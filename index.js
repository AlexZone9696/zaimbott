const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const app = express();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const OFFERS = [
  "Оффер 1: 100 000 ₸, 0.5% в день, до 30 дней",
  "Оффер 2: 150 000 ₸, 0.3% в день, до 15 дней",
  "Оффер 3: 200 000 ₸, 0.4% в день, до 20 дней",
  "Оффер 4: 250 000 ₸, 0.6% в день, до 10 дней"
];

const userStates = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userStates[chatId] = {};
  bot.sendMessage(chatId, "Здравствуйте! Сколько денег вам нужно?", {
    reply_markup: { force_reply: true }
  });
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  const state = userStates[chatId];
  if (!state) return;

  if (!state.amount) {
    state.amount = text;
    bot.sendMessage(chatId, "Есть ли у вас просрочки?", {
      reply_markup: {
        keyboard: [["Да"], ["Нет"]],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  } else if (!state.overdue) {
    state.overdue = text;
    bot.sendMessage(chatId, "Вы сейчас трудоустроены?", {
      reply_markup: {
        keyboard: [["Трудоустроен"], ["Не работаю"], ["Студент"], ["Пенсионер"]],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  } else if (!state.jobStatus) {
    state.jobStatus = text;
    bot.sendMessage(chatId, "Укажите ваш возраст:", {
      reply_markup: {
        keyboard: [["18 - 24"], ["25 - 45"], ["45+"]],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    });
  } else if (!state.age) {
    state.age = text;

    const randomOffers = OFFERS.sort(() => 0.5 - Math.random()).slice(0, 2);
    bot.sendMessage(chatId, `Вот предложения для вас:\n\n${randomOffers.join("\n\n")}`);
    delete userStates[chatId];
  }
});

app.get("/", (req, res) => {
  res.send("Бот работает!");
});

module.exports = app;
