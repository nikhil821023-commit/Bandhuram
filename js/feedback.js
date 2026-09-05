let currentRating = 0;

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + 'd ago';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function renderAverageSummary(items) {
  const list = document.getElementById('fbList');
  const existing = document.getElementById('fbAverageSummary');
  if (existing) existing.remove();

  if (!items.length) return;

  const total = items.length;
  const sum = items.reduce((acc, f) => acc + (f.rating || 0), 0);
  const avg = sum / total;
  const avgRounded = Math.round(avg * 10) / 10; // one decimal place
  const fullStars = Math.round(avg); // nearest whole star for the star display

  const summary = document.createElement('div');
  summary.id = 'fbAverageSummary';
  summary.className = 'fb-card';
  summary.style.display = 'flex';
  summary.style.alignItems = 'center';
  summary.style.gap = '1rem';
  summary.style.marginBottom = '1.5rem';

  summary.innerHTML = `
    <div style="font-size:2.2rem; font-weight:700; line-height:1; color:var(--maroon, #4b1113);">${avgRounded.toFixed(1)}</div>
    <div>
      <div class="fb-stars">${'★'.repeat(fullStars)}${'☆'.repeat(5 - fullStars)}</div>
      <div class="fb-date" style="margin-top:0.2rem;">Based on ${total} review${total === 1 ? '' : 's'}</div>
    </div>
  `;

  list.parentNode.insertBefore(summary, list);
}

function renderFeedbackList(items) {
  const list = document.getElementById('fbList');

  renderAverageSummary(items);

  if (!items.length) {
    list.innerHTML = '<div class="fb-empty">No feedback yet — be the first to share your experience.</div>';
    return;
  }
  list.innerHTML = items.map(f => `
    <div class="fb-card">
      <div class="fb-card-head">
        <div class="fb-avatar">${escapeHtml((f.name || '?').trim().charAt(0).toUpperCase())}</div>
        <div>
          <div class="fb-name">${escapeHtml(f.name)}</div>
          <div class="fb-date">${timeAgo(f.createdAt)}</div>
        </div>
        <div class="fb-stars">${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)}</div>
      </div>
      <div class="fb-comment">${escapeHtml(f.comment)}</div>
    </div>`).join('');
}

async function loadFeedback() {
  const list = document.getElementById('fbList');
  list.innerHTML = '<div class="fb-loading">Loading feedback…</div>';
  try {
    const items = await API.getFeedback();
    renderFeedbackList(items);
  } catch (err) {
    list.innerHTML = `<div class="fb-empty">${escapeHtml(err.message)}</div>`;
  }
}

function initFeedbackForm() {
  const starButtons = document.querySelectorAll('#starPicker button');
  starButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      currentRating = parseInt(btn.dataset.val, 10);
      starButtons.forEach(b => b.classList.toggle('on', parseInt(b.dataset.val, 10) <= currentRating));
    });
  });

  document.getElementById('fbForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('fbName');
    const commentEl = document.getElementById('fbComment');
    const statusEl = document.getElementById('fbStatus');
    const submitBtn = document.getElementById('fbSubmitBtn');

    const name = nameEl.value.trim();
    const comment = commentEl.value.trim();

    if (!name || !comment) {
      statusEl.textContent = 'Please add your name and feedback.';
      statusEl.className = 'fb-status err';
      return;
    }
    if (currentRating < 1) {
      statusEl.textContent = 'Please select a star rating.';
      statusEl.className = 'fb-status err';
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = 'Posting…';
    statusEl.className = 'fb-status';

    try {
      await API.submitFeedback({ name, rating: currentRating, comment });
      statusEl.textContent = 'Thanks — your feedback is posted!';
      statusEl.className = 'fb-status ok';
      nameEl.value = '';
      commentEl.value = '';
      currentRating = 0;
      starButtons.forEach(b => b.classList.remove('on'));
      loadFeedback();
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'fb-status err';
    } finally {
      submitBtn.disabled = false;
    }
  });
}