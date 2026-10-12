window.RICH_CLOUD = (() => {
  const URL = "https://ukrgjdbhbokfkpfpqmnb.supabase.co";
  const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcmdqZGJoYm9rZmtwZnBxbW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NjcwNDYsImV4cCI6MjEwNzA0MzA0Nn0.-ap4_H6uBidtmiUiUax8y0eJPb7iXbh9tQyG3-NruAU";
  const JOURNAL_ID = "rc_rodion_59da7a3cfbf30e70b30aa3dc";
  const QUEUE_KEY = 'richCraftCloudQueueV1';
  const INSTALL_KEY = 'richCraftInstallIdV1';

  function installId() {
    let id = localStorage.getItem(INSTALL_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 'install-' + Date.now() + '-' + Math.random().toString(16).slice(2));
      localStorage.setItem(INSTALL_KEY, id);
    }
    return id;
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

  async function post(event) {
    const res = await fetch(URL + '/rest/v1/rich_craft_events', {
      method: 'POST',
      headers: {
        'apikey': KEY,
        'Authorization': 'Bearer ' + KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(event)
    });
    if (!res.ok && res.status !== 409) {
      const t = await res.text().catch(()=> '');
      throw new Error('cloud ' + res.status + ' ' + t);
    }
  }

  async function flush() {
    let q = queue();
    if (!q.length) {
      setStatus('☁ журнал синхронизирован', true);
      return true;
    }
    setStatus('☁ отправка…', true);
    const rest = [];
    for (const e of q) {
      try { await post(e); }
      catch (err) { rest.push(e); }
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
      details: Object.assign({install_id: installId()}, payload.details || {}),
      client_created_at: new Date().toISOString()
    };
    const q = queue();
    q.push(event);
    saveQueue(q);
    await flush();
  }

  window.addEventListener('online', flush);
  setTimeout(flush, 700);

  return { log, flush, journalId: JOURNAL_ID };
})();
