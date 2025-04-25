const TelegramBot = require("node-telegram-bot-api");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const OFFERS = [
  { title: "Займ до 100 000 ₸", url: "https://example.com/offer1" },
  { title: "Моментальный займ 150 000 ₸", url: "https://example.com/offer2" },
  { title: "До 200 000 ₸ без проверок", url: "https://example.com/offer3" },
  { title: "До 250 000 ₸ за 5 минут", url: "https://example.com/offer4" }
];

const userStates = {};

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const name = msg.from.first_name;

  if (!userStates[chatId] || text === "/start") {
    userStates[chatId] = { step: "start" };

    await bot.sendMessage(chatId, `Здравствуйте, ${name}!\n\nСрочно нужны деньги?\nЯ помогу вам подобрать займ за 1 минуту. Просто ответьте на несколько вопросов, и я подберу для вас самые выгодные предложения.`);

    return bot.sendMessage(chatId, "Нажмите кнопку ниже, чтобы начать:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Подобрать займ", callback_data: "start_loan" }]
        ]
      }
    });
  }

  const user = userStates[chatId];

  if (user.step === "amount") {
    user.amount = text;
    user.step = "overdue";
    return bot.sendMessage(chatId, "Есть ли у вас просрочки?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Да", callback_data: "overdue_yes" }, { text: "Нет", callback_data: "overdue_no" }]
        ]
      }
    });
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const user = userStates[chatId] || {};

  if (data === "start_loan") {
    userStates[chatId] = { step: "amount" };
    return bot.sendMessage(chatId, "Какая сумма вас интересует?");
  }

  if (data.startsWith("overdue_")) {
    user.overdue = data === "overdue_yes" ? "Да" : "Нет";
    user.step = "job";
    return bot.sendMessage(chatId, "Вы сейчас трудоустроены?", {
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
    user.job = data.replace("job_", "");
    user.step = "age";
    return bot.sendMessage(chatId, "Укажите ваш возраст:", {
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
    user.step = "reason";
    return bot.sendMessage(chatId, "Для каких целей вам необходимы деньги?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Погашение долга", callback_data: "reason_debt" }],
          [{ text: "Покупка товаров", callback_data: "reason_goods" }],
          [{ text: "Непредвиденные расходы", callback_data: "reason_emergency" }],
          [{ text: "Другое", callback_data: "reason_other" }]
        ]
      }
    });
  }

  if (data.startsWith("reason_")) {
    const reasons = {
      debt: "Погашение долга",
      goods: "Покупка товаров",
      emergency: "Непредвиденные расходы",
      other: "Другое"
    };
    user.reason = reasons[data.replace("reason_", "")];
    user.step = "processing";

    await bot.sendMessage(chatId, "Спасибо! Обрабатываю ваши данные и подбираю займ...");
    await new Promise(resolve => setTimeout(resolve, 10000));

    const randomOffers = OFFERS.sort(() => 0.5 - Math.random()).slice(0, 4);

    await bot.sendMessage(chatId, "Спасибо за ожидание! Вот предложения для вас:", {
      reply_markup: {
        inline_keyboard: randomOffers.map((offer) => [
          { text: offer.title, url: offer.url }
        ])
      }
    });

    delete userStates[chatId];
  }
});
