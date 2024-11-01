const express = require("express");
const User = require("../models/User");
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const cloudinary = require("cloudinary").v2; // ATTENTION AU .v2
const fileUpload = require("express-fileupload");
const convertToBase64 = require("../utils/convertToBase64");

const router = express.Router();

// inscription
router.post("/user/signup", fileUpload(), async (req, res) => {
  try {
    if (!req.body.username) {
      return res.status(400).json({ error: "Enter a username 😾" });
    } else if (!req.body.password) {
      return res.status(400).json({ error: "Enter a password 😾" });
    } else if (!req.body.email) {
      return res.status(400).json({ error: "Enter an email 😾" });
    }

    const findUser = await User.findOne({ email: req.body.email });

    if (!findUser) {
      let userPassword = req.body.password;
      const salt = uid2(16);
      const hash = SHA256(userPassword + salt).toString(encBase64);
      const token = uid2(64);

      const newUser = new User({
        email: req.body.email,
        account: {
          username: req.body.username,
        },
        newsletter: req.body.newsletter,
        token: token,
        hash: hash,
        salt: salt,
      });

      await newUser.save();

      const convertedPicture = convertToBase64(req.files.picture);
      newUser.account.avatar = await cloudinary.uploader.upload(
        convertedPicture,
        {
          folder: `vinted/users/${newUser.id}`,
        }
      );

      await newUser.save();

      //   const userDisplay = await User.findOne(newUser).select(
      //     "_id token account"
      //   );

      //   return res.status(201).json(userDisplay);
      return res.status(201).json({
        _id: newUser._id,
        token: newUser.token,
        account: newUser.account,
      });
    } else {
      return res.status(409).json({ message: "User already exists 🙃" });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// login
router.post("/user/login", async (req, res) => {
  try {
    const findUser = await User.findOne({ email: req.body.email });

    if (findUser) {
      let userPassword = req.body.password;
      const salt = findUser.salt;
      const hash = SHA256(userPassword + salt).toString(encBase64);
      if (hash === findUser.hash) {
        // const userDisplay = await User.findOne({
        //   email: req.body.email,
        // }).select("_id token account");

        // return res.status(201).json(userDisplay);

        return res.status(201).json({
          _id: findUser._id,
          token: findUser.token,
          account: findUser.account,
        });
      } else {
        return res.status(401).json({ message: "Wrong password 😵" });
      }
    } else {
      return res
        .status(400)
        .json({ message: "Aucun compte à cette adresse 🙄" });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
