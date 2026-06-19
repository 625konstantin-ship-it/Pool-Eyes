function getNorms() {
  return {
    ph: { min: 7.2, max: 7.6, ideal: t('norm.phIdeal') },
    chlorine: { min: 1.0, max: 3.0, ideal: t('norm.chlorineIdeal') },
    peroxide: { min: 30, max: 75, ideal: t('norm.peroxideIdeal') },
    temperature: { min: 24, max: 28, ideal: t('norm.tempIdeal') }
  };
}

function treatmentLabel(type) {
  return type === 'peroxide' ? t('treatment.peroxide') : t('treatment.chlorine');
}

function getNominatimLang() {
  const lang = getLang();
  if (lang === 'en') return 'en';
  if (lang === 'es') return 'es';
  return 'ru';
}

function getNominatimHeaders() {
  return { 'Accept-Language': getNominatimLang(), 'User-Agent': 'PoolTracker/1.0 (local pool app)' };
}

let currentUser = null;
let poolList = [];
let activePoolId = null;
let measurements = [];
let chemistryLog = [];
let poolPhotos = [];
let pendingChemistryPhoto = null;
let pendingChemistryPhotoUrl = null;
let savedChemistryPhotoUrl = null;
let pendingChemistryBatch = [];
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
let locationPanelOpen = false;
let poolEditMode = false;
const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_TILE_FALLBACK_URL = 'https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png';
const LEAFLET_ICON_BASE = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/';
const DEFAULT_MAP_CENTER = [50.4501, 30.5234];

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
  if (!key) return;
  try {
    if (activePoolId) localStorage.setItem(key, activePoolId);
    else localStorage.removeItem(key);
  } catch { /* ignore */ }
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
  syncActivePoolId();
}

async function saveActivePool() {
  const pool = getActivePool();
  if (!pool || !currentUser) return;
  await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
}

function syncActivePoolId() {
  if (poolList.length === 0) {
    activePoolId = null;
    saveActivePoolId();
    return;
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
  alert(t('error.save', { message: err.message || context }));
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

  if (!confirm(t('auth.changePasswordConfirm', { email: currentUser.email }))) return;

  try {
    const result = await authResetPassword(currentUser.email);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    alert(result.message);
  } catch (err) {
    alert(translateAuthError(err.message || t('auth.error.send')));
  }
}

function resetAuthCardHeader() {
  document.getElementById('authBrandHeader')?.classList.remove('hidden');
  document.getElementById('authFormHeader')?.classList.add('hidden');
  const subtitle = document.getElementById('authSubtitle');
  if (subtitle) subtitle.textContent = t('app.subtitle');
}

function showPasswordResetScreen() {
  pendingPasswordRecovery = true;
  document.querySelector('.auth-tabs')?.classList.add('hidden');
  document.getElementById('loginForm')?.classList.add('hidden');
  document.getElementById('registerForm')?.classList.add('hidden');
  document.getElementById('forgotForm')?.classList.add('hidden');
  document.getElementById('newPasswordForm')?.classList.remove('hidden');

  document.getElementById('authBrandHeader')?.classList.add('hidden');
  document.getElementById('authFormHeader')?.classList.remove('hidden');

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
    showAuthMessage('newPasswordError', t('auth.passwordMismatch'));
    return;
  }

  setFormLoading(form, true, t('auth.saving'));
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
      showMessage(document.getElementById('selectorMessage'), t('auth.passwordChanged'));
      return;
    }

    showAuthMessage('newPasswordSuccess', t('auth.passwordSavedLogin'), 'success');
    document.getElementById('newPasswordForm')?.classList.add('hidden');
    document.querySelector('.auth-tabs')?.classList.remove('hidden');
    resetAuthCardHeader();
    switchAuthTab('login');
  } catch (err) {
    showAuthMessage('newPasswordError', translateAuthError(err.message || t('auth.error.save')));
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

function setFormLoading(form, loading, loadingText = null) {
  const btn = form?.querySelector('button[type="submit"]');
  if (!btn) return;
  const waitText = loadingText || t('auth.loading');
  if (loading) {
    if (!btn.dataset.originalText) btn.dataset.originalText = btn.textContent;
    btn.textContent = waitText;
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

  setFormLoading(form, true, t('auth.loggingIn'));
  try {
    const result = await authSignIn(email, password);
    if (!result.ok) {
      showAuthMessage('loginError', result.error);
      return;
    }
    currentUser = result.user;
    await startApp();
  } catch (err) {
    showAuthMessage('loginError', translateAuthError(err.message || t('auth.error.login')));
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
    showAuthMessage('registerError', t('auth.invalidEmailFormat'));
    return;
  }

  if (password !== confirm) {
    showAuthMessage('registerError', t('auth.passwordMismatch'));
    return;
  }

  setFormLoading(form, true, t('auth.registering'));
  try {
    const result = await authSignUp(email, password, displayName);
    if (!result.ok) {
      showAuthMessage('registerError', result.error);
      return;
    }

    if (result.needsConfirmation) {
      showAuthMessage(
        'registerSuccess',
        t('auth.registerSuccess'),
        'success'
      );
      return;
    }

    currentUser = result.user;
    await startApp();
  } catch (err) {
    showAuthMessage('registerError', translateAuthError(err.message || t('auth.error.register')));
  } finally {
    setFormLoading(form, false);
  }
}

async function handleForgot(e) {
  e.preventDefault();
  hideAuthMessages(['forgotError', 'forgotSuccess']);

  const form = e.target;
  const email = document.getElementById('forgotEmail').value.trim();

  setFormLoading(form, true, t('auth.sending'));
  try {
    const result = await authResetPassword(email);
    if (!result.ok) {
      showAuthMessage('forgotError', result.error);
      return;
    }
    showAuthMessage('forgotSuccess', result.message, 'success');
  } catch (err) {
    showAuthMessage('forgotError', translateAuthError(err.message || t('auth.error.send')));
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
  btn.textContent = open ? t('measure.historyHide') : t('measure.historyToggle');
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
  btn.textContent = open ? t('chem.historyHide') : t('chem.historyToggle');
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
    if (poolList.length > 0) {
      await setActivePool(activePoolId);
    } else {
      renderPoolContent();
    }
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
  clearSavedChemistryPhotoPreview();
  clearChemistryBatch();

  PoolSelectUI.setValue(pool.id);

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
  const formatted = Number(liters).toLocaleString(getLocale());
  const unit = getLang() === 'ru' ? 'л' : 'L';
  return `${formatted} ${unit}`;
}

function formatReportDateTime(iso) {
  return new Date(iso).toLocaleString(getLocale(), {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function statusLabelForReport(status) {
  if (status === 'ok') return t('status.ok');
  if (status === 'warn') return t('status.warn');
  return t('status.crit');
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
    alert(t('export.selectPool'));
    return;
  }

  if (typeof pdfMake === 'undefined') {
    alert(t('export.noLibrary'));
    return;
  }

  const poolMeas = getPoolMeasurements(pool.id);
  const poolChem = getPoolChemistry(pool.id);
  const treatmentType = getPoolTreatment(pool);

  if (poolMeas.length === 0 && poolChem.length === 0) {
    alert(t('export.noData'));
    return;
  }

  const sanitizerCol = getSanitizerLabel(treatmentType, true);
  const generatedAt = formatReportDateTime(new Date().toISOString());
  const poolInfo = [
    t('pool.meta.volume', { volume: formatVolume(pool.volume) }),
    treatmentLabel(treatmentType),
    t('pool.meta.measurements', { count: poolMeas.length }),
    t('pool.meta.chemistry', { count: poolChem.length })
  ];
  if (pool.location?.address) poolInfo.push(t('export.address', { address: pool.location.address }));

  const content = [
    { text: t('export.title'), style: 'title' },
    { text: pool.name, style: 'subtitle' },
    {
      text: `${t('export.generatedAt', { date: generatedAt })}${currentUser?.email ? `\n${t('export.account', { email: currentUser.email })}` : ''}`,
      style: 'meta',
      margin: [0, 0, 0, 8]
    },
    { ul: poolInfo, style: 'meta', margin: [0, 0, 0, 18] },
    { text: t('export.measurementsTitle'), style: 'section' }
  ];

  if (poolMeas.length === 0) {
    content.push({ text: t('export.noRecords'), style: 'empty', margin: [0, 0, 0, 16] });
  } else {
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto', 'auto'],
        body: [
          [t('export.col.date'), 'pH', sanitizerCol, t('export.col.temp'), t('export.col.status')],
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

  content.push({ text: t('export.chemistryTitle'), style: 'section' });

  if (poolChem.length === 0) {
    content.push({ text: t('export.noRecords'), style: 'empty' });
  } else {
    const chemGroups = groupChemistryBySession(poolChem);
    content.push({
      table: {
        headerRows: 1,
        widths: ['*', '*', '*'],
        body: [
          [t('export.col.date'), t('export.col.added'), t('export.col.comment')],
          ...chemGroups.map(group => [
            formatReportDateTime(group.date),
            formatChemistryGroupForReport(group.items),
            group.comment || '—'
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

  showMessage(document.getElementById('selectorMessage'), t('export.downloading'));
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

function updateTelegramConnectButton() {
  const btn = document.getElementById('telegramConnectBtn');
  const hint = document.getElementById('telegramConnectHint');
  const form = document.getElementById('telegramReminderForm');
  const connected = !!telegramSettings?.telegramChatId;

  if (!btn) return;

  if (connected) {
    btn.textContent = t('telegram.disconnectBot');
    btn.className = 'btn btn-danger btn-full';
    hint?.classList.add('hidden');
    form?.classList.remove('hidden');
  } else if (telegramConnectPending) {
    btn.textContent = t('telegram.checkConnection');
    btn.className = 'btn btn-secondary btn-full';
    hint?.classList.remove('hidden');
    form?.classList.add('hidden');
  } else {
    btn.textContent = t('telegram.connectBot');
    btn.className = 'btn btn-primary btn-full';
    hint?.classList.add('hidden');
    form?.classList.add('hidden');
  }
}

function showTelegramMessage(text, type = 'success') {
  const el = document.getElementById('telegramSettingsMessage');
  if (el) showMessage(el, text, type);
}

function getReminderIntervalDays() {
  const select = document.getElementById('poolReminderInterval');
  const customInput = document.getElementById('customReminderDays');
  if (select?.value === 'custom') {
    const days = parseInt(customInput?.value, 10);
    return Number.isFinite(days) && days >= 1 && days <= 90 ? days : null;
  }
  const days = parseInt(select?.value, 10);
  return Number.isFinite(days) ? days : null;
}

function syncReminderIntervalSelect(days) {
  const select = document.getElementById('poolReminderInterval');
  const customWrap = document.getElementById('customReminderDaysWrap');
  const customInput = document.getElementById('customReminderDays');
  const presets = ['3', '5', '7', '14', '30'];
  const value = String(days || 7);

  if (!select) return;

  if (presets.includes(value)) {
    select.value = value;
    customWrap?.classList.add('hidden');
  } else {
    select.value = 'custom';
    customWrap?.classList.remove('hidden');
    if (customInput) customInput.value = value;
  }
}

function renderTelegramRemindersUI() {
  const panel = document.getElementById('telegramPanel');
  const missing = document.getElementById('telegramBotMissing');
  if (!isTelegramBotConfigured()) {
    missing?.classList.remove('hidden');
    panel?.classList.add('hidden');
    return;
  }
  missing?.classList.add('hidden');
  panel?.classList.remove('hidden');
  updateTelegramConnectButton();

  if (!telegramSettings?.telegramChatId) return;

  const hourEl = document.getElementById('reminderHour');
  if (hourEl) hourEl.value = String(telegramSettings.reminderHour);
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
    showTelegramMessage(t('telegram.loadFailed'), 'error');
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
    showTelegramMessage(t('telegram.connectStepsShort'), 'info');
    startTelegramConnectPoll();
  } catch (err) {
    showTelegramMessage(err.message || t('auth.error.send'), 'error');
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
        syncTelegramReminderForm(getActivePool());
        showTelegramMessage(t('telegram.connectedSetup'), 'success');
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
      showTelegramMessage(t('telegram.connectedSetup'), 'success');
      syncTelegramReminderForm(getActivePool());
    } else {
      showTelegramMessage(t('telegram.notConnectedYet'), 'warn');
    }
  } catch (err) {
    showTelegramMessage(err.message || t('auth.error.save'), 'error');
  }
}

async function handleDisconnectTelegram() {
  if (!currentUser || !confirm(t('telegram.disconnectConfirm'))) return;
  try {
    const pool = getActivePool();
    if (pool) {
      pool.remindersEnabled = false;
      await dbUpdatePoolReminders(pool.id, false, pool.reminderIntervalDays || 7);
    }
    telegramSettings = await dbSaveTelegramSettings(currentUser.id, {
      telegramChatId: null,
      remindersEnabled: false,
      clearLinkToken: true
    });
    renderTelegramRemindersUI();
    syncTelegramReminderForm(getActivePool());
    showTelegramMessage(t('telegram.disconnected'), 'success');
  } catch (err) {
    showTelegramMessage(err.message || t('auth.error.save'), 'error');
  }
}

async function handleTelegramConnectBtn() {
  if (telegramSettings?.telegramChatId) {
    await handleDisconnectTelegram();
    return;
  }
  if (telegramConnectPending) {
    await handleCheckTelegram();
    return;
  }
  await handleConnectTelegram();
}

async function handleSaveTelegramReminder(e) {
  e.preventDefault();
  const pool = getActivePool();

  if (!pool || !currentUser) {
    showTelegramMessage(t('pool.noHint'), 'warn');
    return;
  }
  if (!telegramSettings?.telegramChatId) {
    showTelegramMessage(t('telegram.connectFirst'), 'warn');
    return;
  }

  const reminderHour = parseInt(document.getElementById('reminderHour').value, 10);
  const reminderIntervalDays = getReminderIntervalDays();
  if (!reminderIntervalDays) {
    showTelegramMessage(t('telegram.invalidDays'), 'warn');
    return;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Kyiv';

  try {
    telegramSettings = await dbSaveTelegramSettings(currentUser.id, {
      reminderHour,
      timezone
    });
    pool.remindersEnabled = true;
    pool.reminderIntervalDays = reminderIntervalDays;
    await dbUpdatePoolReminders(pool.id, true, reminderIntervalDays);
    syncTelegramReminderForm(pool);
    renderTelegramRemindersUI();
    showTelegramMessage(
      t('telegram.saved', {
        time: `${String(reminderHour).padStart(2, '0')}:00`,
        days: reminderIntervalDays
      }),
      'success'
    );
  } catch (err) {
    const hint = /reminders_enabled|reminder_interval|schema cache/i.test(err.message || '')
      ? t('telegram.poolRemindersSqlHint')
      : (err.message || t('auth.error.save'));
    showTelegramMessage(hint, 'error');
    await handleDbError(err, 'saveTelegramReminder');
  }
}

function syncPoolSettingsView(pool) {
  const volEl = document.getElementById('poolVolumeDisplay');
  const treatEl = document.getElementById('poolTreatmentDisplay');
  if (!pool) return;
  if (volEl) volEl.textContent = formatVolume(pool.volume);
  if (treatEl) treatEl.textContent = treatmentLabel(getPoolTreatment(pool));
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
    alert(t('pool.enterVolume'));
    return;
  }

  pool.volume = volume;
  pool.treatmentType = document.getElementById('treatmentSelect').value === 'peroxide' ? 'peroxide' : 'chlorine';

  try {
    await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
    setPoolEditMode(false);
    renderPoolContent();
    showMessage(document.getElementById('selectorMessage'), t('pool.settingsSaved'));
  } catch (err) {
    await handleDbError(err, 'savePoolSettings');
  }
}

function handleCancelPoolEdit() {
  setPoolEditMode(false);
  const pool = getActivePool();
  if (pool) syncPoolSettingsView(pool);
}

function syncTelegramReminderForm(pool) {
  const poolHint = document.getElementById('telegramPoolHint');
  if (poolHint) {
    poolHint.textContent = pool?.name
      ? t('telegram.forPool', { name: pool.name })
      : t('telegram.hint');
  }

  if (!pool || !telegramSettings?.telegramChatId) return;

  const hourEl = document.getElementById('reminderHour');
  if (hourEl) hourEl.value = String(telegramSettings.reminderHour);
  syncReminderIntervalSelect(pool.reminderIntervalDays || 7);
}

function initTelegramReminders() {
  populateReminderHourSelect();
  document.getElementById('telegramConnectBtn')?.addEventListener('click', handleTelegramConnectBtn);
  document.getElementById('telegramReminderForm')?.addEventListener('submit', handleSaveTelegramReminder);
  document.getElementById('poolReminderInterval')?.addEventListener('change', e => {
    document.getElementById('customReminderDaysWrap')?.classList.toggle('hidden', e.target.value !== 'custom');
  });
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
    t('pool.meta.volume', { volume: formatVolume(pool.volume) }),
    treatmentLabel(treatmentType),
    t('pool.meta.measurements', { count: poolMeas.length }),
    t('pool.meta.chemistry', { count: poolChem.length })
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
      updateLocationStatus(t('location.markerSave'));
      updateRouteLinks(pos.lat, pos.lng, document.getElementById('poolAddress')?.value);
    });
  }

  if (pan) {
    poolMap.setView([lat, lng], Math.max(poolMap.getZoom(), 14));
  }
  updateRouteLinks(lat, lng, document.getElementById('poolAddress')?.value);
  updateLocationStatus(t('location.markerSave'));
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
      updateLocationStatus(t('location.loadingMap'));
      setTimeout(() => initPoolMap(pool), 400);
      return;
    }
    updateLocationStatus(t('location.mapFailed'));
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
      updateLocationStatus(loc.address || t('location.saved'));
    } else {
      updateLocationStatus(t('location.clickOrSearch'));
    }

    poolMap.on('click', e => {
      setMapMarker(e.latlng.lat, e.latlng.lng);
    });

    setTimeout(refreshMapSize, 100);
    setTimeout(refreshMapSize, 500);
  } catch (err) {
    console.error('Map init error:', err);
    updateLocationStatus(t('location.mapError'));
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
    btn.title = locationPanelOpen ? t('location.hideMap') : t('location.btn');
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
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&lang=${getNominatimLang()}`;
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
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=ua&accept-language=${getNominatimLang()}`;
    const res = await fetch(url, { headers: getNominatimHeaders() });
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
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=${getNominatimLang()}`;
  const res = await fetch(url, { headers: getNominatimHeaders() });
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
    alert(t('location.pointRequired'));
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
  updateLocationStatus(pool.location.address || t('location.saved'));
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
  const norms = getNorms();
  const sanitizerNorm = getSanitizerNorm(treatmentType);
  const statuses = [
    getParamStatus(ph, norms.ph),
    getParamStatus(chlorine, sanitizerNorm),
    getParamStatus(temp, norms.temperature)
  ];
  if (statuses.includes('crit')) return 'crit';
  if (statuses.includes('warn')) return 'warn';
  return 'ok';
}

function getPoolTreatment(pool) {
  return pool && pool.treatmentType === 'peroxide' ? 'peroxide' : 'chlorine';
}

function getSanitizerNorm(treatmentType) {
  const norms = getNorms();
  return treatmentType === 'peroxide' ? norms.peroxide : norms.chlorine;
}

function getSanitizerLabel(treatmentType, short) {
  if (treatmentType === 'peroxide') {
    return short ? t('measure.peroxideShort') : t('measure.peroxide');
  }
  return short ? t('measure.chlorineShort') : t('measure.chlorine');
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
  const norms = getNorms();
  const sanitizerNorm = getSanitizerNorm(treatmentType);
  const sanitizerName = treatmentType === 'peroxide' ? t('rec.peroxideGenitive') : t('rec.chlorineGenitive');
  const sanitizerDisplay = treatmentType === 'peroxide' ? t('rec.peroxide') : t('rec.chlorine');
  const sanitizerAdd = treatmentType === 'peroxide' ? t('rec.peroxide') : t('rec.chlorine');

  if (ph < norms.ph.min) {
    recs.push({
      level: ph < 6.8 ? 'crit' : 'warn',
      title: t('rec.phLow', { value: ph }),
      text: t('rec.phLowText', { ideal: norms.ph.ideal })
    });
  } else if (ph > norms.ph.max) {
    recs.push({
      level: ph > 8.0 ? 'crit' : 'warn',
      title: t('rec.phHigh', { value: ph }),
      text: t('rec.phHighText', { ideal: norms.ph.ideal })
    });
  } else {
    recs.push({
      level: 'ok',
      title: t('rec.phOk', { value: ph }),
      text: t('rec.range', { ideal: norms.ph.ideal })
    });
  }

  if (chlorine < sanitizerNorm.min) {
    recs.push({
      level: chlorine < sanitizerNorm.min * 0.5 ? 'crit' : 'warn',
      title: t('rec.sanitizerLow', { name: sanitizerName, value: chlorine }),
      text: t('rec.sanitizerLowText', { add: sanitizerAdd, ideal: sanitizerNorm.ideal })
    });
  } else if (chlorine > sanitizerNorm.max) {
    recs.push({
      level: chlorine > sanitizerNorm.max * 1.5 ? 'crit' : 'warn',
      title: t('rec.sanitizerHigh', { name: sanitizerName, value: chlorine }),
      text: treatmentType === 'peroxide' ? t('rec.sanitizerHighPeroxide') : t('rec.sanitizerHighChlorine')
    });
  } else {
    recs.push({
      level: 'ok',
      title: t('rec.sanitizerOk', { name: sanitizerDisplay.charAt(0).toUpperCase() + sanitizerDisplay.slice(1), value: chlorine }),
      text: t('rec.range', { ideal: sanitizerNorm.ideal })
    });
  }

  if (temp < norms.temperature.min) {
    recs.push({
      level: 'warn',
      title: t('rec.tempCold', { value: temp }),
      text: t('rec.tempColdText', { ideal: norms.temperature.ideal })
    });
  } else if (temp > norms.temperature.max) {
    recs.push({
      level: temp > 32 ? 'crit' : 'warn',
      title: t('rec.tempWarm', { value: temp }),
      text: t('rec.tempWarmText')
    });
  } else {
    recs.push({
      level: 'ok',
      title: t('rec.tempOk', { value: temp }),
      text: t('rec.range', { ideal: norms.temperature.ideal })
    });
  }

  return recs;
}

function renderRecommendations(container, recs) {
  container.innerHTML = recs.map(r =>
    `<div class="rec-item ${r.level}"><strong>${escapeHtml(r.title)}</strong>${escapeHtml(r.text)}</div>`
  ).join('');
}

function renderPoolSelect() {
  if (!document.getElementById('poolSelect')) return;

  isUpdatingUI = true;

  if (activePoolId && poolList.some(p => p.id === activePoolId)) {
    // keep current selection
  } else if (poolList.length > 0) {
    activePoolId = poolList[0].id;
    saveActivePoolId();
  } else {
    activePoolId = null;
    saveActivePoolId();
  }

  PoolSelectUI.render(poolList, activePoolId);

  isUpdatingUI = false;
  const deleteBtn = document.getElementById('deletePoolBtn');
  if (deleteBtn) deleteBtn.disabled = poolList.length === 0;
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

function getPoolPhotos(poolId) {
  return poolPhotos.filter(p => p.poolId === poolId);
}

function findPhotoForChemistry(chemEntry, poolId) {
  const chemTime = new Date(chemEntry.date).getTime();
  const candidates = getPoolPhotos(poolId)
    .map(photo => ({
      photo,
      delta: Math.abs(new Date(photo.date).getTime() - chemTime)
    }))
    .filter(item => item.delta < 120000)
    .sort((a, b) => a.delta - b.delta);

  return candidates[0]?.photo || null;
}

function groupChemistryBySession(poolChem) {
  const groupMap = new Map();

  for (const entry of poolChem) {
    const key = entry.date;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        date: entry.date,
        comment: entry.comment || '',
        items: []
      });
    }
    groupMap.get(key).items.push(entry);
  }

  return Array.from(groupMap.values())
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function formatChemistryGroupItems(items) {
  if (items.length === 1) {
    const item = items[0];
    return `<span class="chem-history-single">${escapeHtml(translateChemicalName(item.chemical))} — ${item.amount} ${escapeHtml(translateUnit(item.unit))}</span>`;
  }

  return `<ul class="chem-history-list">${items.map(item =>
    `<li>${escapeHtml(translateChemicalName(item.chemical))} — ${item.amount} ${escapeHtml(translateUnit(item.unit))}</li>`
  ).join('')}</ul>`;
}

function formatChemistryGroupForReport(items) {
  return items.map(item => `${translateChemicalName(item.chemical)} — ${item.amount} ${translateUnit(item.unit)}`).join('\n');
}

function findPhotoForChemistryGroup(group, poolId) {
  return findPhotoForChemistry({ date: group.date }, poolId);
}

function renderChemistryHistory(poolChem, poolId) {
  const tbody = document.getElementById('chemistryBody');
  const empty = document.getElementById('emptyChemistry');
  const groups = groupChemistryBySession(poolChem);

  if (groups.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  tbody.innerHTML = groups.map(group => {
    const date = new Date(group.date).toLocaleString(getLocale(), {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const comment = group.comment ? escapeHtml(group.comment) : '<span class="hint">—</span>';
    const groupKey = encodeURIComponent(group.date);
    return `<tr data-chem-group="${groupKey}">
      <td>${date}</td>
      <td class="chem-items-cell">${formatChemistryGroupItems(group.items)}</td>
      <td class="comment-cell">${comment}</td>
      <td class="chem-photo-cell"><span class="hint">…</span></td>
    </tr>`;
  }).join('');

  loadChemistryGroupPhotoThumbs(groups, poolId);
}

async function loadChemistryGroupPhotoThumbs(groups, poolId) {
  await Promise.all(groups.map(async group => {
    const photo = findPhotoForChemistryGroup(group, poolId);
    const groupKey = encodeURIComponent(group.date);
    const cell = document.querySelector(`tr[data-chem-group="${groupKey}"] .chem-photo-cell`);
    if (!cell) return;

    if (!photo) {
      cell.innerHTML = '<span class="hint">—</span>';
      return;
    }

    try {
      const url = await dbGetPhotoUrl(photo.storagePath);
      cell.innerHTML = `<a href="${url}" class="chem-photo-link" target="_blank" rel="noopener noreferrer"><img src="${url}" class="chem-history-thumb" alt="${escapeHtml(t('chem.photoAlt'))}" loading="lazy"></a>`;
    } catch {
      cell.innerHTML = '<span class="hint">—</span>';
    }
  }));
}

function revokePendingChemistryPhotoUrl() {
  if (pendingChemistryPhotoUrl) {
    URL.revokeObjectURL(pendingChemistryPhotoUrl);
    pendingChemistryPhotoUrl = null;
  }
}

function revokeSavedChemistryPhotoUrl() {
  if (savedChemistryPhotoUrl) {
    URL.revokeObjectURL(savedChemistryPhotoUrl);
    savedChemistryPhotoUrl = null;
  }
}

function setPendingChemistryPhoto(file) {
  revokePendingChemistryPhotoUrl();
  revokeSavedChemistryPhotoUrl();
  pendingChemistryPhoto = file || null;
  pendingChemistryPhotoUrl = file ? URL.createObjectURL(file) : null;
  updateChemistryPhotoUI();
}

function updateChemistryPhotoUI() {
  const btn = document.getElementById('chemistryPhotoBtn');
  const preview = document.getElementById('chemistryPhotoPreview');
  const previewImg = document.getElementById('chemistryPhotoPreviewImg');
  const previewLabel = document.getElementById('chemistryPhotoPreviewLabel');
  const removeBtn = document.getElementById('chemistryPhotoRemoveBtn');
  if (!btn || !preview || !previewImg || !previewLabel) return;

  const previewUrl = pendingChemistryPhotoUrl || savedChemistryPhotoUrl;

  if (previewUrl) {
    btn.classList.add('has-photo');
    preview.classList.remove('hidden');
    preview.classList.toggle('is-saved', !pendingChemistryPhoto && !!savedChemistryPhotoUrl);
    previewImg.src = previewUrl;
    previewLabel.textContent = pendingChemistryPhoto
      ? t('chem.photoReady')
      : t('chem.photoSaved');
    btn.title = pendingChemistryPhoto
      ? t('chem.photoSelected')
      : t('chem.photoSavedTitle');
    if (removeBtn) removeBtn.hidden = !pendingChemistryPhoto;
  } else {
    btn.classList.remove('has-photo');
    preview.classList.add('hidden');
    preview.classList.remove('is-saved');
    previewImg.removeAttribute('src');
    previewLabel.textContent = t('chem.photoReady');
    btn.title = t('chem.photoBtn');
    if (removeBtn) removeBtn.hidden = false;
  }
}

function clearPendingChemistryPhoto() {
  pendingChemistryPhoto = null;
  revokePendingChemistryPhotoUrl();
  const galleryInput = document.getElementById('chemistryPhotoGalleryInput');
  const cameraInput = document.getElementById('chemistryPhotoCameraInput');
  if (galleryInput) galleryInput.value = '';
  if (cameraInput) cameraInput.value = '';
  updateChemistryPhotoUI();
}

function clearSavedChemistryPhotoPreview() {
  revokeSavedChemistryPhotoUrl();
  updateChemistryPhotoUI();
}

function showSavedChemistryPhotoPreview(file) {
  revokeSavedChemistryPhotoUrl();
  savedChemistryPhotoUrl = URL.createObjectURL(file);
  updateChemistryPhotoUI();
}

function handleChemistryPhotoSelected(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  setPendingChemistryPhoto(file);
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
    throw new Error(t('camera.unavailable'));
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
      errorEl.textContent = t('camera.error');
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
    alert(t('camera.notReady'));
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    if (!blob) {
      alert(t('camera.captureFailed'));
      return;
    }
    setPendingChemistryPhoto(new File([blob], `pool-${Date.now()}.jpg`, { type: 'image/jpeg' }));
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
  syncTelegramReminderForm(pool);
  renderLocationUI(pool);
  renderChemistryHistory(poolChem, pool.id);

  if (poolMeas.length > 0) {
    const latest = poolMeas[0];
    renderRecommendations(
      document.getElementById('paramRecommendations'),
      getParamRecommendations(latest.ph, latest.chlorine, latest.temperature, treatmentType)
    );
  } else {
    document.getElementById('paramRecommendations').innerHTML =
      `<div class="rec-item info"><strong>${escapeHtml(t('measure.noData'))}</strong>${escapeHtml(t('measure.noDataHint'))}</div>`;
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
    const statusText = status === 'ok' ? t('status.ok') : status === 'warn' ? t('status.warn') : t('status.crit');
    const date = new Date(m.date).toLocaleString(getLocale(), {
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
    new Date(m.date).toLocaleString(getLocale(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  );

  const sanitizerNorm = getSanitizerNorm(treatmentType);
  updateChart('ph', sorted.map(m => m.ph), labels, 'pH', '#1a8fc7', 7.2, 7.6);
  updateChart('chlorine', sorted.map(m => m.chlorine), labels, getSanitizerLabel(treatmentType, false), '#2db86a', sanitizerNorm.min, sanitizerNorm.max);
  updateChart('temp', sorted.map(m => m.temperature), labels, t('measure.temperature'), '#e6a020', 24, 28);
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

function readChemistryFormItem({ alertOnError = true } = {}) {
  const chemical = getChemicalName();
  const amountRaw = document.getElementById('chemicalAmount').value.trim();
  const amount = parseFloat(amountRaw);
  const unit = document.getElementById('chemicalUnit').value;

  if (!amountRaw) return null;

  if (!chemical) {
    if (alertOnError) alert(t('chem.nameRequired'));
    return null;
  }
  if (!amount || amount <= 0) {
    if (alertOnError) alert(t('chem.amountRequired'));
    return null;
  }

  return { chemical, amount, unit };
}

function resetChemistryItemFields() {
  document.getElementById('chemicalName').value = document.getElementById('chemicalName').options[0].value;
  document.getElementById('chemicalAmount').value = '';
  document.getElementById('customChemical').value = '';
  document.getElementById('customChemicalWrap').classList.add('hidden');
}

function renderChemistryBatch() {
  const wrap = document.getElementById('chemistryBatchWrap');
  const list = document.getElementById('chemistryBatchItems');
  const saveBtn = document.getElementById('saveChemistryBtn');
  if (!wrap || !list) return;

  if (pendingChemistryBatch.length === 0) {
    wrap.classList.add('hidden');
    list.innerHTML = '';
    if (saveBtn) saveBtn.textContent = t('chem.save');
    return;
  }

  wrap.classList.remove('hidden');
  list.innerHTML = pendingChemistryBatch.map(item => `
    <li class="chemistry-batch-item" data-batch-id="${escapeHtml(item.tempId)}">
      <span class="chemistry-batch-item-text">${escapeHtml(translateChemicalName(item.chemical))} — ${item.amount} ${escapeHtml(translateUnit(item.unit))}</span>
      <button type="button" class="chemistry-batch-remove" data-batch-id="${escapeHtml(item.tempId)}">${escapeHtml(t('chem.remove'))}</button>
    </li>
  `).join('');

  if (saveBtn) {
    saveBtn.textContent = pendingChemistryBatch.length === 1
      ? t('chem.save')
      : t('chem.saveCount', { count: pendingChemistryBatch.length });
  }
}

function addChemistryItemToBatch() {
  const item = readChemistryFormItem();
  if (!item) return;

  pendingChemistryBatch.push({
    tempId: generateId(),
    chemical: item.chemical,
    amount: item.amount,
    unit: item.unit
  });

  renderChemistryBatch();
  resetChemistryItemFields();
  document.getElementById('chemicalName').focus();
}

function removeChemistryBatchItem(tempId) {
  pendingChemistryBatch = pendingChemistryBatch.filter(item => item.tempId !== tempId);
  renderChemistryBatch();
}

function clearChemistryBatch() {
  pendingChemistryBatch = [];
  renderChemistryBatch();
}

function collectChemistryItemsForSave() {
  const items = [...pendingChemistryBatch];
  const current = readChemistryFormItem({ alertOnError: items.length === 0 });
  if (current) {
    items.push({
      tempId: generateId(),
      chemical: current.chemical,
      amount: current.amount,
      unit: current.unit
    });
  }
  return items;
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
  PoolSelectUI.init(async poolId => {
    if (isUpdatingUI) return;
    if (!poolId) return;
    if (await setActivePool(poolId)) {
      showMessage(document.getElementById('selectorMessage'), t('pool.selected', { name: getActivePool().name }));
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
      errorEl.textContent = t('pool.nameRequired');
      errorEl.hidden = false;
      return;
    }

    const volume = getVolumeFromSelect(
      document.getElementById('newPoolVolume'),
      document.getElementById('newCustomVolume')
    );

    if (!volume) {
      errorEl.textContent = t('pool.volumeRequired');
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
      showMessage(document.getElementById('selectorMessage'), t('pool.added', { name }));
    } catch (err) {
      await handleDbError(err, 'addPool');
    }
  });

  document.getElementById('deletePoolBtn').addEventListener('click', async () => {
    if (poolList.length === 0) return;
    const pool = getActivePool();
    if (!pool) return;
    if (!confirm(t('pool.deleteConfirm', { name: pool.name }))) return;

    const deletedId = activePoolId;
    try {
      await dbDeletePool(deletedId);
      poolList = poolList.filter(p => p.id !== deletedId);
      measurements = measurements.filter(m => m.poolId !== deletedId);
      chemistryLog = chemistryLog.filter(c => c.poolId !== deletedId);
      poolPhotos = poolPhotos.filter(p => p.poolId !== deletedId);
      delete selectedProblems[deletedId];
      activePoolId = poolList.length > 0 ? poolList[0].id : null;
      saveActivePoolId();
      renderPoolSelect();
      if (activePoolId) {
        await setActivePool(activePoolId);
      } else {
        renderPoolContent();
      }
      showMessage(document.getElementById('selectorMessage'), t('pool.deleted'));
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
  document.getElementById('chemistryPhotoRemoveBtn')?.addEventListener('click', clearPendingChemistryPhoto);
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
      showMessage(document.getElementById('selectorMessage'), t('measure.saved'));
    } catch (err) {
      await handleDbError(err, 'saveMeasurement');
    }
  });

  document.getElementById('chemicalName').addEventListener('change', e => {
    document.getElementById('customChemicalWrap').classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value === 'custom') document.getElementById('customChemical').focus();
  });

  document.getElementById('addChemistryItemBtn')?.addEventListener('click', addChemistryItemToBatch);
  document.getElementById('chemistryBatchItems')?.addEventListener('click', e => {
    const btn = e.target.closest('.chemistry-batch-remove');
    if (btn?.dataset.batchId) removeChemistryBatchItem(btn.dataset.batchId);
  });

  document.getElementById('chemistryForm').addEventListener('submit', async e => {
    e.preventDefault();
    const pool = getActivePool();
    if (!pool) return;

    const items = collectChemistryItemsForSave();
    if (items.length === 0) {
      alert(t('chem.atLeastOne'));
      return;
    }

    const comment = document.getElementById('chemicalComment').value.trim();
    const saveDate = new Date().toISOString();
    const hadPhoto = !!pendingChemistryPhoto;
    const photoFile = pendingChemistryPhoto;

    try {
      for (const item of items) {
        const entry = {
          id: generateId(),
          poolId: pool.id,
          chemical: item.chemical,
          amount: item.amount,
          unit: item.unit,
          comment,
          date: saveDate
        };
        const saved = await dbInsertChemistry(currentUser.id, entry);
        chemistryLog.unshift(saved);
      }

      if (pendingChemistryPhoto) {
        const caption = items.map(item => `${item.chemical}, ${item.amount} ${item.unit}`).join('; ');
        const photo = await dbUploadPhoto(currentUser.id, pool.id, pendingChemistryPhoto, caption);
        poolPhotos.unshift(photo);
        clearPendingChemistryPhoto();
        if (photoFile) showSavedChemistryPhotoPreview(photoFile);
      }

      clearChemistryBatch();
      renderPoolContent();
      e.target.reset();
      resetChemistryItemFields();
      if (hadPhoto) setChemistryHistoryOpen(true);
      showMessage(
        document.getElementById('selectorMessage'),
        hadPhoto
          ? t('chem.savedWithPhoto', { count: items.length })
          : t('chem.savedCount', { count: items.length })
      );
    } catch (err) {
      await handleDbError(err, 'saveChemistry');
    }
  });

  document.getElementById('clearChemistryBtn').addEventListener('click', async () => {
    const pool = getActivePool();
    if (!pool || !confirm(t('chem.clearConfirm', { name: pool.name }))) return;

    try {
      await dbClearChemistry(pool.id);
      chemistryLog = chemistryLog.filter(c => c.poolId !== pool.id);
      renderPoolContent();
      showMessage(document.getElementById('selectorMessage'), t('chem.cleared'));
    } catch (err) {
      await handleDbError(err, 'clearChemistry');
    }
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', async () => {
    const pool = getActivePool();
    if (!pool || !confirm(t('measure.clearConfirm', { name: pool.name }))) return;

    try {
      await dbClearMeasurements(pool.id);
      measurements = measurements.filter(m => m.poolId !== pool.id);
      renderPoolContent();
      showMessage(document.getElementById('selectorMessage'), t('measure.cleared'));
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
      alert(t('location.enterAddress'));
      return;
    }

    updateLocationStatus(t('location.searching'));
    try {
      const result = await geocodeAddress(address);
      if (!result) {
        updateLocationStatus(t('location.notFound'));
        return;
      }
      document.getElementById('poolAddress').value = result.address;
      setMapMarker(result.lat, result.lng);
    } catch {
      updateLocationStatus(t('location.searchError'));
    }
  });

  document.getElementById('gpsBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert(t('location.geoUnsupported'));
      return;
    }

    updateLocationStatus(t('location.gettingGps'));
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setMapMarker(latitude, longitude);
        try {
          const address = await reverseGeocode(latitude, longitude);
          if (address) {
            document.getElementById('poolAddress').value = address;
            updateLocationStatus(t('location.found', { address }));
          }
        } catch {
          /* coords already set on map */
        }
      },
      () => {
        updateLocationStatus(t('location.gpsFailed'));
        alert(t('location.gpsPermission'));
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  document.getElementById('saveLocationBtn').addEventListener('click', async () => {
    if (await savePoolLocation()) {
      showMessage(document.getElementById('selectorMessage'), t('location.savedSuccess'));
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && poolMap && locationPanelOpen) refreshMapSize();
  });
}

function handleLanguageChange() {
  applyTranslations();
  resetAuthCardHeader();
  if (pendingPasswordRecovery) {
    document.getElementById('authBrandHeader')?.classList.add('hidden');
    document.getElementById('authFormHeader')?.classList.remove('hidden');
  }
  if (currentUser) {
    renderPoolSelect();
    renderPoolContent();
    renderTelegramRemindersUI();
    syncTelegramReminderForm(getActivePool());
    setMeasurementHistoryOpen(measurementHistoryOpen);
    setChemistryHistoryOpen(chemistryHistoryOpen);
    updateChemistryPhotoUI();
    renderChemistryBatch();
  }
}

function initLanguageListener() {
  window.addEventListener('languagechange', handleLanguageChange);
}

async function init() {
  initI18n();
  registerServiceWorker();

  if (!initSupabaseClient()) {
    showConfigError();
    return;
  }

  setupSupabaseAuthListener();
  initAuthListeners();
  initLanguageListener();
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
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
  return false;
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
    navigator.serviceWorker.register('./sw.js?v=34')
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
