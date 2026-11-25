/* Connexion Strava (lecture des activités). Utilise TON application API Strava personnelle :
   l'identifiant et le secret restent sur cet appareil, rien ne passe par un serveur tiers. */
(function (RP) {
  const KEY = 'runwow-strava-v1';
  const API = 'https://www.strava.com';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function save(cfg) {
    try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* stockage indisponible */ }
  }

  const redirectUri = () => location.origin + location.pathname;

  function authorizeUrl(cfg) {
    const state = Math.random().toString(36).slice(2) + Date.now().toString(36);
    cfg.oauthState = state;
    cfg.returnHash = location.hash || '#/plus';
    save(cfg);
    const q = new URLSearchParams({
      client_id: cfg.clientId, response_type: 'code', redirect_uri: redirectUri(),
      approval_prompt: 'auto', scope: 'activity:read_all', state,
    });
    return `${API}/oauth/authorize?${q}`;
  }

  async function tokenRequest(cfg, params) {
    const body = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params });
    const res = await fetch(`${API}/oauth/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message === 'Bad Request' ? 'Identifiant ou secret Strava refusé.' : `Strava a refusé la connexion (${res.status}).`);
    return json;
  }

  // Retour de la page d'autorisation Strava (?code=…&state=…). Renvoie un message ou null.
  async function handleRedirect() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return null;
    const cfg = load();
    const clean = () => history.replaceState(null, '', location.pathname + (cfg.returnHash || location.hash || '#/plus'));
    if (q.get('error')) { clean(); return { ok: false, msg: 'Connexion Strava annulée.' }; }
    if (!cfg.oauthState || q.get('state') !== cfg.oauthState) { clean(); return { ok: false, msg: 'Réponse Strava inattendue : relance la connexion.' }; }
    if (!(q.get('scope') || '').includes('activity:read')) { clean(); return { ok: false, msg: 'Coche l\'accès aux activités sur la page Strava pour que la synchro fonctionne.' }; }
    try {
      const t = await tokenRequest(cfg, { code: q.get('code'), grant_type: 'authorization_code' });
      Object.assign(cfg, {
        access: t.access_token, refresh: t.refresh_token, expiresAt: t.expires_at,
        athlete: t.athlete ? { firstname: t.athlete.firstname } : null, connectedAt: RP.U.todayISO(),
      });
      delete cfg.oauthState;
      save(cfg);
      clean();
      return { ok: true, msg: 'Strava connecté.' };
    } catch (e) {
      clean();
      return { ok: false, msg: e.message };
    }
  }

  async function token(cfg) {
    if (!cfg.refresh) throw new Error('Strava n\'est pas connecté.');
    if (!cfg.access || cfg.expiresAt - 120 < Date.now() / 1000) {
      const t = await tokenRequest(cfg, { refresh_token: cfg.refresh, grant_type: 'refresh_token' });
      Object.assign(cfg, { access: t.access_token, refresh: t.refresh_token, expiresAt: t.expires_at });
      save(cfg);
    }
    return cfg.access;
  }

  // Activités depuis une date (AAAA-MM-JJ), au format réduit utilisé par RunwoW.
  async function fetchActivities(sinceISO) {
    const cfg = load();
    const access = await token(cfg);
    const after = Math.floor(RP.U.parseDate(sinceISO).getTime() / 1000) - 86400;
    const out = [];
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(`${API}/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { Authorization: `Bearer ${access}` } });
      if (res.status === 429) throw new Error('Trop de requêtes vers Strava : réessaie dans 15 minutes.');
      if (!res.ok) throw new Error(`Lecture Strava impossible (${res.status}).`);
      const list = await res.json();
      list.forEach((a) => out.push({
        id: String(a.id), name: a.name, type: a.sport_type || a.type, date: (a.start_date_local || '').slice(0, 10),
        km: Math.round((a.distance || 0) / 100) / 10, elev: Math.round(a.total_elevation_gain || 0), min: Math.round((a.moving_time || 0) / 6) / 10,
        race: a.workout_type === 1, // sortie marquée « course » dans Strava
      }));
      if (list.length < 100) break;
    }
    cfg.lastSync = new Date().toISOString();
    save(cfg);
    return out;
  }

  async function disconnect() {
    const cfg = load();
    try { if (cfg.access) await fetch(`${API}/oauth/deauthorize`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.access}` } }); } catch (e) { /* hors ligne : on oublie quand même */ }
    save({ clientId: cfg.clientId });
  }

  RP.strava = { load, save, authorizeUrl, handleRedirect, fetchActivities, disconnect, redirectUri };
})(window.RP);
