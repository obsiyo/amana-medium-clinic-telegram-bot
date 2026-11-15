
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

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

async function startBot() {
  try {
    await bot.launch();
    console.log("Telegram bot started successfully.");
  } catch (error) {
    console.error("Failed to start Telegram bot:", error);
    process.exit(1);
  }
}

startBot();

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down...`);

  try {
    bot.stop(signal);
  } catch (error) {
    console.error("Bot shutdown error:", error);
  }

  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
