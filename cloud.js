window.RICH_CLOUD = (() => {
  const EDGE_URL = "https://ukrgjdbhbokfkpfpqmnb.supabase.co/functions/v1/rich-craft-sync";
  const JOURNAL_ID = "rc_rodion_59da7a3cfbf30e70b30aa3dc";
  const QUEUE_KEY = 'richCraftSecureQueueV1';
  const TOKEN_KEY = 'richCraftDeviceTokenV1';
  const INSTALL_KEY = 'richCraftInstallIdV1';

  function installId() {
    let id = localStorage.getItem(INSTALL_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : 'install-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      localStorage.setItem(INSTALL_KEY, id);
    }
    return id;
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || '';
  }

  function setStatus(text, ok=true) {
    const el = document.getElementById('cloudStatus');
    if (!el) return;
    el.textContent = text;
    el.dataset.ok = ok ? '1' : '0';
  }

  function queue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
    catch { return []; }
  }

  function saveQueue(q) {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  }

  function makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function connect() {
    const current = token();
    const entered = prompt(
      current
        ? 'Облачный журнал уже подключён. Введи новый ключ только если хочешь заменить его:'
        : 'Введи ключ RICH CRAFT для этого телефона:'
    );
    if (entered === null) return false;
    const clean = entered.trim();
    if (clean.length < 30) {
      alert('Ключ слишком короткий.');
      return false;
    }
    localStorage.setItem(TOKEN_KEY, clean);
    setStatus('☁ проверяю ключ…', true);
    const ok = await ping();
    if (!ok) {
      localStorage.removeItem(TOKEN_KEY);
      setStatus('☁ ключ не принят — нажми сюда', false);
      alert('Ключ не принят. Проверь символы.');
      return false;
    }
    setStatus('☁ журнал подключён', true);
    await flush();
    return true;
  }

  async function post(event) {
    const t = token();
    if (!t) throw new Error('missing_token');

    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rich-device-token': t
      },
      body: JSON.stringify(event)
    });

    let payload = {};
    try { payload = await res.json(); } catch {}

    if (res.status === 401) throw new Error('unauthorized');
    if (!res.ok) throw new Error(payload.error || ('cloud_' + res.status));
    return payload;
  }

  async function ping() {
    const event = {
      journal_id: JOURNAL_ID,
      client_event_id: JOURNAL_ID + '-ping-' + makeId(),
      event_date: new Date().toISOString().slice(0,10),
      category: 'system',
      title: 'Device connected',
      text_value: 'Secure device connection',
      details: { install_id: installId(), kind: 'device_connect' },
      client_created_at: new Date().toISOString()
    };
    try {
      await post(event);
      return true;
    } catch {
      return false;
    }
  }

  async function flush() {
    if (!token()) {
      setStatus('☁ журнал не подключён — нажми сюда', false);
      return false;
    }

    let q = queue();
    if (!q.length) {
      setStatus('☁ журнал синхронизирован', true);
      return true;
    }

    setStatus('☁ отправка…', true);
    const rest = [];

    for (const e of q) {
      try {
        await post(e);
      } catch (err) {
        if (String(err?.message || err) === 'unauthorized') {
          localStorage.removeItem(TOKEN_KEY);
          rest.push(e);
          saveQueue(rest.concat(q.slice(q.indexOf(e)+1)));
          setStatus('☁ ключ нужно ввести заново', false);
          return false;
        }
        rest.push(e);
      }
    }

    saveQueue(rest);

    if (rest.length) {
      setStatus('☁ в очереди: ' + rest.length, false);
      return false;
    }

    setStatus('☁ журнал синхронизирован', true);
    return true;
  }

  async function log(payload) {
    const event = {
      journal_id: JOURNAL_ID,
      client_event_id: JOURNAL_ID + '-' + makeId(),
      event_date: payload.event_date,
      week_index: payload.week_index ?? null,
      day_index: payload.day_index ?? null,
      training_index: payload.training_index ?? null,
      category: payload.category,
      title: payload.title || null,
      text_value: payload.text_value || null,
      score: payload.score ?? null,
      max_score: payload.max_score ?? null,
      seconds: payload.seconds ?? null,
      confidence: payload.confidence ?? null,
      details: Object.assign({ install_id: installId() }, payload.details || {}),
      client_created_at: new Date().toISOString()
    };

    const q = queue();
    q.push(event);
    saveQueue(q);
    return flush();
  }

  function init() {
    const el = document.getElementById('cloudStatus');
    if (el) {
      el.onclick = connect;
      el.style.cursor = 'pointer';
    }
    if (!token()) setStatus('☁ журнал не подключён — нажми сюда', false);
    else setTimeout(flush, 500);
  }

  window.addEventListener('online', flush);
  window.addEventListener('load', init);

  return {
    log,
    flush,
    connect,
    journalId: JOURNAL_ID,
    isConnected: () => !!token()
  };
})();
