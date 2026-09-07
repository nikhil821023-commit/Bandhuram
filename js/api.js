async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

function extractErrorMessage(errBody, fallback) {
  if (!errBody) return fallback;
  if (errBody.fields) return Object.values(errBody.fields).join(', ');
  return errBody.error || fallback;
}

function authHeaders() {
  const token = localStorage.getItem('bandhuram_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

const API = {
  async getMenu() {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/menu`);
    if (!res.ok) throw new Error('Could not load the menu right now.');
    return res.json();
  },

  async getFeedback() {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/feedback`);
    if (!res.ok) throw new Error('Could not load feedback right now.');
    return res.json();
  },

  async submitFeedback(payload) {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(extractErrorMessage(err, 'Could not post your feedback.'));
    }
    return res.json();
  },

  uploadItemPhoto(id, file) {
   const formData = new FormData();
    formData.append('file', file);
    const token = localStorage.getItem('bandhuram_admin_token');
    return fetch(`${CONFIG.API_BASE_URL}/api/admin/menu/items/${id}/photo`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData
    }).then(async res => {
      if (res.status === 401 || res.status === 403) throw new Error('Session expired — please log in again.');
      if (!res.ok) {
       const err = await safeJson(res);
        throw new Error(extractErrorMessage(err, 'Could not upload photo.'));
      }
      return res.json();
    });
  },

  // add inside the API object, alongside submitContact:

  async submitOrder(payload) {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/orders`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(payload)
    });
    if (!res.ok) {
     const err = await safeJson(res);
     throw new Error(extractErrorMessage(err, 'Could not place your order.'));
    }
    return res.json();
  },

  getOrders() {
   return this.authedRequest('/api/admin/orders', { method: 'GET' });
  }, 
  updateOrderStatus(id, status) {
   return this.authedRequest(`/api/admin/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  },

  

  async submitContact(payload) {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(extractErrorMessage(err, 'Could not send your message.'));
    }
    return res.json();
  },

  // public
async getGallery() {
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/gallery`);
  if (!res.ok) throw new Error('Could not load photos right now.');
  return res.json();
},

// admin — note: no Content-Type header, the browser sets the multipart boundary itself
 async uploadImage(file, caption) {
  const formData = new FormData();
  formData.append('file', file);
  if (caption) formData.append('caption', caption);

  const token = localStorage.getItem('bandhuram_admin_token');
  const res = await fetch(`${CONFIG.API_BASE_URL}/api/admin/gallery`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(extractErrorMessage(err, 'Could not upload that image.'));
  }
  return res.json();
},
deleteImage(id) {
  return this.authedRequest(`/api/admin/gallery/${id}`, { method: 'DELETE' });
},

  // ---------------- ADMIN ----------------

  async login(username, password) {
    const res = await fetch(`${CONFIG.API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(extractErrorMessage(err, 'Invalid username or password.'));
    }
    return res.json();
  },

  async authedRequest(path, options = {}) {
    const res = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
        ...(options.headers || {})
      }
    });
    if (res.status === 401 || res.status === 403) {
      localStorage.removeItem('bandhuram_admin_token');
      throw new Error('Session expired — please log in again.');
    }
    if (!res.ok) {
      const err = await safeJson(res);
      throw new Error(extractErrorMessage(err, 'Request failed.'));
    }
    if (res.status === 204) return null;
    return res.json();
  },

  createCategory(payload) {
    return this.authedRequest('/api/admin/menu/categories', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateCategory(id, payload) {
    return this.authedRequest(`/api/admin/menu/categories/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  deleteCategory(id) {
    return this.authedRequest(`/api/admin/menu/categories/${id}`, { method: 'DELETE' });
  },
  createItem(payload) {
    return this.authedRequest('/api/admin/menu/items', { method: 'POST', body: JSON.stringify(payload) });
  },
  updateItem(id, payload) {
    return this.authedRequest(`/api/admin/menu/items/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  deleteItem(id) {
    return this.authedRequest(`/api/admin/menu/items/${id}`, { method: 'DELETE' });
  },
  getInquiries() {
    return this.authedRequest('/api/admin/contact', { method: 'GET' });
  },
  updateInquiryStatus(id, status) {
    return this.authedRequest(`/api/admin/contact/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
  },
  deleteFeedbackAdmin(id) {
    return this.authedRequest(`/api/admin/feedback/${id}`, { method: 'DELETE' });
  }
};