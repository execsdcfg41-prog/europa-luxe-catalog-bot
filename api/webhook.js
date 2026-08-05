const { google } = require('googleapis');
const { Redis } = require('@upstash/redis');

// ==================== КОНФИГУРАЦИЯ ====================

// Токен вставлен как значение по умолчанию, но лучше продублировать
// его в Vercel → Settings → Environment Variables как BOT_TOKEN
// (так он не будет "жить" в открытом виде в коде на GitHub).
const TOKEN = process.env.BOT_TOKEN || '8960862027:AAG38D3zyfPSPWDPOkozeaJNLoL0IERW7xY';

const SHEET_ID = process.env.SHEET_ID; // та же таблица, что и у бота для сотрудников

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Уведомления о новых заявках — chat_id сотрудников/группы (через запятую)
const ADMIN_CHAT_IDS = (process.env.ADMIN_CHAT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);

const CLIENTS_SHEET = 'Клиенты';
const CATALOG_SHEET = 'Каталог';
const ORDERS_SHEET = 'Заказы';

const BRANCHES = [
  'Elegance Ц1',
  'Elegance Istiroxat',
  'Europa Luxe Kazakhstan',
  'Europa Luxe Modera',
  'Europa Luxe Генерал Узоков',
];

// ==================== ЛОКАЛИЗАЦИЯ ====================

const T = {
  ru: {
    shareContact: '📱 Отправить номер телефона',
    askContact: '👋 Добро пожаловать в Europa Luxe & Elegance!\n\nЧтобы открыть каталог, поделитесь номером телефона:',
    resetDone: '🔄 Готово, забыл ваш номер. Напишите /start, чтобы привязать бота заново.',
    contactSaved: (name) => `✅ Спасибо${name ? ', ' + name : ''}! Теперь вам доступен каталог.`,
    mainMenu: 'Главное меню. Что хотите сделать?',
    btnCatalog: '📖 Каталог',
    btnCart: '🛒 Корзина',
    btnMyOrders: '📦 Мои заказы',
    btnLang: '🌐 Язык / Til',
    chooseCategory: '📖 Выберите категорию:',
    noCategories: 'Каталог пока пуст. Загляните позже.',
    chooseProduct: (cat) => `Категория: ${cat}\nВыберите товар:`,
    backToCategories: '⬅️ К категориям',
    addToCart: '🛒 Добавить в корзину',
    addedToCart: (name) => `✅ «${name}» добавлен в корзину.`,
    productCard: (p) => `🛍 ${p.name}\n\n${p.desc ? p.desc + '\n\n' : ''}💵 ${formatPrice(p.price)}`,
    cartEmpty: '🛒 Корзина пуста.\n\nЗагляните в каталог, чтобы что-то выбрать.',
    cartHeader: '🛒 Ваша корзина:\n\n',
    cartLine: (name, qty, sum) => `• ${name} × ${qty} = ${formatPrice(sum)}`,
    cartTotal: (sum) => `\n\n💰 Итого: ${formatPrice(sum)}`,
    btnCheckout: '✅ Оформить заказ',
    btnClearCart: '🗑 Очистить корзину',
    btnRemoveItem: (name) => `❌ Убрать: ${name}`,
    cartCleared: '🗑 Корзина очищена.',
    chooseBranch: 'В каком филиале хотите получить заказ?',
    orderConfirm: (name, phone, branch, itemsText, total) =>
      `Проверьте заявку:\n\n👤 ${name}\n📞 ${phone}\n🏬 ${branch}\n\n${itemsText}\n💰 Итого: ${formatPrice(total)}\n\nПодтвердить?`,
    btnConfirmOrder: '✅ Подтвердить',
    btnCancelOrder: '❌ Отмена',
    orderPlaced: (id) => `🎉 Заявка №${id} принята! Мы свяжемся с вами для подтверждения.`,
    orderCancelled: 'Оформление отменено.',
    myOrdersEmpty: 'У вас пока нет заявок.',
    myOrdersHeader: '📦 Ваши заявки:\n\n',
    myOrderLine: (id, date, branch, total, status) =>
      `№${id} от ${date}\n🏬 ${branch} · 💰 ${formatPrice(total)}\nСтатус: ${status}\n`,
    chooseLang: 'Выберите язык интерфейса:',
    langSetRu: '✅ Язык изменён на русский.',
    langSetUz: "✅ Til o'zbekchaga o'zgartirildi.",
  },
  uz: {
    shareContact: '📱 Telefon raqamni yuborish',
    askContact: "👋 Europa Luxe & Elegance botiga xush kelibsiz!\n\nKatalogni ochish uchun telefon raqamingizni ulashing:",
    resetDone: "🔄 Tayyor, raqamingizni unutdim. Botni qayta ulash uchun /start yozing.",
    contactSaved: (name) => `✅ Rahmat${name ? ', ' + name : ''}! Endi katalog sizga ochiq.`,
    mainMenu: 'Asosiy menyu. Nima qilmoqchisiz?',
    btnCatalog: '📖 Katalog',
    btnCart: '🛒 Savat',
    btnMyOrders: '📦 Buyurtmalarim',
    btnLang: '🌐 Til / Язык',
    chooseCategory: '📖 Kategoriyani tanlang:',
    noCategories: "Katalog hozircha bo'sh. Keyinroq qayting.",
    chooseProduct: (cat) => `Kategoriya: ${cat}\nMahsulotni tanlang:`,
    backToCategories: '⬅️ Kategoriyalarga',
    addToCart: "🛒 Savatga qo'shish",
    addedToCart: (name) => `✅ «${name}» savatga qo'shildi.`,
    productCard: (p) => `🛍 ${p.name}\n\n${p.desc ? p.desc + '\n\n' : ''}💵 ${formatPrice(p.price)}`,
    cartEmpty: "🛒 Savat bo'sh.\n\nKatalogdan mahsulot tanlang.",
    cartHeader: '🛒 Sizning savatingiz:\n\n',
    cartLine: (name, qty, sum) => `• ${name} × ${qty} = ${formatPrice(sum)}`,
    cartTotal: (sum) => `\n\n💰 Jami: ${formatPrice(sum)}`,
    btnCheckout: '✅ Buyurtma berish',
    btnClearCart: '🗑 Savatni tozalash',
    btnRemoveItem: (name) => `❌ O'chirish: ${name}`,
    cartCleared: "🗑 Savat tozalandi.",
    chooseBranch: 'Qaysi filialdan olmoqchisiz?',
    orderConfirm: (name, phone, branch, itemsText, total) =>
      `Buyurtmani tekshiring:\n\n👤 ${name}\n📞 ${phone}\n🏬 ${branch}\n\n${itemsText}\n💰 Jami: ${formatPrice(total)}\n\nTasdiqlaysizmi?`,
    btnConfirmOrder: '✅ Tasdiqlash',
    btnCancelOrder: '❌ Bekor qilish',
    orderPlaced: (id) => `🎉 №${id} buyurtma qabul qilindi! Tasdiqlash uchun siz bilan bog'lanamiz.`,
    orderCancelled: 'Buyurtma bekor qilindi.',
    myOrdersEmpty: "Sizda hali buyurtmalar yo'q.",
    myOrdersHeader: '📦 Buyurtmalaringiz:\n\n',
    myOrderLine: (id, date, branch, total, status) =>
      `№${id} — ${date}\n🏬 ${branch} · 💰 ${formatPrice(total)}\nHolat: ${status}\n`,
    chooseLang: 'Interfeys tilini tanlang:',
    langSetRu: '✅ Язык изменён на русский.',
    langSetUz: "✅ Til o'zbekchaga o'zgartirildi.",
  },
};

function formatPrice(n) {
  n = Number(n) || 0;
  return n.toLocaleString('ru-RU') + ' сум';
}

// ==================== СЕССИЯ (Redis) ====================
// profile — постоянно (нет TTL), state/cart — на 6 часов

async function getProfile(chatId) {
  return (await redis.get(`catalog_profile:${chatId}`)) || null;
}
async function setProfile(chatId, profile) {
  await redis.set(`catalog_profile:${chatId}`, profile);
}
async function clearProfile(chatId) {
  await redis.del(`catalog_profile:${chatId}`);
}

async function getLang(chatId) {
  return (await redis.get(`catalog_lang:${chatId}`)) || 'ru';
}
async function setLang(chatId, lang) {
  await redis.set(`catalog_lang:${chatId}`, lang);
}

async function getCart(chatId) {
  return (await redis.get(`catalog_cart:${chatId}`)) || {};
}
async function setCart(chatId, cart) {
  await redis.set(`catalog_cart:${chatId}`, cart, { ex: 21600 });
}
async function clearCart(chatId) {
  await redis.del(`catalog_cart:${chatId}`);
}

async function getState(chatId) {
  return (await redis.get(`catalog_state:${chatId}`)) || null;
}
async function setState(chatId, state) {
  await redis.set(`catalog_state:${chatId}`, state, { ex: 21600 });
}
async function clearState(chatId) {
  await redis.del(`catalog_state:${chatId}`);
}

async function t(chatId, key, ...args) {
  const lang = await getLang(chatId);
  const val = T[lang][key];
  return typeof val === 'function' ? val(...args) : val;
}

// ==================== GOOGLE SHEETS ====================

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

// Создаёт листы "Каталог" и "Заказы", если их ещё нет в таблице
// (проверяется один раз и кешируется в Redis на сутки, чтобы не дёргать API на каждый запрос)
async function ensureSheetsExist() {
  const ready = await redis.get('catalog_sheets_ready');
  if (ready) return;

  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const titles = meta.data.sheets.map((s) => s.properties.title);

  const requests = [];
  if (!titles.includes(CATALOG_SHEET)) {
    requests.push({ addSheet: { properties: { title: CATALOG_SHEET } } });
  }
  if (!titles.includes(ORDERS_SHEET)) {
    requests.push({ addSheet: { properties: { title: ORDERS_SHEET } } });
  }
  if (requests.length) {
    await sheets.spreadsheets.batchUpdate({ spreadsheetId: SHEET_ID, requestBody: { requests } });
  }
  if (!titles.includes(CATALOG_SHEET)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${CATALOG_SHEET}!A1:G1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['ID', 'Категория', 'Название', 'Описание', 'Цена', 'Фото (URL)', 'Активен']] },
    });
  }
  if (!titles.includes(ORDERS_SHEET)) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${ORDERS_SHEET}!A1:H1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['ID', 'Дата', 'Клиент', 'Телефон', 'Филиал', 'Товары', 'Итого', 'Статус']] },
    });
  }

  await redis.set('catalog_sheets_ready', '1', { ex: 86400 });
}

function digitsOnly(phone) {
  return (phone || '').replace(/\D/g, '');
}

function normalizePhone(text) {
  let cleaned = text.replace(/[\s()\-]/g, '');
  if (/^\+998\d{9}$/.test(cleaned)) return cleaned;
  if (/^998\d{9}$/.test(cleaned)) return '+' + cleaned;
  if (/^9\d{8}$/.test(cleaned)) return '+998' + cleaned;
  return '+' + digitsOnly(text);
}

async function findClientByPhone(phone) {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${CLIENTS_SHEET}!A:E` });
  const rows = result.data.values || [];
  const targetDigits = digitsOnly(phone);
  for (let i = 1; i < rows.length; i++) {
    if (digitsOnly(rows[i][2]) === targetDigits) {
      return { name: rows[i][1] || '', phone: rows[i][2] || phone };
    }
  }
  return null;
}

async function addClientIfMissing(name, phone) {
  const sheets = await getSheetsClient();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${CLIENTS_SHEET}!A:E`,
    valueInputOption: 'RAW',
    requestBody: { values: [[new Date().toLocaleString('ru-RU'), name, phone, '-', 'новый клиент (бот-каталог)']] },
  });
}

async function getCategories() {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${CATALOG_SHEET}!A:G` });
  const rows = (result.data.values || []).slice(1);
  const cats = [];
  rows.forEach((r) => {
    const active = String(r[6] || '').toLowerCase();
    const isActive = active === '' || active === 'да' || active === 'ha' || active === 'true';
    if (r[1] && isActive && !cats.includes(r[1])) cats.push(r[1]);
  });
  return cats;
}

async function getAllProducts() {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${CATALOG_SHEET}!A:G` });
  const rows = (result.data.values || []).slice(1);
  return rows
    .filter((r) => r[0])
    .map((r) => ({ id: String(r[0]), category: r[1], name: r[2], desc: r[3], price: Number(r[4]) || 0, photoUrl: r[5] }));
}

async function getProductsByCategory(category) {
  const all = await getAllProducts();
  return all.filter((p) => p.category === category);
}

async function getProductById(id) {
  const all = await getAllProducts();
  return all.find((p) => p.id === String(id)) || null;
}

async function addOrder(name, phone, branch, itemsText, total) {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${ORDERS_SHEET}!A:A` });
  const id = (result.data.values || []).length; // header = row1 -> next id = rows count
  const date = new Date().toLocaleString('ru-RU');
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${ORDERS_SHEET}!A:H`,
    valueInputOption: 'RAW',
    requestBody: { values: [[id, date, name, phone, branch, itemsText, total, 'Новый']] },
  });
  return id;
}

async function getOrdersByPhone(phone) {
  const sheets = await getSheetsClient();
  const result = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${ORDERS_SHEET}!A:H` });
  const rows = (result.data.values || []).slice(1);
  const targetDigits = digitsOnly(phone);
  return rows
    .filter((r) => digitsOnly(r[3]) === targetDigits)
    .map((r) => ({ id: r[0], date: r[1], branch: r[4], total: r[6], status: r[7] }))
    .reverse();
}

// ==================== TELEGRAM API ====================

async function tg(method, payload) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

async function sendMessage(chatId, text, reply_markup) {
  await tg('sendMessage', { chat_id: chatId, text, reply_markup });
}
async function sendPhoto(chatId, photo, caption, reply_markup) {
  await tg('sendPhoto', { chat_id: chatId, photo, caption, reply_markup });
}
async function editMessageText(chatId, message_id, text, reply_markup) {
  await tg('editMessageText', { chat_id: chatId, message_id, text, reply_markup });
}
async function answerCallbackQuery(id) {
  await tg('answerCallbackQuery', { callback_query_id: id });
}

// ==================== КЛАВИАТУРЫ ====================

async function mainMenuKeyboard(chatId) {
  return {
    keyboard: [
      [{ text: await t(chatId, 'btnCatalog') }, { text: await t(chatId, 'btnCart') }],
      [{ text: await t(chatId, 'btnMyOrders') }, { text: await t(chatId, 'btnLang') }],
    ],
    resize_keyboard: true,
  };
}

// ==================== ХЕНДЛЕРЫ ====================

async function handleReset(chatId) {
  await clearProfile(chatId);
  await clearCart(chatId);
  await clearState(chatId);
  await sendMessage(chatId, await t(chatId, 'resetDone'), { remove_keyboard: true });
}

async function handleStart(chatId) {
  const profile = await getProfile(chatId);
  if (profile && profile.phone) {
    await sendMessage(chatId, await t(chatId, 'mainMenu'), await mainMenuKeyboard(chatId));
  } else {
    await sendMessage(chatId, await t(chatId, 'askContact'), {
      keyboard: [[{ text: await t(chatId, 'shareContact'), request_contact: true }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    });
  }
}

async function handleContact(chatId, contact) {
  const phone = normalizePhone(contact.phone_number);
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();

  const existing = await findClientByPhone(phone);
  const displayName = existing ? existing.name || name : name;
  if (!existing) await addClientIfMissing(name, phone);

  await setProfile(chatId, { phone, name: displayName });
  await sendMessage(chatId, await t(chatId, 'contactSaved', displayName), { remove_keyboard: true });
  await sendMessage(chatId, await t(chatId, 'mainMenu'), await mainMenuKeyboard(chatId));
}

async function handleText(chatId, text) {
  const profile = await getProfile(chatId);
  if (!profile || !profile.phone) return handleStart(chatId);

  const lang = await getLang(chatId);
  const other = lang === 'ru' ? 'uz' : 'ru';

  if (text === T.ru.btnCatalog || text === T.uz.btnCatalog) return showCategories(chatId);
  if (text === T.ru.btnCart || text === T.uz.btnCart) return showCart(chatId);
  if (text === T.ru.btnMyOrders || text === T.uz.btnMyOrders) return showMyOrders(chatId);
  if (text === T.ru.btnLang || text === T.uz.btnLang) {
    return sendMessage(chatId, await t(chatId, 'chooseLang'), {
      inline_keyboard: [[
        { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
        { text: "🇺🇿 O'zbekcha", callback_data: 'lang_uz' },
      ]],
    });
  }
  await sendMessage(chatId, await t(chatId, 'mainMenu'), await mainMenuKeyboard(chatId));
}

async function showCategories(chatId, editMsgId) {
  const categories = await getCategories();
  if (!categories.length) return sendMessage(chatId, await t(chatId, 'noCategories'));
  const keyboard = { inline_keyboard: categories.map((c) => [{ text: c, callback_data: 'cat_' + encodeURIComponent(c) }]) };
  const text = await t(chatId, 'chooseCategory');
  if (editMsgId) await editMessageText(chatId, editMsgId, text, keyboard);
  else await sendMessage(chatId, text, keyboard);
}

async function showProducts(chatId, category, editMsgId) {
  const products = await getProductsByCategory(category);
  const rows = products.map((p) => [{ text: `${p.name} — ${formatPrice(p.price)}`, callback_data: 'prod_' + p.id }]);
  rows.push([{ text: await t(chatId, 'backToCategories'), callback_data: 'back_categories' }]);
  const text = await t(chatId, 'chooseProduct', category);
  const keyboard = { inline_keyboard: rows };
  if (editMsgId) await editMessageText(chatId, editMsgId, text, keyboard);
  else await sendMessage(chatId, text, keyboard);
}

async function showProduct(chatId, productId) {
  const p = await getProductById(productId);
  if (!p) return;
  const keyboard = {
    inline_keyboard: [
      [{ text: await t(chatId, 'addToCart'), callback_data: 'add_' + p.id }],
      [{ text: await t(chatId, 'backToCategories'), callback_data: 'cat_' + encodeURIComponent(p.category) }],
    ],
  };
  const caption = await t(chatId, 'productCard', p);
  if (p.photoUrl) await sendPhoto(chatId, p.photoUrl, caption, keyboard);
  else await sendMessage(chatId, caption, keyboard);
}

async function showCart(chatId, editMsgId) {
  const cart = await getCart(chatId);
  const ids = Object.keys(cart);
  if (!ids.length) return sendMessage(chatId, await t(chatId, 'cartEmpty'));

  let text = await t(chatId, 'cartHeader');
  let total = 0;
  const rows = [];
  for (const id of ids) {
    const p = await getProductById(id);
    if (!p) continue;
    const qty = cart[id];
    const sum = p.price * qty;
    total += sum;
    text += (await t(chatId, 'cartLine', p.name, qty, sum)) + '\n';
    rows.push([{ text: await t(chatId, 'btnRemoveItem', p.name), callback_data: 'rm_' + id }]);
  }
  text += await t(chatId, 'cartTotal', total);
  rows.push([{ text: await t(chatId, 'btnCheckout'), callback_data: 'checkout_start' }]);
  rows.push([{ text: await t(chatId, 'btnClearCart'), callback_data: 'clear_cart' }]);

  const keyboard = { inline_keyboard: rows };
  if (editMsgId) await editMessageText(chatId, editMsgId, text, keyboard);
  else await sendMessage(chatId, text, keyboard);
}

async function startCheckout(chatId) {
  const cart = await getCart(chatId);
  if (!Object.keys(cart).length) return sendMessage(chatId, await t(chatId, 'cartEmpty'));
  const rows = BRANCHES.map((b) => [{ text: b, callback_data: 'branch_' + encodeURIComponent(b) }]);
  await sendMessage(chatId, await t(chatId, 'chooseBranch'), { inline_keyboard: rows });
}

async function confirmOrderPreview(chatId, branch) {
  const cart = await getCart(chatId);
  const profile = await getProfile(chatId);
  let total = 0;
  let itemsText = '';
  for (const id of Object.keys(cart)) {
    const p = await getProductById(id);
    if (!p) continue;
    const qty = cart[id];
    const sum = p.price * qty;
    total += sum;
    itemsText += `• ${p.name} × ${qty} = ${formatPrice(sum)}\n`;
  }
  await setState(chatId, { branch, total, itemsText });
  await sendMessage(chatId, await t(chatId, 'orderConfirm', profile.name, profile.phone, branch, itemsText, total), {
    inline_keyboard: [[
      { text: await t(chatId, 'btnConfirmOrder'), callback_data: 'order_confirm' },
      { text: await t(chatId, 'btnCancelOrder'), callback_data: 'order_cancel' },
    ]],
  });
}

async function placeOrder(chatId) {
  const profile = await getProfile(chatId);
  const state = await getState(chatId);
  if (!state || !state.branch) return;

  const orderId = await addOrder(profile.name, profile.phone, state.branch, state.itemsText, state.total);
  await clearCart(chatId);
  await clearState(chatId);

  await sendMessage(chatId, await t(chatId, 'orderPlaced', orderId));
  await sendMessage(chatId, await t(chatId, 'mainMenu'), await mainMenuKeyboard(chatId));

  const notify = `🆕 Новая заявка №${orderId}\n\n👤 ${profile.name}\n📞 ${profile.phone}\n🏬 ${state.branch}\n\n${state.itemsText}\n💰 Итого: ${formatPrice(state.total)}`;
  for (const adminId of ADMIN_CHAT_IDS) await sendMessage(adminId, notify);
}

async function showMyOrders(chatId) {
  const profile = await getProfile(chatId);
  const orders = await getOrdersByPhone(profile.phone);
  if (!orders.length) return sendMessage(chatId, await t(chatId, 'myOrdersEmpty'));
  let text = await t(chatId, 'myOrdersHeader');
  for (const o of orders) {
    text += (await t(chatId, 'myOrderLine', o.id, o.date, o.branch, o.total, o.status)) + '\n';
  }
  await sendMessage(chatId, text);
}

async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  const messageId = cq.message.message_id;
  const data = cq.data;
  await answerCallbackQuery(cq.id);

  if (data.startsWith('lang_')) {
    const lang = data.split('_')[1];
    await setLang(chatId, lang);
    await sendMessage(chatId, lang === 'ru' ? T.ru.langSetRu : T.uz.langSetUz);
    await sendMessage(chatId, await t(chatId, 'mainMenu'), await mainMenuKeyboard(chatId));
  } else if (data.startsWith('cat_')) {
    await showProducts(chatId, decodeURIComponent(data.slice(4)), messageId);
  } else if (data.startsWith('prod_')) {
    await showProduct(chatId, data.slice(5));
  } else if (data.startsWith('add_')) {
    const productId = data.slice(4);
    const cart = await getCart(chatId);
    cart[productId] = (cart[productId] || 0) + 1;
    await setCart(chatId, cart);
    const p = await getProductById(productId);
    await sendMessage(chatId, await t(chatId, 'addedToCart', p ? p.name : ''));
  } else if (data === 'back_categories') {
    await showCategories(chatId, messageId);
  } else if (data.startsWith('rm_')) {
    const cart = await getCart(chatId);
    delete cart[data.slice(3)];
    await setCart(chatId, cart);
    await showCart(chatId, messageId);
  } else if (data === 'clear_cart') {
    await clearCart(chatId);
    await sendMessage(chatId, await t(chatId, 'cartCleared'));
    await sendMessage(chatId, await t(chatId, 'mainMenu'), await mainMenuKeyboard(chatId));
  } else if (data === 'checkout_start') {
    await startCheckout(chatId);
  } else if (data.startsWith('branch_')) {
    await confirmOrderPreview(chatId, decodeURIComponent(data.slice(7)));
  } else if (data === 'order_confirm') {
    await placeOrder(chatId);
  } else if (data === 'order_cancel') {
    await clearState(chatId);
    await sendMessage(chatId, await t(chatId, 'orderCancelled'));
    await sendMessage(chatId, await t(chatId, 'mainMenu'), await mainMenuKeyboard(chatId));
  }
}

// ==================== ТОЧКА ВХОДА (Vercel) ====================

module.exports = async (req, res) => {
  try {
    await ensureSheetsExist();
    const update = req.body;

    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      if (msg.contact) await handleContact(chatId, msg.contact);
      else if (msg.text === '/start') await handleStart(chatId);
      else if (msg.text === '/reset') await handleReset(chatId);
      else if (msg.text) await handleText(chatId, msg.text);
    } else if (update.callback_query) {
      await handleCallback(update.callback_query);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(200).json({ ok: true }); // Telegram не любит не-200 ответы
  }
};
