let currentUser = null;
let poolList = [];
let activePoolId = null;
let selectedProblems = {};
let isUpdatingUI = false;

function storageGet(key) {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function storageSet(key, value) {
  try { localStorage.setItem(key, value); }
  catch { /* ignore */ }
}

function activePoolKey() {
  return currentUser ? `activePool_${currentUser.id}` : null;
}

function saveActivePoolId() {
  const key = activePoolKey();
  if (key && activePoolId) storageSet(key, activePoolId);
}

function getActivePool() {
  return poolList.find(p => p.id === activePoolId) || null;
}

function isAiAssistantConfigured() {
  return typeof AI_ASSISTANT_ENABLED !== 'undefined' && AI_ASSISTANT_ENABLED === true;
}

function renderAiAssistantUI() {
  const statusEl = document.getElementById('aiModeStatus');
  const connectBtn = document.getElementById('connectAiBtn');
  const aiOption = document.getElementById('aiModeOption');
  const manualOption = document.getElementById('manualModeOption');
  const aiRadio = aiOption?.querySelector('input');

  if (isAiAssistantConfigured()) {
    statusEl.textContent = 'AI-асистент доступен — можно переключить режим';
    statusEl.className = 'ai-mode-status ai-ready';
    connectBtn.disabled = false;
    connectBtn.title = '';
    aiOption?.classList.remove('disabled');
    if (aiRadio) aiRadio.disabled = false;
    return;
  }

  statusEl.textContent = 'Ручной режим — готовые рекомендации по выбранным проблемам';
  statusEl.className = 'ai-mode-status manual';
  connectBtn.disabled = true;
  connectBtn.title = 'Функция появится позже';
  aiOption?.classList.add('disabled');
  if (aiRadio) {
    aiRadio.disabled = true;
    aiRadio.checked = false;
  }
  manualOption?.querySelector('input')?.click();
  manualOption?.classList.add('selected');
  aiOption?.classList.remove('selected');
}

async function loadUserData() {
  if (!currentUser) return;
  const data = await dbLoadUserData(currentUser.id);
  poolList = data.poolList;
  selectedProblems = data.selectedProblems;
  activePoolId = storageGet(activePoolKey()) || null;

  if (poolList.length === 0) {
    activePoolId = null;
    return;
  }
  if (!activePoolId || !poolList.some(p => p.id === activePoolId)) {
    activePoolId = poolList[0].id;
    saveActivePoolId();
  }
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
  }

  isUpdatingUI = false;
}

function renderProblemsGrid() {
  const grid = document.getElementById('problemsGrid');
  if (!grid || !activePoolId) return;

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

function renderProblemRecommendations(problemIds) {
  const container = document.getElementById('problemRecommendations');
  if (!container) return;

  if (!problemIds || problemIds.length === 0) {
    container.innerHTML = '<div class="rec-item info"><strong>Выберите проблемы</strong>Отметьте ситуации, которые видите в бассейне.</div>';
    return;
  }

  container.innerHTML = renderRecommendationsHtml(buildProblemRecommendations(problemIds));
}

function updatePoolProblems() {
  const checked = [...document.querySelectorAll('#problemsGrid input:checked')].map(el => el.value);
  selectedProblems[activePoolId] = checked;

  const pool = getActivePool();
  if (pool && currentUser) {
    dbUpsertPool(currentUser.id, pool, checked).catch(err => {
      console.error('saveProblems', err);
      alert('Не удалось сохранить выбор проблем. Проверьте подключение.');
    });
  }

  renderProblemRecommendations(checked);
}

function renderProblemsContent() {
  const pool = getActivePool();
  const content = document.getElementById('problemsContent');
  const noHint = document.getElementById('noPoolHint');
  const meta = document.getElementById('problemsPoolMeta');

  if (!pool) {
    content?.classList.add('hidden');
    noHint?.classList.remove('hidden');
    if (meta) meta.textContent = '';
    return;
  }

  content?.classList.remove('hidden');
  noHint?.classList.add('hidden');

  if (meta) {
    meta.textContent = `${pool.name} · ${Number(pool.volume).toLocaleString('ru-RU')} л`;
  }

  renderProblemsGrid();
  renderProblemRecommendations(selectedProblems[pool.id] || []);
}

async function setActivePool(poolId) {
  const pool = poolList.find(p => p.id === poolId);
  if (!pool) return;

  activePoolId = pool.id;
  saveActivePoolId();

  const select = document.getElementById('poolSelect');
  if (select && select.value !== pool.id) {
    isUpdatingUI = true;
    select.value = pool.id;
    isUpdatingUI = false;
  }

  renderProblemsContent();
}

function showProblemsApp() {
  document.getElementById('problemsLoading')?.classList.add('hidden');
  document.getElementById('problemsApp')?.classList.remove('hidden');
}

function redirectToLogin() {
  window.location.href = 'index.html';
}

function initEventListeners() {
  document.getElementById('poolSelect')?.addEventListener('change', e => {
    if (isUpdatingUI) return;
    setActivePool(e.target.value);
  });

  document.getElementById('connectAiBtn')?.addEventListener('click', () => {
    if (!isAiAssistantConfigured()) return;
    alert('Подключение AI-асистента будет добавлено в следующем обновлении.');
  });

  document.querySelectorAll('input[name="helpMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.getElementById('manualModeOption')?.classList.toggle('selected', radio.value === 'manual');
      document.getElementById('aiModeOption')?.classList.toggle('selected', radio.value === 'ai');
    });
  });
}

async function startProblemsPage() {
  renderAiAssistantUI();
  renderPoolSelect();

  if (poolList.length === 0) {
    renderProblemsContent();
    showProblemsApp();
    return;
  }

  await setActivePool(activePoolId);
  showProblemsApp();
}

async function init() {
  if (!initSupabaseClient()) {
    alert('Настройте Supabase в файле config.js');
    redirectToLogin();
    return;
  }

  initEventListeners();

  const session = await authGetSession();
  if (!session?.user) {
    redirectToLogin();
    return;
  }

  currentUser = mapUser(session);

  try {
    await loadUserData();
    await startProblemsPage();
  } catch (err) {
    console.error(err);
    alert('Не удалось загрузить данные. Попробуйте обновить страницу.');
    redirectToLogin();
  }
}

document.addEventListener('DOMContentLoaded', init);
