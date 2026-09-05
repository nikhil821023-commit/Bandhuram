(function () {
  // ---------------- CONFIG / KNOWLEDGE ----------------

  const GREETINGS = /\b(hi|hello|hey|namaste)\b/i;

  const FAQ_RULES = [
    {
      patterns: [/\b(where|location|address|located)\b/i],
      answer: () => `We're at <b>${CONFIG.ADDRESS}</b>. <a href="#visit" onclick="document.getElementById('bandhuChatPanel').classList.remove('open')">See it on the map ↓</a>`
    },
    {
      patterns: [/\b(hour|time|timing|open|close|opens|closes)\b/i],
      answer: () => CONFIG.HOURS_DISPLAY || 'Timings are being confirmed — please call ahead to check.'
    },
    {
      patterns: [/\b(phone|number|contact|call)\b/i],
      answer: () => `You can call us at <b>${CONFIG.PHONE_DISPLAY}</b>, or message on <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}" target="_blank" rel="noopener">WhatsApp</a>.`
    },
    {
      patterns: [/\bveg(etarian)?\b/i, /\bnon.?veg\b/i],
      answer: () => `Yes — Bandhuram is 100% pure veg.`
    },
    {
      patterns: [/\b(swiggy|zomato|deliver(y)?)\b/i],
      answer: () => `We're on Swiggy &amp; Zomato for delivery, or you can order ahead directly on <a href="https://wa.me/${CONFIG.WHATSAPP_NUMBER}" target="_blank" rel="noopener">WhatsApp</a>.`
    },
    {
      patterns: [/\b(thali)\b/i],
      answer: () => findThaliAnswer()
    }
  ];

  const STOPWORDS = new Set(['the','a','an','with','and','of','pc','pcs','plate','half','full']);
  const PRICE_WORDS = /\b(price|cost|rate|how much|kitna)\b/i;
  const AVAIL_WORDS = /\b(have|available|milta|is there|do you)\b/i;

  let menuItemsFlat = [];
  let menuLoaded = false;

  async function ensureMenuLoaded() {
    if (menuLoaded) return;
    try {
      const categories = await API.getMenu();
      menuItemsFlat = [];
      categories.forEach(cat => {
        cat.items.forEach(item => {
          menuItemsFlat.push({ ...item, categoryName: cat.name });
        });
      });
      menuLoaded = true;
    } catch (e) {
      menuItemsFlat = [];
    }
  }

  function findThaliAnswer() {
    const thali = menuItemsFlat.find(i => i.categoryName.toLowerCase() === 'thali' || /thali/i.test(i.name));
    if (!thali) return `We don't have a listed thali right now — ask us directly!`;
    return `Yes! <b>${escapeHtml(thali.name)}</b> is <b>${escapeHtml(thali.priceLabel)}</b>${thali.description ? ' — ' + escapeHtml(thali.description) : ''}.`;
  }

  function normalize(str) {
    return str.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function baseName(name) {
    return normalize(name.replace(/\s*\([^)]*\)/g, ''));
  }

  function findMenuItem(text) {
    const normText = normalize(text);
    let best = null;
    let bestScore = 0;

    menuItemsFlat.forEach(item => {
      const bn = baseName(item.name);
      if (!bn) return;

      let score = 0;

      if (normText.includes(bn)) {
        score = bn.length * 3; // strong: exact phrase match
      } else {
        const tokens = bn.split(' ').filter(t => t.length > 2 && !STOPWORDS.has(t));
        if (tokens.length) {
          const matched = tokens.filter(t => new RegExp(`\\b${t}\\b`, 'i').test(normText));
          if (matched.length === tokens.length) {
            score = bn.length; // all significant words present
          } else if (matched.length > 0) {
            score = matched.length; // partial credit, low priority
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        best = item;
      }
    });

    return bestScore > 0 ? best : null;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  async function getBotReply(userText) {
    await ensureMenuLoaded();

    if (GREETINGS.test(userText) && userText.trim().split(' ').length <= 3) {
      return `Hi! Ask me about our location, hours, or anything on the menu — like "do you have kachori" or "price of thali".`;
    }

    for (const rule of FAQ_RULES) {
      if (rule.patterns.some(p => p.test(userText))) {
        return rule.answer();
      }
    }

    const item = findMenuItem(userText);
    if (item) {
      const wantsPrice = PRICE_WORDS.test(userText);
      const wantsAvail = AVAIL_WORDS.test(userText);

      if (wantsPrice && !wantsAvail) {
        return `<b>${escapeHtml(item.name)}</b> is <b>${escapeHtml(item.priceLabel)}</b>.`;
      }
      if (wantsAvail && !wantsPrice) {
        return item.available
          ? `Yes, we have <b>${escapeHtml(item.name)}</b> — it's ${escapeHtml(item.priceLabel)}.`
          : `Sorry, <b>${escapeHtml(item.name)}</b> isn't available right now.`;
      }
      return `<b>${escapeHtml(item.name)}</b> — ${escapeHtml(item.priceLabel)}${item.description ? ' (' + escapeHtml(item.description) + ')' : ''}.`;
    }

    return `I'm not sure about that one — try asking about our location, hours, or a specific menu item (e.g. "price of litti chokha"). For anything else, call ${CONFIG.PHONE_DISPLAY}.`;
  }

  // ---------------- UI ----------------

  const STYLE = `
    #bandhuChatBtn{
      position:fixed; bottom:22px; right:22px; z-index:400;
      width:58px; height:58px; border-radius:50%; border:none; cursor:pointer;
      background:var(--maroon, #6e1f1a); color:#fff; font-size:1.5rem;
      box-shadow:0 8px 20px rgba(0,0,0,0.25);
      display:flex; align-items:center; justify-content:center;
      transition:transform .15s ease;
    }
    #bandhuChatBtn:hover{ transform:scale(1.06); }
    #bandhuChatPanel{
      position:fixed; bottom:92px; right:22px; z-index:400;
      width:340px; max-width:88vw; height:460px; max-height:70vh;
      background:#fff; border-radius:12px; box-shadow:0 20px 50px rgba(0,0,0,0.25);
      display:none; flex-direction:column; overflow:hidden;
      font-family:var(--body, 'Mukta', sans-serif);
      border:1px solid rgba(201,147,46,0.35);
    }
    #bandhuChatPanel.open{ display:flex; }
    .bc-head{
      background:var(--maroon-deep,#4a1310); color:#f8efd9; padding:14px 16px;
      font-family:var(--display,'Playfair Display',serif); font-size:1.05rem;
      display:flex; justify-content:space-between; align-items:center;
    }
    .bc-head button{ background:none; border:none; color:#f8efd9; font-size:1.3rem; cursor:pointer; line-height:1; }
    .bc-body{ flex:1; overflow-y:auto; padding:14px; background:var(--cream,#f8efd9); }
    .bc-msg{ max-width:85%; margin-bottom:10px; padding:9px 13px; border-radius:12px; font-size:0.9rem; line-height:1.45; }
    .bc-msg a{ color:inherit; text-decoration:underline; }
    .bc-msg.bot{ background:#fff; border:1px solid rgba(201,147,46,0.3); border-bottom-left-radius:2px; }
    .bc-msg.user{ background:var(--maroon,#6e1f1a); color:#fff; margin-left:auto; border-bottom-right-radius:2px; }
    .bc-chips{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px; }
    .bc-chip{
      font-size:0.78rem; background:#fff; border:1px solid rgba(201,147,46,0.4);
      color:var(--maroon,#6e1f1a); padding:6px 10px; border-radius:14px; cursor:pointer;
    }
    .bc-chip:hover{ background:var(--cream-deep,#efe0bb); }
    .bc-input-row{ display:flex; border-top:1px solid rgba(201,147,46,0.3); }
    .bc-input-row input{
      flex:1; border:none; padding:12px 14px; font-size:0.9rem; font-family:inherit; outline:none;
    }
    .bc-input-row button{
      border:none; background:var(--maroon,#6e1f1a); color:#fff; padding:0 18px; cursor:pointer; font-size:0.85rem;
    }
  `;

  function injectStyle() {
    const tag = document.createElement('style');
    tag.textContent = STYLE;
    document.head.appendChild(tag);
  }

  function buildWidget() {
    const btn = document.createElement('button');
    btn.id = 'bandhuChatBtn';
    btn.setAttribute('aria-label', 'Chat with Bandhuram');
    btn.textContent = '💬';

    const panel = document.createElement('div');
    panel.id = 'bandhuChatPanel';
    panel.innerHTML = `
      <div class="bc-head">
        <span>Ask Bandhuram</span>
        <button id="bcCloseBtn" aria-label="Close chat">×</button>
      </div>
      <div class="bc-body" id="bcBody"></div>
      <div class="bc-input-row">
        <input type="text" id="bcInput" placeholder="Ask about menu, hours, location...">
        <button id="bcSendBtn">Send</button>
      </div>
    `;

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    btn.addEventListener('click', () => {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) document.getElementById('bcInput').focus();
    });
    document.getElementById('bcCloseBtn').addEventListener('click', () => panel.classList.remove('open'));

    addBotMessage(`Hi! I'm here to help with quick questions about Bandhuram.`);
    addChips(['Where are you located?', 'What are your hours?', 'Do you have kachori?', 'Price of thali']);

    document.getElementById('bcSendBtn').addEventListener('click', handleSend);
    document.getElementById('bcInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  function addBotMessage(html) {
    const body = document.getElementById('bcBody');
    const div = document.createElement('div');
    div.className = 'bc-msg bot';
    div.innerHTML = html;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function addUserMessage(text) {
    const body = document.getElementById('bcBody');
    const div = document.createElement('div');
    div.className = 'bc-msg user';
    div.textContent = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
  }

  function addChips(options) {
    const body = document.getElementById('bcBody');
    const wrap = document.createElement('div');
    wrap.className = 'bc-chips';
    wrap.innerHTML = options.map(o => `<button type="button" class="bc-chip">${escapeHtml(o)}</button>`).join('');
    body.appendChild(wrap);
    wrap.querySelectorAll('.bc-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.getElementById('bcInput').value = chip.textContent;
        handleSend();
      });
    });
    body.scrollTop = body.scrollHeight;
  }

  async function handleSend() {
    const input = document.getElementById('bcInput');
    const text = input.value.trim();
    if (!text) return;
    addUserMessage(text);
    input.value = '';

    const reply = await getBotReply(text);
    addBotMessage(reply);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyle();
    buildWidget();
  });
})();