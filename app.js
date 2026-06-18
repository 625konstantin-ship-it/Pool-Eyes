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
const memoryStorage = {};

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

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
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

function setSession(userId, login) {
  storageSet(STORAGE_KEYS.session, JSON.stringify({ userId, login }));
}

function clearSession() {
  storageRemove(STORAGE_KEYS.session);
}

function normalizeLogin(login) {
  return login.trim().toLowerCase();
}

async function registerUser(login, password) {
  const normalized = normalizeLogin(login);
  if (normalized.length < 3) return { ok: false, error: 'Логин — минимум 3 символа.' };
  if (password.length < 4) return { ok: false, error: 'Пароль — минимум 4 символа.' };

  const users = getUsers();
  if (users.some(u => u.login === normalized)) {
    return { ok: false, error: 'Такой логин уже занят.' };
  }

  const salt = generateId();
  const passwordHash = await hashPassword(password, salt);
  const user = { id: generateId(), login: normalized, displayLogin: login.trim(), salt, passwordHash };
  users.push(user);
  saveUsers(users);

  if (users.length === 1) migrateLegacyToUser(user.id);

  return { ok: true, user };
}

async function loginUser(login, password) {
  const normalized = normalizeLogin(login);
  const user = getUsers().find(u => u.login === normalized);
  if (!user) return { ok: false, error: 'Неверный логин или пароль.' };

  const hash = await hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    return { ok: false, error: 'Неверный логин или пароль.' };
  }

  return { ok: true, user };
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

function normalizeStoredData() {
  poolList = poolList
    .filter(p => p && p.id && p.name)
    .map(p => ({
      id: String(p.id),
      name: String(p.name),
      volume: Number(p.volume) || 25000,
      treatmentType: p.treatmentType === 'peroxide' ? 'peroxide' : 'chlorine'
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
    const pool = { id: generateId(), name: 'Мой бассейн', volume: 25000, treatmentType: 'chlorine' };
    poolList.push(pool);
    activePoolId = pool.id;
    savePools();
  }
  if (!activePoolId || !poolList.find(p => p.id === activePoolId)) {
    activePoolId = poolList[0].id;
    savePools();
  }
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  document.getElementById('currentUserLabel').textContent = currentUser.displayLogin || currentUser.login;
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('loginError').hidden = true;
  document.getElementById('registerError').hidden = true;
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
  setSession(currentUser.id, currentUser.displayLogin || currentUser.login);
  startApp();
}

async function handleRegister(e) {
  e.preventDefault();
  const login = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerPasswordConfirm').value;
  const errorEl = document.getElementById('registerError');

  if (password !== confirm) {
    errorEl.textContent = 'Пароли не совпадают.';
    errorEl.hidden = false;
    return;
  }

  const result = await registerUser(login, password);
  if (!result.ok) {
    errorEl.textContent = result.error;
    errorEl.hidden = false;
    return;
  }

  currentUser = result.user;
  setSession(currentUser.id, currentUser.displayLogin || currentUser.login);
  startApp();
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
    return;
  }

  content.classList.remove('hidden');
  noHint.classList.add('hidden');

  const poolMeas = getPoolMeasurements(pool.id);
  const poolChem = getPoolChemistry(pool.id);
  const treatmentType = getPoolTreatment(pool);

  document.getElementById('activePoolName').textContent = pool.name;
  document.getElementById('activePoolMeta').textContent =
    `Объём: ${formatVolume(pool.volume)} · ${TREATMENT_LABELS[treatmentType]} · Измерений: ${poolMeas.length} · Записей химии: ${poolChem.length}`;

  syncVolumeSelect(pool.volume);
  syncTreatmentSelect(treatmentType);
  syncMeasurementLabels(treatmentType);
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
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
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
      treatmentType: document.getElementById('newPoolTreatment').value === 'peroxide' ? 'peroxide' : 'chlorine'
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
}

function init() {
  initAuthListeners();
  initEventListeners();

  const session = getSession();
  if (session && session.userId) {
    const user = getUsers().find(u => u.id === session.userId);
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
