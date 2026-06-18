const STORAGE_KEYS = {
  pools: 'poolList',
  activePool: 'activePoolId',
  measurements: 'poolMeasurements',
  problems: 'poolProblems'
};

const NORMS = {
  ph: { min: 7.2, max: 7.6, ideal: '7.2–7.6' },
  chlorine: { min: 1.0, max: 3.0, ideal: '1.0–3.0 мг/л' },
  temperature: { min: 24, max: 28, ideal: '24–28 °C' }
};

const POOL_PROBLEMS = [
  {
    id: 'clear',
    label: 'Вода прозрачная',
    desc: 'Нормальное состояние',
    recommendations: [
      { level: 'ok', title: 'Вода в порядке', text: 'Прозрачная вода — признак сбалансированной химии и работающей фильтрации. Продолжайте регулярные измерения pH и хлора.' }
    ]
  },
  {
    id: 'cloudy',
    label: 'Вода мутная',
    desc: 'Плохая видимость на глубине',
    recommendations: [
      { level: 'warn', title: 'Мутная вода', text: 'Частые причины: низкий хлор, высокий pH, много органики или сбой фильтра. Проверьте pH (7.2–7.6) и хлор (1–3 мг/л). Усильте фильтрацию 24–48 ч, добавьте коагулянт (флокулянт) по инструкции.' },
      { level: 'info', title: 'Дополнительно', text: 'Пропылесосьте дно, промойте фильтр. При сильной мутности — шоковое хлорирование и не купайтесь до нормализации параметров.' }
    ]
  },
  {
    id: 'green',
    label: 'Зелёная вода',
    desc: 'Цветение водорослей',
    recommendations: [
      { level: 'crit', title: 'Зелёная вода — водоросли', text: 'Недостаточно хлора или стабилизатора. Проведите шоковое хлорирование (3–5 раз выше обычной дозы). Тщательно очистите стены щёткой, включите фильтр на сутки.' },
      { level: 'warn', title: 'Профилактика', text: 'Поддерживайте свободный хлор 1–3 мг/л, pH 7.2–7.6. Добавьте альгицид по инструкции. Уберите листья и органику из воды.' }
    ]
  },
  {
    id: 'white',
    label: 'Белая / молочная вода',
    desc: 'Взвесь, известь или переизбыток хлора',
    recommendations: [
      { level: 'warn', title: 'Белёсая вода', text: 'Часто из-за высокого pH (>7.8), избытка кальция или только что внесённого гипохлорита. Проверьте pH и понизьте pH-минусом при необходимости.' },
      { level: 'info', title: 'Что делать', text: 'Дайте фильтру поработать 4–8 ч. Если вода остаётся белой — проверьте жёсткость воды и дозировку химии. Не передозируйте порошковый хлор.' }
    ]
  },
  {
    id: 'yellow',
    label: 'Жёлтая / металлическая вода',
    desc: 'Железо, медь, марганец',
    recommendations: [
      { level: 'warn', title: 'Желтоватый оттенок', text: 'Обычно железо или медь в воде. Используйте хелатирующий (связывающий металлы) препарат. Проверьте источник воды — скважина часто даёт металлы.' },
      { level: 'info', title: 'Металлический блеск', text: 'Медь может осаждаться на стенках. Понизьте pH в рабочий диапазон, добавьте препарат от металлов, пропылесосьте дно. При заполнении — фильтруйте воду через уголь.' }
    ]
  },
  {
    id: 'foam',
    label: 'Пена на поверхности',
    desc: 'Моющие средства, органика',
    recommendations: [
      { level: 'warn', title: 'Пена на воде', text: 'Часто от остатков моющих средств, косметики или высокой органической нагрузки. Снизьте использование моющих средств при мытье окрестностей бассейна.' },
      { level: 'info', title: 'Устранение', text: 'Добавьте антипену по инструкции, усильте хлорирование и фильтрацию. Смените часть воды при сильной пене.' }
    ]
  },
  {
    id: 'sediment_bottom',
    label: 'Осадок на дне',
    desc: 'Пыль, песок, хлопья водорослей',
    recommendations: [
      { level: 'warn', title: 'Осадок на дне', text: 'Может быть песок, пыль, мёртвые водоросли или известковый налёт. Пропылесосьте дно. Проверьте хлор — при низком уровне осадок может быть «мёртвыми» водорослями.' },
      { level: 'info', title: 'Фильтрация', text: 'Промойте фильтр. При повторении — проверьте pH и используйте флокулянт, чтобы мелкие частицы собирались для фильтра.' }
    ]
  },
  {
    id: 'floating',
    label: 'Взвесь / хлопья в воде',
    desc: 'Плавающие частицы',
    recommendations: [
      { level: 'warn', title: 'Плавающие частицы', text: 'Часто после шокового хлорирования, при цветении водорослей или избытке флокулянта. Включите фильтр, пропылесосьте.' },
      { level: 'info', title: 'Действия', text: 'Если хлопья белые — возможно переизбыток химии. Если зелёные — водоросли, нужен хлор и щётка. Коагулянт вносите только при выключенном насосе по инструкции производителя.' }
    ]
  },
  {
    id: 'slippery',
    label: 'Скользкие стены',
    desc: 'Биоплёнка, водоросли',
    recommendations: [
      { level: 'warn', title: 'Скользкость', text: 'Ранний признак водорослей или бактериальной плёнки. Почистите стены щёткой, повысьте уровень хлора, добавьте альгицид.' },
      { level: 'info', title: 'Профилактика', text: 'Регулярно проверяйте хлор. Скользкость на ступенях — риск травм, не откладывайте обработку.' }
    ]
  },
  {
    id: 'smell',
    label: 'Запах хлора / «болотный» запах',
    desc: 'Хлорамины или органика',
    recommendations: [
      { level: 'warn', title: 'Резкий запах хлора', text: 'Часто при связанном хлоре (хлораминах) — «хлор пахнет», но свободного хлора мало. Нужно шоковое хлорирование для разрушения хлораминов.' },
      { level: 'crit', title: 'Болотный запах', text: 'Признак бактерий и органики. Срочно шоковое хлорирование, очистка фильтра, проверка циркуляции воды.' }
    ]
  },
  {
    id: 'eye_irritation',
    label: 'Щиплет глаза / кожу',
    desc: 'pH или хлорамины',
    recommendations: [
      { level: 'warn', title: 'Раздражение', text: 'Чаще всего pH вне диапазона 7.2–7.6 или избыток хлораминов. Измерьте pH и свободный хлор. Скорректируйте pH в первую очередь.' },
      { level: 'info', title: 'Важно', text: 'При высоком pH (>7.8) хлор слабее действует, а раздражение сильнее. Не купайтесь до нормализации параметров.' }
    ]
  }
];

let poolList = [];
let activePoolId = null;
let measurements = [];
let selectedProblems = {};
let charts = { ph: null, chlorine: null, temp: null };
let isUpdatingUI = false;
const memoryStorage = {};

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return memoryStorage[key] ?? null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryStorage[key] = value;
  }
}

function loadData() {
  try {
    poolList = JSON.parse(storageGet(STORAGE_KEYS.pools) || '[]');
    activePoolId = storageGet(STORAGE_KEYS.activePool);
    measurements = JSON.parse(storageGet(STORAGE_KEYS.measurements) || '[]');
    selectedProblems = JSON.parse(storageGet(STORAGE_KEYS.problems) || '{}');
  } catch {
    poolList = [];
    activePoolId = null;
    measurements = [];
    selectedProblems = {};
  }

  normalizeStoredData();
  migrateLegacyData();
  ensureDefaultPool();
}

function normalizeStoredData() {
  if (!Array.isArray(poolList)) poolList = [];
  if (!Array.isArray(measurements)) measurements = [];
  if (!selectedProblems || typeof selectedProblems !== 'object') selectedProblems = {};

  poolList = poolList
    .filter(p => p && p.id && p.name)
    .map(p => ({ id: String(p.id), name: String(p.name), volume: Number(p.volume) || 25000 }));

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
}

function savePools() {
  storageSet(STORAGE_KEYS.pools, JSON.stringify(poolList));
  if (activePoolId) {
    storageSet(STORAGE_KEYS.activePool, String(activePoolId));
  }
}

function saveMeasurements() {
  storageSet(STORAGE_KEYS.measurements, JSON.stringify(measurements));
}

function saveProblems() {
  storageSet(STORAGE_KEYS.problems, JSON.stringify(selectedProblems));
}

function migrateLegacyData() {
  const legacy = storageGet('poolMeasurements');
  if (!legacy || poolList.length > 0) return;

  try {
    const old = JSON.parse(legacy);
    if (Array.isArray(old) && old.length > 0 && !old[0].poolId) {
      const defaultPool = { id: generateId(), name: 'Мой бассейн', volume: 25000 };
      poolList = [defaultPool];
      activePoolId = defaultPool.id;
      measurements = old.map(m => ({ ...m, poolId: defaultPool.id }));
      savePools();
      saveMeasurements();
    }
  } catch { /* ignore */ }
}

function ensureDefaultPool() {
  if (poolList.length === 0) {
    const pool = { id: generateId(), name: 'Мой бассейн', volume: 25000 };
    poolList.push(pool);
    activePoolId = pool.id;
    savePools();
  }
  if (!activePoolId || !poolList.find(p => p.id === activePoolId)) {
    activePoolId = poolList[0].id;
    savePools();
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

function getOverallStatus(ph, chlorine, temp) {
  const statuses = [
    getParamStatus(ph, NORMS.ph),
    getParamStatus(chlorine, NORMS.chlorine),
    getParamStatus(temp, NORMS.temperature)
  ];
  if (statuses.includes('crit')) return 'crit';
  if (statuses.includes('warn')) return 'warn';
  return 'ok';
}

function getParamRecommendations(ph, chlorine, temp) {
  const recs = [];

  if (ph < NORMS.ph.min) {
    recs.push({ level: ph < 6.8 ? 'crit' : 'warn', title: 'pH слишком низкий (' + ph + ')', text: 'Вода кислая, может раздражать кожу и корродировать оборудование. Добавьте pH-плюс (соду) по инструкции. Цель: ' + NORMS.ph.ideal });
  } else if (ph > NORMS.ph.max) {
    recs.push({ level: ph > 8.0 ? 'crit' : 'warn', title: 'pH слишком высокий (' + ph + ')', text: 'Хлор теряет эффективность, возможна мутность. Добавьте pH-минус (кислоту) по инструкции. Цель: ' + NORMS.ph.ideal });
  } else {
    recs.push({ level: 'ok', title: 'pH в норме (' + ph + ')', text: 'Диапазон ' + NORMS.ph.ideal + ' — оптимально для комфорта и действия хлора.' });
  }

  if (chlorine < NORMS.chlorine.min) {
    recs.push({ level: chlorine < 0.5 ? 'crit' : 'warn', title: 'Мало свободного хлора (' + chlorine + ' мг/л)', text: 'Вода недостаточно дезинфицирована. Добавьте хлор по инструкции с учётом объёма бассейна. Цель: ' + NORMS.chlorine.ideal });
  } else if (chlorine > NORMS.chlorine.max) {
    recs.push({ level: chlorine > 5 ? 'crit' : 'warn', title: 'Много свободного хлора (' + chlorine + ' мг/л)', text: 'Подождите снижения уровня перед купанием. Не добавляйте хлор до нормализации.' });
  } else {
    recs.push({ level: 'ok', title: 'Хлор в норме (' + chlorine + ' мг/л)', text: 'Диапазон ' + NORMS.chlorine.ideal + ' — достаточная дезинфекция.' });
  }

  if (temp < NORMS.temperature.min) {
    recs.push({ level: 'warn', title: 'Вода холодная (' + temp + ' °C)', text: 'Комфортный диапазон: ' + NORMS.temperature.ideal + '. Для обогрева используйте теплообменник или подогрев по возможности.' });
  } else if (temp > NORMS.temperature.max) {
    recs.push({ level: temp > 32 ? 'crit' : 'warn', title: 'Вода тёплая (' + temp + ' °C)', text: 'При высокой температуре хлор расходуется быстрее, чаще цветут водоросли. Чаще проверяйте хлор.' });
  } else {
    recs.push({ level: 'ok', title: 'Температура комфортная (' + temp + ' °C)', text: 'Диапазон ' + NORMS.temperature.ideal + '.' });
  }

  return recs;
}

function renderRecommendations(container, recs) {
  container.innerHTML = recs.map(r =>
    `<div class="rec-item ${r.level}"><strong>${r.title}</strong>${r.text}</div>`
  ).join('');
}

function renderProblemsGrid() {
  const grid = document.getElementById('problemsGrid');
  const poolProblems = selectedProblems[activePoolId] || [];

  grid.innerHTML = POOL_PROBLEMS.map(p => `
    <label class="problem-item ${poolProblems.includes(p.id) ? 'selected' : ''}">
      <input type="checkbox" value="${p.id}" ${poolProblems.includes(p.id) ? 'checked' : ''}>
      <div>
        <div class="problem-label">${p.label}</div>
        <div class="problem-desc">${p.desc}</div>
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
    container.innerHTML = '<div class="rec-item info"><strong>Выберите проблемы</strong>Отметьте одну или несколько ситуаций, которые вы видите в бассейне — появятся советы по устранению.</div>';
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

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  document.getElementById('activePoolName').textContent = pool.name;
  document.getElementById('activePoolMeta').textContent =
    `Объём: ${formatVolume(pool.volume)} · Измерений: ${poolMeas.length}`;

  syncVolumeSelect(pool.volume);
  renderProblemsGrid();
  renderProblemRecommendations(selectedProblems[pool.id] || []);

  if (poolMeas.length > 0) {
    const latest = poolMeas[0];
    renderRecommendations(
      document.getElementById('paramRecommendations'),
      getParamRecommendations(latest.ph, latest.chlorine, latest.temperature)
    );
  } else {
    document.getElementById('paramRecommendations').innerHTML =
      '<div class="rec-item info"><strong>Нет измерений</strong>Добавьте первое измерение — здесь появятся рекомендации по pH, хлору и температуре.</div>';
  }

  renderHistory(poolMeas);
  renderCharts(poolMeas);
}

function renderHistory(poolMeas) {
  const tbody = document.getElementById('historyBody');
  const empty = document.getElementById('emptyHistory');

  if (poolMeas.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  tbody.innerHTML = poolMeas.map(m => {
    const status = getOverallStatus(m.ph, m.chlorine, m.temperature);
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

function renderCharts(poolMeas) {
  const sorted = [...poolMeas].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(m =>
    new Date(m.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  );

  updateChart('ph', sorted.map(m => m.ph), labels, 'pH', '#1a8fc7', 7.2, 7.6);
  updateChart('chlorine', sorted.map(m => m.chlorine), labels, 'Хлор (мг/л)', '#2db86a', 1, 3);
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
      plugins: {
        legend: { display: false },
        annotation: {}
      },
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
      const pool = getActivePool();
      showMessage(document.getElementById('selectorMessage'), `Выбран бассейн «${pool.name}»`);
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
    if (e.target.value === 'custom') {
      document.getElementById('newCustomVolume').focus();
    }
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

    const pool = { id: generateId(), name, volume };
    poolList.push(pool);
    savePools();
    closeModal();
    renderPoolSelect();
    setActivePool(pool.id);
    showMessage(document.getElementById('selectorMessage'), `Бассейн «${name}» добавлен и сохранён!`);
  });

  document.getElementById('deletePoolBtn').addEventListener('click', () => {
    if (poolList.length <= 1) return;
    const pool = getActivePool();
    if (!confirm(`Удалить бассейн «${pool.name}» и все его измерения?`)) return;

    poolList = poolList.filter(p => p.id !== activePoolId);
    measurements = measurements.filter(m => m.poolId !== activePoolId);
    delete selectedProblems[activePoolId];
    activePoolId = poolList[0].id;
    savePools();
    saveMeasurements();
    saveProblems();
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

  document.getElementById('measurementForm').addEventListener('submit', e => {
    e.preventDefault();
    const pool = getActivePool();
    if (!pool) return;

    const ph = parseFloat(document.getElementById('ph').value);
    const chlorine = parseFloat(document.getElementById('chlorine').value);
    const temperature = parseFloat(document.getElementById('temperature').value);

    measurements.push({
      id: generateId(),
      poolId: pool.id,
      ph,
      chlorine,
      temperature,
      date: new Date().toISOString()
    });
    saveMeasurements();
    renderPoolContent();
    e.target.reset();
    showMessage(document.getElementById('selectorMessage'), 'Измерение сохранено!');
  });

  document.getElementById('clearHistoryBtn').addEventListener('click', () => {
    const pool = getActivePool();
    if (!pool || !confirm(`Очистить всю историю для «${pool.name}»?`)) return;

    measurements = measurements.filter(m => m.poolId !== pool.id);
    saveMeasurements();
    renderPoolContent();
    showMessage(document.getElementById('selectorMessage'), 'История очищена.');
  });
}

function init() {
  loadData();
  renderPoolSelect();
  setActivePool(activePoolId);
  initEventListeners();
}

document.addEventListener('DOMContentLoaded', init);
