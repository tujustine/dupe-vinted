const express = require("express");
const Offer = require("../models/Offer");
const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2; // ATTENTION AU .v2
const convertToBase64 = require("../utils/convertToBase64");
//import de mon middleware
const isAuthenticated = require("../middlewares/isAuthenticated");

const router = express.Router();

// poster une annonce
// le user doit être authentifié
router.post(
  "/offer/publish",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      const { title, description, price, brand, size, condition, color, city } =
        req.body;

      const newOffer = new Offer({
        product_name: title,
        product_description: description,
        product_price: price,
        product_details: [
          { MARQUE: brand },
          { TAILLE: size },
          { ETAT: condition },
          { COULEUR: color },
          { EMPLACEMENT: city },
        ],
        owner: req.user.id,
      });

      // await newOffer.save();

      if (
        !title ||
        !description ||
        !price ||
        !brand ||
        !city ||
        !size ||
        !condition ||
        !color ||
        !req.files.picture
      ) {
        return res.status(400).json({ message: "Required fields missing 🤨" });
      }

      if (req.files === null || req.files.picture.length === 0) {
        return res.send("No file uploaded!");
      }

      const picturesToUpload = req.files.picture;

      if (Array.isArray(picturesToUpload)) {
        // TODO : a améliorer avec Promise.all
        const arrayOfFilesUrl = [];
        for (const picture of picturesToUpload) {
          const result = await cloudinary.uploader.upload(
            convertToBase64(picture),
            { folder: `vinted/offers/${newOffer.id}` }
          );
          arrayOfFilesUrl.push(result);
        }
        newOffer.product_image = arrayOfFilesUrl;
      } else {
        const convertedPicture = convertToBase64(req.files.picture);
        newOffer.product_image = await cloudinary.uploader.upload(
          convertedPicture,
          {
            folder: `vinted/offers/${newOffer.id}`,
          }
        );
      }

      await newOffer.save();

      return res
        .status(201)
        .json(await Offer.find(newOffer).populate("owner", "account id"));
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// modifier une annonce
router.put(
  "/offer/modify/:offerId",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      // vérifier que l'annonce est bien celle du user
      const offerToModify = await Offer.findOne({
        _id: req.params.offerId,
        owner: req.user.id,
      });

      if (!offerToModify) {
        return res.status(400).json({ message: "Bad Request" });
      }

      const { title, description, price, condition, city, brand, size, color } =
        req.body;

      if (
        !title ||
        !description ||
        !price ||
        !brand ||
        !city ||
        !size ||
        !condition ||
        !color ||
        !req.files.picture
      ) {
        return res.status(400).json({ message: "Required fields missing 🤨" });
      } else if (price === "0" && price > "100000") {
        return res
          .status(400)
          .json({ message: "Please enter a price between 1 and 100000" });
      } else {
        offerToModify.product_name = title;
        offerToModify.product_description = description;
        offerToModify.product_details = [
          { MARQUE: brand },
          { TAILLE: size },
          { ETAT: condition },
          { COULEUR: color },
          { EMPLACEMENT: city },
        ];
        offerToModify.product_price = Number(price);

        // gérer picture : tout vider et remettre
        const pathLength =
          offerToModify.product_image[0].public_id.split("/").length;

        const picturePath = offerToModify.product_image[0].public_id
          .split("/")
          .slice(0, pathLength - 1)
          .join("/");

        await cloudinary.api.delete_resources_by_prefix(picturePath);
        // await cloudinary.api.delete_folder(picturePath);

        const picturesToUpload = req.files.picture;

        if (Array.isArray(picturesToUpload)) {
          // TODO : a améliorer avec Promise.all
          const arrayOfFilesUrl = [];
          for (const picture of picturesToUpload) {
            const result = await cloudinary.uploader.upload(
              convertToBase64(picture),
              { folder: `vinted/offers/${offerToModify.id}` }
            );
            arrayOfFilesUrl.push(result);
          }
          offerToModify.product_image = arrayOfFilesUrl;
        } else {
          const convertedPicture = convertToBase64(req.files.picture);
          offerToModify.product_image = await cloudinary.uploader.upload(
            convertedPicture,
            {
              folder: `vinted/offers/${offerToModify.id}`,
            }
          );
        }

        await offerToModify.save();
        return res.status(200).json({ message: "Post modified 🥸" });
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// supprimer une annonce
router.delete(
  "/offer/delete/:offerId",
  isAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      // vérifier que l'annonce est bien celle du user
      const offerToDelete = await Offer.findOne({
        _id: req.params.offerId,
        owner: req.user.id,
      });

      if (!offerToDelete) {
        return res.status(400).json({ message: "Bad Request" });
      } else {
        // picturePublicID =
        //   offerToDelete.product_image[0].public_id.split("/")[2];
        const pathLength =
          offerToDelete.product_image[0].public_id.split("/").length;

        const picturePath = offerToDelete.product_image[0].public_id
          .split("/")
          .slice(0, pathLength - 1)
          .join("/");

        // on supprimer les images contenu dans notre dossier
        await cloudinary.api.delete_resources_by_prefix(picturePath);
        // on supprime le dossier vide
        await cloudinary.api.delete_folder(picturePath);

        await Offer.deleteOne(offerToDelete);
        res.status(201).json({ message: "Offer deleted 🥲" });
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// affichage des annonces filtrées
router.get("/offers", async (req, res) => {
  try {
    const { title, priceMin, priceMax, sort, page } = req.query;

    const limitOfferPerPage = 3;
    const filters = {};

    if (title) {
      filters.product_name = new RegExp(title, "i");
    }

    if (priceMin || priceMax) {
      filters.product_price = {};
      if (priceMin) {
        filters.product_price = { $gte: Number(priceMin) };
      }
      if (priceMax) {
        filters.product_price = { $lte: Number(priceMax) };
      }
    }

    const sortOption = {};
    if (sort === "price-desc") {
      sortOption.product_price = -1;
    } else if (sort === "price-asc") {
      sortOption.product_price = 1;
    }

    const pageNumber = Number(page) || 1;
    const offerToSkip = (pageNumber - 1) * limitOfferPerPage;

    const findOffers = await Offer.find(filters)
      .sort(sortOption)
      .skip(offerToSkip)
      .limit(limitOfferPerPage)
      .populate("owner", "account.username account.avatar.secure_url");

    return (
      res
        .status(201)
        // compte tous les documents répondant au filtre
        .json({
          count: await Offer.countDocuments(filters),
          offers: findOffers,
        })
    );
    // if (!findOffer) {
    //   return res.status(400).json({ message: "No result for your request 🫣" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// affichage d'une annonce selon son ID
router.get("/offers/:id", async (req, res) => {
  const findOffer = await Offer.findById(req.params.id).populate(
    "owner",
    "account.username account.avatar"
  );
  if (!findOffer) {
    return res.status(400).json({ message: "No result for your request 🫣" });
  }
  return res.status(201).json(findOffer);
});

module.exports = router;
