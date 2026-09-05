function initContactForm() {
  document.getElementById('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nameEl = document.getElementById('cName');
    const phoneEl = document.getElementById('cPhone');
    const emailEl = document.getElementById('cEmail');
    const messageEl = document.getElementById('cMessage');
    const statusEl = document.getElementById('contactStatus');
    const submitBtn = document.getElementById('contactSubmitBtn');

    const name = nameEl.value.trim();
    const phone = phoneEl.value.trim();
    const email = emailEl.value.trim();
    const message = messageEl.value.trim();

    if (!name || !phone || !message) {
      statusEl.textContent = 'Please fill in your name, phone and message.';
      statusEl.className = 'fb-status err';
      return;
    }

    submitBtn.disabled = true;
    statusEl.textContent = 'Sending…';
    statusEl.className = 'fb-status';

    try {
      await API.submitContact({ name, phone, email: email || undefined, message });
      statusEl.textContent = 'Thanks — we\'ll get back to you shortly!';
      statusEl.className = 'fb-status ok';
      nameEl.value = '';
      phoneEl.value = '';
      emailEl.value = '';
      messageEl.value = '';
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'fb-status err';
    } finally {
      submitBtn.disabled = false;
    }
  });
}