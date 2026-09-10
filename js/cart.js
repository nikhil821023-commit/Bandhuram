let cart = []; // { menuItemId, name, priceLabel, quantity }

function parsePrice(label) {
  const match = /^₹(\d+)$/.exec((label || '').trim());
  return match ? parseInt(match[1], 10) : null;
}

function cartCount() {
  return cart.reduce((sum, i) => sum + i.quantity, 0);
}

function cartTotals() {
  let total = 0;
  let hasVariablePricing = false;
  cart.forEach(i => {
    const price = parsePrice(i.priceLabel);
    if (price === null) { hasVariablePricing = true; return; }
    total += price * i.quantity;
  });
  return { total, hasVariablePricing };
}

function addToCart(menuItemId, name, priceLabel) {
  const existing = cart.find(i => i.menuItemId === menuItemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ menuItemId, name, priceLabel, quantity: 1 });
  }
  renderCart();
}

function changeQty(menuItemId, delta) {
  const item = cart.find(i => i.menuItemId === menuItemId);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    cart = cart.filter(i => i.menuItemId !== menuItemId);
  }
  renderCart();
}

function renderCart() {
  const badge = document.getElementById('cartBadge');
  const count = cartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';

  const list = document.getElementById('cartItemsList');
  const { total, hasVariablePricing } = cartTotals();

  if (!cart.length) {
    list.innerHTML = '<div class="cart-empty">Your cart is empty. Add something tasty from the menu!</div>';
  } else {
    list.innerHTML = cart.map(i => `
      <div class="cart-line">
        <div>
          <div class="cart-line-name">${escapeHtml(i.name)}</div>
          <div class="cart-line-price">${escapeHtml(i.priceLabel)}</div>
        </div>
        <div class="cart-qty">
          <button type="button" onclick="changeQty(${i.menuItemId}, -1)">−</button>
          <span>${i.quantity}</span>
          <button type="button" onclick="changeQty(${i.menuItemId}, 1)">+</button>
        </div>
      </div>
    `).join('');
  }

  document.getElementById('cartTotal').textContent = `₹${total}`;
  document.getElementById('cartVariableNote').style.display = hasVariablePricing ? 'block' : 'none';
  document.getElementById('cartCheckoutBtn').disabled = cart.length === 0;
}

function toggleCartDrawer(open) {
  document.getElementById('cartDrawer').classList.toggle('open', open);

  // hide the floating chat bubble while the cart is open — they overlap in the same corner
  const chatBtn = document.getElementById('bandhuChatBtn');
  const chatPanel = document.getElementById('bandhuChatPanel');
  if (chatBtn) chatBtn.style.display = open ? 'none' : 'flex';
  if (chatPanel && open) chatPanel.classList.remove('open'); // also close chat if it happened to be open
}

function initCart() {
  document.getElementById('cartToggleBtn').addEventListener('click', () => toggleCartDrawer(true));
  document.getElementById('cartCloseBtn').addEventListener('click', () => toggleCartDrawer(false));
  document.getElementById('cartCheckoutBtn').addEventListener('click', () => {
    toggleCartDrawer(false);
    document.getElementById('checkoutModal').style.display = 'flex';
  });
  document.getElementById('checkoutCancelBtn').addEventListener('click', () => {
    document.getElementById('checkoutModal').style.display = 'none';
  });

  document.getElementById('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('coName').value.trim();
    const phone = document.getElementById('coPhone').value.trim();
    const notes = document.getElementById('coNotes').value.trim();
    const statusEl = document.getElementById('checkoutStatus');
    const btn = document.getElementById('checkoutSubmitBtn');

    if (!name || !phone || !cart.length) {
      statusEl.textContent = 'Please add your name and phone number.';
      statusEl.className = 'fb-status err';
      return;
    }

    btn.disabled = true;
    statusEl.textContent = 'Placing your order…';
    statusEl.className = 'fb-status';

    try {
      await API.submitOrder({
        customerName: name,
        phone,
        notes: notes || undefined,
        items: cart.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity }))
      });
      statusEl.textContent =  '🎉 Thank you for placing your order with Bandhuram! Your order has been received. Kindly call 7209565334 to confirm your order. We look forward to serving you! ❤️';

      statusEl.className = 'fb-status ok';
      cart = [];
      renderCart();
      setTimeout(() => {
        document.getElementById('checkoutModal').style.display = 'none';
        document.getElementById('coName').value = '';
        document.getElementById('coPhone').value = '';
        document.getElementById('coNotes').value = '';
        statusEl.textContent = '';
      }, 1800);
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'fb-status err';
    } finally {
      btn.disabled = false;
    }
  });

  renderCart();
}
