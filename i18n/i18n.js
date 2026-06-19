const LANG_STORAGE_KEY = 'poolAppLang';
const SUPPORTED_LANGS = ['ru', 'en', 'es'];
const I18N_SCRIPT_VERSION = '5';

const LANG_SCRIPT_BUNDLES = {
  ru: [`i18n/ru.js?v=${I18N_SCRIPT_VERSION}`, `i18n/pool-problems-ru.js?v=${I18N_SCRIPT_VERSION}`],
  en: [`i18n/en.js?v=${I18N_SCRIPT_VERSION}`, `i18n/pool-problems-en.js?v=${I18N_SCRIPT_VERSION}`],
  es: [`i18n/es.js?v=${I18N_SCRIPT_VERSION}`, `i18n/pool-problems-es.js?v=${I18N_SCRIPT_VERSION}`]
};

let currentLang = 'ru';
const langChangeListeners = [];
const langScriptLoads = {};

function getStoredLang() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && SUPPORTED_LANGS.includes(stored)) return stored;
  } catch { /* ignore */ }
  const browser = (navigator.language || 'ru').slice(0, 2).toLowerCase();
  if (SUPPORTED_LANGS.includes(browser)) return browser;
  return 'ru';
}

function langBundleReady(lang) {
  if (lang === 'en') return typeof I18N_EN !== 'undefined' || Boolean(window.I18N_EN);
  if (lang === 'es') return typeof I18N_ES !== 'undefined' || Boolean(window.I18N_ES);
  return typeof I18N_RU !== 'undefined' || Boolean(window.I18N_RU);
}

function loadLangScript(src) {
  const base = src.split('?')[0].replace(/^\.\//, '');
  const already = Array.from(document.scripts).find(script => script.src.includes(base));
  if (already) {
    return langScriptLoads[src] || Promise.resolve();
  }

  if (langScriptLoads[src]) return langScriptLoads[src];

  langScriptLoads[src] = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.addEventListener('load', () => {
      script.setAttribute('data-loaded', 'true');
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  return langScriptLoads[src];
}

async function ensureLangBundle(lang) {
  if (langBundleReady(lang)) return true;
  const bundle = LANG_SCRIPT_BUNDLES[lang];
  if (!bundle) return false;
  try {
    for (const src of bundle) await loadLangScript(src);
  } catch (err) {
    console.error('ensureLangBundle', lang, err);
    return false;
  }
  return langBundleReady(lang);
}

function getTranslations(lang) {
  if (lang === 'en') {
    return typeof I18N_EN !== 'undefined' ? I18N_EN : (window.I18N_EN || {});
  }
  if (lang === 'es') {
    return typeof I18N_ES !== 'undefined' ? I18N_ES : (window.I18N_ES || {});
  }
  return typeof I18N_RU !== 'undefined' ? I18N_RU : (window.I18N_RU || {});
}

function getLang() {
  return currentLang;
}

function getLocale() {
  if (currentLang === 'en') return 'en-US';
  if (currentLang === 'es') return 'es-ES';
  return 'ru-RU';
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
  if (currentLang === 'en') {
    if (typeof POOL_PROBLEMS_EN !== 'undefined') return POOL_PROBLEMS_EN;
    if (window.POOL_PROBLEMS_EN) return window.POOL_PROBLEMS_EN;
  }
  if (currentLang === 'es') {
    if (typeof POOL_PROBLEMS_ES !== 'undefined') return POOL_PROBLEMS_ES;
    if (window.POOL_PROBLEMS_ES) return window.POOL_PROBLEMS_ES;
  }
  if (typeof POOL_PROBLEMS_RU !== 'undefined') return POOL_PROBLEMS_RU;
  if (window.POOL_PROBLEMS_RU) return window.POOL_PROBLEMS_RU;
  return typeof POOL_PROBLEMS_EN !== 'undefined' ? POOL_PROBLEMS_EN : (window.POOL_PROBLEMS_EN || []);
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

let langDropdownOutsideBound = false;

function closeAllLangDropdowns() {
  document.querySelectorAll('.lang-dropdown-btn').forEach(btn => {
    btn.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.lang-dropdown-menu').forEach(menu => {
    menu.classList.add('hidden');
  });
}

function bindLangDropdowns() {
  document.querySelectorAll('.lang-dropdown:not([data-lang-bound])').forEach(dropdown => {
    dropdown.dataset.langBound = '1';
    const btn = dropdown.querySelector('.lang-dropdown-btn');
    const menu = dropdown.querySelector('.lang-dropdown-menu');
    if (!btn || !menu) return;

    const toggleMenu = event => {
      event.preventDefault();
      event.stopPropagation();
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      closeAllLangDropdowns();
      if (!expanded) {
        btn.setAttribute('aria-expanded', 'true');
        menu.classList.remove('hidden');
      }
    };

    btn.addEventListener('click', toggleMenu);

    menu.querySelectorAll('.lang-option').forEach(option => {
      const pickLang = event => {
        event.preventDefault();
        event.stopPropagation();
        const lang = option.dataset.lang;
        if (lang && lang !== currentLang) void setLang(lang);
        closeAllLangDropdowns();
      };
      option.addEventListener('click', pickLang);
    });
  });

  document.querySelectorAll('.lang-btn:not([data-lang-bound])').forEach(btn => {
    btn.dataset.langBound = '1';
    btn.addEventListener('click', event => {
      event.preventDefault();
      const lang = btn.dataset.lang;
      if (lang && lang !== currentLang) void setLang(lang);
    });
  });

  if (!langDropdownOutsideBound) {
    langDropdownOutsideBound = true;
    document.addEventListener('click', event => {
      if (!event.target.closest('.lang-dropdown')) closeAllLangDropdowns();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeAllLangDropdowns();
    });
  }
}

function updateLangSwitcherUI() {
  document.querySelectorAll('.lang-dropdown-current').forEach(el => {
    el.textContent = t(`lang.${currentLang}`);
  });
  document.querySelectorAll('.lang-option').forEach(btn => {
    const active = btn.dataset.lang === currentLang;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function setLang(lang, { skipReload } = {}) {
  if (!SUPPORTED_LANGS.includes(lang)) return Promise.resolve(false);

  return ensureLangBundle(lang).then(ready => {
    if (!ready) return false;

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
    return true;
  });
}

function onLangChange(fn) {
  langChangeListeners.push(fn);
}

function initI18n() {
  currentLang = getStoredLang();
  document.documentElement.lang = currentLang;
  bindLangDropdowns();
  ensureLangBundle(currentLang).finally(() => {
    applyTranslations();
    updateLangSwitcherUI();
    bindLangDropdowns();
    window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: currentLang } }));
  });

  window.addEventListener('pageshow', () => {
    currentLang = getStoredLang();
    document.documentElement.lang = currentLang;
    bindLangDropdowns();
    ensureLangBundle(currentLang).finally(() => {
      applyTranslations();
      updateLangSwitcherUI();
      window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: currentLang } }));
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
