document.addEventListener('DOMContentLoaded', () => {
  // Smooth scroll reveal with stagger effect
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { 
      if (e.isIntersecting) {
        e.target.classList.add('in');
        
        // Stagger child elements
        const children = e.target.querySelectorAll('.feature-item, .event-card, .menu-line, .fb-card');
        children.forEach((child, i) => {
          child.style.transitionDelay = `${i * 0.1}s`;
          child.classList.add(`stagger-${(i % 5) + 1}`);
        });
      }
    });
  }, { threshold: 0.12 });
  
  document.querySelectorAll('.reveal:not(.in)').forEach(el => io.observe(el));

  // Dynamic gradient background following mouse on hero
  const hero = document.querySelector('.hero');
  if (hero) {
    hero.addEventListener('mousemove', (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      hero.style.setProperty('--gx', `${x}%`);
      hero.style.setProperty('--gy', `${y}%`);
    });
  }


    // mobile nav toggle
  const navToggleBtn = document.getElementById('navToggleBtn');
  const navLinks = document.getElementById('navLinks');

  navToggleBtn.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggleBtn.classList.toggle('open', isOpen);
    navToggleBtn.setAttribute('aria-expanded', isOpen);
  });

  // close menu when a link is tapped
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggleBtn.classList.remove('open');
      navToggleBtn.setAttribute('aria-expanded', false);
    });
  });

  // close menu if tapping outside it
  document.addEventListener('click', (e) => {
    if (!navLinks.contains(e.target) && !navToggleBtn.contains(e.target)) {
      navLinks.classList.remove('open');
      navToggleBtn.classList.remove('open');
      navToggleBtn.setAttribute('aria-expanded', false);
    }
  });

  // wire contact links to config values
  document.querySelectorAll('[data-whatsapp-link]').forEach(el => {
    el.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}`;
  });
  document.querySelectorAll('[data-call-link]').forEach(el => {
    el.href = `tel:${CONFIG.PHONE_TEL}`;
  });
  document.querySelectorAll('[data-phone-display]').forEach(el => {
    el.textContent = CONFIG.PHONE_DISPLAY;
  });
  document.querySelectorAll('[data-address-display]').forEach(el => {
    el.textContent = CONFIG.ADDRESS;
  });

  // init everything
  loadMenu();
  initCart();
  loadFeedback();
  initFeedbackForm();
  initContactForm();
  loadGallery();
});
