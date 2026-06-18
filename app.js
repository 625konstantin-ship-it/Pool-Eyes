const STORAGE_KEYS = {
  users: 'poolApp_users',
  session: 'poolApp_session'
};

const LEGACY_KEYS = {
  pools: 'poolList',
  activePool: 'activePoolId',
  measurements: 'poolMeasurements',
  problems: 'poolProblems'
};

const NORMS = {
  ph: { min: 7.2, max: 7.6, ideal: '7.2–7.6' },
  chlorine: { min: 1.0, max: 3.0, ideal: '1.0–3.0 мг/л' },
  peroxide: { min: 30, max: 75, ideal: '30–75 мг/л' },
  temperature: { min: 24, max: 28, ideal: '24–28 °C' }
};

const TREATMENT_LABELS = {
  chlorine: 'На хлоре',
  peroxide: 'На перекиси'
};

const POOL_PROBLEMS = [
  { id: 'clear', label: 'Вода прозрачная', desc: 'Нормальное состояние', recommendations: [
    { level: 'ok', title: 'Вода в порядке', text: 'Прозрачная вода — признак сбалансированной химии и работающей фильтрации. Продолжайте регулярные измерения pH и хлора.' }
  ]},
  { id: 'cloudy', label: 'Вода мутная', desc: 'Плохая видимость на глубине', recommendations: [
    { level: 'warn', title: 'Мутная вода', text: 'Частые причины: низкий хлор, высокий pH, много органики или сбой фильтра. Проверьте pH (7.2–7.6) и хлор (1–3 мг/л). Усильте фильтрацию 24–48 ч, добавьте коагулянт по инструкции.' },
    { level: 'info', title: 'Дополнительно', text: 'Пропылесосьте дно, промойте фильтр. При сильной мутности — шоковое хлорирование.' }
  ]},
  { id: 'green', label: 'Зелёная вода', desc: 'Цветение водорослей', recommendations: [
    { level: 'crit', title: 'Зелёная вода — водоросли', text: 'Недостаточно хлора. Проведите шоковое хлорирование. Очистите стены щёткой, включите фильтр на сутки.' },
    { level: 'warn', title: 'Профилактика', text: 'Поддерживайте хлор 1–3 мг/л, pH 7.2–7.6. Добавьте альгицид.' }
  ]},
  { id: 'white', label: 'Белая / молочная вода', desc: 'Взвесь, известь или переизбыток хлора', recommendations: [
    { level: 'warn', title: 'Белёсая вода', text: 'Часто из-за высокого pH (>7.8) или переизбытка хлора. Проверьте pH и понизьте pH-минусом при необходимости.' },
    { level: 'info', title: 'Что делать', text: 'Дайте фильтру поработать 4–8 ч. Не передозируйте порошковый хлор.' }
  ]},
  { id: 'yellow', label: 'Жёлтая / металлическая вода', desc: 'Железо, медь, марганец', recommendations: [
    { level: 'warn', title: 'Желтоватый оттенок', text: 'Обычно железо или медь в воде. Используйте препарат от металлов.' },
    { level: 'info', title: 'Металлический блеск', text: 'Понизьте pH, добавьте препарат от металлов, пропылесосьте дно.' }
  ]},
  { id: 'foam', label: 'Пена на поверхности', desc: 'Моющие средства, органика', recommendations: [
    { level: 'warn', title: 'Пена на воде', text: 'Часто от остатков моющих средств или косметики. Снизьте использование моющих средств.' },
    { level: 'info', title: 'Устранение', text: 'Добавьте антипену, усильте хлорирование и фильтрацию.' }
  ]},
  { id: 'sediment_bottom', label: 'Осадок на дне', desc: 'Пыль, песок, хлопья', recommendations: [
    { level: 'warn', title: 'Осадок на дне', text: 'Пропылесосьте дно. Проверьте хлор — при низком уровне осадок может быть мёртвыми водорослями.' },
    { level: 'info', title: 'Фильтрация', text: 'Промойте фильтр. Используйте флокулянт при необходимости.' }
  ]},
  { id: 'floating', label: 'Взвесь / хлопья в воде', desc: 'Плавающие частицы', recommendations: [
    { level: 'warn', title: 'Плавающие частицы', text: 'Часто после шокового хлорирования или при цветении водорослей. Включите фильтр, пропылесосьте.' },
    { level: 'info', title: 'Действия', text: 'Белые хлопья — возможен переизбыток химии. Зелёные — нужен хлор и щётка.' }
  ]},
  { id: 'slippery', label: 'Скользкие стены', desc: 'Биоплёнка, водоросли', recommendations: [
    { level: 'warn', title: 'Скользкость', text: 'Ранний признак водорослей. Почистите стены щёткой, повысьте хлор, добавьте альгицид.' }
  ]},
  { id: 'smell', label: 'Запах хлора / «болотный»', desc: 'Хлорамины или органика', recommendations: [
    { level: 'warn', title: 'Резкий запах хлора', text: 'Часто при хлораминах — нужно шоковое хлорирование.' },
    { level: 'crit', title: 'Болотный запах', text: 'Срочно шоковое хлорирование, очистка фильтра.' }
  ]},
  { id: 'eye_irritation', label: 'Щиплет глаза / кожу', desc: 'pH или хлорамины', recommendations: [
    { level: 'warn', title: 'Раздражение', text: 'Чаще всего pH вне 7.2–7.6. Измерьте pH и свободный хлор.' }
  ]}
];

let currentUser = null;
let poolList = [];
let activePoolId = null;
let measurements = [];
let chemistryLog = [];
let selectedProblems = {};
let charts = { ph: null, chlorine: null, temp: null };
let isUpdatingUI = false;
let poolMap = null;
let poolMarker = null;
let lastMapPoolId = null;
const memoryStorage = {};
const DEFAULT_MAP_CENTER = [50.4501, 30.5234];
const NOMINATIM_HEADERS = { 'Accept-Language': 'ru', 'User-Agent': 'PoolTracker/1.0 (local pool app)' };

function storageGet(key) {
  try { return localStorage.getItem(key); }
  catch { return memoryStorage[key] ?? null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch { memoryStorage[key] = value; }
}

function storageRemove(key) {
  try { localStorage.removeItem(key); }
  catch { delete memoryStorage[key]; }
}

function getUserDataKey(userId) {
  return `poolApp_data_${userId}`;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let useServerAuth = false;

async function digestSHA256(text) {
  if (window.crypto && window.crypto.subtle) {
    try {
      const data = new TextEncoder().encode(text);
      const hash = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { /* fallback below */ }
  }
  return sha256Fallback(text);
}

function sha256Fallback(text) {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const withOne = bytes.length + 1;
  const padLen = (withOne % 64 <= 56 ? 56 : 120) - (withOne % 64);
  const total = withOne + padLen + 8;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[bytes.length] = 0x80;
  new DataView(buf.buffer).setUint32(total - 4, bitLen);
  const w = new Uint32Array(64);
  for (let i = 0; i < total; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = (buf[i + j * 4] << 24) | (buf[i + j * 4 + 1] << 16) | (buf[i + j * 4 + 2] << 8) | buf[i + j * 4 + 3];
    }
    for (let j = 16; j < 64; j++) {
      const s0 = ((w[j - 15] >>> 7) | (w[j - 15] << 25)) ^ ((w[j - 15] >>> 18) | (w[j - 15] << 14)) ^ (w[j - 15] >>> 3);
      const s1 = ((w[j - 2] >>> 17) | (w[j - 2] << 15)) ^ ((w[j - 2] >>> 19) | (w[j - 2] << 13)) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;
    for (let j = 0; j < 64; j++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[j] + w[j]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + hh) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7].map(v => (v >>> 0).toString(16).padStart(8, '0')).join('');
}

async function hashPassword(password, salt) {
  return digestSHA256((salt || '') + password);
}

function findUserByLogin(login) {
  const normalized = normalizeLogin(login);
  const users = getUsers();
  return users.find(u => u.login === normalized)
    || users.find(u => u.displayLogin && normalizeLogin(u.displayLogin) === normalized)
    || null;
}

async function verifyPassword(password, user) {
  if (!user || !user.passwordHash) return false;
  const salt = user.salt || '';
  const primary = await hashPassword(password, salt);
  if (primary === user.passwordHash) return true;
  if (salt) {
    const legacy = await hashPassword(password, '');
    if (legacy === user.passwordHash) return true;
  }
  return false;
}

async function apiPost(path, body) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: 'Нет связи с сервером. Запустите запуск.command.' } };
  }
}

async function checkServerAuth() {
  try {
    const res = await fetch('/api/health', { cache: 'no-store' });
    useServerAuth = res.ok;
  } catch {
    useServerAuth = false;
  }
  return useServerAuth;
}

async function migrateLocalUsersToServer() {
  const localUsers = getUsers();
  if (!localUsers.length) return;
  try {
    await apiPost('/api/migrate-local', { users: localUsers });
  } catch { /* ignore */ }
}

function showProtocolWarning() {
  const el = document.getElementById('authProtocolWarn');
  if (!el) return;
  if (location.protocol === 'file:') {
    el.textContent = 'Сайт открыт как файл — вход может не работать. Запустите запуск.command и откройте http://localhost:8080';
    el.className = 'message warn';
    el.hidden = false;
  } else if (!useServerAuth) {
    el.textContent = 'Сервер не запущен — сброс пароля покажет код на экране. Для письма на email запустите запуск.command.';
    el.className = 'message warn';
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

function getUsers() {
  try {
    const users = JSON.parse(storageGet(STORAGE_KEYS.users) || '[]');
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveUsers(users) {
  storageSet(STORAGE_KEYS.users, JSON.stringify(users));
}

function getSession() {
  try {
    return JSON.parse(storageGet(STORAGE_KEYS.session) || 'null');
  } catch {
    return null;
  }
}

function setSession(user) {
  storageSet(STORAGE_KEYS.session, JSON.stringify({
    userId: user.id,
    login: user.login,
    displayLogin: user.displayLogin || user.login,
    email: user.email || ''
  }));
}

function clearSession() {
  storageRemove(STORAGE_KEYS.session);
}

function normalizeLogin(login) {
  return login.trim().toLowerCase();
}

async function registerUser(login, password, email) {
  const normalized = normalizeLogin(login);
  if (normalized.length < 3) return { ok: false, error: 'Логин — минимум 3 символа.' };
  if (password.length < 4) return { ok: false, error: 'Пароль — минимум 4 символа.' };
  if (!email || !email.includes('@')) return { ok: false, error: 'Укажите корректный email.' };

  if (useServerAuth) {
    const { ok, data } = await apiPost('/api/register', {
      login: login.trim(),
      password,
      email: email.trim().toLowerCase()
    });
    if (!ok) return { ok: false, error: data.error || 'Ошибка регистрации.' };
    return { ok: true, user: data.user };
  }

  const users = getUsers();
  if (findUserByLogin(normalized)) {
    return { ok: false, error: 'Такой логин уже занят.' };
  }

  const salt = generateId();
  const passwordHash = await hashPassword(password, salt);
  const user = {
    id: generateId(),
    login: normalized,
    displayLogin: login.trim(),
    email: email.trim().toLowerCase(),
    salt,
    passwordHash
  };
  users.push(user);
  saveUsers(users);

  if (users.length === 1) migrateLegacyToUser(user.id);

  return { ok: true, user };
}

async function loginUser(login, password) {
  if (useServerAuth) {
    const { ok, data } = await apiPost('/api/login', { login, password });
    if (ok) return { ok: true, user: data.user };
  }

  const user = findUserByLogin(login);
  if (!user) return { ok: false, error: 'Неверный логин или пароль.' };

  const valid = await verifyPassword(password, user);
  if (!valid) return { ok: false, error: 'Неверный логин или пароль.' };

  if (useServerAuth) {
    await apiPost('/api/migrate-local', { users: [user] });
  }

  return { ok: true, user: {
    id: user.id,
    login: user.login,
    displayLogin: user.displayLogin || user.login,
    email: user.email || ''
  }};
}

async function requestPasswordReset(login, email) {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedLogin = login.trim();

  if (useServerAuth) {
    const { ok, data } = await apiPost('/api/forgot-password', {
      login: trimmedLogin,
      email: normalizedEmail
    });
    if (ok && data.devCode) return { ok: true, ...data };
    if (ok) return { ok: true, ...data };
  }

  const user = findUserByLogin(trimmedLogin);
  if (!user) {
    return { ok: false, error: 'Пользователь с таким логином не найден на этом компьютере.' };
  }
  if (!user.email) {
    return {
      ok: false,
      error: 'Email не указан. Войдите в аккаунт → кнопка «Email» → сохраните почту, затем повторите сброс.'
    };
  }
  if (user.email.toLowerCase() !== normalizedEmail) {
    return { ok: false, error: 'Email не совпадает. Проверьте написание или обновите email в настройках аккаунта.' };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  storageSet(`poolApp_reset_${normalizeLogin(trimmedLogin)}`, JSON.stringify({
    code,
    expires: Date.now() + 15 * 60 * 1000
  }));

  return {
    ok: true,
    devMode: true,
    devCode: code,
    message: 'Код показан ниже. Для отправки на email настройте data/smtp.json и запустите запуск.command.'
  };
}

async function resetPassword(login, code, newPassword) {
  const trimmedLogin = login.trim();
  const resetKey = `poolApp_reset_${normalizeLogin(trimmedLogin)}`;

  if (useServerAuth) {
    const { ok, data } = await apiPost('/api/reset-password', {
      login: trimmedLogin,
      code: code.trim(),
      newPassword
    });
    if (ok) {
      storageRemove(resetKey);
      return { ok: true, message: data.message };
    }
  }

  const user = findUserByLogin(trimmedLogin);
  if (!user) {
    return { ok: false, error: 'Пользователь не найден.' };
  }

  let token;
  try { token = JSON.parse(storageGet(resetKey)); } catch { token = null; }
  if (!token || token.code !== code.trim() || token.expires < Date.now()) {
    return { ok: false, error: 'Неверный или просроченный код (действует 15 минут).' };
  }

  user.salt = generateId();
  user.passwordHash = await hashPassword(newPassword, user.salt);
  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx >= 0) {
    users[idx] = user;
    saveUsers(users);
  }
  storageRemove(resetKey);

  if (useServerAuth) {
    await apiPost('/api/migrate-local', { users: [user] });
  }

  return { ok: true, message: 'Пароль изменён. Теперь можно войти.' };
}

async function saveAccountEmail(email) {
  if (!currentUser) return { ok: false, error: 'Не выполнен вход.' };
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes('@') || normalized.length < 5) {
    return { ok: false, error: 'Укажите корректный email.' };
  }

  if (useServerAuth) {
    const { ok, data } = await apiPost('/api/update-email', {
      userId: currentUser.id,
      login: currentUser.login,
      email: normalized
    });
    if (!ok) return { ok: false, error: data.error || 'Не удалось сохранить на сервере.' };
  }

  const users = getUsers();
  const user = users.find(u => u.id === currentUser.id) || findUserByLogin(currentUser.login);
  if (user) {
    user.email = normalized;
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
      saveUsers(users);
    }
  }

  currentUser.email = normalized;
  setSession(currentUser);
  document.getElementById('currentUserLabel').textContent =
    (currentUser.displayLogin || currentUser.login) + ` · ${normalized}`;

  return { ok: true, message: 'Email сохранён.' };
}

function migrateLegacyToUser(userId) {
  const hasLegacy = storageGet(LEGACY_KEYS.pools) || storageGet(LEGACY_KEYS.measurements);
  if (!hasLegacy) return;

  const data = {
    pools: JSON.parse(storageGet(LEGACY_KEYS.pools) || '[]'),
    activePoolId: storageGet(LEGACY_KEYS.activePool),
    measurements: JSON.parse(storageGet(LEGACY_KEYS.measurements) || '[]'),
    problems: JSON.parse(storageGet(LEGACY_KEYS.problems) || '{}'),
    chemistry: []
  };
  storageSet(getUserDataKey(userId), JSON.stringify(data));
}

function loadUserData() {
  if (!currentUser) return;

  let data;
  try {
    data = JSON.parse(storageGet(getUserDataKey(currentUser.id)) || '{}');
  } catch {
    data = {};
  }

  poolList = Array.isArray(data.pools) ? data.pools : [];
  activePoolId = data.activePoolId || null;
  measurements = Array.isArray(data.measurements) ? data.measurements : [];
  chemistryLog = Array.isArray(data.chemistry) ? data.chemistry : [];
  selectedProblems = data.problems && typeof data.problems === 'object' ? data.problems : {};

  normalizeStoredData();
  ensureDefaultPool();
}

function saveUserData() {
  if (!currentUser) return;

  const data = {
    pools: poolList,
    activePoolId,
    measurements,
    chemistry: chemistryLog,
    problems: selectedProblems
  };
  storageSet(getUserDataKey(currentUser.id), JSON.stringify(data));
}

function savePools() {
  saveUserData();
}

function saveMeasurements() {
  saveUserData();
}

function saveProblems() {
  saveUserData();
}

function saveChemistry() {
  saveUserData();
}

function normalizeLocation(loc) {
  if (!loc || typeof loc !== 'object') {
    return { address: '', lat: null, lng: null };
  }
  const lat = loc.lat != null ? Number(loc.lat) : null;
  const lng = loc.lng != null ? Number(loc.lng) : null;
  return {
    address: String(loc.address || ''),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
}

function normalizeStoredData() {
  poolList = poolList
    .filter(p => p && p.id && p.name)
    .map(p => ({
      id: String(p.id),
      name: String(p.name),
      volume: Number(p.volume) || 25000,
      treatmentType: p.treatmentType === 'peroxide' ? 'peroxide' : 'chlorine',
      location: normalizeLocation(p.location)
    }));

  measurements = measurements
    .filter(m => m && m.poolId)
    .map(m => ({
      id: m.id || generateId(),
      poolId: String(m.poolId),
      ph: Number(m.ph),
      chlorine: Number(m.chlorine),
      temperature: Number(m.temperature),
      date: m.date || new Date().toISOString()
    }));

  chemistryLog = chemistryLog
    .filter(c => c && c.poolId && c.chemical)
    .map(c => ({
      id: c.id || generateId(),
      poolId: String(c.poolId),
      chemical: String(c.chemical),
      amount: Number(c.amount),
      unit: String(c.unit || 'г'),
      comment: String(c.comment || ''),
      date: c.date || new Date().toISOString()
    }));
}

function ensureDefaultPool() {
  if (poolList.length === 0) {
    const pool = {
      id: generateId(),
      name: 'Мой бассейн',
      volume: 25000,
      treatmentType: 'chlorine',
      location: { address: '', lat: null, lng: null }
    };
    poolList.push(pool);
    activePoolId = pool.id;
    savePools();
  }
  if (!activePoolId || !poolList.find(p => p.id === activePoolId)) {
    activePoolId = poolList[0].id;
    savePools();
  }
}

function openAccountModal() {
  document.getElementById('accountEmail').value = currentUser?.email || '';
  document.getElementById('accountEmailError').hidden = true;
  document.getElementById('accountEmailSuccess').hidden = true;
  document.getElementById('accountModal').classList.remove('hidden');
}

function closeAccountModal() {
  document.getElementById('accountModal').classList.add('hidden');
}

async function handleSaveAccountEmail() {
  const email = document.getElementById('accountEmail').value;
  document.getElementById('accountEmailError').hidden = true;
  document.getElementById('accountEmailSuccess').hidden = true;

  const result = await saveAccountEmail(email);
  if (!result.ok) {
    document.getElementById('accountEmailError').textContent = result.error;
    document.getElementById('accountEmailError').hidden = false;
    return;
  }
  document.getElementById('accountEmailSuccess').textContent = result.message;
  document.getElementById('accountEmailSuccess').hidden = false;
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  const label = currentUser.displayLogin || currentUser.login;
  const email = currentUser.email ? ` · ${currentUser.email}` : '';
  document.getElementById('currentUserLabel').textContent = label + email;
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('forgotForm').classList.toggle('hidden', tab !== 'forgot');
  document.getElementById('resetForm').classList.toggle('hidden', tab !== 'reset');
  ['loginError', 'registerError', 'forgotError', 'forgotSuccess', 'forgotDevCode', 'resetError', 'resetSuccess'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

function hideAuthMessages(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

function showAuthMessage(id, text, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type}`;
  el.hidden = false;
}

async function handleLogin(e) {
  e.preventDefault();
  const login = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');

  const result = await loginUser(login, password);
  if (!result.ok) {
    errorEl.textContent = result.error;
    errorEl.hidden = false;
    return;
  }

  currentUser = result.user;
  setSession(currentUser);
  startApp();
}

async function handleRegister(e) {
  e.preventDefault();
  const login = document.getElementById('registerUsername').value;
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerPasswordConfirm').value;

  hideAuthMessages(['registerError']);

  if (password !== confirm) {
    showAuthMessage('registerError', 'Пароли не совпадают.');
    return;
  }

  const result = await registerUser(login, password, email);
  if (!result.ok) {
    showAuthMessage('registerError', result.error);
    return;
  }

  currentUser = result.user;
  setSession(currentUser);
  startApp();
}

async function handleForgot(e) {
  e.preventDefault();
  hideAuthMessages(['forgotError', 'forgotSuccess', 'forgotDevCode']);

  const login = document.getElementById('forgotLogin').value;
  const email = document.getElementById('forgotEmail').value;

  const result = await requestPasswordReset(login, email);
  if (!result.ok) {
    showAuthMessage('forgotError', result.error);
    return;
  }

  showAuthMessage('forgotSuccess', result.message, 'success');
  document.getElementById('resetLogin').value = login.trim();

  if (result.devCode) {
    showAuthMessage('forgotDevCode', `Код для теста (почта не настроена): ${result.devCode}`, 'info');
  }

  switchAuthTab('reset');
  document.getElementById('resetForm').classList.remove('hidden');
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === 'reset');
  });
}

async function handleReset(e) {
  e.preventDefault();
  hideAuthMessages(['resetError', 'resetSuccess']);

  const login = document.getElementById('resetLogin').value;
  const code = document.getElementById('resetCode').value;
  const password = document.getElementById('resetPassword').value;
  const confirm = document.getElementById('resetPasswordConfirm').value;

  if (password !== confirm) {
    showAuthMessage('resetError', 'Пароли не совпадают.');
    return;
  }

  const result = await resetPassword(login, code, password);
  if (!result.ok) {
    showAuthMessage('resetError', result.error);
    return;
  }

  showAuthMessage('resetSuccess', result.message || 'Пароль изменён!', 'success');
  document.getElementById('loginUsername').value = login.trim();
  setTimeout(() => switchAuthTab('login'), 1500);
}

function handleLogout() {
  saveCurrentPoolProblems();
  saveUserData();
  currentUser = null;
  poolList = [];
  activePoolId = null;
  measurements = [];
  chemistryLog = [];
  selectedProblems = {};
  clearSession();
  destroyCharts();
  destroyPoolMap();
  showAuthScreen();
  document.getElementById('loginForm').reset();
  document.getElementById('registerForm').reset();
}

function destroyCharts() {
  Object.keys(charts).forEach(key => {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  });
}

function startApp() {
  loadUserData();
  showAppScreen();
  renderPoolSelect();
  setActivePool(activePoolId);
}

function getActivePool() {
  return poolList.find(p => p.id === activePoolId) || null;
}

function setActivePool(poolId) {
  const pool = poolList.find(p => p.id === poolId);
  if (!pool) return false;

  saveCurrentPoolProblems();
  activePoolId = pool.id;
  savePools();

  const select = document.getElementById('poolSelect');
  if (select && select.value !== pool.id) {
    isUpdatingUI = true;
    select.value = pool.id;
    isUpdatingUI = false;
  }

  renderPoolContent();
  return true;
}

function saveCurrentPoolProblems() {
  if (!activePoolId) return;
  const grid = document.getElementById('problemsGrid');
  if (!grid) return;
  const checked = [...grid.querySelectorAll('input:checked')].map(el => el.value);
  selectedProblems[activePoolId] = checked;
  saveProblems();
}

function getPoolMeasurements(poolId) {
  return measurements
    .filter(m => m.poolId === poolId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getPoolChemistry(poolId) {
  return chemistryLog
    .filter(c => c.poolId === poolId)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function formatVolume(liters) {
  return Number(liters).toLocaleString('ru-RU') + ' л';
}

function showMessage(el, text, type = 'success') {
  el.textContent = text;
  el.className = `message ${type}`;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3500);
}

function formatPoolMeta(pool, poolMeas, poolChem, treatmentType) {
  const parts = [
    `Объём: ${formatVolume(pool.volume)}`,
    TREATMENT_LABELS[treatmentType],
    `Измерений: ${poolMeas.length}`,
    `Записей химии: ${poolChem.length}`
  ];
  if (pool.location && pool.location.address) {
    parts.push(`📍 ${pool.location.address}`);
  }
  return parts.join(' · ');
}

function updateLocationStatus(text) {
  const el = document.getElementById('locationStatus');
  if (el) el.textContent = text;
}

function destroyPoolMap() {
  if (poolMap) {
    poolMap.remove();
    poolMap = null;
    poolMarker = null;
  }
  lastMapPoolId = null;
}

function updateRouteLinks(lat, lng) {
  const routeActions = document.getElementById('routeActions');
  if (!routeActions) return;

  if (lat == null || lng == null) {
    routeActions.classList.add('hidden');
    return;
  }

  routeActions.classList.remove('hidden');
  document.getElementById('routeGoogle').href =
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function setMapMarker(lat, lng, pan = true) {
  if (!poolMap || typeof L === 'undefined') return;

  if (poolMarker) {
    poolMarker.setLatLng([lat, lng]);
  } else {
    poolMarker = L.marker([lat, lng], { draggable: true }).addTo(poolMap);
    poolMarker.on('dragend', () => {
      const pos = poolMarker.getLatLng();
      updateLocationStatus(`Метка: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)} — нажмите «Сохранить локацию»`);
      updateRouteLinks(pos.lat, pos.lng);
    });
  }

  if (pan) {
    poolMap.setView([lat, lng], Math.max(poolMap.getZoom(), 14));
  }
  updateRouteLinks(lat, lng);
  updateLocationStatus(`Метка: ${lat.toFixed(5)}, ${lng.toFixed(5)} — нажмите «Сохранить локацию»`);
}

function getMarkerCoords() {
  if (!poolMarker) return null;
  const pos = poolMarker.getLatLng();
  return { lat: pos.lat, lng: pos.lng };
}

function initPoolMap(pool) {
  destroyPoolMap();
  if (typeof L === 'undefined') {
    updateLocationStatus('Карта не загрузилась. Проверьте интернет.');
    return;
  }

  const loc = pool.location || normalizeLocation(null);
  const hasCoords = loc.lat != null && loc.lng != null;
  const center = hasCoords ? [loc.lat, loc.lng] : DEFAULT_MAP_CENTER;
  const zoom = hasCoords ? 15 : 10;

  poolMap = L.map('poolMap', { scrollWheelZoom: true }).setView(center, zoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(poolMap);

  if (hasCoords) {
    setMapMarker(loc.lat, loc.lng, false);
    updateLocationStatus(loc.address || `Сохранено: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
  } else {
    updateLocationStatus('Кликните на карту, чтобы поставить метку, или найдите адрес.');
    updateRouteLinks(null, null);
  }

  poolMap.on('click', e => {
    setMapMarker(e.latlng.lat, e.latlng.lng);
  });

  setTimeout(() => {
    if (poolMap) poolMap.invalidateSize();
  }, 150);
}

function renderLocationUI(pool) {
  const addressInput = document.getElementById('poolAddress');
  const poolChanged = lastMapPoolId !== pool.id;

  if (addressInput && poolChanged) {
    addressInput.value = pool.location?.address || '';
  }

  if (poolChanged) {
    lastMapPoolId = pool.id;
    initPoolMap(pool);
  }
}

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    address: data[0].display_name
  };
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return '';
  const data = await res.json();
  return data.display_name || '';
}

function savePoolLocation() {
  const pool = getActivePool();
  if (!pool) return false;

  const coords = getMarkerCoords();
  if (!coords) {
    alert('Сначала укажите точку на карте или найдите адрес.');
    return false;
  }

  pool.location = {
    address: document.getElementById('poolAddress').value.trim(),
    lat: coords.lat,
    lng: coords.lng
  };
  savePools();
  updateLocationStatus(pool.location.address || `Сохранено: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
  document.getElementById('activePoolMeta').textContent = formatPoolMeta(
    pool,
    getPoolMeasurements(pool.id),
    getPoolChemistry(pool.id),
    getPoolTreatment(pool)
  );
  return true;
}

function getParamStatus(value, norm) {
  if (value < norm.min - 0.5 || value > norm.max + 1) return 'crit';
  if (value < norm.min || value > norm.max) return 'warn';
  return 'ok';
}

function getOverallStatus(ph, chlorine, temp, treatmentType) {
  const sanitizerNorm = getSanitizerNorm(treatmentType);
  const statuses = [
    getParamStatus(ph, NORMS.ph),
    getParamStatus(chlorine, sanitizerNorm),
    getParamStatus(temp, NORMS.temperature)
  ];
  if (statuses.includes('crit')) return 'crit';
  if (statuses.includes('warn')) return 'warn';
  return 'ok';
}

function getPoolTreatment(pool) {
  return pool && pool.treatmentType === 'peroxide' ? 'peroxide' : 'chlorine';
}

function getSanitizerNorm(treatmentType) {
  return treatmentType === 'peroxide' ? NORMS.peroxide : NORMS.chlorine;
}

function getSanitizerLabel(treatmentType, short) {
  if (treatmentType === 'peroxide') {
    return short ? 'Перекись' : 'Перекись водорода (мг/л)';
  }
  return short ? 'Хлор' : 'Свободный хлор (мг/л)';
}

function syncTreatmentSelect(treatmentType) {
  const select = document.getElementById('treatmentSelect');
  if (!select) return;
  isUpdatingUI = true;
  select.value = treatmentType === 'peroxide' ? 'peroxide' : 'chlorine';
  isUpdatingUI = false;
}

function syncMeasurementLabels(treatmentType) {
  const isPeroxide = treatmentType === 'peroxide';
  const label = document.getElementById('chlorineLabel');
  const input = document.getElementById('chlorine');
  const header = document.getElementById('historyChlorineHeader');

  if (label) label.textContent = getSanitizerLabel(treatmentType, false);
  if (input) input.placeholder = isPeroxide ? '50' : '1.5';
  if (header) header.textContent = getSanitizerLabel(treatmentType, true);
}

function getParamRecommendations(ph, chlorine, temp, treatmentType) {
  const recs = [];
  const sanitizerNorm = getSanitizerNorm(treatmentType);
  const sanitizerName = treatmentType === 'peroxide' ? 'перекись' : 'хлор';

  if (ph < NORMS.ph.min) {
    recs.push({ level: ph < 6.8 ? 'crit' : 'warn', title: 'pH слишком низкий (' + ph + ')', text: 'Добавьте pH-плюс по инструкции. Цель: ' + NORMS.ph.ideal });
  } else if (ph > NORMS.ph.max) {
    recs.push({ level: ph > 8.0 ? 'crit' : 'warn', title: 'pH слишком высокий (' + ph + ')', text: 'Добавьте pH-минус по инструкции. Цель: ' + NORMS.ph.ideal });
  } else {
    recs.push({ level: 'ok', title: 'pH в норме (' + ph + ')', text: 'Диапазон ' + NORMS.ph.ideal + '.' });
  }

  if (chlorine < sanitizerNorm.min) {
    recs.push({
      level: chlorine < sanitizerNorm.min * 0.5 ? 'crit' : 'warn',
      title: `Мало ${sanitizerName}а (${chlorine} мг/л)`,
      text: `Добавьте ${treatmentType === 'peroxide' ? 'перекись' : 'хлор'} по инструкции. Цель: ${sanitizerNorm.ideal}`
    });
  } else if (chlorine > sanitizerNorm.max) {
    recs.push({
      level: chlorine > sanitizerNorm.max * 1.5 ? 'crit' : 'warn',
      title: `Много ${sanitizerName}а (${chlorine} мг/л)`,
      text: treatmentType === 'peroxide'
        ? 'Подождите снижения уровня перекиси перед купанием.'
        : 'Подождите снижения уровня хлора перед купанием.'
    });
  } else {
    recs.push({
      level: 'ok',
      title: `${sanitizerName.charAt(0).toUpperCase() + sanitizerName.slice(1)} в норме (${chlorine} мг/л)`,
      text: 'Диапазон ' + sanitizerNorm.ideal + '.'
    });
  }

  if (temp < NORMS.temperature.min) {
    recs.push({ level: 'warn', title: 'Вода холодная (' + temp + ' °C)', text: 'Комфорт: ' + NORMS.temperature.ideal });
  } else if (temp > NORMS.temperature.max) {
    recs.push({ level: temp > 32 ? 'crit' : 'warn', title: 'Вода тёплая (' + temp + ' °C)', text: 'При высокой температуре чаще проверяйте воду.' });
  } else {
    recs.push({ level: 'ok', title: 'Температура комфортная (' + temp + ' °C)', text: 'Диапазон ' + NORMS.temperature.ideal + '.' });
  }

  return recs;
}

function renderRecommendations(container, recs) {
  container.innerHTML = recs.map(r =>
    `<div class="rec-item ${r.level}"><strong>${escapeHtml(r.title)}</strong>${escapeHtml(r.text)}</div>`
  ).join('');
}

function renderProblemsGrid() {
  const grid = document.getElementById('problemsGrid');
  const poolProblems = selectedProblems[activePoolId] || [];

  grid.innerHTML = POOL_PROBLEMS.map(p => `
    <label class="problem-item ${poolProblems.includes(p.id) ? 'selected' : ''}">
      <input type="checkbox" value="${p.id}" ${poolProblems.includes(p.id) ? 'checked' : ''}>
      <div>
        <div class="problem-label">${escapeHtml(p.label)}</div>
        <div class="problem-desc">${escapeHtml(p.desc)}</div>
      </div>
    </label>
  `).join('');

  grid.querySelectorAll('.problem-item').forEach(label => {
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', () => {
      label.classList.toggle('selected', checkbox.checked);
      updatePoolProblems();
    });
  });
}

function updatePoolProblems() {
  const checked = [...document.querySelectorAll('#problemsGrid input:checked')].map(el => el.value);
  selectedProblems[activePoolId] = checked;
  saveProblems();
  renderProblemRecommendations(checked);
}

function renderProblemRecommendations(problemIds) {
  const container = document.getElementById('problemRecommendations');

  if (!problemIds || problemIds.length === 0) {
    container.innerHTML = '<div class="rec-item info"><strong>Выберите проблемы</strong>Отметьте ситуации, которые видите в бассейне.</div>';
    return;
  }

  const recs = [];
  problemIds.forEach(id => {
    const problem = POOL_PROBLEMS.find(p => p.id === id);
    if (problem) {
      problem.recommendations.forEach(r => {
        recs.push({ ...r, title: `${problem.label}: ${r.title}` });
      });
    }
  });

  renderRecommendations(container, recs);
}

function renderPoolSelect() {
  const select = document.getElementById('poolSelect');
  if (!select) return;

  isUpdatingUI = true;
  select.innerHTML = poolList
    .map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join('');

  if (activePoolId && poolList.some(p => p.id === activePoolId)) {
    select.value = activePoolId;
  } else if (poolList.length > 0) {
    activePoolId = poolList[0].id;
    select.value = activePoolId;
    savePools();
  }

  isUpdatingUI = false;
  document.getElementById('deletePoolBtn').disabled = poolList.length <= 1;
}

function syncVolumeSelect(volume) {
  const select = document.getElementById('volumeSelect');
  const presets = ['10000', '25000', '50000', '75000'];
  const str = String(volume);

  isUpdatingUI = true;
  if (presets.includes(str)) {
    select.value = str;
    document.getElementById('customVolumeWrap').classList.add('hidden');
  } else {
    select.value = 'custom';
    document.getElementById('customVolumeWrap').classList.remove('hidden');
    document.getElementById('customVolume').value = volume;
  }
  isUpdatingUI = false;
}

function renderChemistryHistory(poolChem) {
  const tbody = document.getElementById('chemistryBody');
  const empty = document.getElementById('emptyChemistry');

  if (poolChem.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  tbody.innerHTML = poolChem.map(c => {
    const date = new Date(c.date).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const comment = c.comment ? escapeHtml(c.comment) : '<span class="hint">—</span>';
    return `<tr>
      <td>${date}</td>
      <td>${escapeHtml(c.chemical)}</td>
      <td>${c.amount} ${escapeHtml(c.unit)}</td>
      <td class="comment-cell">${comment}</td>
    </tr>`;
  }).join('');
}

function renderPoolContent() {
  const pool = getActivePool();
  const content = document.getElementById('poolContent');
  const noHint = document.getElementById('noPoolHint');

  if (!pool) {
    content.classList.add('hidden');
    noHint.classList.remove('hidden');
    destroyPoolMap();
    return;
  }

  content.classList.remove('hidden');
  noHint.classList.add('hidden');

  const poolMeas = getPoolMeasurements(pool.id);
  const poolChem = getPoolChemistry(pool.id);
  const treatmentType = getPoolTreatment(pool);

  document.getElementById('activePoolName').textContent = pool.name;
  document.getElementById('activePoolMeta').textContent =
    formatPoolMeta(pool, poolMeas, poolChem, treatmentType);

  syncVolumeSelect(pool.volume);
  syncTreatmentSelect(treatmentType);
  syncMeasurementLabels(treatmentType);
  renderLocationUI(pool);
  renderProblemsGrid();
  renderProblemRecommendations(selectedProblems[pool.id] || []);
  renderChemistryHistory(poolChem);

  if (poolMeas.length > 0) {
    const latest = poolMeas[0];
    renderRecommendations(
      document.getElementById('paramRecommendations'),
      getParamRecommendations(latest.ph, latest.chlorine, latest.temperature, treatmentType)
    );
  } else {
    document.getElementById('paramRecommendations').innerHTML =
      '<div class="rec-item info"><strong>Нет измерений</strong>Добавьте первое измерение.</div>';
  }

  renderHistory(poolMeas, treatmentType);
  renderCharts(poolMeas, treatmentType);
}

function renderHistory(poolMeas, treatmentType) {
  const tbody = document.getElementById('historyBody');
  const empty = document.getElementById('emptyHistory');

  if (poolMeas.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  tbody.innerHTML = poolMeas.map(m => {
    const status = getOverallStatus(m.ph, m.chlorine, m.temperature, treatmentType);
    const statusText = status === 'ok' ? 'Норма' : status === 'warn' ? 'Внимание' : 'Критично';
    const date = new Date(m.date).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    return `<tr>
      <td>${date}</td>
      <td>${m.ph}</td>
      <td>${m.chlorine}</td>
      <td>${m.temperature}</td>
      <td class="status-${status}">${statusText}</td>
    </tr>`;
  }).join('');
}

function renderCharts(poolMeas, treatmentType) {
  const sorted = [...poolMeas].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(m =>
    new Date(m.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  );

  const sanitizerNorm = getSanitizerNorm(treatmentType);
  updateChart('ph', sorted.map(m => m.ph), labels, 'pH', '#1a8fc7', 7.2, 7.6);
  updateChart('chlorine', sorted.map(m => m.chlorine), labels, getSanitizerLabel(treatmentType, false), '#2db86a', sanitizerNorm.min, sanitizerNorm.max);
  updateChart('temp', sorted.map(m => m.temperature), labels, 'Температура (°C)', '#e6a020', 24, 28);
}

function updateChart(key, data, labels, label, color, normMin, normMax) {
  const canvas = document.getElementById(key + 'Chart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (charts[key]) {
    charts[key].destroy();
    charts[key] = null;
  }

  if (data.length === 0) return;

  charts[key] = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: color + '22',
        fill: true,
        tension: 0.3,
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: false,
          suggestedMin: Math.min(...data, normMin) - 0.5,
          suggestedMax: Math.max(...data, normMax) + 0.5
        }
      }
    }
  });
}

function openModal() {
  document.getElementById('addPoolModal').classList.remove('hidden');
  document.getElementById('newPoolName').value = '';
  document.getElementById('newPoolVolume').value = '25000';
  document.getElementById('newPoolTreatment').value = 'chlorine';
  document.getElementById('newCustomVolumeWrap').classList.add('hidden');
  document.getElementById('newCustomVolume').value = '';
  document.getElementById('modalError').hidden = true;
  document.getElementById('newPoolName').focus();
}

function closeModal() {
  document.getElementById('addPoolModal').classList.add('hidden');
}

function getVolumeFromSelect(selectEl, customInputEl) {
  const val = selectEl.value;
  if (val === 'custom') {
    const custom = parseInt(customInputEl.value, 10);
    if (!custom || custom < 1000) return null;
    return custom;
  }
  return parseInt(val, 10);
}

function getChemicalName() {
  const select = document.getElementById('chemicalName');
  if (select.value === 'custom') {
    return document.getElementById('customChemical').value.trim();
  }
  return select.value;
}

function initAuthListeners() {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('registerForm').addEventListener('submit', handleRegister);
  document.getElementById('forgotForm').addEventListener('submit', handleForgot);
  document.getElementById('resetForm').addEventListener('submit', handleReset);
  document.getElementById('gotoForgotBtn').addEventListener('click', () => switchAuthTab('forgot'));
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('accountBtn').addEventListener('click', openAccountModal);
  document.getElementById('saveAccountEmailBtn').addEventListener('click', handleSaveAccountEmail);
  document.querySelectorAll('[data-close-account]').forEach(el => {
    el.addEventListener('click', closeAccountModal);
  });
}

function initEventListeners() {
  document.getElementById('poolSelect').addEventListener('change', e => {
    if (isUpdatingUI) return;
    const poolId = e.target.value;
    if (!poolId) {
      isUpdatingUI = true;
      e.target.value = activePoolId;
      isUpdatingUI = false;
      return;
    }
    if (setActivePool(poolId)) {
      showMessage(document.getElementById('selectorMessage'), `Выбран бассейн «${getActivePool().name}»`);
    }
  });

  document.getElementById('addPoolBtn').addEventListener('click', openModal);

  document.querySelectorAll('[data-close-modal]').forEach(el => {
    el.addEventListener('click', closeModal);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  document.getElementById('newPoolVolume').addEventListener('change', e => {
    document.getElementById('newCustomVolumeWrap').classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value === 'custom') document.getElementById('newCustomVolume').focus();
  });

  document.getElementById('addPoolForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('newPoolName').value.trim();
    const errorEl = document.getElementById('modalError');

    if (!name) {
      errorEl.textContent = 'Введите название бассейна.';
      errorEl.hidden = false;
      return;
    }

    const volume = getVolumeFromSelect(
      document.getElementById('newPoolVolume'),
      document.getElementById('newCustomVolume')
    );

    if (!volume) {
      errorEl.textContent = 'Введите объём в литрах (от 1000).';
      errorEl.hidden = false;
      return;
    }

    const pool = {
      id: generateId(),
      name,
      volume,
      treatmentType: document.getElementById('newPoolTreatment').value === 'peroxide' ? 'peroxide' : 'chlorine',
      location: { address: '', lat: null, lng: null }
    };
    poolList.push(pool);
    savePools();
    closeModal();
    renderPoolSelect();
    setActivePool(pool.id);
    showMessage(document.getElementById('selectorMessage'), `Бассейн «${name}» добавлен!`);
  });

  document.getElementById('deletePoolBtn').addEventListener('click', () => {
    if (poolList.length <= 1) return;
    const pool = getActivePool();
    if (!confirm(`Удалить бассейн «${pool.name}» и все его данные?`)) return;

    poolList = poolList.filter(p => p.id !== activePoolId);
    measurements = measurements.filter(m => m.poolId !== activePoolId);
    chemistryLog = chemistryLog.filter(c => c.poolId !== activePoolId);
    delete selectedProblems[activePoolId];
    activePoolId = poolList[0].id;
    saveUserData();
    renderPoolSelect();
    setActivePool(activePoolId);
    showMessage(document.getElementById('selectorMessage'), 'Бассейн удалён.');
  });

  document.getElementById('volumeSelect').addEventListener('change', e => {
    if (isUpdatingUI) return;
    const wrap = document.getElementById('customVolumeWrap');
    wrap.classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value !== 'custom') {
      const pool = getActivePool();
      if (pool) {
        pool.volume = parseInt(e.target.value, 10);
        savePools();
        renderPoolContent();
        showMessage(document.getElementById('selectorMessage'), 'Объём сохранён.');
      }
    } else {
      document.getElementById('customVolume').focus();
    }
  });

  document.getElementById('saveVolumeBtn').addEventListener('click', () => {
    const pool = getActivePool();
    const custom = parseInt(document.getElementById('customVolume').value, 10);
    if (!pool || !custom || custom < 1000) {
      alert('Введите объём от 1000 литров.');
      return;
    }
    pool.volume = custom;
    savePools();
    renderPoolContent();
    showMessage(document.getElementById('selectorMessage'), 'Объём сохранён.');
  });

  document.getElementById('treatmentSelect').addEventListener('change', e => {
    if (isUpdatingUI) return;
    const pool = getActivePool();
    if (!pool) return;

    pool.treatmentType = e.target.value === 'peroxide' ? 'peroxide' : 'chlorine';
    savePools();
    renderPoolContent();
    showMessage(document.getElementById('selectorMessage'), `Обработка: ${TREATMENT_LABELS[pool.treatmentType]}`);
  });

  document.getElementById('measurementForm').addEventListener('submit', e => {
    e.preventDefault();
    const pool = getActivePool();
    if (!pool) return;

    measurements.push({
      id: generateId(),
      poolId: pool.id,
      ph: parseFloat(document.getElementById('ph').value),
      chlorine: parseFloat(document.getElementById('chlorine').value),
      temperature: parseFloat(document.getElementById('temperature').value),
      date: new Date().toISOString()
    });
    saveMeasurements();
    renderPoolContent();
    e.target.reset();
    showMessage(document.getElementById('selectorMessage'), 'Измерение сохранено!');
  });

  document.getElementById('chemicalName').addEventListener('change', e => {
    document.getElementById('customChemicalWrap').classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value === 'custom') document.getElementById('customChemical').focus();
  });

  document.getElementById('chemistryForm').addEventListener('submit', e => {
    e.preventDefault();
    const pool = getActivePool();
    if (!pool) return;

    const chemical = getChemicalName();
    const amount = parseFloat(document.getElementById('chemicalAmount').value);
    const unit = document.getElementById('chemicalUnit').value;
    const comment = document.getElementById('chemicalComment').value.trim();

    if (!chemical) {
      alert('Укажите название химии.');
      return;
    }
    if (!amount || amount <= 0) {
      alert('Укажите количество больше нуля.');
      return;
    }

    chemistryLog.push({
      id: generateId(),
      poolId: pool.id,
      chemical,
      amount,
      unit,
      comment,
      date: new Date().toISOString()
    });
    saveChemistry();
    renderPoolContent();
    e.target.reset();
    document.getElementById('customChemicalWrap').classList.add('hidden');
    showMessage(document.getElementById('selectorMessage'), 'Запись о химии сохранена!');
  });

  document.getElementById('clearChemistryBtn').addEventListener('click', () => {
    const pool = getActivePool();
    if (!pool || !confirm(`Очистить историю химии для «${pool.name}»?`)) return;

    chemistryLog = chemistryLog.filter(c => c.poolId !== pool.id);
    saveChemistry();
    renderPoolContent();
    showMessage(document.getElementById('selectorMessage'), 'История химии очищена.');
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    const pool = getActivePool();
    if (!pool || !confirm(`Очистить историю измерений для «${pool.name}»?`)) return;

    measurements = measurements.filter(m => m.poolId !== pool.id);
    saveMeasurements();
    renderPoolContent();
    showMessage(document.getElementById('selectorMessage'), 'История очищена.');
  });

  document.getElementById('geocodeBtn').addEventListener('click', async () => {
    const address = document.getElementById('poolAddress').value.trim();
    if (!address) {
      alert('Введите адрес для поиска.');
      return;
    }

    updateLocationStatus('Ищем адрес...');
    try {
      const result = await geocodeAddress(address);
      if (!result) {
        updateLocationStatus('Адрес не найден. Попробуйте другую формулировку.');
        return;
      }
      document.getElementById('poolAddress').value = result.address;
      setMapMarker(result.lat, result.lng);
    } catch {
      updateLocationStatus('Ошибка поиска. Проверьте интернет.');
    }
  });

  document.getElementById('gpsBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Геолокация не поддерживается в этом браузере.');
      return;
    }

    updateLocationStatus('Определяем местоположение...');
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setMapMarker(latitude, longitude);
        try {
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            document.getElementById('poolAddress').value = address;
            updateLocationStatus(`Найдено: ${address}`);
          }
        } catch {
          /* coords already set on map */
        }
      },
      () => {
        updateLocationStatus('Не удалось определить GPS. Разрешите доступ к геолокации.');
        alert('Разрешите доступ к местоположению в настройках браузера.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  document.getElementById('saveLocationBtn').addEventListener('click', () => {
    if (savePoolLocation()) {
      showMessage(document.getElementById('selectorMessage'), 'Локация бассейна сохранена!');
    }
  });
}

async function init() {
  initAuthListeners();
  initEventListeners();

  await checkServerAuth();
  if (useServerAuth) {
    await migrateLocalUsersToServer();
  }
  showProtocolWarning();

  const session = getSession();
  if (session && session.userId) {
    if (useServerAuth) {
      currentUser = {
        id: session.userId,
        login: session.login,
        displayLogin: session.displayLogin || session.login,
        email: session.email || ''
      };
      startApp();
      return;
    }
    const user = getUsers().find(u => u.id === session.userId) || findUserByLogin(session.login || '');
    if (user) {
      currentUser = user;
      startApp();
      return;
    }
    clearSession();
  }

  showAuthScreen();
}

document.addEventListener('DOMContentLoaded', init);
