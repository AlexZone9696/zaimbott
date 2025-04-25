const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const OFFERS = [
  { title: "Займ до 100 000 ₸", url: "https://example.com/offer1" },
  { title: "Моментальный займ 150 000 ₸", url: "https://example.com/offer2" },
  { title: "До 200 000 ₸ без проверок", url: "https://example.com/offer3" },
  { title: "До 250 000 ₸ за 5 минут", url: "https://example.com/offer4" }
];

const userStates = {};
const usersFile = path.join(__dirname, "users.txt");

function saveUserId(chatId) {
  fs.readFile(usersFile, "utf8", (err, data) => {
    const users = data ? data.split("\n") : [];
    if (!users.includes(chatId.toString())) {
      users.push(chatId);
      fs.writeFile(usersFile, users.join("\n"), () => {});
    }
  });
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const name = msg.from.first_name;

  saveUserId(chatId);

  if (!userStates[chatId] || text === "/start") {
    if (userStates[chatId]?.lastBotMessageId) {
      bot.deleteMessage(chatId, userStates[chatId].lastBotMessageId).catch(() => {});
    }
    userStates[chatId] = { step: "start" };

    const hello = await bot.sendMessage(chatId, `Здравствуйте, ${name}!\n\nСрочно нужны деньги?\nЯ помогу вам подобрать займ за 1 минуту. Просто ответьте на несколько вопросов, и я подберу для вас самые выгодные предложения.`);
    userStates[chatId].lastBotMessageId = hello.message_id;

    const button = await bot.sendMessage(chatId, "Нажмите кнопку ниже, чтобы начать:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Подобрать займ", callback_data: "start_loan" }]
        ]
      }
    });
    userStates[chatId].lastBotMessageId = button.message_id;
    return;
  }

  const user = userStates[chatId];
  user.lastUserMessageId = msg.message_id;

  if (user.step === "amount") {
    const amount = parseInt(text.replace(/\D/g, ""));

    if (
      isNaN(amount) ||
      amount < 10000 ||
      amount > 500000 ||
      amount % 10000 !== 0
    ) {
      const warn = await bot.sendMessage(chatId, "Введите сумму от 10 000 до 500 000 тенге, шагом 10 000.");
      if (user.lastBotMessageId) bot.deleteMessage(chatId, user.lastBotMessageId).catch(() => {});
      user.lastBotMessageId = warn.message_id;
      return;
    }

    user.amount = amount;
    user.step = "overdue";
    if (user.lastUserMessageId) bot.deleteMessage(chatId, user.lastUserMessageId).catch(() => {});
    if (user.lastBotMessageId) bot.deleteMessage(chatId, user.lastBotMessageId).catch(() => {});
    const msgSent = await bot.sendMessage(chatId, "Есть ли у вас просрочки?", {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Да", callback_data: "overdue_yes" },
            { text: "Нет", callback_data: "overdue_no" }
          ]
        ]
      }
    });
    user.lastBotMessageId = msgSent.message_id;
  }
});

bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const user = userStates[chatId] || {};

  saveUserId(chatId);

  if (user.lastBotMessageId) {
    bot.deleteMessage(chatId, user.lastBotMessageId).catch(() => {});
  }

  if (data === "start_loan") {
    userStates[chatId] = { step: "amount" };
    const ask = await bot.sendMessage(chatId, "Какая сумма вас интересует?");
    userStates[chatId].lastBotMessageId = ask.message_id;
    return;
  }

  if (data.startsWith("overdue_")) {
    user.overdue = data === "overdue_yes" ? "Да" : "Нет";
    user.step = "job";

    const msgSent = await bot.sendMessage(chatId, "Вы сейчас трудоустроены?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Трудоустроен", callback_data: "job_working" }],
          [{ text: "Не работаю", callback_data: "job_unemployed" }],
          [{ text: "Студент", callback_data: "job_student" }],
          [{ text: "Пенсионер", callback_data: "job_pensioner" }]
        ]
      }
    });
    user.lastBotMessageId = msgSent.message_id;
    return;
  }

  if (data.startsWith("job_")) {
    user.job = data.replace("job_", "");
    user.step = "age";

    const msgSent = await bot.sendMessage(chatId, "Укажите ваш возраст:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "18 - 24", callback_data: "age_18_24" }],
          [{ text: "25 - 45", callback_data: "age_25_45" }],
          [{ text: "45+", callback_data: "age_45_plus" }]
        ]
      }
    });
    user.lastBotMessageId = msgSent.message_id;
    return;
  }

  if (data.startsWith("age_")) {
    user.age = data.replace("age_", "").replace("_", " - ");
    user.step = "reason";

    const msgSent = await bot.sendMessage(chatId, "Для каких целей вам необходимы деньги?", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Погашение долга", callback_data: "reason_debt" }],
          [{ text: "Покупка товаров", callback_data: "reason_goods" }],
          [{ text: "Непредвиденные расходы", callback_data: "reason_emergency" }],
          [{ text: "Другое", callback_data: "reason_other" }]
        ]
      }
    });
    user.lastBotMessageId = msgSent.message_id;
    return;
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

    const waitMsg = await bot.sendMessage(chatId, "Спасибо! Обрабатываю ваши данные и подбираю займ...");
    user.lastBotMessageId = waitMsg.message_id;

    await new Promise(resolve => setTimeout(resolve, 10000));

    const randomOffers = OFFERS.sort(() => 0.5 - Math.random()).slice(0, 2);

    const result = await bot.sendMessage(chatId,
      `Подобрал для вас два предложения с наивысшим шансом на одобрение!\n\n` +
      `Доступно: ${user.amount}₸\n` +
      `Для клиентов без просрочек\n\n` +
      `⌛Предложение действительно 30 минут`, {
        reply_markup: {
          inline_keyboard: randomOffers.map((offer) => [
            { text: offer.title, url: offer.url }
          ])
        }
      }
    );

    user.lastBotMessageId = result.message_id;
    delete userStates[chatId];
  }
});

// Рассылка рекламы каждые 10 минут
setInterval(() => {
  fs.readFile(usersFile, "utf8", async (err, data) => {
    if (err || !data) return;
    const users = data.split("\n").filter(Boolean);
    for (const chatId of users) {
      try {
        await bot.sendMessage(chatId, "🔥 Новый займ с одобрением 95%! Получите деньги за 5 минут!\n\nОформить: https://example.com/promo");
      } catch (e) {
        console.log(`Не удалось отправить ${chatId}:`, e.message);
      }
    }
  });
}, 10 * 60 * 1000);
