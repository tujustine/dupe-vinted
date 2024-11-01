const express = require("express");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2; // ATTENTION AU .v2
const cors = require("cors");

require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI);

// configuration de cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const userRouter = require("./routes/user");
app.use(userRouter);

const offerRouter = require("./routes/offer");
app.use(offerRouter);

app.get("/", (req, res) => {
  res.json({ message: "Welcome to Vinted 🛍️" });
});

app.all("*", (req, res) => {
  res.status(404).json({ message: "This route does not exist (ʟooseʀ)" });
});

app.listen(process.env.PORT, () => {
  console.log("Server started 🤑");
});
