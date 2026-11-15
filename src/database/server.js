require("dotenv").config();

const express = require("express");
const cors = require("cors");

const bot = require("./bot/bot");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Amana Medium Clinic Telegram Bot API is running"
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {

  console.log(`Server running on port ${PORT}`);

  try {

    await bot.launch();

    console.log("Telegram bot started successfully.");

  } catch (error) {

    console.error(
      "Failed to start Telegram bot:",
      error
    );

  }
});