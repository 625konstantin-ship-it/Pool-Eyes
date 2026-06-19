const PoolSelectUI = (function () {
  let root;
  let btn;
  let currentEl;
  let menu;
  let searchInput;
  let listEl;
  let emptyEl;
  let onSelectCallback = null;
  let isUpdating = false;
  let pools = [];
  let activeId = null;
  let isOpen = false;
  let outsideBound = false;

  function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, ch => map[ch]);
  }

  function getEmptyText() {
    return typeof t === 'function' ? t('pool.searchEmpty') : 'No results';
  }

  function buildMarkup(ariaLabel) {
    return `
      <button type="button" class="pool-search-select-btn" aria-haspopup="listbox" aria-expanded="false">
        <span class="pool-search-select-current">—</span>
        <svg class="pool-search-select-chevron" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <div class="pool-search-select-menu hidden" role="presentation">
        <input type="search" class="pool-search-select-search" autocomplete="off" spellcheck="false" data-i18n-placeholder="pool.searchPlaceholder" aria-label="${escapeHtml(ariaLabel)}">
        <ul class="pool-search-select-list" role="listbox"></ul>
        <p class="pool-search-select-empty hidden" data-i18n="pool.searchEmpty"></p>
      </div>
    `;
  }

  function upgradeSelect(selectEl) {
    const wrapper = document.createElement('div');
    wrapper.className = 'pool-search-select';
    wrapper.id = selectEl.id;

    const ariaLabelKey = selectEl.getAttribute('data-i18n-aria-label');
    const ariaLabel = selectEl.getAttribute('aria-label') || '';
    if (ariaLabelKey) wrapper.setAttribute('data-i18n-aria-label', ariaLabelKey);
    if (ariaLabel) wrapper.setAttribute('aria-label', ariaLabel);

    wrapper.innerHTML = buildMarkup(ariaLabel || 'Pools');
    selectEl.replaceWith(wrapper);
    return wrapper;
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    menu.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
    searchInput.value = '';
    renderList('');
  }

  function open() {
    if (isOpen) return;
    isOpen = true;
    menu.classList.remove('hidden');
    btn.setAttribute('aria-expanded', 'true');
    renderList('');
    requestAnimationFrame(() => searchInput.focus());
    scrollActiveIntoView();
  }

  function scrollActiveIntoView() {
    const active = listEl.querySelector('.pool-search-select-option.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  }

  function renderList(query) {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? pools.filter(p => (p.name || '').toLowerCase().includes(q))
      : pools;

    listEl.innerHTML = filtered.map(p => {
      const active = p.id === activeId;
      return `<li role="presentation"><button type="button" class="pool-search-select-option${active ? ' active' : ''}" role="option" aria-selected="${active}" data-id="${escapeHtml(p.id)}">${escapeHtml(p.name)}</button></li>`;
    }).join('');

    emptyEl.textContent = getEmptyText();
    emptyEl.classList.toggle('hidden', filtered.length > 0);
  }

  function updateCurrentLabel() {
    const pool = pools.find(p => p.id === activeId);
    currentEl.textContent = pool?.name || '—';
  }

  function bindEvents() {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (isOpen) close();
      else open();
    });

    searchInput.addEventListener('input', () => renderList(searchInput.value));
    searchInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        btn.focus();
      }
    });

    listEl.addEventListener('click', e => {
      const opt = e.target.closest('.pool-search-select-option');
      if (!opt) return;

      const id = opt.dataset.id;
      close();

      if (!id || id === activeId || isUpdating) {
        if (id) {
          activeId = id;
          updateCurrentLabel();
        }
        return;
      }

      activeId = id;
      updateCurrentLabel();
      onSelectCallback?.(id);
    });

    if (!outsideBound) {
      outsideBound = true;
      document.addEventListener('click', e => {
        if (isOpen && root && !root.contains(e.target)) close();
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen) {
          close();
          btn.focus();
        }
      });
    }
  }

  function init(onSelect) {
    const el = document.getElementById('poolSelect');
    if (!el) return;

    onSelectCallback = onSelect;
    root = el.tagName === 'SELECT' ? upgradeSelect(el) : el;

    if (!root.classList.contains('pool-search-select')) {
      root.classList.add('pool-search-select');
    }
    if (!root.querySelector('.pool-search-select-btn')) {
      const ariaLabel = root.getAttribute('aria-label') || 'Pools';
      root.innerHTML = buildMarkup(ariaLabel);
    }

    btn = root.querySelector('.pool-search-select-btn');
    currentEl = root.querySelector('.pool-search-select-current');
    menu = root.querySelector('.pool-search-select-menu');
    searchInput = root.querySelector('.pool-search-select-search');
    listEl = root.querySelector('.pool-search-select-list');
    emptyEl = root.querySelector('.pool-search-select-empty');

    bindEvents();

    if (typeof applyTranslations === 'function') applyTranslations(root);
  }

  function render(newPools, newActiveId) {
    if (!root) return;

    isUpdating = true;
    pools = newPools || [];
    activeId = newActiveId ?? activeId;

    if (!activeId && pools.length > 0) {
      activeId = pools[0].id;
    }

    updateCurrentLabel();
    renderList(isOpen ? searchInput.value : '');
    isUpdating = false;
  }

  function setValue(poolId) {
    if (!root) return;

    isUpdating = true;
    activeId = poolId;
    updateCurrentLabel();
    renderList(isOpen ? searchInput.value : '');
    isUpdating = false;
  }

  return {
    init,
    render,
    setValue,
    get isUpdating() {
      return isUpdating;
    }
  };
})();
