const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const app = express();
app.use(express.json());

const bot = new TelegramBot(process.env.BOT_TOKEN);
bot.setWebHook(`${process.env.BASE_URL}/bot${process.env.BOT_TOKEN}`);

const OFFERS = [
  "Оффер 1: 100 000 ₸, 0.5% в день, до 30 дней",
  "Оффер 2: 150 000 ₸, 0.3% в день, до 15 дней",
  "Оффер 3: 200 000 ₸, 0.4% в день, до 20 дней",
  "Оффер 4: 250 000 ₸, 0.6% в день, до 10 дней"
];

const userStates = {};

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId] || text.toLowerCase() === "/start") {
    userStates[chatId] = { step: 1 };
    bot.sendMessage(chatId, "Здравствуйте! Сколько денег вам нужно?");
    return;
  }

  const user = userStates[chatId];

  if (user.step === 1) {
    user.amount = text;
    user.step = 2;
    bot.sendMessage(chatId, "Есть ли у вас просрочки?", {
      reply_markup: {
        keyboard: [["Да"], ["Нет"]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  } else if (user.step === 2) {
    user.overdue = text;
    user.step = 3;
    bot.sendMessage(chatId, "Вы сейчас трудоустроены?", {
      reply_markup: {
        keyboard: [["Трудоустроен"], ["Не работаю"], ["Студент"], ["Пенсионер"]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  } else if (user.step === 3) {
    user.jobStatus = text;
    user.step = 4;
    bot.sendMessage(chatId, "Укажите ваш возраст:", {
      reply_markup: {
        keyboard: [["18 - 24"], ["25 - 45"], ["45+"]],
        resize_keyboard: true,
        one_time_keyboard: true
      }
    });
  } else if (user.step === 4) {
    user.age = text;
    const randomOffers = OFFERS.sort(() => 0.5 - Math.random()).slice(0, 2);
    bot.sendMessage(chatId, `Вот предложения для вас:\n\n${randomOffers.join("\n\n")}`);
    delete userStates[chatId];
  }
});

app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("Bot is working with webhook!");
});

module.exports = app;
