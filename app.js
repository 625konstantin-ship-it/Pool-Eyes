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

let currentUser = null;
let poolList = [];
let activePoolId = null;
let measurements = [];
let chemistryLog = [];
let poolPhotos = [];
let pendingChemistryPhoto = null;
let cameraStream = null;
let selectedProblems = {};
let charts = { ph: null, chlorine: null, temp: null };
let isUpdatingUI = false;
let poolMap = null;
let poolMarker = null;
let lastMapPoolId = null;
let mapInitRetries = 0;
let measurementHistoryOpen = false;
let chemistryHistoryOpen = false;
let pendingPasswordRecovery = false;
let telegramSettings = null;
let telegramConnectPending = false;
let telegramPollTimer = null;
let telegramPanelOpen = false;
let locationPanelOpen = false;
let poolEditMode = false;
const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_TILE_FALLBACK_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
const LEAFLET_ICON_BASE = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/';
const DEFAULT_MAP_CENTER = [50.4501, 30.5234];
const NOMINATIM_HEADERS = { 'Accept-Language': 'ru', 'User-Agent': 'PoolTracker/1.0 (local pool app)' };

function storageGet(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch { /* ignore */ }
}

function generateId() {
  return crypto.randomUUID();
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function activePoolKey() {
  return currentUser ? `activePool_${currentUser.id}` : null;
}

function saveActivePoolId() {
  const key = activePoolKey();
  if (key && activePoolId) storageSet(key, activePoolId);
}

async function loadUserData() {
  if (!currentUser) return;
  const data = await dbLoadUserData(currentUser.id);
  poolList = data.poolList;
  measurements = data.measurements;
  chemistryLog = data.chemistryLog;
  poolPhotos = data.poolPhotos || [];
  selectedProblems = data.selectedProblems;
  activePoolId = storageGet(activePoolKey()) || null;
  normalizeStoredData();
  await ensureDefaultPool();
}

async function saveActivePool() {
  const pool = getActivePool();
  if (!pool || !currentUser) return;
  await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
}

async function ensureDefaultPool() {
  if (poolList.length === 0) {
    const pool = await dbCreateDefaultPool(currentUser.id);
    poolList.push(pool);
    selectedProblems[pool.id] = [];
    activePoolId = pool.id;
    saveActivePoolId();
  }
  if (!activePoolId || !poolList.find(p => p.id === activePoolId)) {
    activePoolId = poolList[0].id;
    saveActivePoolId();
  }
}

function showConfigError() {
  document.getElementById('authConfigError').hidden = false;
  showAuthScreen();
}

function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appScreen').classList.add('hidden');
}

async function handleDbError(err, context) {
  console.error(context, err);
  alert('Ошибка сохранения: ' + (err.message || context));
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
      location: normalizeLocation(p.location),
      remindersEnabled: !!p.remindersEnabled,
      reminderIntervalDays: Number(p.reminderIntervalDays) || 7
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

function updateUserLabel() {
  const el = document.getElementById('currentUserLabel');
  if (!el || !currentUser) return;
  el.textContent = currentUser.email;
}

function closeUserMenu() {
  const dropdown = document.getElementById('userMenuDropdown');
  const btn = document.getElementById('userMenuBtn');
  if (dropdown) dropdown.classList.add('hidden');
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

function toggleUserMenu() {
  const dropdown = document.getElementById('userMenuDropdown');
  const btn = document.getElementById('userMenuBtn');
  if (!dropdown || !btn) return;

  const willOpen = dropdown.classList.contains('hidden');
  if (willOpen) {
    dropdown.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
  } else {
    closeUserMenu();
  }
}

async function handleChangePassword() {
  closeUserMenu();
  if (!currentUser?.email) return;

  if (!confirm(`Отправить ссылку для смены пароля на ${currentUser.email}?`)) return;

  try {
    const result = await authResetPassword(currentUser.email);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    alert(result.message);
  } catch (err) {
    alert(translateAuthError(err.message || 'Ошибка отправки'));
  }
}

function resetAuthCardHeader() {
  const title = document.querySelector('.auth-card h1');
  const subtitle = document.querySelector('.auth-card .subtitle');
  if (title) title.textContent = 'Учёт параметров бассейна';
  if (subtitle) subtitle.textContent = 'Войдите или создайте учётную запись';
}

function showPasswordResetScreen() {
  pendingPasswordRecovery = true;
  document.querySelector('.auth-tabs')?.classList.add('hidden');
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('registerForm')?.classList.add('hidden');
  document.getElementById('forgotForm')?.classList.add('hidden');
  document.getElementById('newPasswordForm')?.classList.remove('hidden');

  const title = document.querySelector('.auth-card h1');
  const subtitle = document.querySelector('.auth-card .subtitle');
  if (title) title.textContent = 'Новый пароль';
  if (subtitle) subtitle.textContent = 'Задайте новый пароль для входа';

  hideAuthMessages(['newPasswordError', 'newPasswordSuccess']);
  showAuthScreen();
}

async function handleUpdatePassword(e) {
  e.preventDefault();
  hideAuthMessages(['newPasswordError', 'newPasswordSuccess']);

  const form = e.target;
  const password = document.getElementById('newPassword').value;
  const confirm = document.getElementById('newPasswordConfirm').value;

  if (password !== confirm) {
    showAuthMessage('newPasswordError', 'Пароли не совпадают.');
    return;
  }

  setFormLoading(form, true, 'Сохранение...');
  try {
    const result = await authUpdatePassword(password);
    if (!result.ok) {
      showAuthMessage('newPasswordError', result.error);
      return;
    }

    pendingPasswordRecovery = false;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);

    const session = await authGetSession();
    if (session?.user) {
      currentUser = mapUser(session);
      document.getElementById('newPasswordForm')?.classList.add('hidden');
      document.querySelector('.auth-tabs')?.classList.remove('hidden');
      resetAuthCardHeader();
      form.reset();
      await startApp();
      showMessage(document.getElementById('selectorMessage'), 'Пароль успешно изменён!');
      return;
    }

    showAuthMessage('newPasswordSuccess', 'Пароль сохранён! Теперь вой с новым паролем.', 'success');
    document.getElementById('newPasswordForm')?.classList.add('hidden');
    document.querySelector('.auth-tabs')?.classList.remove('hidden');
    resetAuthCardHeader();
    switchAuthTab('login');
  } catch (err) {
    showAuthMessage('newPasswordError', translateAuthError(err.message || 'Ошибка сохранения'));
  } finally {
    setFormLoading(form, false);
  }
}

function setupSupabaseAuthListener() {
  sb.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      showPasswordResetScreen();
    }
  });
}

function isPasswordRecoveryUrl() {
  return window.location.hash.includes('type=recovery');
}

function showAppScreen() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  updateUserLabel();
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('forgotForm').classList.toggle('hidden', tab !== 'forgot');
  document.getElementById('newPasswordForm').classList.add('hidden');
  resetAuthCardHeader();
  document.querySelector('.auth-tabs')?.classList.remove('hidden');
  ['loginError', 'registerError', 'registerSuccess', 'forgotError', 'forgotSuccess', 'newPasswordError', 'newPasswordSuccess'].forEach(id => {
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
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function setFormLoading(form, loading, loadingText = 'Подождите...') {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  if (loading) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    btn.textContent = loadingText;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || btn.textContent;
    btn.disabled = false;
  }
}

async function handleLogin(e) {
  e.preventDefault();
  hideAuthMessages(['loginError']);
  const form = e.target;
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  setFormLoading(form, true, 'Вход...');
  try {
    const result = await authSignIn(email, password);
    if (!result.ok) {
      showAuthMessage('loginError', result.error);
      return;
    }
    currentUser = result.user;
    await startApp();
  } catch (err) {
    showAuthMessage('loginError', translateAuthError(err.message || 'Ошибка входа'));
  } finally {
    setFormLoading(form, false);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  hideAuthMessages(['registerError', 'registerSuccess']);

  const form = e.target;
  const displayName = document.getElementById('registerDisplayName').value;
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerPasswordConfirm').value;

  if (!email.includes('@') || !email.includes('.')) {
    showAuthMessage('registerError', 'Введите корректный email, например name@gmail.com');
    return;
  }

  if (password !== confirm) {
    showAuthMessage('registerError', 'Пароли не совпадают.');
    return;
  }

  setFormLoading(form, true, 'Регистрация...');
  try {
    const result = await authSignUp(email, password, displayName);
    if (!result.ok) {
      showAuthMessage('registerError', result.error);
      return;
    }

    if (result.needsConfirmation) {
      showAuthMessage(
        'registerSuccess',
        '✅ Аккаунт создан! Откройте почту (и папку «Спам»), перейдите по ссылке из письма, затем вой вой «Вход».',
        'success'
      );
      return;
    }

    currentUser = result.user;
    await startApp();
  } catch (err) {
    showAuthMessage('registerError', translateAuthError(err.message || 'Ошибка регистрации'));
  } finally {
    setFormLoading(form, false);
  }
}

async function handleForgot(e) {
  e.preventDefault();
  hideAuthMessages(['forgotError', 'forgotSuccess']);

  const form = e.target;
  const email = document.getElementById('forgotEmail').value.trim();

  setFormLoading(form, true, 'Отправка...');
  try {
    const result = await authResetPassword(email);
    if (!result.ok) {
      showAuthMessage('forgotError', result.error);
      return;
    }
    showAuthMessage('forgotSuccess', result.message, 'success');
  } catch (err) {
    showAuthMessage('forgotError', translateAuthError(err.message || 'Ошибка отправки'));
  } finally {
    setFormLoading(form, false);
  }
}

async function handleLogout() {
  closeUserMenu();
  await authSignOut();
  currentUser = null;
  poolList = [];
  activePoolId = null;
  measurements = [];
  chemistryLog = [];
  poolPhotos = [];
  selectedProblems = {};
  measurementHistoryOpen = false;
  chemistryHistoryOpen = false;
  telegramSettings = null;
  telegramPanelOpen = false;
  locationPanelOpen = false;
  destroyCharts();
  destroyPoolMap(true);
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

function refreshChartsSize() {
  Object.values(charts).forEach(chart => chart?.resize());
}

function setMeasurementHistoryOpen(open) {
  measurementHistoryOpen = open;
  const panel = document.getElementById('measurementHistoryPanel');
  const btn = document.getElementById('toggleMeasurementHistoryBtn');
  if (!panel || !btn) return;

  panel.classList.toggle('hidden', !open);
  btn.textContent = open ? 'Скрыть историю и графики' : 'История и графики';
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (open) {
    const pool = getActivePool();
    if (pool) {
      const poolMeas = getPoolMeasurements(pool.id);
      const treatmentType = getPoolTreatment(pool);
      renderCharts(poolMeas, treatmentType);
      setTimeout(refreshChartsSize, 50);
      setTimeout(refreshChartsSize, 300);
    }
  } else {
    destroyCharts();
  }
}

function toggleMeasurementHistory() {
  setMeasurementHistoryOpen(!measurementHistoryOpen);
}

function setChemistryHistoryOpen(open) {
  chemistryHistoryOpen = open;
  const panel = document.getElementById('chemistryHistoryPanel');
  const btn = document.getElementById('toggleChemistryHistoryBtn');
  if (!panel || !btn) return;

  panel.classList.toggle('hidden', !open);
  btn.textContent = open ? 'Скрыть историю химии' : 'История добавленной химии';
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function toggleChemistryHistory() {
  setChemistryHistoryOpen(!chemistryHistoryOpen);
}

async function startApp() {
  try {
    await loadUserData();
    showAppScreen();
    renderPoolSelect();
    await loadTelegramSettings();
    await setActivePool(activePoolId);
  } catch (err) {
    await handleDbError(err, 'loadUserData');
  }
}

function getActivePool() {
  return poolList.find(p => p.id === activePoolId) || null;
}

async function setActivePool(poolId) {
  const pool = poolList.find(p => p.id === poolId);
  if (!pool) return false;

  activePoolId = pool.id;
  saveActivePoolId();
  setMeasurementHistoryOpen(false);
  setChemistryHistoryOpen(false);
  setPoolEditMode(false);
  clearPendingChemistryPhoto();

  const select = document.getElementById('poolSelect');
  if (select && select.value !== pool.id) {
    isUpdatingUI = true;
    select.value = pool.id;
    isUpdatingUI = false;
  }

  renderPoolContent();
  return true;
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

function formatReportDateTime(iso) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function statusLabelForReport(status) {
  if (status === 'ok') return 'Норма';
  if (status === 'warn') return 'Внимание';
  return 'Критично';
}

function sanitizePdfFilename(name) {
  return String(name)
    .replace(/[^\w\u0400-\u04FF\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '_') || 'bassein';
}

function handleExportPdf() {
  const pool = getActivePool();
  if (!pool) {
    alert('Выберите бассейн.');
    return;
  }

  if (typeof pdfMake === 'undefined') {
    alert('Библиотека PDF не загрузилась. Обновите страницу.');
    return;
  }

  const poolMeas = getPoolMeasurements(pool.id);
  const poolChem = getPoolChemistry(pool.id);
  const treatmentType = getPoolTreatment(pool);

  if (poolMeas.length === 0 && poolChem.length === 0) {
    alert('Нет данных для выгрузки. Добавьте измерения или записи о химии.');
    return;
  }

  const sanitizerCol = getSanitizerLabel(treatmentType, true);
  const generatedAt = formatReportDateTime(new Date().toISOString());
  const poolInfo = [
    `Объём: ${formatVolume(pool.volume)}`,
    TREATMENT_LABELS[treatmentType],
    `Измерений: ${poolMeas.length}`,
    `Записей химии: ${poolChem.length}`
  ];
  if (pool.location?.address) poolInfo.push(`Адрес: ${pool.location.address}`);

  const content = [
    { text: 'Отчёт по бассейну', style: 'title' },
    { text: pool.name, style: 'subtitle' },
    {
      text: `Дата формирования: ${generatedAt}${currentUser?.email ? `\nАккаунт: ${currentUser.email}` : ''}`,
      style: 'meta',
      margin: [0, 0, 0, 8]
    },
    { ul: poolInfo, style: 'meta', margin: [0, 0, 0, 18] },
    { text: 'История измерений', style: 'section' }
  ];

  if (poolMeas.length === 0) {
    content.push({ text: 'Нет записей.', style: 'empty', margin: [0, 0, 0, 16] });
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
        body: [
          ['Дата', 'pH', sanitizerCol, 'Темп., °C', 'Статус'],
          ...poolMeas.map(m => {
            const status = getOverallStatus(m.ph, m.chlorine, m.temperature, treatmentType);
            return [
              formatReportDateTime(m.date),
              String(m.ph),
              String(m.chlorine),
              String(m.temperature),
              statusLabelForReport(status)
            ];
          })
        ]
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => '#c8dce8',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 4,
        paddingBottom: () => 4
      },
      margin: [0, 4, 0, 18]
    });
  }

  content.push({ text: 'История химии и работ', style: 'section' });

  if (poolChem.length === 0) {
    content.push({ text: 'Нет записей.', style: 'empty' });
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', 'auto', '*'],
        body: [
          ['Дата', 'Химия / препарат', 'Кол-во', 'Комментарий (работы)'],
          ...poolChem.map(c => [
            formatReportDateTime(c.date),
            c.chemical,
            `${c.amount} ${c.unit}`,
            c.comment || '—'
          ])
        ]
      },
      layout: {
        hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 1 : 0.5),
        vLineWidth: () => 0,
        hLineColor: () => '#c8dce8',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 4,
        paddingBottom: () => 4
      },
      margin: [0, 4, 0, 0]
    });
  }

  const filename = `otchet_${sanitizePdfFilename(pool.name)}_${new Date().toISOString().slice(0, 10)}.pdf`;

  pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [40, 48, 40, 48],
    content,
    styles: {
      title: { fontSize: 18, bold: true, color: '#0d4a6b' },
      subtitle: { fontSize: 14, bold: true, margin: [0, 4, 0, 8] },
      section: { fontSize: 12, bold: true, color: '#0d4a6b', margin: [0, 4, 0, 6] },
      meta: { fontSize: 10, color: '#444444' },
      empty: { fontSize: 10, color: '#666666', italics: true }
    },
    defaultStyle: { font: 'Roboto', fontSize: 9 }
  }).download(filename);

  showMessage(document.getElementById('selectorMessage'), 'PDF отчёт скачивается…');
}

function isTelegramBotConfigured() {
  return typeof TELEGRAM_BOT_USERNAME === 'string'
    && TELEGRAM_BOT_USERNAME.length > 2
    && TELEGRAM_BOT_USERNAME !== 'YourPoolBot';
}

function populateReminderHourSelect() {
  const select = document.getElementById('reminderHour');
  if (!select || select.options.length > 0) return;
  for (let h = 7; h <= 21; h++) {
    const opt = document.createElement('option');
    opt.value = String(h);
    opt.textContent = `${String(h).padStart(2, '0')}:00`;
    if (h === 9) opt.selected = true;
    select.appendChild(opt);
  }
}

function updateTelegramToggleButton() {
  const btn = document.getElementById('toggleTelegramBtn');
  if (!btn) return;

  if (telegramPanelOpen) {
    btn.textContent = 'Скрыть настройки напоминаний';
    btn.setAttribute('aria-expanded', 'true');
    return;
  }

  btn.setAttribute('aria-expanded', 'false');
  const enabledPools = poolList.filter(p => p.remindersEnabled).length;
  if (telegramSettings?.telegramChatId && enabledPools > 0) {
    const h = String(telegramSettings.reminderHour).padStart(2, '0');
    btn.textContent = `Напоминания • ${enabledPools} басс. • ${h}:00`;
  } else if (telegramSettings?.telegramChatId) {
    btn.textContent = 'Напоминания • Telegram подключён';
  } else {
    btn.textContent = 'Настроить напоминания';
  }
}

function setTelegramPanelOpen(open) {
  telegramPanelOpen = open;
  const panel = document.getElementById('telegramDetailsPanel');
  if (panel) panel.classList.toggle('hidden', !open);
  updateTelegramToggleButton();
}

function toggleTelegramPanel() {
  setTelegramPanelOpen(!telegramPanelOpen);
}

function showTelegramMessage(text, type = 'success') {
  const el = document.getElementById('telegramSettingsMessage');
  if (el) showMessage(el, text, type);
}

function renderTelegramRemindersUI() {
  const panel = document.getElementById('telegramPanel');
  const missing = document.getElementById('telegramBotMissing');
  if (!isTelegramBotConfigured()) {
    missing?.classList.remove('hidden');
    panel?.classList.add('hidden');
    updateTelegramToggleButton();
    return;
  }
  missing?.classList.add('hidden');
  panel?.classList.remove('hidden');

  const connected = !!telegramSettings?.telegramChatId;
  const statusEl = document.getElementById('telegramConnectionStatus');
  const connectBtn = document.getElementById('connectTelegramBtn');
  const checkBtn = document.getElementById('checkTelegramBtn');
  const disconnectBtn = document.getElementById('disconnectTelegramBtn');
  const form = document.getElementById('telegramSettingsForm');

  if (statusEl) {
    statusEl.textContent = connected
      ? 'Telegram подключён'
      : 'Telegram не подключён — нажмите кнопку ниже и откройте бота.';
    statusEl.className = connected ? 'telegram-status connected' : 'telegram-status';
  }

  connectBtn?.classList.toggle('hidden', connected);
  checkBtn?.classList.toggle('hidden', connected || !telegramConnectPending);
  disconnectBtn?.classList.toggle('hidden', !connected);
  form?.classList.toggle('hidden', !connected);
  document.getElementById('telegramSettingsLocked')?.classList.toggle('hidden', connected);

  if (!connected || !telegramSettings) {
    updateTelegramToggleButton();
    return;
  }

  document.getElementById('reminderHour').value = String(telegramSettings.reminderHour);
  updateTelegramToggleButton();
}

async function loadTelegramSettings() {
  if (!currentUser || !isTelegramBotConfigured()) {
    renderTelegramRemindersUI();
    return;
  }
  try {
    telegramSettings = await dbEnsureTelegramSettings(currentUser.id);
    renderTelegramRemindersUI();
  } catch (err) {
    console.error('telegram settings', err);
    showTelegramMessage('Не удалось загрузить настройки Telegram. Выполните supabase/telegram.sql', 'error');
  }
}

async function handleConnectTelegram() {
  if (!currentUser) return;
  try {
    const { token } = await dbCreateTelegramLinkToken(currentUser.id);
    const url = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`;
    telegramConnectPending = true;
    renderTelegramRemindersUI();
    window.open(url, '_blank', 'noopener,noreferrer');
    showTelegramMessage('1) В Telegram нажмите Start  2) Вернитесь сюда  3) «Проверить подключение»', 'info');
    startTelegramConnectPoll();
  } catch (err) {
    showTelegramMessage(err.message || 'Ошибка создания ссылки', 'error');
  }
}

function stopTelegramConnectPoll() {
  if (telegramPollTimer) {
    clearInterval(telegramPollTimer);
    telegramPollTimer = null;
  }
}

function startTelegramConnectPoll() {
  stopTelegramConnectPoll();
  let attempts = 0;
  telegramPollTimer = setInterval(async () => {
    attempts++;
    if (!currentUser || attempts > 20) {
      stopTelegramConnectPoll();
      return;
    }
    try {
      telegramSettings = await dbGetTelegramSettings(currentUser.id);
      if (telegramSettings?.telegramChatId) {
        telegramConnectPending = false;
        stopTelegramConnectPoll();
        renderTelegramRemindersUI();
        syncPoolReminderUI(getActivePool());
        showTelegramMessage('Telegram подключён! Настройте напоминания ниже.', 'success');
      }
    } catch { /* retry */ }
  }, 3000);
}

async function handleCheckTelegram() {
  if (!currentUser) return;
  try {
    telegramSettings = await dbGetTelegramSettings(currentUser.id);
    renderTelegramRemindersUI();
    if (telegramSettings?.telegramChatId) {
      telegramConnectPending = false;
      stopTelegramConnectPoll();
      showTelegramMessage('Telegram подключён! Настройте напоминания ниже.', 'success');
      syncPoolReminderUI(getActivePool());
    } else {
      showTelegramMessage('Пока не подключено. Нажмите Start в боте.', 'warn');
    }
  } catch (err) {
    showTelegramMessage(err.message || 'Ошибка проверки', 'error');
  }
}

async function handleDisconnectTelegram() {
  if (!currentUser || !confirm('Отключить Telegram? Напоминания перестанут приходить.')) return;
  try {
    telegramSettings = await dbSaveTelegramSettings(currentUser.id, {
      telegramChatId: null,
      remindersEnabled: false,
      clearLinkToken: true
    });
    renderTelegramRemindersUI();
    syncPoolReminderUI(getActivePool());
    showTelegramMessage('Telegram отключён.', 'success');
  } catch (err) {
    showTelegramMessage(err.message || 'Ошибка отключения', 'error');
  }
}

async function handleSaveTelegramSettings(e) {
  e.preventDefault();
  if (!currentUser || !telegramSettings?.telegramChatId) return;

  const reminderHour = parseInt(document.getElementById('reminderHour').value, 10);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';

  try {
    telegramSettings = await dbSaveTelegramSettings(currentUser.id, {
      reminderHour,
      timezone
    });
    renderTelegramRemindersUI();
    showTelegramMessage('Время сообщений сохранено.', 'success');
  } catch (err) {
    showTelegramMessage(err.message || 'Ошибка сохранения', 'error');
  }
}

function syncPoolSettingsView(pool) {
  const volEl = document.getElementById('poolVolumeDisplay');
  const treatEl = document.getElementById('poolTreatmentDisplay');
  if (!pool) return;
  if (volEl) volEl.textContent = formatVolume(pool.volume);
  if (treatEl) treatEl.textContent = TREATMENT_LABELS[getPoolTreatment(pool)];
}

function setPoolEditMode(edit) {
  poolEditMode = edit;
  document.getElementById('poolSettingsView')?.classList.toggle('hidden', edit);
  document.getElementById('poolSettingsEdit')?.classList.toggle('hidden', !edit);

  if (edit) {
    const pool = getActivePool();
    if (pool) {
      syncVolumeSelect(pool.volume);
      syncTreatmentSelect(getPoolTreatment(pool));
    }
  }
}

async function handleSavePoolSettings() {
  const pool = getActivePool();
  if (!pool) return;

  const volume = getVolumeFromSelect(
    document.getElementById('volumeSelect'),
    document.getElementById('customVolume')
  );
  if (!volume) {
    alert('Введите объём от 1000 литров.');
    return;
  }

  pool.volume = volume;
  pool.treatmentType = document.getElementById('treatmentSelect').value === 'peroxide' ? 'peroxide' : 'chlorine';

  try {
    await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
    setPoolEditMode(false);
    renderPoolContent();
    showMessage(document.getElementById('selectorMessage'), 'Настройки бассейна сохранены.');
  } catch (err) {
    await handleDbError(err, 'savePoolSettings');
  }
}

function handleCancelPoolEdit() {
  setPoolEditMode(false);
  const pool = getActivePool();
  if (pool) syncPoolSettingsView(pool);
}

function syncPoolReminderUI(pool) {
  const section = document.getElementById('poolReminderSection');
  const options = document.getElementById('poolReminderOptions');
  const nameEl = document.getElementById('poolReminderPoolName');
  const telegramConnected = !!telegramSettings?.telegramChatId;

  if (nameEl) nameEl.textContent = pool?.name || '—';

  if (!section) return;

  section.classList.toggle('hidden', !telegramConnected || !pool);

  if (!pool || !telegramConnected) return;

  const enabledEl = document.getElementById('poolRemindersEnabled');
  const intervalEl = document.getElementById('poolReminderInterval');

  if (enabledEl) enabledEl.checked = !!pool.remindersEnabled;
  if (intervalEl) intervalEl.value = String(pool.reminderIntervalDays || 7);
  if (options) options.classList.toggle('hidden', !pool.remindersEnabled);
}

async function handleSavePoolReminders() {
  const pool = getActivePool();
  if (!pool || !currentUser || !telegramSettings?.telegramChatId) return;

  const enabled = document.getElementById('poolRemindersEnabled').checked;
  const reminderIntervalDays = parseInt(document.getElementById('poolReminderInterval').value, 10);
  const msgEl = document.getElementById('poolReminderMessage');

  pool.remindersEnabled = enabled;
  pool.reminderIntervalDays = reminderIntervalDays;

  try {
    await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
    syncPoolReminderUI(pool);
    renderTelegramRemindersUI();
    if (msgEl) showMessage(msgEl, enabled ? 'Напоминания для бассейна включены.' : 'Напоминания для бассейна выключены.', 'success');
  } catch (err) {
    if (msgEl) showMessage(msgEl, err.message || 'Ошибка сохранения', 'error');
    await handleDbError(err, 'savePoolReminders');
  }
}

function initTelegramReminders() {
  populateReminderHourSelect();
  document.getElementById('toggleTelegramBtn')?.addEventListener('click', toggleTelegramPanel);
  document.getElementById('connectTelegramBtn')?.addEventListener('click', handleConnectTelegram);
  document.getElementById('checkTelegramBtn')?.addEventListener('click', handleCheckTelegram);
  document.getElementById('disconnectTelegramBtn')?.addEventListener('click', handleDisconnectTelegram);
  document.getElementById('telegramSettingsForm')?.addEventListener('submit', handleSaveTelegramSettings);
  document.getElementById('poolRemindersEnabled')?.addEventListener('change', e => {
    document.getElementById('poolReminderOptions')?.classList.toggle('hidden', !e.target.checked);
  });
  document.getElementById('savePoolRemindersBtn')?.addEventListener('click', handleSavePoolReminders);
  renderTelegramRemindersUI();
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
  return parts.join(' · ');
}

function updateLocationStatus(text) {
  const el = document.getElementById('locationStatus');
  if (el) el.textContent = text;
}

function destroyPoolMap(resetPoolId = false) {
  if (poolMap) {
    poolMap.remove();
    poolMap = null;
    poolMarker = null;
  }
  if (resetPoolId) lastMapPoolId = null;
}

function fixLeafletIcons() {
  if (typeof L === 'undefined') return;
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: LEAFLET_ICON_BASE + 'marker-icon-2x.png',
    iconUrl: LEAFLET_ICON_BASE + 'marker-icon.png',
    shadowUrl: LEAFLET_ICON_BASE + 'marker-shadow.png'
  });
}

function refreshMapSize() {
  if (!poolMap) return;
  poolMap.invalidateSize({ animate: false });
  requestAnimationFrame(() => {
    if (poolMap) poolMap.invalidateSize({ animate: false });
  });
}

function updateRouteLinks(lat, lng, address) {
  const routeCompact = document.getElementById('routeGoogleCompact');

  let href = null;
  if (lat != null && lng != null) {
    href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  } else if (address && address.trim()) {
    href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
  }

  if (href) {
    routeCompact?.classList.remove('hidden');
    if (routeCompact) routeCompact.href = href;
    return;
  }

  routeCompact?.classList.add('hidden');
}

function setMapMarker(lat, lng, pan = true) {
  if (!poolMap || typeof L === 'undefined') return;

  if (poolMarker) {
    poolMarker.setLatLng([lat, lng]);
  } else {
    poolMarker = L.marker([lat, lng], { draggable: true }).addTo(poolMap);
    poolMarker.on('dragend', () => {
      const pos = poolMarker.getLatLng();
      updateLocationStatus('Метка на карте — нажмите «Сохранить локацию»');
      updateRouteLinks(pos.lat, pos.lng, document.getElementById('poolAddress')?.value);
    });
  }

  if (pan) {
    poolMap.setView([lat, lng], Math.max(poolMap.getZoom(), 14));
  }
  updateRouteLinks(lat, lng, document.getElementById('poolAddress')?.value);
  updateLocationStatus('Метка на карте — нажмите «Сохранить локацию»');
}

function getMarkerCoords() {
  if (!poolMarker) return null;
  const pos = poolMarker.getLatLng();
  return { lat: pos.lat, lng: pos.lng };
}

function addPoolMapTiles(map) {
  const osm = L.tileLayer(MAP_TILE_URL, {
    subdomains: 'abc',
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });
  const osmFallback = L.tileLayer(MAP_TILE_FALLBACK_URL, {
    subdomains: 'abc',
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  });

  let tileErrors = 0;
  osm.on('tileerror', () => {
    tileErrors += 1;
    if (tileErrors >= 4 && map.hasLayer(osm)) {
      map.removeLayer(osm);
      osmFallback.addTo(map);
    }
  });

  osm.addTo(map);
}

function initPoolMap(pool) {
  const mapEl = document.getElementById('poolMap');
  if (!mapEl) return;

  if (typeof L === 'undefined') {
    if (mapInitRetries < 10) {
      mapInitRetries += 1;
      updateLocationStatus('Загрузка карты...');
      setTimeout(() => initPoolMap(pool), 400);
      return;
    }
    updateLocationStatus('Карта не загрузилась. Проверьте интернет или обновите страницу.');
    syncRouteFromPool(pool);
    return;
  }

  mapInitRetries = 0;
  fixLeafletIcons();
  destroyPoolMap();

  const loc = pool.location || normalizeLocation(null);
  const hasCoords = loc.lat != null && loc.lng != null;
  const center = hasCoords ? [loc.lat, loc.lng] : DEFAULT_MAP_CENTER;
  const zoom = hasCoords ? 15 : 10;

  try {
    poolMap = L.map(mapEl, { scrollWheelZoom: true }).setView(center, zoom);
    addPoolMapTiles(poolMap);

    if (hasCoords) {
      setMapMarker(loc.lat, loc.lng, false);
      updateLocationStatus(loc.address || 'Локация сохранена');
    } else {
      updateLocationStatus('Кликните на карту, чтобы поставить метку, или найдите адрес.');
    }

    poolMap.on('click', e => {
      setMapMarker(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(refreshMapSize, 100);
    setTimeout(refreshMapSize, 500);
  } catch (err) {
    console.error('Map init error:', err);
    updateLocationStatus('Не удалось показать карту. Используйте «Найти по адресу» или GPS — маршрут всё равно можно сохранить.');
  }

  syncRouteFromPool(pool);
}

function syncRouteFromPool(pool) {
  const loc = pool?.location || normalizeLocation(null);
  updateRouteLinks(loc.lat, loc.lng, loc.address);
}

function updateLocationSummary(pool) {
  const el = document.getElementById('locationSummaryText');
  const btn = document.getElementById('toggleLocationBtn');
  if (!el) return;

  const loc = pool?.location || normalizeLocation(null);

  if (loc.address) {
    el.textContent = loc.address;
    el.classList.remove('hidden');
  } else {
    el.textContent = '';
    el.classList.add('hidden');
  }

  if (btn) {
    btn.setAttribute('aria-expanded', locationPanelOpen ? 'true' : 'false');
    btn.classList.toggle('is-open', locationPanelOpen);
    btn.title = locationPanelOpen ? 'Скрыть карту' : 'Локация бассейна';
  }
}

function setLocationPanelOpen(open) {
  locationPanelOpen = open;
  const popover = document.getElementById('locationPopover');
  if (popover) popover.classList.toggle('hidden', !open);

  const pool = getActivePool();
  if (open && pool) {
    const poolChanged = lastMapPoolId !== pool.id;
    if (poolChanged || !poolMap) {
      lastMapPoolId = pool.id;
      initPoolMap(pool);
    } else {
      refreshMapSize();
    }
  } else if (!open) {
    destroyPoolMap(false);
  }

  updateLocationSummary(pool);
}

function toggleLocationPanel() {
  setLocationPanelOpen(!locationPanelOpen);
}

function renderLocationUI(pool) {
  const addressInput = document.getElementById('poolAddress');

  if (addressInput) {
    addressInput.value = pool.location?.address || '';
  }

  syncRouteFromPool(pool);
  updateLocationSummary(pool);

  if (!locationPanelOpen) return;

  const poolChanged = lastMapPoolId !== pool.id;
  if (poolChanged || !poolMap) {
    lastMapPoolId = pool.id;
    initPoolMap(pool);
  } else {
    refreshMapSize();
  }
}

async function geocodeAddress(address) {
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&lang=ru`;
    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length) {
        const [lng, lat] = data.features[0].geometry.coordinates;
        const p = data.features[0].properties;
        const parts = [p.name, p.street, p.housenumber, p.city, p.country].filter(Boolean);
        return {
          lat,
          lng,
          address: parts.join(', ') || address
        };
      }
    }
  } catch { /* fallback */ }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=ua&accept-language=ru`;
    const res = await fetch(url, { headers: NOMINATIM_HEADERS });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.length) return null;
    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      address: data[0].display_name
    };
  } catch {
    return null;
  }
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ru`;
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  if (!res.ok) return '';
  const data = await res.json();
  return data.display_name || '';
}

async function savePoolLocation() {
  const pool = getActivePool();
  if (!pool || !currentUser) return false;

  let coords = getMarkerCoords();
  const address = document.getElementById('poolAddress').value.trim();

  if (!coords && pool.location?.lat != null && pool.location?.lng != null) {
    coords = { lat: pool.location.lat, lng: pool.location.lng };
  }

  if (!coords) {
    alert('Сначала укажите точку на карте, нажмите «Найти по адресу» или «Моё местоположение».');
    return false;
  }

  pool.location = { address, lat: coords.lat, lng: coords.lng };
  try {
    await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
  } catch (err) {
    await handleDbError(err, 'saveLocation');
    return false;
  }
  syncRouteFromPool(pool);
  updateLocationSummary(pool);
  updateLocationStatus(pool.location.address || 'Локация сохранена');
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
    saveActivePoolId();
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

function updateChemistryPhotoUI() {
  const btn = document.getElementById('chemistryPhotoBtn');
  const status = document.getElementById('chemistryPhotoStatus');
  if (!btn || !status) return;

  if (pendingChemistryPhoto) {
    btn.classList.add('has-photo');
    btn.title = 'Фото выбрано — нажмите «Сохранить запись»';
    status.textContent = 'Фото готово';
    status.classList.remove('hidden');
  } else {
    btn.classList.remove('has-photo');
    btn.title = 'Добавить фото бассейна';
    status.textContent = '';
    status.classList.add('hidden');
  }
}

function clearPendingChemistryPhoto() {
  pendingChemistryPhoto = null;
  const galleryInput = document.getElementById('chemistryPhotoGalleryInput');
  const cameraInput = document.getElementById('chemistryPhotoCameraInput');
  if (galleryInput) galleryInput.value = '';
  if (cameraInput) cameraInput.value = '';
  updateChemistryPhotoUI();
}

function handleChemistryPhotoSelected(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  pendingChemistryPhoto = file;
  updateChemistryPhotoUI();
}

function openPhotoSourceModal() {
  document.getElementById('photoSourceModal')?.classList.remove('hidden');
}

function closePhotoSourceModal() {
  document.getElementById('photoSourceModal')?.classList.add('hidden');
}

function stopCameraStream() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const video = document.getElementById('cameraPreview');
  if (video) video.srcObject = null;
}

function closeCameraCapture() {
  stopCameraStream();
  const modal = document.getElementById('cameraCaptureModal');
  const errorEl = document.getElementById('cameraError');
  const fallbackBtn = document.getElementById('cameraFallbackBtn');
  if (modal) modal.classList.add('hidden');
  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  if (fallbackBtn) fallbackBtn.classList.add('hidden');
}

async function startCameraStream() {
  stopCameraStream();
  const video = document.getElementById('cameraPreview');
  const errorEl = document.getElementById('cameraError');
  const fallbackBtn = document.getElementById('cameraFallbackBtn');
  if (!video) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Камера недоступна в этом браузере');
  }

  if (errorEl) {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }
  if (fallbackBtn) fallbackBtn.classList.add('hidden');

  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false
  });

  video.srcObject = cameraStream;
  await video.play();
}

async function openCameraCapture() {
  closePhotoSourceModal();
  const modal = document.getElementById('cameraCaptureModal');
  if (!modal) return;

  modal.classList.remove('hidden');

  try {
    await startCameraStream();
  } catch (err) {
    console.error('Camera error:', err);
    stopCameraStream();
    const errorEl = document.getElementById('cameraError');
    const fallbackBtn = document.getElementById('cameraFallbackBtn');
    if (errorEl) {
      errorEl.textContent = 'Не удалось включить камеру. Разрешите доступ или выберите файл.';
      errorEl.hidden = false;
    }
    if (fallbackBtn) fallbackBtn.classList.remove('hidden');
  }
}

function openCameraFileInput() {
  document.getElementById('chemistryPhotoCameraInput')?.click();
}

function capturePhotoFromCamera() {
  const video = document.getElementById('cameraPreview');
  const canvas = document.getElementById('cameraCanvas');
  if (!video || !canvas || !video.videoWidth) {
    alert('Камера ещё не готова. Подождите секунду и попробуйте снова.');
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    if (!blob) {
      alert('Не удалось сделать фото.');
      return;
    }
    pendingChemistryPhoto = new File([blob], `pool-${Date.now()}.jpg`, { type: 'image/jpeg' });
    updateChemistryPhotoUI();
    closeCameraCapture();
  }, 'image/jpeg', 0.9);
}

function renderPoolContent() {
  const pool = getActivePool();
  const content = document.getElementById('poolContent');
  const noHint = document.getElementById('noPoolHint');

  if (!pool) {
    content.classList.add('hidden');
    noHint.classList.remove('hidden');
    destroyPoolMap(true);
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
  syncPoolSettingsView(pool);
  syncMeasurementLabels(treatmentType);
  syncPoolReminderUI(pool);
  renderLocationUI(pool);
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
  if (measurementHistoryOpen) {
    renderCharts(poolMeas, treatmentType);
    setTimeout(refreshChartsSize, 50);
  }

  const chartsHint = document.getElementById('chartsHint');
  if (chartsHint) {
    chartsHint.hidden = poolMeas.length > 0;
  }
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

function openPoolModal() {
  document.getElementById('addPoolModal').classList.remove('hidden');
  document.getElementById('newPoolName').value = '';
  document.getElementById('newPoolVolume').value = '25000';
  document.getElementById('newPoolTreatment').value = 'chlorine';
  document.getElementById('newCustomVolumeWrap').classList.add('hidden');
  document.getElementById('newCustomVolume').value = '';
  document.getElementById('modalError').hidden = true;
  document.getElementById('newPoolName').focus();
}

function closePoolModal() {
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
  document.getElementById('newPasswordForm').addEventListener('submit', handleUpdatePassword);
  document.getElementById('gotoForgotBtn').addEventListener('click', () => switchAuthTab('forgot'));
  document.getElementById('userMenuBtn').addEventListener('click', e => {
    e.stopPropagation();
    toggleUserMenu();
  });
  document.getElementById('changePasswordBtn').addEventListener('click', handleChangePassword);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.addEventListener('click', e => {
    if (!e.target.closest('#userMenu')) closeUserMenu();
  });
}

function initEventListeners() {
  document.getElementById('poolSelect').addEventListener('change', async e => {
    if (isUpdatingUI) return;
    const poolId = e.target.value;
    if (!poolId) {
      isUpdatingUI = true;
      e.target.value = activePoolId;
      isUpdatingUI = false;
      return;
    }
    if (await setActivePool(poolId)) {
      showMessage(document.getElementById('selectorMessage'), `Выбран бассейн «${getActivePool().name}»`);
    }
  });

  document.getElementById('addPoolBtn').addEventListener('click', openPoolModal);

  document.querySelectorAll('[data-close-pool-modal]').forEach(el => {
    el.addEventListener('click', closePoolModal);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closePoolModal();
      closeUserMenu();
    }
  });

  document.getElementById('newPoolVolume').addEventListener('change', e => {
    document.getElementById('newCustomVolumeWrap').classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value === 'custom') document.getElementById('newCustomVolume').focus();
  });

  document.getElementById('addPoolForm').addEventListener('submit', async e => {
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
      location: { address: '', lat: null, lng: null },
      remindersEnabled: false,
      reminderIntervalDays: 7
    };

    try {
      await dbUpsertPool(currentUser.id, pool, []);
      poolList.push(pool);
      selectedProblems[pool.id] = [];
      closePoolModal();
      renderPoolSelect();
      await setActivePool(pool.id);
      showMessage(document.getElementById('selectorMessage'), `Бассейн «${name}» добавлен!`);
    } catch (err) {
      await handleDbError(err, 'addPool');
    }
  });

  document.getElementById('deletePoolBtn').addEventListener('click', async () => {
    if (poolList.length <= 1) return;
    const pool = getActivePool();
    if (!confirm(`Удалить бассейн «${pool.name}» и все его данные?`)) return;

    const deletedId = activePoolId;
    try {
      await dbDeletePool(deletedId);
      poolList = poolList.filter(p => p.id !== deletedId);
      measurements = measurements.filter(m => m.poolId !== deletedId);
      chemistryLog = chemistryLog.filter(c => c.poolId !== deletedId);
      poolPhotos = poolPhotos.filter(p => p.poolId !== deletedId);
      delete selectedProblems[deletedId];
      activePoolId = poolList[0].id;
      saveActivePoolId();
      renderPoolSelect();
      await setActivePool(activePoolId);
      showMessage(document.getElementById('selectorMessage'), 'Бассейн удалён.');
    } catch (err) {
      await handleDbError(err, 'deletePool');
    }
  });

  document.getElementById('volumeSelect').addEventListener('change', e => {
    if (isUpdatingUI || !poolEditMode) return;
    const wrap = document.getElementById('customVolumeWrap');
    wrap.classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value === 'custom') {
      document.getElementById('customVolume').focus();
    }
  });

  document.getElementById('editPoolBtn')?.addEventListener('click', () => setPoolEditMode(true));
  document.getElementById('savePoolSettingsBtn')?.addEventListener('click', handleSavePoolSettings);
  document.getElementById('cancelPoolEditBtn')?.addEventListener('click', handleCancelPoolEdit);

  document.getElementById('chemistryPhotoBtn')?.addEventListener('click', openPhotoSourceModal);
  document.getElementById('chemistryPhotoGalleryInput')?.addEventListener('change', handleChemistryPhotoSelected);
  document.getElementById('chemistryPhotoCameraInput')?.addEventListener('change', handleChemistryPhotoSelected);
  document.getElementById('photoFromGalleryBtn')?.addEventListener('click', () => {
    document.getElementById('chemistryPhotoGalleryInput')?.click();
    closePhotoSourceModal();
  });
  document.getElementById('photoFromCameraBtn')?.addEventListener('click', () => {
    if (navigator.mediaDevices?.getUserMedia) {
      openCameraCapture();
      return;
    }
    document.getElementById('chemistryPhotoCameraInput')?.click();
    closePhotoSourceModal();
  });
  document.getElementById('capturePhotoBtn')?.addEventListener('click', capturePhotoFromCamera);
  document.getElementById('cameraFallbackBtn')?.addEventListener('click', () => {
    closeCameraCapture();
    openCameraFileInput();
  });
  document.querySelectorAll('[data-close-photo-source]').forEach(el => {
    el.addEventListener('click', closePhotoSourceModal);
  });
  document.querySelectorAll('[data-close-camera]').forEach(el => {
    el.addEventListener('click', closeCameraCapture);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) closeCameraCapture();
  });

  document.getElementById('toggleMeasurementHistoryBtn').addEventListener('click', toggleMeasurementHistory);
  document.getElementById('toggleChemistryHistoryBtn')?.addEventListener('click', toggleChemistryHistory);

  document.getElementById('measurementForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pool = getActivePool();
    if (!pool) return;

    const entry = {
      id: generateId(),
      poolId: pool.id,
      ph: parseFloat(document.getElementById('ph').value),
      chlorine: parseFloat(document.getElementById('chlorine').value),
      temperature: parseFloat(document.getElementById('temperature').value),
      date: new Date().toISOString()
    };

    try {
      const saved = await dbInsertMeasurement(currentUser.id, entry);
      measurements.unshift(saved);
      renderPoolContent();
      e.target.reset();
      showMessage(document.getElementById('selectorMessage'), 'Измерение сохранено!');
    } catch (err) {
      await handleDbError(err, 'saveMeasurement');
    }
  });

  document.getElementById('chemicalName').addEventListener('change', e => {
    document.getElementById('customChemicalWrap').classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value === 'custom') document.getElementById('customChemical').focus();
  });

  document.getElementById('chemistryForm').addEventListener('submit', async e => {
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

    const entry = {
      id: generateId(),
      poolId: pool.id,
      chemical,
      amount,
      unit,
      comment,
      date: new Date().toISOString()
    };

    try {
      const saved = await dbInsertChemistry(currentUser.id, entry);
      chemistryLog.unshift(saved);

      const hadPhoto = !!pendingChemistryPhoto;
      if (pendingChemistryPhoto) {
        const caption = `${chemical}, ${amount} ${unit}`;
        const photo = await dbUploadPhoto(currentUser.id, pool.id, pendingChemistryPhoto, caption);
        poolPhotos.unshift(photo);
        clearPendingChemistryPhoto();
      }

      renderPoolContent();
      e.target.reset();
      document.getElementById('customChemicalWrap').classList.add('hidden');
      showMessage(
        document.getElementById('selectorMessage'),
        hadPhoto ? 'Запись и фото сохранены!' : 'Запись о химии сохранена!'
      );
    } catch (err) {
      await handleDbError(err, 'saveChemistry');
    }
  });

  document.getElementById('clearChemistryBtn').addEventListener('click', async () => {
    const pool = getActivePool();
    if (!pool || !confirm(`Очистить историю химии для «${pool.name}»?`)) return;

    try {
      await dbClearChemistry(pool.id);
      chemistryLog = chemistryLog.filter(c => c.poolId !== pool.id);
      renderPoolContent();
      showMessage(document.getElementById('selectorMessage'), 'История химии очищена.');
    } catch (err) {
      await handleDbError(err, 'clearChemistry');
    }
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    const pool = getActivePool();
    if (!pool || !confirm(`Очистить историю измерений для «${pool.name}»?`)) return;

    try {
      await dbClearMeasurements(pool.id);
      measurements = measurements.filter(m => m.poolId !== pool.id);
      renderPoolContent();
      showMessage(document.getElementById('selectorMessage'), 'История очищена.');
    } catch (err) {
      await handleDbError(err, 'clearMeasurements');
    }
  });

  document.getElementById('exportPdfBtn').addEventListener('click', handleExportPdf);

  document.getElementById('toggleLocationBtn')?.addEventListener('click', toggleLocationPanel);
  document.getElementById('locationSummaryText')?.addEventListener('click', toggleLocationPanel);

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

  document.getElementById('saveLocationBtn').addEventListener('click', async () => {
    if (await savePoolLocation()) {
      showMessage(document.getElementById('selectorMessage'), 'Локация бассейна сохранена!');
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && poolMap && locationPanelOpen) refreshMapSize();
  });
}

async function init() {
  registerServiceWorker();

  if (!initSupabaseClient()) {
    showConfigError();
    return;
  }

  setupSupabaseAuthListener();
  initAuthListeners();
  initTelegramReminders();
  initEventListeners();

  const session = await authGetSession();

  if (pendingPasswordRecovery || isPasswordRecoveryUrl()) {
    showPasswordResetScreen();
    return;
  }

  if (session?.user) {
    currentUser = mapUser(session);
    await startApp();
    return;
  }

  showAuthScreen();
}

document.addEventListener('DOMContentLoaded', init);

function isLocalDevHost() {
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  if (isLocalDevHost()) {
    navigator.serviceWorker.getRegistrations().then(async regs => {
      const hadSw = regs.length > 0 || Boolean(navigator.serviceWorker.controller);
      await Promise.all(regs.map(reg => reg.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      if (hadSw) window.location.reload();
    });
    return;
  }

  let refreshing = false;
  let swRegistration = null;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const checkForSwUpdate = () => swRegistration?.update().catch(() => {});

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js?v=22')
      .then(reg => {
        swRegistration = reg;
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              worker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      })
      .catch(() => {});
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForSwUpdate();
  });
}
