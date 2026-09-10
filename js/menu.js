function renderBestSellers(categories) {
  const grid = document.getElementById('bestSellersGrid');
  const section = document.getElementById('bestSellers');
  if (!grid) return;

  const featuredItems = categories
    .flatMap(cat => cat.items)
    .filter(item => item.featured && item.available);

  if (!featuredItems.length) {
    if (section) section.style.display = 'none';
    return;
  }
  if (section) section.style.display = 'block';

  grid.innerHTML = featuredItems.map(item => {
const photoSrc = item.photoUrl || null;   // already a full URL — no prefix needed
    return `
      <div class="bs-card">
        <div class="bs-photo">
          ${photoSrc
            ? `<img src="${photoSrc}" alt="${escapeHtml(item.name)}" onerror="this.parentElement.innerHTML='<div class=\\'bs-photo-placeholder\\'>📷</div>'">`
            : `<div class="bs-photo-placeholder">📷</div>`}
        </div>
        <div class="bs-info">
          <h4>${escapeHtml(item.name.replace(/\s*\([^)]*\)/g, ''))}</h4>
          <div class="bs-price">${escapeHtml(item.priceLabel)}</div>
          <button class="bs-add" onclick="addToCart(${item.id}, '${escapeHtml(item.name).replace(/'/g, "\\'")}', '${escapeHtml(item.priceLabel).replace(/'/g, "\\'")}')">Add +</button>
        </div>
      </div>`;
  }).join('');
}




function menuLineHTML(item) {
  const sub = item.description
    ? `<span class="menu-line-sub">${escapeHtml(item.description)}</span>`
    : '';
  return `
    <div class="menu-line">
      <div><span class="menu-line-name">${escapeHtml(item.name)}</span>${sub}</div>
      <div class="menu-line-right">
        <span class="menu-line-price">${escapeHtml(item.priceLabel)}</span>
        <button type="button" class="add-to-cart-btn" onclick="addToCart(${item.id}, '${escapeHtml(item.name).replace(/'/g, "\\'")}', '${escapeHtml(item.priceLabel).replace(/'/g, "\\'")}')">Add</button>
      </div>
    </div>`;
}
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function renderThaliCallout(thaliCategory) {
  const wrap = document.getElementById('thaliCallout');
  if (!thaliCategory || !thaliCategory.items.length) {
    wrap.style.display = 'none';
    return;
  }
  const item = thaliCategory.items[0];
  wrap.innerHTML = `
    <div class="thali-callout-inner">
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description || '')}</p>
      </div>
      <div class="thali-price">${escapeHtml(item.priceLabel)}</div>
    </div>`;
  wrap.style.display = 'block';
}

function renderMenuTabs(categories) {
  const tabsEl = document.getElementById('menuTabs');
  const panelsEl = document.getElementById('menuPanels');

  tabsEl.innerHTML = categories.map((cat, i) => `
    <button class="menu-tab ${i === 0 ? 'active' : ''}" data-tab="cat-${cat.id}">
      ${escapeHtml(cat.name)}
    </button>`).join('');

  panelsEl.innerHTML = categories.map((cat, i) => `
    <div class="menu-panel ${i === 0 ? 'active' : ''}" data-panel="cat-${cat.id}">
      <div class="menu-list">
        ${cat.items.filter(it => it.available).map(menuLineHTML).join('')}
      </div>
    </div>`).join('');

  tabsEl.querySelectorAll('.menu-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabsEl.querySelectorAll('.menu-tab').forEach(t => t.classList.remove('active'));
      panelsEl.querySelectorAll('.menu-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      panelsEl.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });
}

async function loadMenu() {
  const tabsEl = document.getElementById('menuTabs');
  const panelsEl = document.getElementById('menuPanels');
  panelsEl.innerHTML = '<div class="menu-loading">Loading today\'s menu…</div>';

  try {
    const categories = await API.getMenu();
    renderBestSellers(categories);

    const thaliIndex = categories.findIndex(c => c.name.trim().toLowerCase() === 'thali');
    let thaliCategory = null;
    let restCategories = categories;

    if (thaliIndex !== -1) {
      thaliCategory = categories[thaliIndex];
      restCategories = categories.filter((_, i) => i !== thaliIndex);
    }

    renderThaliCallout(thaliCategory);

    if (!restCategories.length) {
      tabsEl.innerHTML = '';
      panelsEl.innerHTML = '<div class="menu-loading">Menu coming soon.</div>';
      return;
    }

    renderMenuTabs(restCategories);
  } catch (err) {
    panelsEl.innerHTML = `<div class="menu-loading">${escapeHtml(err.message)}</div>`;
  }
}
