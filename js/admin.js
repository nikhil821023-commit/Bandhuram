let currentCategories = [];
let currentOrders = [];
let stompClient = null;

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('bandhuram_admin_token');
  const username = localStorage.getItem('bandhuram_admin_username');
  if (token) {
    showDashboard(username);
  }

  initLoginForm();
  initLogout();
  initTabs();
  initCategoryModal();
  initItemModal();
  initGalleryUpload();
  
});

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

// ================= AUTH =================

function initLoginForm() {
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const statusEl = document.getElementById('loginStatus');
    const btn = document.getElementById('loginSubmitBtn');

    btn.disabled = true;
    statusEl.textContent = 'Logging in…';
    statusEl.className = 'fb-status';

    try {
      const res = await API.login(username, password);
      localStorage.setItem('bandhuram_admin_token', res.token);
      localStorage.setItem('bandhuram_admin_username', res.username);
      showDashboard(res.username);
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'fb-status err';
    } finally {
      btn.disabled = false;
    }
  });
}

function initLogout() {
  document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('bandhuram_admin_token');
    localStorage.removeItem('bandhuram_admin_username');
    if (stompClient) { stompClient.deactivate(); stompClient = null; }
    document.getElementById('dashboardView').style.display = 'none';
    document.getElementById('loginView').style.display = 'flex';
  });
}

function showDashboard(username) {
  document.getElementById('loginView').style.display = 'none';
  document.getElementById('dashboardView').style.display = 'block';
  document.getElementById('adminUsernameLabel').textContent = username || '';
  loadOrders();
  loadMenuAdmin();
  loadInquiries();
  loadFeedbackAdmin();
  loadGalleryAdmin();
  connectOrderSocket();

}

// ================= TABS =================

function initTabs() {
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.view).classList.add('active');

      const badgeMap = {
        ordersPanel: 'ordersLiveBadge',
        inquiriesPanel: 'inquiriesLiveBadge',
        feedbackPanel: 'feedbackLiveBadge'
      };
      const badgeId = badgeMap[tab.dataset.view];
      if (badgeId) document.getElementById(badgeId).style.display = 'none';
    });
  });
}

// ================= WEBSOCKET (LIVE ORDERS) =================

function setWsStatus(text, cls) {
  const el = document.getElementById('wsStatus');
  el.textContent = text;
  el.className = `ws-status ${cls}`;
}

function playNotifySound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.25);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.25);
    });
  } catch (e) { /* audio not available, ignore */ }
}

function connectOrderSocket() {
  const token = localStorage.getItem('bandhuram_admin_token');
  if (!token || typeof StompJs === 'undefined') {
    setWsStatus('Live updates unavailable', 'disconnected');
    return;
  }

  const wsUrl = CONFIG.API_BASE_URL.replace(/^http/, 'ws') + '/ws';

  stompClient = new StompJs.Client({
    brokerURL: wsUrl,
    connectHeaders: { Authorization: `Bearer ${token}` },
    reconnectDelay: 4000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    debug: () => {}
  });

  stompClient.onConnect = () => {
    setWsStatus('Live', 'connected');
    stompClient.subscribe('/topic/orders', (message) => {
      const order = JSON.parse(message.body);
      prependOrder(order);
      playNotifySound();
      showOrderToast(order);
      flashOrdersTab('ordersLiveBadge');
      
    });

    stompClient.subscribe('/topic/contact', (message) => {
      const inquiry = JSON.parse(message.body);
      playNotifySound();
      showGenericToast(`New inquiry from ${inquiry.name}`);
      flashTab('inquiriesLiveBadge');
      loadInquiries();

    });

    stompClient.subscribe('/topic/feedback', (message) => {
      const feedback = JSON.parse(message.body);
      playNotifySound();
      showGenericToast(`New feedback from ${feedback.name} (${feedback.rating})`);
      flashTab('feedbackLiveBadge');
      loadFeedback();
    });

  };

  stompClient.onWebSocketClose = () => setWsStatus('Reconnecting…', 'disconnected');
  stompClient.onStompError = (frame) => {
    console.error('WebSocket/auth error:', frame.headers['message']);
    setWsStatus('Connection error', 'disconnected');
  };

  stompClient.activate();
}

function flashTab(badgeId) {
  const badge = document.getElementById(badgeId);
  if (badge) badge.style.display = 'inline-block';
}

function showGenericToast(text) {
  const toast = document.createElement('div');
  toast.className = 'order-toast';
  toast.innerHTML = `<b>${escapeHtml(text)}</b>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 5000);
}

// ================= ORDERS =================

function prependOrder(order) {
  currentOrders = [order, ...currentOrders.filter(o => o.id !== order.id)];
  renderOrders(order.id);
}

async function loadOrders() {
  const list = document.getElementById('adminOrdersList');
  list.innerHTML = '<div class="admin-loading">Loading orders…</div>';
  try {
    currentOrders = await API.getOrders();
    renderOrders();
  } catch (err) {
    list.innerHTML = `<div class="admin-loading">${escapeHtml(err.message)}</div>`;
  }
}

function renderOrders(highlightId) {
  const list = document.getElementById('adminOrdersList');
  if (!currentOrders.length) {
    list.innerHTML = '<div class="admin-loading">No orders yet.</div>';
    return;
  }

  list.innerHTML = currentOrders.map(o => `
    <div class="order-card ${o.id === highlightId ? 'is-new' : ''}">
      <div class="order-card-head">
        <div>
          <b>${escapeHtml(o.customerName)}</b>
          <span style="color:var(--ink-soft); font-size:0.88rem;"> · ${escapeHtml(o.phone)}</span>
          <div class="fb-date">${new Date(o.createdAt).toLocaleString('en-IN')}</div>
        </div>
        <select class="admin-status-select" onchange="handleOrderStatusChange(${o.id}, this.value)">
          <option value="NEW" ${o.status==='NEW'?'selected':''}>New</option>
          <option value="PREPARING" ${o.status==='PREPARING'?'selected':''}>Preparing</option>
          <option value="READY" ${o.status==='READY'?'selected':''}>Ready</option>
          <option value="COMPLETED" ${o.status==='COMPLETED'?'selected':''}>Completed</option>
          <option value="CANCELLED" ${o.status==='CANCELLED'?'selected':''}>Cancelled</option>
        </select>
      </div>
      <ul class="order-items-list">
        ${o.items.map(i => `<li>${i.quantity} × ${escapeHtml(i.name)} <span>${escapeHtml(i.priceLabel)}</span></li>`).join('')}
      </ul>
      ${o.notes ? `<p class="order-notes">Note: ${escapeHtml(o.notes)}</p>` : ''}
    </div>
  `).join('');
}

async function handleOrderStatusChange(id, status) {
  try {
    await API.updateOrderStatus(id, status);
    loadOrders();
  } catch (err) {
    alert(err.message);
    loadOrders();
  }
}

// ================= MENU MANAGEMENT =================

async function loadMenuAdmin() {
  const list = document.getElementById('adminMenuList');
  list.innerHTML = '<div class="admin-loading">Loading menu…</div>';
  try {
    currentCategories = await API.getMenu();
    renderMenuAdmin();
    renderBestSellersAdmin();   // ← add this line
  } catch (err) {
    list.innerHTML = `<div class="admin-loading">${escapeHtml(err.message)}</div>`;
  }
}

function renderMenuAdmin() {
  const list = document.getElementById('adminMenuList');
  if (!currentCategories.length) {
    list.innerHTML = '<div class="admin-loading">No categories yet — add one to get started.</div>';
    return;
  }

  list.innerHTML = currentCategories.map(cat => `
    <div class="admin-category-card">
      <div class="admin-category-head">
        <h3>${escapeHtml(cat.name)} <span style="font-size:0.75rem; color:var(--ink-soft); font-family:var(--label);">#${cat.sortOrder ?? '-'}</span></h3>
        <div class="admin-category-actions">
          <button class="admin-icon-btn" onclick="openCategoryModal(${cat.id})">Edit</button>
          <button class="admin-icon-btn danger" onclick="handleDeleteCategory(${cat.id})">Delete</button>
        </div>
      </div>
      ${cat.items.map(item => `
       <div class="admin-item-row ${item.available ? '' : 'unavailable'}">
          <div class="admin-item-info">
           <b>${escapeHtml(item.name)} ${item.featured ? '<span style="color:var(--gold);">⭐</span>' : ''}</b>
           ${item.description ? `<span>${escapeHtml(item.description)}</span>` : ''}
          </div>
         <div class="admin-item-right">
           <span class="admin-item-price">${escapeHtml(item.priceLabel)}</span>
           <button class="admin-icon-btn" onclick="openItemModal(${cat.id}, ${item.id})">Edit</button>
           <button class="admin-icon-btn danger" onclick="handleDeleteItem(${item.id})">Delete</button>
          </div>
       </div>
      `).join('')}
     
      <button class="admin-add-item-btn" onclick="openItemModal(${cat.id})">+ Add item to ${escapeHtml(cat.name)}</button>
    </div>
  `).join('');
}

async function handleDeleteCategory(id) {
  if (!confirm('Delete this category and all its items?')) return;
  try {
    await API.deleteCategory(id);
    loadMenuAdmin();
  } catch (err) {
    alert(err.message);
  }
}

async function handleDeleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try {
    await API.deleteItem(id);
    loadMenuAdmin();
  } catch (err) {
    alert(err.message);
  }
}

function initCategoryModal() {
  document.getElementById('newCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('categoryCancelBtn').addEventListener('click', closeCategoryModal);

  document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value.trim();
    const sortOrder = parseInt(document.getElementById('categorySortOrder').value, 10) || 1;
    const statusEl = document.getElementById('categoryModalStatus');
    const btn = document.getElementById('categorySaveBtn');

    btn.disabled = true;
    statusEl.textContent = 'Saving…';
    statusEl.className = 'fb-status';

    try {
      if (id) {
        await API.updateCategory(id, { name, sortOrder });
      } else {
        await API.createCategory({ name, sortOrder });
      }
      closeCategoryModal();
      loadMenuAdmin();
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'fb-status err';
    } finally {
      btn.disabled = false;
    }
  });
}

function openCategoryModal(id) {
  const modal = document.getElementById('categoryModal');
  const title = document.getElementById('categoryModalTitle');
  document.getElementById('categoryModalStatus').textContent = '';

  if (id) {
    const cat = currentCategories.find(c => c.id === id);
    title.textContent = 'Edit Category';
    document.getElementById('categoryId').value = cat.id;
    document.getElementById('categoryName').value = cat.name;
    document.getElementById('categorySortOrder').value = cat.sortOrder ?? 1;
  } else {
    title.textContent = 'New Category';
    document.getElementById('categoryId').value = '';
    document.getElementById('categoryName').value = '';
    document.getElementById('categorySortOrder').value = currentCategories.length + 1;
  }
  modal.style.display = 'flex';
}

function closeCategoryModal() {
  document.getElementById('categoryModal').style.display = 'none';
}

function initItemModal() {
  document.getElementById('itemCancelBtn').addEventListener('click', closeItemModal);

  document.getElementById('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('itemId').value;
    const categoryId = parseInt(document.getElementById('itemCategoryId').value, 10);
    const name = document.getElementById('itemName').value.trim();
    const description = document.getElementById('itemDescription').value.trim();
    const priceLabel = document.getElementById('itemPriceLabel').value.trim();
    const sortOrder = parseInt(document.getElementById('itemSortOrder').value, 10) || 1;
    const available = document.getElementById('itemAvailable').checked;
    const featured = document.getElementById('itemFeatured').checked;
    const photoFile = document.getElementById('itemPhotoFile').files[0];
    const statusEl = document.getElementById('itemModalStatus');
    const btn = document.getElementById('itemSaveBtn');

    const payload = { categoryId, name, description: description || null, priceLabel, sortOrder, available, featured };

    btn.disabled = true;
    statusEl.textContent = 'Saving…';
    statusEl.className = 'fb-status';

    try {
      let savedItem;
      if (id) {
        savedItem = await API.updateItem(id, payload);
      } else {
        savedItem = await API.createItem(payload);
      }

      if (photoFile) {
        statusEl.textContent = 'Uploading photo…';
        await API.uploadItemPhoto(savedItem.id, photoFile);
      }

      closeItemModal();
      loadMenuAdmin();
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'fb-status err';
    } finally {
      btn.disabled = false;
    }
  });
}

function openItemModal(categoryId, itemId) {
  const modal = document.getElementById('itemModal');
  const title = document.getElementById('itemModalTitle');
  const photoField = document.getElementById('itemPhotoField');
  const photoPreview = document.getElementById('itemPhotoPreview');
  document.getElementById('itemModalStatus').textContent = '';
  document.getElementById('itemCategoryId').value = categoryId;

  if (itemId) {
    const cat = currentCategories.find(c => c.id === categoryId);
    const item = cat.items.find(i => i.id === itemId);
    title.textContent = 'Edit Item';
    document.getElementById('itemId').value = item.id;
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemDescription').value = item.description || '';
    document.getElementById('itemPriceLabel').value = item.priceLabel;
    document.getElementById('itemSortOrder').value = item.sortOrder ?? 1;
    document.getElementById('itemAvailable').checked = item.available;
    document.getElementById('itemFeatured').checked = item.featured;

    photoField.style.display = 'block';
    photoPreview.innerHTML = item.photoUrl
      ? `<img src="${CONFIG.API_BASE_URL}${item.photoUrl}" style="width:100px; height:75px; object-fit:cover; border-radius:6px;">`
      : `<span style="font-size:0.82rem; color:var(--ink-soft);">No photo uploaded yet</span>`;
  } else {
    const cat = currentCategories.find(c => c.id === categoryId);
    title.textContent = 'New Item';
    document.getElementById('itemId').value = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemDescription').value = '';
    document.getElementById('itemPriceLabel').value = '';
    document.getElementById('itemSortOrder').value = (cat?.items.length || 0) + 1;
    document.getElementById('itemAvailable').checked = true;
    document.getElementById('itemFeatured').checked = false;
    photoField.style.display = 'none';   // no item id yet — can't attach a photo until it's saved
  }
  document.getElementById('itemPhotoFile').value = '';
  modal.style.display = 'flex';
}



function closeItemModal() {
  document.getElementById('itemModal').style.display = 'none';
}

function renderBestSellersAdmin() {
  const list = document.getElementById('adminBestSellersList');
  if (!list) return;

  const featured = currentCategories.flatMap(cat => cat.items.map(i => ({ ...i, categoryId: cat.id }))).filter(i => i.featured);

  if (!featured.length) {
    list.innerHTML = '<div class="admin-loading">No items marked as Best Sellers yet — check the ⭐ box when editing an item.</div>';
    return;
  }

  list.innerHTML = `<div class="admin-category-card">${featured.map(item => `
    <div class="admin-item-row ${item.available ? '' : 'unavailable'}">
      <div class="admin-item-info">
        <b>${escapeHtml(item.name)}</b>
        <span>${item.photoUrl ? 'Photo uploaded' : 'No photo yet'}${item.available ? '' : ' · Currently unavailable'}</span>
      </div>
      <div class="admin-item-right">
        <span class="admin-item-price">${escapeHtml(item.priceLabel)}</span>
        <button class="admin-icon-btn" onclick="openItemModal(${item.categoryId}, ${item.id})">Edit</button>
        <button class="admin-icon-btn danger" onclick="handleRemoveFromBestSellers(${item.categoryId}, ${item.id})">Remove</button>
      </div>
    </div>
  `).join('')}</div>`;
}

async function handleRemoveFromBestSellers(categoryId, itemId) {
  const cat = currentCategories.find(c => c.id === categoryId);
  const item = cat.items.find(i => i.id === itemId);
  try {
    await API.updateItem(itemId, {
      categoryId, name: item.name, description: item.description, priceLabel: item.priceLabel,
      sortOrder: item.sortOrder, available: item.available, featured: false
    });
    loadMenuAdmin();
  } catch (err) {
    alert(err.message);
  }
}

// ================= CONTACT INQUIRIES =================

async function loadInquiries() {
  const list = document.getElementById('adminInquiriesList');
  list.innerHTML = '<div class="admin-loading">Loading inquiries…</div>';
  try {
    const inquiries = await API.getInquiries();
    renderInquiries(inquiries);
  } catch (err) {
    list.innerHTML = `<div class="admin-loading">${escapeHtml(err.message)}</div>`;
  }
}

function renderInquiries(inquiries) {
  const list = document.getElementById('adminInquiriesList');
  if (!inquiries.length) {
    list.innerHTML = '<div class="admin-loading">No inquiries yet.</div>';
    return;
  }

  const rows = inquiries.map(i => `
    <div class="admin-row">
      <div data-label="Name / Phone"><b>${escapeHtml(i.name)}</b><br><span style="font-size:0.85rem; color:var(--ink-soft);">${escapeHtml(i.phone)}${i.email ? ' · ' + escapeHtml(i.email) : ''}</span></div>
      <div data-label="Received" style="font-size:0.85rem; color:var(--ink-soft);">${new Date(i.createdAt).toLocaleString('en-IN')}</div>
      <div data-label="Message" style="font-size:0.92rem;">${escapeHtml(i.message)}</div>
      <div data-label="Status"><span class="admin-status-badge ${i.status}">${i.status}</span></div>
      <div data-label="Update">
        <select class="admin-status-select" onchange="handleStatusChange(${i.id}, this.value)">
          <option value="NEW" ${i.status === 'NEW' ? 'selected' : ''}>New</option>
          <option value="CONTACTED" ${i.status === 'CONTACTED' ? 'selected' : ''}>Contacted</option>
          <option value="CLOSED" ${i.status === 'CLOSED' ? 'selected' : ''}>Closed</option>
        </select>
      </div>
    </div>
  `).join('');

  list.innerHTML = `
    <div class="admin-row admin-row-head">
      <div>Name / Phone</div><div>Received</div><div>Message</div><div>Status</div><div>Update</div>
    </div>
    ${rows}`;
}


async function handleStatusChange(id, status) {
  try {
    await API.updateInquiryStatus(id, status);
    loadInquiries();
  } catch (err) {
    alert(err.message);
    loadInquiries();
  }
}

// ================= FEEDBACK MODERATION =================

async function loadFeedbackAdmin() {
  const list = document.getElementById('adminFeedbackList');
  list.innerHTML = '<div class="admin-loading">Loading feedback…</div>';
  try {
    const items = await API.getFeedback();
    renderFeedbackAdmin(items);
  } catch (err) {
    list.innerHTML = `<div class="admin-loading">${escapeHtml(err.message)}</div>`;
  }
}
 
function renderFeedbackAdminSummary(items) {
  if (!items.length) return '';
 
  const total = items.length;
  const sum = items.reduce((acc, f) => acc + (f.rating || 0), 0);
  const avg = sum / total;
  const avgRounded = Math.round(avg * 10) / 10; // one decimal place
  const fullStars = Math.round(avg);
 
  return `
    <div class="admin-fb-row" style="align-items:center; gap:1.25rem;">
      <div style="font-size:2rem; font-weight:700; line-height:1; color:var(--maroon);">${avgRounded.toFixed(1)}</div>
      <div>
        <span class="fb-stars">${'★'.repeat(fullStars)}${'☆'.repeat(5 - fullStars)}</span>
        <div style="font-size:0.85rem; color:var(--ink-soft); margin-top:0.2rem;">Based on ${total} review${total === 1 ? '' : 's'}</div>
      </div>
    </div>`;
}
 
function renderFeedbackAdmin(items) {
  const list = document.getElementById('adminFeedbackList');
  if (!items.length) {
    list.innerHTML = '<div class="admin-loading">No feedback yet.</div>';
    return;
  }
 
  const summaryHtml = renderFeedbackAdminSummary(items);
 
  const rowsHtml = items.map(f => `
    <div class="admin-fb-row">
      <div>
        <b>${escapeHtml(f.name)}</b>
        <span class="fb-stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</span>
        <div style="font-size:0.85rem; color:var(--ink-soft); margin-top:0.3rem;">${new Date(f.createdAt).toLocaleString('en-IN')}</div>
        <p style="margin-top:0.5rem; font-size:0.95rem; color:var(--ink-soft);">${escapeHtml(f.comment)}</p>
      </div>
      <button class="admin-icon-btn danger" onclick="handleDeleteFeedback(${f.id})">Delete</button>
    </div>
  `).join('');
 
  list.innerHTML = summaryHtml + rowsHtml;
}
 
async function handleDeleteFeedback(id) {
  if (!confirm('Remove this feedback entry?')) return;
  try {
    await API.deleteFeedbackAdmin(id);
    loadFeedbackAdmin();
  } catch (err) {
    alert(err.message);
  }
}
 

// call inside showDashboard(), alongside the other load___() calls:
//   loadGalleryAdmin();

function initGalleryUpload() {
  document.getElementById('galleryUploadForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('galleryFile');
    const caption = document.getElementById('galleryCaption').value.trim();
    const statusEl = document.getElementById('galleryUploadStatus');
    const btn = document.getElementById('galleryUploadBtn');
    const file = fileInput.files[0];

    if (!file) {
      statusEl.textContent = 'Please choose a photo first.';
      statusEl.className = 'fb-status err';
      return;
    }

    btn.disabled = true;
    statusEl.textContent = 'Uploading…';
    statusEl.className = 'fb-status';

    try {
      await API.uploadImage(file, caption);
      statusEl.textContent = 'Uploaded!';
      statusEl.className = 'fb-status ok';
      fileInput.value = '';
      document.getElementById('galleryCaption').value = '';
      loadGalleryAdmin();
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'fb-status err';
    } finally {
      btn.disabled = false;
    }
  });
}

async function loadGalleryAdmin() {
  const grid = document.getElementById('adminGalleryGrid');
  grid.innerHTML = '<div class="admin-loading">Loading photos…</div>';
  try {
    const images = await API.getGallery();
    if (!images.length) {
      grid.innerHTML = '<div class="admin-loading">No photos uploaded yet.</div>';
      return;
    }
    grid.innerHTML = images.map(img => `
      <div class="admin-gallery-item">
        <img src="${CONFIG.API_BASE_URL}${img.url}" alt="${escapeHtml(img.caption || '')}">
        ${img.caption ? `<div class="admin-gallery-caption">${escapeHtml(img.caption)}</div>` : ''}
        <button class="admin-icon-btn danger" onclick="handleDeleteImage(${img.id})">Delete</button>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<div class="admin-loading">${escapeHtml(err.message)}</div>`;
  }
}

async function handleDeleteImage(id) {
  if (!confirm('Delete this photo?')) return;
  try {
    await API.deleteImage(id);
    loadGalleryAdmin();
  } catch (err) {
    alert(err.message);
  }
}

// add initGalleryUpload(); to the DOMContentLoaded block at the top of admin.js