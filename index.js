const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");

// Инициализируем бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Список офферов
const OFFERS = [
  { title: "Займ до 100 000 ₸", url: "https://example.com/offer1" },
  { title: "Моментальный займ 150 000 ₸", url: "https://example.com/offer2" },
  { title: "До 200 000 ₸ без проверок", url: "https://example.com/offer3" },
  { title: "До 250 000 ₸ за 5 минут", url: "https://example.com/offer4" }
];

// Хранение состояний пользователей
const userStates = {};

// Путь к файлу с ID пользователей
const usersFile = path.join(__dirname, "users.txt");

/**
 * Сохраняет chatId в файл, если его там ещё нет.
 * При отсутствии файла создаёт новый.
 */
async function saveUserId(chatId) {
  let users = [];
  try {
    const data = await fs.promises.readFile(usersFile, "utf8");
    users = data.split("\n").filter(Boolean);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error("Ошибка чтения файла пользователей:", err);
      return;
    }
    // ENOENT — файл не существует: будем создавать
  }

  const idStr = chatId.toString();
  if (!users.includes(idStr)) {
    users.push(idStr);
    try {
      await fs.promises.writeFile(usersFile, users.join("\n"));
      console.log(`Добавили chatId ${idStr} в ${usersFile}`);
    } catch (err) {
      console.error("Ошибка записи в файл пользователей:", err);
    }
  }
}

// Обработчик входящих текстовых сообщений
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const name = msg.from.first_name;

  // Сохраняем ID (с ожиданием)
  await saveUserId(chatId);

  // Если начало или /start — сбрасываем состояние
  if (!userStates[chatId] || text === "/start") {
    if (userStates[chatId]?.lastBotMessageId) {
      await bot.deleteMessage(chatId, userStates[chatId].lastBotMessageId).catch(() => {});
    }
    userStates[chatId] = { step: "start" };

    const hello = await bot.sendMessage(
      chatId,
      `Здравствуйте, ${name}!\n\nСрочно нужны деньги?\nЯ помогу вам подобрать займ за 1 минуту. Просто ответьте на несколько вопросов.`
    );
    userStates[chatId].lastBotMessageId = hello.message_id;

    const button = await bot.sendMessage(chatId, "Нажмите кнопку ниже, чтобы начать:", {
      reply_markup: {
        inline_keyboard: [[{ text: "Подобрать займ", callback_data: "start_loan" }]]
      }
    });
    userStates[chatId].lastBotMessageId = button.message_id;
    return;
  }

  // Дальнейшая логика, пока только сумма
  const user = userStates[chatId];
  if (user.step === "amount") {
    const amount = parseInt(text.replace(/\D/g, ""), 10);
    if (
      isNaN(amount) ||
      amount < 10000 ||
      amount > 500000 ||
      amount % 10000 !== 0
    ) {
      const warn = await bot.sendMessage(chatId, "Введите сумму от 10 000 до 500 000 ₸ шагом 10 000.");
      if (user.lastBotMessageId) {
        await bot.deleteMessage(chatId, user.lastBotMessageId).catch(() => {});
      }
      user.lastBotMessageId = warn.message_id;
      return;
    }

    // Сохраняем сумму и переходим к следующему шагу
    user.amount = amount;
    user.step = "overdue";
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

// Обработчик нажатий inline-кнопок
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  // Сохраняем ID (с ожиданием)
  await saveUserId(chatId);

  // Удаляем предыдущее бот-сообщение
  const user = userStates[chatId] || {};
  if (user.lastBotMessageId) {
    await bot.deleteMessage(chatId, user.lastBotMessageId).catch(() => {});
  }

  // Старт подбора займа
  if (data === "start_loan") {
    userStates[chatId] = { step: "amount" };
    const ask = await bot.sendMessage(chatId, "Какая сумма вас интересует?");
    userStates[chatId].lastBotMessageId = ask.message_id;
    return;
  }

  // Обработка ответа по просрочкам
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

  // Продолжайте аналогично для job_, age_, reason_ и финального шага…
});

// Рассылка рекламы каждые 10 минут
setInterval(async () => {
  let data;
  try {
    data = await fs.promises.readFile(usersFile, "utf8");
  } catch {
    return; // файл не создан — никому не шлём
  }
  const users = data.split("\n").filter(Boolean);
  for (const chatId of users) {
    try {
      await bot.sendMessage(
        chatId,
        "🔥 Новый займ с одобрением 95%! Получите деньги за 5 минут!\n\nОформить: https://example.com/promo"
      );
    } catch (e) {
      console.error(`Не удалось отправить ${chatId}:`, e.message);
    }
  }
}, 10 * 60 * 1000);
