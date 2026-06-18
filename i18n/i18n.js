const LANG_STORAGE_KEY = 'poolAppLang';
const SUPPORTED_LANGS = ['ru', 'en'];

let currentLang = 'ru';
const langChangeListeners = [];

function getStoredLang() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  } catch { /* ignore */ }
  const browser = (navigator.language || 'ru').slice(0, 2).toLowerCase();
  return browser === 'en' ? 'en' : 'ru';
}

function getTranslations(lang) {
  if (lang === 'en') return typeof I18N_EN !== 'undefined' ? I18N_EN : {};
  return typeof I18N_RU !== 'undefined' ? I18N_RU : {};
}

function getLang() {
  return currentLang;
}

function getLocale() {
  return currentLang === 'en' ? 'en-US' : 'ru-RU';
}

function t(key, params) {
  const dict = getTranslations(currentLang);
  let text = dict[key];
  if (text == null) {
    const fallback = getTranslations('ru')[key];
    text = fallback != null ? fallback : key;
  }
  if (params && typeof text === 'string') {
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(params[param]));
    });
  }
  return text;
}

function getPoolProblems() {
  if (currentLang === 'en' && typeof POOL_PROBLEMS_EN !== 'undefined') {
    return POOL_PROBLEMS_EN;
  }
  if (typeof POOL_PROBLEMS_RU !== 'undefined') return POOL_PROBLEMS_RU;
  return typeof POOL_PROBLEMS_EN !== 'undefined' ? POOL_PROBLEMS_EN : [];
}

function translateChemicalName(name) {
  const key = CHEMICAL_I18N_KEYS[name];
  return key ? t(key) : name;
}

function translateUnit(unit) {
  const key = UNIT_I18N_KEYS[unit];
  return key ? t(key) : unit;
}

function translateAuthError(msg) {
  if (!msg) return t('error.generic');
  const lower = msg.toLowerCase();
  if (msg.includes('Invalid login credentials')) return t('auth.error.invalidCredentials');
  if (msg.includes('User already registered')) return t('auth.error.alreadyRegistered');
  if (msg.includes('Email not confirmed')) return t('auth.error.emailNotConfirmed');
  if (msg.includes('Password should be at least')) return t('auth.error.passwordTooShort');
  if (msg.includes('invalid') && lower.includes('email')) return t('auth.error.invalidEmail');
  if (msg.includes('rate limit')) return t('auth.error.rateLimit');
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return t('auth.error.network');
  if (msg.includes('same as the old')) return t('auth.error.samePassword');
  if (msg.includes('Supabase')) return t('auth.error.supabaseDisconnected');
  return msg;
}

function applyTranslations(root) {
  const scope = root || document;

  scope.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = t(key);
  });

  scope.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    if (!key) return;
    el.innerHTML = t(key);
  });

  scope.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (!key) return;
    el.placeholder = t(key);
  });

  scope.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (!key) return;
    el.setAttribute('aria-label', t(key));
  });

  scope.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (!key) return;
    el.title = t(key);
  });

  scope.querySelectorAll('[data-i18n-alt]').forEach(el => {
    const key = el.getAttribute('data-i18n-alt');
    if (!key) return;
    el.alt = t(key);
  });

  scope.querySelectorAll('option[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    el.textContent = t(key);
  });

  const titleKey = document.body?.dataset?.pageTitleKey;
  if (titleKey) document.title = t(titleKey);

  const appTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (appTitle) appTitle.content = t('app.shortTitle');
}

function updateLangSwitcherUI() {
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const active = btn.dataset.lang === currentLang;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
}

function setLang(lang, { skipReload } = {}) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  currentLang = lang;
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang;
  applyTranslations();
  updateLangSwitcherUI();
  langChangeListeners.forEach(fn => {
    try { fn(currentLang); } catch (err) { console.error('languagechange listener', err); }
  });
  if (!skipReload) {
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: currentLang } }));
  }
}

function onLangChange(fn) {
  langChangeListeners.push(fn);
}

function initI18n() {
  currentLang = getStoredLang();
  document.documentElement.lang = currentLang;
  applyTranslations();
  updateLangSwitcherUI();

  document.querySelectorAll('.lang-switcher').forEach(switcher => {
    switcher.querySelectorAll('.lang-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.lang && btn.dataset.lang !== currentLang) {
          setLang(btn.dataset.lang);
        }
      });
    });
  });
}

const CHEMICAL_I18N_KEYS = {
  'Хлор (таблетки)': 'chem.chlorineTablets',
  'Хлор (гранулы)': 'chem.chlorineGranules',
  'Шоковый хлор': 'chem.shockChlorine',
  'pH-минус': 'chem.phMinus',
  'pH-плюс': 'chem.phPlus',
  'pH (регулятор)': 'chem.phRegulator',
  'Флокулянт': 'chem.flocculant',
  'Стопметал': 'chem.stopMetal',
  'Перекись водорода': 'chem.peroxide',
  'Перекись': 'chem.peroxideShort',
  'Альгицид': 'chem.algaecide',
  'Стабилизатор': 'chem.stabilizer',
  'Препарат от металлов': 'chem.metalRemover'
};

const UNIT_I18N_KEYS = {
  'г': 'unit.g',
  'кг': 'unit.kg',
  'мл': 'unit.ml',
  'л': 'unit.l',
  'таб.': 'unit.tabs',
  'мг': 'unit.mg'
};
