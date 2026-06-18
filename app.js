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
let poolPhotos = [];
let selectedProblems = {};
let charts = { ph: null, chlorine: null, temp: null };
let isUpdatingUI = false;
let poolMap = null;
let poolMarker = null;
let lastMapPoolId = null;
let mapInitRetries = 0;
let measurementHistoryOpen = false;
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

function updateUserLabel() {
  const el = document.getElementById('currentUserLabel');
  if (!el || !currentUser) return;
  const compact = window.matchMedia('(max-width: 768px)').matches;
  el.textContent = compact
    ? currentUser.email
    : `${currentUser.displayLogin || currentUser.email} · ${currentUser.email}`;
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
  ['loginError', 'registerError', 'registerSuccess', 'forgotError', 'forgotSuccess'].forEach(id => {
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
  await saveCurrentPoolProblems();
  await authSignOut();
  currentUser = null;
  poolList = [];
  activePoolId = null;
  measurements = [];
  chemistryLog = [];
  poolPhotos = [];
  selectedProblems = {};
  measurementHistoryOpen = false;
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

async function startApp() {
  try {
    await loadUserData();
    showAppScreen();
    renderPoolSelect();
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

  await saveCurrentPoolProblems();
  activePoolId = pool.id;
  saveActivePoolId();
  setMeasurementHistoryOpen(false);

  const select = document.getElementById('poolSelect');
  if (select && select.value !== pool.id) {
    isUpdatingUI = true;
    select.value = pool.id;
    isUpdatingUI = false;
  }

  renderPoolContent();
  return true;
}

async function saveCurrentPoolProblems() {
  if (!activePoolId || !currentUser) return;
  const grid = document.getElementById('problemsGrid');
  if (grid) {
    const checked = [...grid.querySelectorAll('input:checked')].map(el => el.value);
    selectedProblems[activePoolId] = checked;
  }
  const pool = getActivePool();
  if (pool) {
    try {
      await dbUpsertPool(currentUser.id, pool, selectedProblems[activePoolId] || []);
    } catch (err) {
      await handleDbError(err, 'saveProblems');
    }
  }
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
  const routeActions = document.getElementById('routeActions');
  const routeLink = document.getElementById('routeGoogle');
  if (!routeActions || !routeLink) return;

  if (lat != null && lng != null) {
    routeActions.classList.remove('hidden');
    routeLink.href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    return;
  }

  if (address && address.trim()) {
    routeActions.classList.remove('hidden');
    routeLink.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
    return;
  }

  routeActions.classList.add('hidden');
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
      updateRouteLinks(pos.lat, pos.lng, document.getElementById('poolAddress')?.value);
    });
  }

  if (pan) {
    poolMap.setView([lat, lng], Math.max(poolMap.getZoom(), 14));
  }
  updateRouteLinks(lat, lng, document.getElementById('poolAddress')?.value);
  updateLocationStatus(`Метка: ${lat.toFixed(5)}, ${lng.toFixed(5)} — нажмите «Сохранить локацию»`);
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
      updateLocationStatus(loc.address || `Сохранено: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`);
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

function renderLocationUI(pool) {
  const addressInput = document.getElementById('poolAddress');
  const poolChanged = lastMapPoolId !== pool.id;

  if (addressInput) {
    addressInput.value = pool.location?.address || '';
  }

  syncRouteFromPool(pool);

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
  const pool = getActivePool();
  if (pool && currentUser) {
    dbUpsertPool(currentUser.id, pool, checked).catch(err => handleDbError(err, 'saveProblems'));
  }
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

function getPoolPhotos(poolId) {
  return poolPhotos.filter(p => p.poolId === poolId);
}

async function renderPhotoGallery(poolId) {
  const gallery = document.getElementById('photoGallery');
  const empty = document.getElementById('emptyPhotos');
  if (!gallery || !empty) return;

  const photos = getPoolPhotos(poolId);
  if (photos.length === 0) {
    gallery.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  gallery.innerHTML = photos.map(p => {
    const date = new Date(p.date).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
    const caption = p.caption ? escapeHtml(p.caption) : '';
    return `
      <figure class="photo-item" data-photo-id="${p.id}">
        <div class="photo-thumb loading">Загрузка...</div>
        <figcaption>
          ${caption ? `<span class="photo-caption">${caption}</span>` : ''}
          <span class="photo-date">${date}</span>
        </figcaption>
        <button type="button" class="photo-delete btn btn-danger btn-small" data-photo-id="${p.id}">Удалить</button>
      </figure>`;
  }).join('');

  await Promise.all(photos.map(async photo => {
    try {
      const url = await dbGetPhotoUrl(photo.storagePath);
      const thumb = gallery.querySelector(`[data-photo-id="${photo.id}"] .photo-thumb`);
      if (thumb) {
        thumb.classList.remove('loading');
        thumb.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer"><img src="${url}" alt="Фото бассейна" loading="lazy"></a>`;
      }
    } catch {
      const thumb = gallery.querySelector(`[data-photo-id="${photo.id}"] .photo-thumb`);
      if (thumb) {
        thumb.classList.remove('loading');
        thumb.textContent = 'Не удалось загрузить';
      }
    }
  }));
}

async function handlePhotoSelected(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !currentUser) return;

  const pool = getActivePool();
  if (!pool) return;

  const statusEl = document.getElementById('photoUploadStatus');
  const caption = document.getElementById('photoCaption')?.value || '';

  if (statusEl) statusEl.textContent = 'Загрузка...';

  try {
    const saved = await dbUploadPhoto(currentUser.id, pool.id, file, caption);
    poolPhotos.unshift(saved);
    const captionInput = document.getElementById('photoCaption');
    if (captionInput) captionInput.value = '';
    await renderPhotoGallery(pool.id);
    if (statusEl) statusEl.textContent = 'Фото сохранено!';
    showMessage(document.getElementById('selectorMessage'), 'Фото добавлено!');
  } catch (err) {
    const msg = err.message || 'Ошибка загрузки фото';
    if (statusEl) statusEl.textContent = msg;
    alert(msg);
  }
}

async function handleDeletePhoto(photoId) {
  const photo = poolPhotos.find(p => p.id === photoId);
  if (!photo || !confirm('Удалить это фото?')) return;

  try {
    await dbDeletePhoto(photo);
    poolPhotos = poolPhotos.filter(p => p.id !== photoId);
    await renderPhotoGallery(activePoolId);
    showMessage(document.getElementById('selectorMessage'), 'Фото удалено.');
  } catch (err) {
    await handleDbError(err, 'deletePhoto');
  }
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
  syncMeasurementLabels(treatmentType);
  renderLocationUI(pool);
  renderProblemsGrid();
  renderProblemRecommendations(selectedProblems[pool.id] || []);
  renderChemistryHistory(poolChem);
  renderPhotoGallery(pool.id);

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
  document.getElementById('gotoForgotBtn').addEventListener('click', () => switchAuthTab('forgot'));
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
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
      location: { address: '', lat: null, lng: null }
    };

    try {
      await dbUpsertPool(currentUser.id, pool, []);
      poolList.push(pool);
      selectedProblems[pool.id] = [];
      closeModal();
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

  document.getElementById('volumeSelect').addEventListener('change', async e => {
    if (isUpdatingUI) return;
    const wrap = document.getElementById('customVolumeWrap');
    wrap.classList.toggle('hidden', e.target.value !== 'custom');
    if (e.target.value !== 'custom') {
      const pool = getActivePool();
      if (pool) {
        pool.volume = parseInt(e.target.value, 10);
        try {
          await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
          renderPoolContent();
          showMessage(document.getElementById('selectorMessage'), 'Объём сохранён.');
        } catch (err) {
          await handleDbError(err, 'saveVolume');
        }
      }
    } else {
      document.getElementById('customVolume').focus();
    }
  });

  document.getElementById('saveVolumeBtn').addEventListener('click', async () => {
    const pool = getActivePool();
    const custom = parseInt(document.getElementById('customVolume').value, 10);
    if (!pool || !custom || custom < 1000) {
      alert('Введите объём от 1000 литров.');
      return;
    }
    pool.volume = custom;
    try {
      await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
      renderPoolContent();
      showMessage(document.getElementById('selectorMessage'), 'Объём сохранён.');
    } catch (err) {
      await handleDbError(err, 'saveVolume');
    }
  });

  document.getElementById('treatmentSelect').addEventListener('change', async e => {
    if (isUpdatingUI) return;
    const pool = getActivePool();
    if (!pool) return;

    pool.treatmentType = e.target.value === 'peroxide' ? 'peroxide' : 'chlorine';
    try {
      await dbUpsertPool(currentUser.id, pool, selectedProblems[pool.id] || []);
      renderPoolContent();
      showMessage(document.getElementById('selectorMessage'), `Обработка: ${TREATMENT_LABELS[pool.treatmentType]}`);
    } catch (err) {
      await handleDbError(err, 'saveTreatment');
    }
  });

  document.getElementById('photoPickBtn').addEventListener('click', () => {
    document.getElementById('photoInput').click();
  });
  document.getElementById('photoInput').addEventListener('change', handlePhotoSelected);
  document.getElementById('photoGallery').addEventListener('click', e => {
    const btn = e.target.closest('.photo-delete');
    if (btn?.dataset.photoId) handleDeletePhoto(btn.dataset.photoId);
  });

  document.getElementById('toggleMeasurementHistoryBtn').addEventListener('click', toggleMeasurementHistory);

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
      renderPoolContent();
      e.target.reset();
      document.getElementById('customChemicalWrap').classList.add('hidden');
      showMessage(document.getElementById('selectorMessage'), 'Запись о химии сохранена!');
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
    if (!document.hidden && poolMap) refreshMapSize();
  });

  window.addEventListener('resize', updateUserLabel);
}

async function init() {
  if (!initSupabaseClient()) {
    showConfigError();
    return;
  }

  initAuthListeners();
  initEventListeners();

  const session = await authGetSession();
  if (session?.user) {
    currentUser = mapUser(session);
    await startApp();
    return;
  }

  showAuthScreen();
}

document.addEventListener('DOMContentLoaded', init);
