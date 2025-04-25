const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const OFFERS = [
  { title: "Займ до 100 000 ₸", url: "https://example.com/offer1" },
  { title: "Моментальный займ 150 000 ₸", url: "https://example.com/offer2" },
  { title: "До 200 000 ₸ без проверок", url: "https://example.com/offer3" },
  { title: "До 250 000 ₸ за 5 минут", url: "https://example.com/offer4" }
];

const userStates = {};

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!userStates[chatId] || text.toLowerCase() === "/start") {
    userStates[chatId] = { step: 1 };
    bot.sendMessage(chatId, "Здравствуйте!\n\nСколько денег вам нужно?", {
      reply_markup: {
        force_reply: true,
        remove_keyboard: true
      }
    });
    return;
  }

  const user = userStates[chatId];

  if (user.step === 1) {
    user.amount = text;
    user.step = 2;
    bot.sendMessage(chatId, "Есть ли у вас просрочки?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Да", callback_data: "overdue_yes" }, { text: "Нет", callback_data: "overdue_no" }]
        ]
      }
    });
  }
});

bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const user = userStates[chatId] || {};

  if (data === "overdue_yes" || data === "overdue_no") {
    user.overdue = data === "overdue_yes" ? "Да" : "Нет";
    user.step = 3;
    userStates[chatId] = user;

    bot.editMessageText("Есть ли у вас просрочки?\nОтвет: " + user.overdue, {
      chat_id: chatId,
      message_id: query.message.message_id
    });

    bot.sendMessage(chatId, "Вы сейчас трудоустроены?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Трудоустроен", callback_data: "job_working" }],
          [{ text: "Не работаю", callback_data: "job_unemployed" }],
          [{ text: "Студент", callback_data: "job_student" }],
          [{ text: "Пенсионер", callback_data: "job_pensioner" }]
        ]
      }
    });
  }

  if (data.startsWith("job_")) {
    user.jobStatus = data.replace("job_", "");
    user.step = 4;
    userStates[chatId] = user;

    const jobTitles = {
      working: "Трудоустроен",
      unemployed: "Не работаю",
      student: "Студент",
      pensioner: "Пенсионер"
    };

    bot.editMessageText("Вы сейчас трудоустроены?\nОтвет: " + jobTitles[user.jobStatus], {
      chat_id: chatId,
      message_id: query.message.message_id
    });

    bot.sendMessage(chatId, "Укажите ваш возраст:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "18 - 24", callback_data: "age_18_24" }],
          [{ text: "25 - 45", callback_data: "age_25_45" }],
          [{ text: "45+", callback_data: "age_45_plus" }]
        ]
      }
    });
  }

  if (data.startsWith("age_")) {
    user.age = data.replace("age_", "").replace("_", " - ");
    user.step = 5;
    userStates[chatId] = user;

    const randomOffers = OFFERS.sort(() => 0.5 - Math.random()).slice(0, 2);

    bot.editMessageText("Возраст: " + user.age, {
      chat_id: chatId,
      message_id: query.message.message_id
    });

    bot.sendMessage(chatId, "Вот предложения для вас:", {
      reply_markup: {
        inline_keyboard: randomOffers.map((offer) => [
          { text: offer.title, url: offer.url }
        ])
      }
    });

    delete userStates[chatId]; // Сбросить состояние после окончания диалога
  }
});
