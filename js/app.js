/* Interface de RunwoW. Toutes les données restent sur l'appareil (localStorage). */
(function (RP) {
  const U = RP.U;
  const P = RP.paces;
  const esc = U.esc;
  const KEY = 'runwow-state-v1';

  // ---------- État ----------
  const blankState = () => ({ profile: null, overrides: {}, statuses: {}, statusSource: {}, moves: {}, downgrades: {}, evaluated: {}, breaks: [], log: [], activities: {}, syncInfo: {} });
  function loadState() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === 'object') return Object.assign(blankState(), s);
    } catch (e) { /* stockage indisponible */ }
    return blankState();
  }
  function saveState() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Impossible d\'enregistrer sur cet appareil (stockage bloqué).'); }
  }

  let state = loadState();
  let plan = null;
  let planError = null;
  const ui = { modalId: null, openWeeks: {}, search: '', setupErrors: [], draft: null, history: null, busy: false };

  function regen() {
    plan = null;
    planError = null;
    if (!state.profile) return;
    try { plan = RP.plan.generate(state.profile, state); } catch (e) { planError = e.message; }
  }
  function evaluate() {
    if (!plan) return [];
    const changes = RP.replan.evaluateWeeks(plan, state);
    if (changes.length) {
      changes.forEach((c) => state.log.unshift({ date: U.todayISO(), rule: c.rule, msg: c.msg }));
      saveState();
      regen();
    }
    return changes;
  }

  // ---------- Icônes ----------
  const ICONS = {
    run: '<polyline points="3 12 7 12 10 5 14 19 17 12 21 12"/>',
    strength: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
    mobility: '<path d="M3 15c3-6 6-6 9 0s6 6 9 0"/><circle cx="12" cy="6" r="2"/>',
    race: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    plan: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    pace: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    warn: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    rest: '<path d="M20 14A8 8 0 1 1 10 4a6 6 0 0 0 10 10z"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M5 3v5h5M19 21v-5h-5"/>',
    watch: '<rect x="7" y="6" width="10" height="12" rx="3"/><path d="M9 6l1-3h4l1 3M9 18l1 3h4l1-3M12 10v2l1 1"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    half: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    ext: '<path d="M7 17L17 7M9 7h8v8"/>',
    move: '<path d="M5 9l-3 3 3 3M19 9l3 3-3 3M2 12h20"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  // ---------- Aides d'affichage ----------
  const kindClass = (it) => (it.kind === 'strength' ? 'k-strength' : it.kind === 'mobility' ? 'k-mobility' : it.sub === 'race' ? 'k-race' : it.sub === 'long' ? 'k-long' : it.sub === 'quality' ? 'k-quality' : 'k-easy');
  const gradClass = (it) => kindClass(it).replace('k-', 'g-');
  const kindIcon = (it) => (it.kind === 'strength' ? 'strength' : it.kind === 'mobility' ? 'mobility' : it.sub === 'race' ? 'race' : 'run');
  const kindLabel = (it) => (it.kind === 'strength' ? 'Renforcement' : it.kind === 'mobility' ? 'Mobilité' : it.sub === 'race' ? 'Jour J' : it.sub === 'long' ? 'Sortie longue' : it.sub === 'quality' ? 'Qualité' : 'Footing');
  const STATUS_LABELS = { done: 'Fait', partial: 'Partiel', missed: 'Raté', break: 'Coupure' };
  const STATUS_ICONS = { done: 'check', partial: 'half', missed: 'x', break: 'x' };

  // Niveau d'effort (hauteur dans le profil de séance) et couleur par zone
  const ZLEVEL = { marche: 0.16, recup: 0.22, ef: 0.38, ef_long: 0.38, descente: 0.46, marathon: 0.6, cote_seuil: 0.68, seuil: 0.7, race: 0.78, a10k: 0.82, a5k: 0.9, cote: 0.95, vma: 1 };
  const ZCOLOR = { marche: 'var(--muted)', recup: 'var(--k-easy)', ef: 'var(--k-easy)', ef_long: 'var(--k-long)', descente: 'var(--k-mobility)', marathon: 'var(--k-long)', cote_seuil: 'var(--ph-construction)', seuil: 'var(--ph-construction)', race: 'var(--k-race)', a10k: 'var(--k-quality)', a5k: 'var(--k-quality)', cote: 'var(--k-quality)', vma: 'var(--ph-specifique)' };

  const unit = () => (plan && plan.c.trail ? 'km-effort' : 'km');
  const isTraining = () => !!(plan && plan.training);

  function durParts(min) {
    min = Math.round(min);
    if (min < 60) return [String(min), 'min'];
    return [`${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`, ''];
  }

  function itemMeta(it) {
    if (it.kind === 'run') {
      const parts = [];
      if (it.km) parts.push(`${it.km} km`);
      if (it.min) parts.push(U.fmtDuration(it.min));
      return parts.join(' · ');
    }
    return `${it.min} min · ${it.exercises.length} exercices`;
  }

  function findItem(id) {
    if (!plan) return null;
    for (const w of plan.weeks) for (const d of w.days) for (const it of d.items) if (it.id === id) return { it, w, d };
    return null;
  }

  function currentWeekIndex() {
    if (!plan) return -1;
    const t = U.todayISO();
    const i = plan.weeks.findIndex((w) => t >= w.start && t <= w.end);
    if (i >= 0) return i;
    return t < plan.weeks[0].start ? 0 : plan.weeks.length - 1;
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 3800);
  }

  // ---------- Ouvrir l'appli Strava ----------
  // Android : lien « intent » vers l'appli Strava (sinon le site). iPhone : schéma strava:// puis le site si rien ne s'ouvre.
  function openStrava(webUrl) {
    const web = webUrl || 'https://www.strava.com/dashboard';
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) {
      location.href = `intent://${web.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.strava;S.browser_fallback_url=${encodeURIComponent(web)};end`;
      return;
    }
    if (/iPhone|iPad|iPod/i.test(ua)) {
      const act = web.match(/activities\/(\d+)/);
      const timer = setTimeout(() => { location.href = web; }, 1500);
      document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); }, { once: true });
      location.href = act ? `strava://activities/${act[1]}` : 'strava://';
      return;
    }
    window.open(web, '_blank', 'noopener');
  }

  // ---------- Synchro Strava ----------
  async function syncStrava(silent) {
    const cfg = RP.strava.load();
    if (!cfg.refresh || !plan || ui.syncing) return;
    ui.syncing = true;
    if (!silent) render();
    try {
      const acts = await RP.strava.fetchActivities(plan.planStart);
      state.activities = Object.fromEntries(acts.map((a) => [a.id, a]));
      const since = cfg.connectedAt && cfg.connectedAt > plan.planStart ? cfg.connectedAt : plan.planStart;
      const rep = RP.match.apply(plan, state, { sinceISO: since, todayISO: U.todayISO() });
      const parts = [`${rep.done} faite(s)`, `${rep.partial} partielle(s)`, `${rep.missed} ratée(s)`];
      if (rep.offPlan) parts.push(`${rep.offPlan} sortie(s) hors plan`);
      state.lastSyncMsg = `Strava : ${parts.join(', ')}.`;
      saveState();
      const changes = evaluate();
      ui.syncing = false;
      render();
      if (!silent || rep.done || rep.partial || rep.missed) toast(changes.length ? changes[changes.length - 1].msg : state.lastSyncMsg);
    } catch (e) {
      ui.syncing = false;
      render();
      if (!silent) toast(e.message);
    }
  }

  // ---------- Routage ----------
  const ROUTES = ['aujourdhui', 'plan', 'allures', 'exercices', 'plus', 'profil'];
  function route() {
    const r = (location.hash || '').replace(/^#\/?/, '');
    return ROUTES.includes(r) ? r : 'aujourdhui';
  }

  function render() {
    const app = document.getElementById('app');
    const r = route();
    if (!state.profile || r === 'profil') {
      app.innerHTML = `<div class="shell">${renderSetup()}</div>`;
      initSetup();
      renderModal();
      return;
    }
    let body;
    if (planError) body = `<div class="card"><h2>Plan impossible à générer</h2><p>${esc(planError)}</p><a class="btn primary" href="#/profil">Modifier mon profil</a></div>`;
    else if (r === 'plan') body = renderPlan();
    else if (r === 'allures') body = renderPaces();
    else if (r === 'exercices') body = renderLibrary();
    else if (r === 'plus') body = renderMore();
    else body = renderToday();
    app.innerHTML = `<div class="shell">${renderTopbar()}${body}</div>${renderNav(r)}`;
    renderModal();
  }

  function planName() {
    const p = state.profile;
    if (!plan) return '';
    if (isTraining()) return p.raceName || `Entraînement · orientation ${plan.c.cat.label}`;
    return p.raceName || plan.c.cat.label;
  }

  function renderTopbar() {
    const p = state.profile;
    let pill = '';
    if (plan) {
      if (isTraining()) {
        const wi = currentWeekIndex();
        pill = `<div class="pill-count"><b class="num">S${wi + 1}</b><span>sur ${plan.nWeeks}</span></div>`;
      } else {
        const days = U.daysBetween(U.parseDate(U.todayISO()), U.parseDate(p.raceDate));
        pill = days > 0 ? `<div class="pill-count"><b class="num">J-${days}</b><span>${esc(U.fmtDateShort(U.parseDate(p.raceDate)))}</span></div>`
          : `<div class="pill-count"><b>${days === 0 ? 'Jour J' : 'Fini'}</b><span>${days === 0 ? 'go !' : 'bravo'}</span></div>`;
      }
    }
    const trailInfo = !isTraining() && p.terrain === 'trail' && p.dplus ? ` · ${esc(p.distanceKm)} km, ${esc(p.dplus)} m D+` : '';
    return `<header class="topbar">
      <div class="brand"><span class="wordmark">Run<em>woW</em></span><span class="sub">${esc(planName())}${trailInfo}</span></div>
      <button class="strava-btn" data-action="open-strava" aria-label="Ouvrir l'appli Strava">Strava${icon('ext')}</button>
      ${pill}
    </header>`;
  }

  function renderNav(r) {
    const items = [['aujourdhui', 'today', 'Aujourd\'hui'], ['plan', 'plan', 'Plan'], ['allures', 'pace', 'Allures'], ['exercices', 'list', 'Exercices'], ['plus', 'more', 'Plus']];
    return `<nav class="nav" aria-label="Navigation principale"><ul>${items.map(([id, ic, label]) =>
      `<li><a href="#/${id}" ${r === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a></li>`).join('')}</ul></nav>`;
  }

  // ---------- Profil de séance (graphe des efforts) ----------
  function segments(it) {
    const c = plan.c;
    const segs = [];
    const push = (zone, part) => {
      const sp = c.z[zone] || c.z.ef;
      const min = part.min != null ? part.min : (part.km / sp) * 60;
      if (min > 0) segs.push({ zone, min });
    };
    (it.blocks || []).forEach((b) => {
      if (b.rep) {
        const series = b.rep.series || 1;
        for (let s = 0; s < series; s++) {
          for (let i = 0; i < b.rep.n; i++) { push(b.rep.work.zone, b.rep.work); push(b.rep.rest.zone, b.rep.rest); }
          if (s < series - 1 && b.rep.seriesRest) push('recup', { min: b.rep.seriesRest });
        }
      } else (b.parts || []).forEach((pt) => push(pt.zone, pt));
    });
    return segs;
  }
  function profileBar(it) {
    if (it.kind !== 'run') return '';
    const segs = segments(it);
    if (!segs.length) return '';
    return `<div class="wprofile" aria-hidden="true">${segs.map((s) => {
      const lv = ZLEVEL[s.zone] || 0.4;
      return `<i class="${lv >= 0.6 ? 'hard' : ''}" style="flex-grow:${s.min.toFixed(2)};height:${Math.round(lv * 100)}%"></i>`;
    }).join('')}</div>`;
  }
  function blockZone(b) {
    if (b.rep) return b.rep.work.zone;
    let best = null;
    (b.parts || []).forEach((p) => { if (!best || (ZLEVEL[p.zone] || 0) > (ZLEVEL[best] || 0)) best = p.zone; });
    return best || 'ef';
  }

  // ---------- Carte séance ----------
  function heroHTML(it, w, inModal) {
    const st = state.statuses[it.id];
    const stats = [];
    if (it.kind === 'run') {
      if (it.km) stats.push([String(it.km), plan.c.trail && (it.sub === 'long' || it.sub === 'race') ? 'km-eff.' : 'km']);
      if (it.min) stats.push(durParts(it.min));
      if (it.intensityMin) stats.push([String(it.intensityMin), 'min vite']);
    } else {
      stats.push([String(it.min), 'min'], [String(it.exercises.length), 'exos']);
    }
    const flags = [];
    if (inModal) flags.push(`${U.fmtDateLong(U.parseDate(it.date))} · semaine ${w.index + 1}`);
    if (it.moved) flags.push('déplacée');
    if (it.downgraded) flags.push('allégée');
    return `<div class="hero ${gradClass(it)}">
      ${inModal ? `<button class="close" data-action="close" aria-label="Fermer">${icon('close')}</button>` : ''}
      <div class="hero-top"><span class="kind-pill">${icon(kindIcon(it))}${kindLabel(it)}</span>${st && !inModal ? `<span class="hero-status">${STATUS_LABELS[st]}</span>` : ''}</div>
      <h2>${esc(it.title)}</h2>
      ${flags.length ? `<div class="when">${esc(flags.join(' · '))}</div>` : ''}
      <div class="hero-stats">${stats.map(([v, u]) => `<div><b class="num">${esc(v)}</b><span>${esc(u)}</span></div>`).join('')}</div>
      ${profileBar(it)}
    </div>`;
  }

  function bodyHTML(it, w, inModal) {
    let html = '';
    if (it.focus) html += `<p class="focus">${esc(it.focus)}</p>`;
    if (it.blocks && it.blocks.length) html += `<ol class="timeline">${it.blocks.map((b) => `<li style="--z:${ZCOLOR[blockZone(b)] || 'var(--k-easy)'}">${esc(b.label)}</li>`).join('')}</ol>`;
    if (it.exercises) {
      html += `<ul class="ex-list">${it.exercises.map((e, i) => `<li><details><summary><span class="ex-num">${i + 1}</span><span class="ex-name">${esc(e.name)}${e.slot === 'prev' ? '<span class="ex-tag">prévention</span>' : ''}</span><span class="ex-dose">${esc(e.dose)}</span></summary><div class="ex-how">${esc(e.how)}</div></details></li>`).join('')}</ul>`;
    }
    if (it.notes && it.notes.length) html += `<ul class="notes">${it.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
    const si = state.syncInfo && state.syncInfo[it.id];
    if (si) html += `<div class="banner info">${icon('sync')}<div>Strava : ${esc(si.names.join(' + '))} · ${si.km} km (${Math.round(si.ratio * 100)} % du prévu)</div></div>`;
    else if (state.statusSource[it.id] === 'strava' && state.statuses[it.id] === 'missed') html += `<div class="banner warn">${icon('warn')}<div>Aucune sortie Strava trouvée pour cette séance. Corrige le statut si besoin.</div></div>`;
    html += statusControls(it, inModal);
    return html;
  }

  function statusControls(it, inModal) {
    if (it.sub === 'race') return '';
    const st = state.statuses[it.id] || '';
    const opts = it.kind === 'run' ? [['done', 'Fait'], ['partial', 'Partiel'], ['missed', 'Raté']] : [['done', 'Fait'], ['missed', 'Pas fait']];
    let html = `<div class="status-bar ${opts.length === 2 ? 'two' : ''}">${opts.map(([v, l]) =>
      `<button class="st-btn v-${v}" data-action="status" data-id="${it.id}" data-val="${v}" aria-pressed="${st === v}">${icon(STATUS_ICONS[v])}${l}</button>`).join('')}</div>`;
    const extra = [];
    const today = U.todayISO();
    if (it.kind === 'run' && (it.hard || it.downgraded) && it.date >= today) {
      extra.push(it.downgraded
        ? `<button class="btn small" data-action="downgrade" data-id="${it.id}" data-val="0">Rétablir la séance</button>`
        : `<button class="btn small" data-action="downgrade" data-id="${it.id}" data-val="1">${icon('bolt')}Pas à 100 %</button>`);
    }
    if (!inModal) extra.push(`<button class="btn small" data-action="open" data-id="${it.id}" data-move="1">${icon('move')}Déplacer</button>`);
    if (RP.fit.canExport(it)) extra.push(`<button class="btn small" data-action="fit" data-id="${it.id}">${icon('watch')}Montre</button>`);
    const si = state.syncInfo && state.syncInfo[it.id];
    if (si && si.ids && si.ids.length) extra.push(`<button class="strava-btn ghost" data-action="open-strava" data-url="https://www.strava.com/activities/${esc(si.ids[0])}">Voir sur Strava${icon('ext')}</button>`);
    else if (it.kind === 'run' && it.date <= today) extra.push(`<button class="strava-btn ghost" data-action="open-strava">Strava${icon('ext')}</button>`);
    if (extra.length) html += `<div class="actions">${extra.join('')}</div>`;
    return html;
  }

  function sessionCard(it, w) {
    return `<article class="card session-card">${heroHTML(it, w, false)}<div class="session-body">${bodyHTML(it, w, false)}</div></article>`;
  }

  function chip(it) {
    const st = state.statuses[it.id];
    return `<button class="chip ${kindClass(it)} ${st ? `st-${st}` : ''}" data-action="open" data-id="${it.id}">
      <span class="badge">${icon(kindIcon(it))}</span><span class="ctext"><span class="ctitle">${esc(it.title)}</span><span class="cmeta num">${esc(itemMeta(it))}</span></span>
      ${st ? `<span class="st ${st}" title="${STATUS_LABELS[st]}">${icon(STATUS_ICONS[st])}</span>` : ''}</button>`;
  }

  // ---------- Vue : Aujourd'hui ----------
  function weekStrip(w) {
    const t = U.todayISO();
    return `<div class="weekstrip">${w.days.map((d) => {
      const dots = d.items.slice(0, 3).map((i) => `<i class="${kindClass(i)} ${state.statuses[i.id] === 'done' ? 'done' : ''}"></i>`).join('');
      const label = `${U.DAYS[d.day]} ${U.parseDate(d.date).getDate()} : ${d.items.length ? d.items.map((i) => i.title).join(', ') : 'repos'}`;
      const attrs = d.items.length ? `data-action="open" data-id="${d.items[0].id}"` : '';
      return `<button class="ws-day ${d.date === t ? 'today' : ''} ${d.date < t ? 'past' : ''}" ${attrs} aria-label="${esc(label)}">
        <span class="l">${U.DAYS_SHORT[d.day].slice(0, 1)}</span><span class="d num">${U.parseDate(d.date).getDate()}</span><span class="dots">${dots}</span></button>`;
    }).join('')}</div>`;
  }

  function ring(pct) {
    const r = 40;
    const C = 2 * Math.PI * r;
    const off = C * (1 - Math.min(1, pct));
    return `<div class="ring"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4d2e"/><stop offset="1" stop-color="#ff9f1c"/></linearGradient></defs>
      <circle class="bg" cx="50" cy="50" r="${r}"/>${pct > 0 ? `<circle class="fg" cx="50" cy="50" r="${r}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>` : ''}</svg>
      <div class="pct num">${Math.round(pct * 100)}%</div></div>`;
  }

  function renderToday() {
    const t = U.todayISO();
    const wi = currentWeekIndex();
    const w = plan.weeks[wi];
    let html = '';

    if (t < plan.weeks[0].start) {
      return `<div class="today-head"><h1>Bientôt le départ</h1></div>
        <div class="card plan-hero"><div class="eyebrow">Début du plan</div><h2>${esc(U.fmtDateLong(U.parseDate(plan.weeks[0].start)))}</h2>
        <p class="foot">${plan.nWeeks} semaines au programme. En attendant, parcours le plan et les exercices.</p></div>
        ${weekStrip(plan.weeks[0])}<a class="btn primary block" href="#/plan">Voir le plan</a>`;
    }
    if (t > plan.raceDate) {
      return isTraining()
        ? `<div class="card plan-hero"><div class="eyebrow">Cycle terminé</div><h2>Bravo pour ces ${plan.nWeeks} semaines</h2><p class="foot">Reporte ton dernier test dans ton profil et lance un nouveau cycle : il repartira de ta forme actuelle.</p></div><a class="btn primary block" href="#/profil">Lancer un nouveau cycle</a>`
        : `<div class="card plan-hero"><div class="eyebrow">Préparation terminée</div><h2>Récupère bien</h2><p class="foot">Tu peux créer un nouveau plan depuis ton profil.</p></div><a class="btn primary block" href="#/profil">Nouvel objectif</a>`;
    }
    const day = w.days.find((d) => d.date === t);
    html += `<div class="today-head"><h1>${esc(U.fmtDateLong(U.parseDate(t)))}</h1>
      <div class="tags"><span class="tag ph-${w.phase}"><span class="dot"></span>${RP.plan.PHASE_LABELS[w.phase]}</span><span class="tag">Semaine ${wi + 1}/${plan.nWeeks}</span><span class="tag">${RP.plan.WEEK_TYPE_LABELS[w.type]}</span></div></div>`;
    html += weekStrip(w);
    if (state.log.length && state.log[0].date === t) html += `<div class="banner info">${icon('info')}<div>${esc(state.log[0].msg)}</div></div>`;

    if (day && day.items.length) {
      html += day.items.map((it) => sessionCard(it, w)).join('');
    } else {
      html += `<article class="card session-card"><div class="hero g-rest"><div class="hero-top"><span class="kind-pill">${icon('rest')}Repos</span></div>
        <h2>Jour de repos</h2><div class="when">C'est pendant la récupération que le corps progresse.</div></div></article>`;
    }
    if (day && day.note) html += `<div class="banner info">${icon('info')}<div>${esc(day.note)}</div></div>`;

    // Progression de la semaine
    const comp = RP.replan.weekCompletion(w, state.statuses);
    const pct = comp.planned ? comp.done / comp.planned : 0;
    html += `<div class="section-title">Ta semaine <span class="muted">${esc(U.fmtDateShort(U.parseDate(w.start)))} – ${esc(U.fmtDateShort(U.parseDate(w.end)))}</span></div>
      <div class="card progress-card">${ring(pct)}<div><div class="big num">${U.round1(comp.done)} <span class="muted" style="font-size:16px">/ ${U.round1(comp.planned)} ${unit()}</span></div>
      <div class="muted small">${comp.marked}/${comp.total} courses renseignées · ${w.nStrength} renfo · ${w.nMobility} mobilité</div>
      <a class="btn small" style="margin-top:10px" href="#/plan">Voir le plan</a></div></div>`;

    // Prochaine séance
    const upcoming = [];
    plan.weeks.slice(wi).forEach((wk) => wk.days.forEach((d) => { if (d.date > t && d.items.length) upcoming.push(d); }));
    if (upcoming.length) {
      const d = upcoming[0];
      html += `<div class="section-title">Ensuite <span class="muted">${esc(U.fmtDateLong(U.parseDate(d.date)))}</span></div>`;
      html += `<div style="display:flex;flex-direction:column;gap:8px">${d.items.map(chip).join('')}</div>`;
    }
    return html;
  }

  // ---------- Vue : Plan ----------
  function renderPlan() {
    const c = plan.c;
    const p = state.profile;
    const wi = currentWeekIndex();
    const kpis = [[`${plan.nWeeks}`, 'semaines'], [`${Math.round(plan.maxLoad)}`, `${unit()} au pic`], [`${U.round1(c.vma)}`, 'VMA km/h']];
    if (isTraining()) kpis.push([`${plan.weeks.filter((w) => w.type === 'test').length}`, 'tests chrono']);
    else if (!c.trail) kpis.push([U.fmtTime(c.targetMin && !c.targetCapped ? c.targetMin : c.predictedMin), c.targetMin && !c.targetCapped ? 'objectif' : 'prédiction']);
    const eyebrow = isTraining() ? `Mode entraînement · cycle de ${plan.nWeeks} semaines` : `Course · ${U.fmtDateLong(U.parseDate(p.raceDate))}`;
    let html = `<div class="card plan-hero"><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(planName())}</h2>
      <div class="kpis">${kpis.map(([v, l]) => `<div><b class="num">${esc(v)}</b>${esc(l)}</div>`).join('')}</div>
      <p class="foot">${(p.runDays || []).length} jours de course · ${p.strengthPerWeek || 0} renfo / semaine · ${esc(c.cat.label)}</p></div>`;
    plan.warnings.forEach((wr) => { html += `<div class="banner warn">${icon('warn')}<div>${esc(wr)}</div></div>`; });
    html += renderChart(wi);
    html += `<div class="section-title">Semaine par semaine</div>`;
    html += plan.weeks.map((w) => renderWeek(w, wi)).join('');
    return html;
  }

  function renderChart(wi) {
    const max = Math.max(...plan.weeks.map((w) => Math.max(w.volume, w.km)));
    const bars = plan.weeks.map((w) => {
      const h = Math.max(4, Math.round(((w.type === 'race' ? w.volume : w.km) / max) * 100));
      const label = `Semaine ${w.index + 1}, ${RP.plan.PHASE_LABELS[w.phase]}, ${w.km} km`;
      return `<button class="ph-${w.phase} ${w.type} ${w.index === wi ? 'current' : ''}" style="height:${h}%" data-action="goto-week" data-week="${w.index}" title="${esc(label)}" aria-label="${esc(label)}"></button>`;
    }).join('');
    const legend = ['base', 'construction', 'specifique', 'affutage'].filter((ph) => plan.weeks.some((w) => w.phase === ph))
      .map((ph) => `<span class="ph-${ph}"><i></i>${RP.plan.PHASE_LABELS[ph]}</span>`).join('');
    return `<div class="card"><div class="row"><h2 style="margin:0">Volume</h2><span class="spacer"></span><span class="muted small">max ${Math.round(max)} ${unit()} · touche une barre</span></div>
      <div class="chart" role="group" aria-label="Volume hebdomadaire">${bars}</div>
      <div class="chart-axis"><span>S1</span><span>Aujourd'hui : S${wi + 1}</span><span>S${plan.nWeeks}</span></div>
      <div class="legend">${legend}<span style="--ph:var(--ink)"><i></i>Semaine en cours</span></div></div>`;
  }

  function renderWeek(w, wi) {
    const open = ui.openWeeks[w.index] != null ? ui.openWeeks[w.index] : w.index === wi;
    const comp = RP.replan.weekCompletion(w, state.statuses);
    const ev = state.evaluated[w.index];
    const today = U.todayISO();
    const notes = [];
    if (w.reason) notes.push(['info', w.reason]);
    (w.notes || []).forEach((n) => notes.push(['warn', n]));
    if (ev && ev.rule && ev.rule !== 'R4') notes.push(['info', `Bilan : ${Math.round(ev.ratio * 100)} % du volume réalisé (règle ${ev.rule}).`]);
    const intens = Math.round(w.pctIntensity * 100);
    const pct = comp.planned ? Math.min(100, Math.round((comp.done / comp.planned) * 100)) : 0;
    return `<details class="card week ph-${w.phase} ${w.index === wi ? 'current' : ''}" id="week-${w.index}" data-week="${w.index}" ${open ? 'open' : ''}>
      <summary><span class="wk-num">S${w.index + 1}</span>
        <span class="wk-main"><span class="wk-title">${esc(U.fmtDateShort(U.parseDate(w.start)))} – ${esc(U.fmtDateShort(U.parseDate(w.end)))}</span>
          <span class="wk-meta" style="display:block">${RP.plan.PHASE_LABELS[w.phase]} · ${RP.plan.WEEK_TYPE_LABELS[w.type]}${w.nStrength ? ` · ${w.nStrength} renfo` : ''}${intens ? ` · ${intens} % vite` : ''}</span>
          ${comp.marked ? `<span class="wk-bar" style="display:block"><div style="width:${pct}%"></div></span>` : ''}</span>
        <span class="wk-km"><b class="num">${w.km}</b><span>${unit()} · ${U.fmtDuration(w.min)}</span></span>
        ${icon('chev', 'icon chev')}
      </summary>
      <div class="wk-body">
        ${notes.length ? `<div class="wk-notes">${notes.map(([t, n]) => `<div class="banner ${t}">${icon(t)}<div>${esc(n)}</div></div>`).join('')}</div>` : ''}
        ${w.days.map((d) => `<div class="day ${d.date === today ? 'today' : ''}">
          <div class="dname">${U.DAYS_SHORT[d.day]}<b class="num">${U.parseDate(d.date).getDate()}</b></div>
          <div class="items">${d.items.length ? d.items.map(chip).join('') : '<div class="rest">Repos</div>'}${d.note ? `<div class="dnote">${esc(d.note)}</div>` : ''}</div>
        </div>`).join('')}
        ${w.end >= today ? `<div class="wk-foot"><button class="btn small block" data-action="fit-week" data-week="${w.index}">${icon('watch')}Envoyer la semaine sur la montre (.zip)</button></div>` : ''}
      </div></details>`;
  }

  // ---------- Modale séance ----------
  function renderModal() {
    const root = document.getElementById('modal-root');
    if (!ui.modalId) { root.innerHTML = ''; document.body.style.overflow = ''; return; }
    const f = findItem(ui.modalId);
    if (!f) { ui.modalId = null; root.innerHTML = ''; document.body.style.overflow = ''; return; }
    const { it, w } = f;
    let body = bodyHTML(it, w, true);
    if (it.sub !== 'race') {
      const opts = RP.replan.moveOptions(plan, w.index, it.id, U.todayISO());
      body += `<h3 id="move">Déplacer dans la semaine</h3>`;
      body += opts.length
        ? `<div class="btn-group">${opts.map((d) => `<button class="btn small" data-action="move" data-id="${it.id}" data-day="${d}">${U.DAYS[d]} ${U.parseDate(w.days[d].date).getDate()}</button>`).join('')}</div>`
        : '<p class="muted small">Aucun autre jour de la semaine ne respecte les règles de placement.</p>';
      if (it.moved) body += `<button class="btn small" style="margin-top:8px" data-action="move" data-id="${it.id}" data-day="reset">Remettre au ${U.DAYS[it.originalDay].toLowerCase()}</button>`;
      body += '<p class="muted small">Jamais deux courses le même jour, jamais deux séances dures de suite, renfo jamais la veille d\'une séance dure.</p>';
    }
    root.innerHTML = `<div class="overlay" data-action="overlay"><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(it.title)}">${heroHTML(it, w, true)}<div class="session-body">${body}</div></div></div>`;
    document.body.style.overflow = 'hidden';
    if (ui.scrollToMove) {
      const el = document.getElementById('move');
      if (el) el.scrollIntoView({ block: 'start' });
      ui.scrollToMove = false;
    }
  }

  // ---------- Vue : Allures ----------
  function renderPaces() {
    const c = plan.c;
    const zones = P.ZONES.map((z) => `<div class="zone-row" style="--z:${ZCOLOR[z.id]}"><span class="bar"></span>
        <div><div class="zn">${z.label}</div><div class="zd">${esc(z.desc)} · effort ${z.rpe}</div></div>
        <div class="zp num">${P.zoneRange(c.vma, z.id)}<span>${Math.round(z.lo * 100)}-${Math.round(z.hi * 100)} % VMA</span></div></div>`).join('');
    const preds = [[5, '5 km'], [10, '10 km'], [21.1, 'Semi'], [42.195, 'Marathon']].map(([d, l]) => {
      const t = P.predictTime(c.vma, d);
      return `<div><span>${l}</span><b class="num">${U.fmtTime(t)}</b><span class="num">${P.fmtPace((t * 60) / d)}/km</span></div>`;
    }).join('');
    return `<div class="card vma-hero"><div class="eyebrow" style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#ff9f1c">Ta VMA</div>
        <div class="big num">${U.round1(c.vma)}<small>km/h</small></div>
        <p style="margin:8px 0 0;opacity:.75;font-size:13px">${esc(c.vmaSource)}.</p>
        ${!c.trail ? `<p style="margin:10px 0 0">Allure course : <b class="num">${c.pace('race')}</b>${c.targetCapped ? ' (plafonnée : objectif trop ambitieux pour l\'instant)' : ''}</p>` : '<p style="margin:10px 0 0;opacity:.75;font-size:13px">En trail, on s\'entraîne à l\'effort : ces allures valent sur le plat.</p>'}</div>
      <div class="card"><h2>Zones d'entraînement</h2>${zones}</div>
      <div class="card"><h2>Temps prédits sur route</h2><div class="pred">${preds}</div>
      <p class="muted small" style="margin-bottom:0">Prédictions théoriques avec une préparation spécifique. Mets à jour ta course de référence dans ton profil pour les affiner.</p></div>`;
  }

  // ---------- Vue : Exercices ----------
  function renderLibrary() {
    const q = ui.search.trim().toLowerCase();
    const match = (e) => !q || `${e.name} ${e.how}`.toLowerCase().includes(q);
    const groups = [
      ['Renforcement', 'k-strength', RP.EXERCISES.filter((e) => e.cat === 'force')],
      ['Gainage', 'k-strength', RP.EXERCISES.filter((e) => e.cat === 'gainage')],
      ['Pliométrie', 'k-quality', RP.EXERCISES.filter((e) => e.cat === 'plio')],
      ['Prévention ciblée', 'k-mobility', RP.EXERCISES.filter((e) => e.cat === 'prev')],
      ['Mobilité', 'k-mobility', RP.MOBILITY],
    ];
    let html = `<div class="today-head"><h1>Exercices</h1></div><input class="search" type="search" placeholder="Rechercher un exercice" value="${esc(ui.search)}" data-action="search" aria-label="Rechercher un exercice">`;
    let any = false;
    groups.forEach(([title, k, list]) => {
      const items = list.filter(match);
      if (!items.length) return;
      any = true;
      html += `<div class="section-title">${title} <span class="muted">${items.length}</span></div><div class="card ${k}" style="padding:4px 16px"><ul class="ex-list">${items.map((e) => {
        const meta = [];
        if (e.eq) meta.push(RP.EQUIP_LABELS[e.eq]);
        if (e.zones && e.zones.length) meta.push(e.zones.map((z) => RP.INJURY_ZONES[z].split(' (')[0]).join(', '));
        if (e.dose && !e.cat) meta.push(e.dose);
        return `<li><details><summary><span class="ex-num" style="color:var(--k)">${icon(e.cat ? (e.cat === 'prev' ? 'mobility' : 'strength') : 'mobility')}</span><span class="ex-name">${esc(e.name)}</span><span class="ex-dose">${esc(meta.join(' · '))}</span></summary><div class="ex-how">${esc(e.how)}</div></details></li>`;
      }).join('')}</ul></div>`;
    });
    if (!any) html += '<div class="empty">Aucun exercice ne correspond.</div>';
    return html;
  }

  // Formulaire de connexion Strava (sans « form » imbriqué : utilisable dans le profil)
  function stravaConnectHTML() {
    const host = location.hostname;
    return `<ol class="steps">
        <li>Sur <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a>, crée une application : nom « RunwoW », catégorie « Training », site web <code>https://${esc(host)}</code>, <b>Authorization Callback Domain : <code>${esc(host)}</code></b>.</li>
        <li>Copie ci-dessous le <b>Client ID</b> et le <b>Client Secret</b>.</li>
        <li>Connecte ton compte et autorise l'accès aux activités.</li></ol>
      <div class="form"><div class="grid2">
        <div class="field"><label class="lbl" for="st-id">Client ID</label><input id="st-id" data-strava="clientId" type="text" inputmode="numeric" autocomplete="off"></div>
        <div class="field"><label class="lbl" for="st-secret">Client Secret</label><input id="st-secret" data-strava="clientSecret" type="text" autocomplete="off" spellcheck="false"></div>
      </div><button class="btn primary" type="button" data-action="strava-save">Enregistrer et connecter</button></div>
      <p class="muted small">C'est ta propre application Strava : l'identifiant et le secret restent sur cet appareil et ne sont pas inclus dans l'export.</p>`;
  }

  // ---------- Historique : analyse et pré-remplissage du profil ----------
  function historyCardHTML() {
    const cfg = RP.strava.load();
    const h = ui.history;
    let res = '';
    if (h && h.enough) {
      const max = Math.max(1, ...h.weekly.map((w) => w.km));
      const bars = h.weekly.slice().reverse().map((w) => `<button type="button" tabindex="-1" class="ph-base" style="height:${Math.max(4, Math.round((w.km / max) * 100))}%" title="${esc(`Semaine du ${U.fmtDateShort(U.parseDate(w.start))} : ${Math.round(w.km)} km`)}"></button>`).join('');
      const from = h.vmaFrom ? ` · VMA d'après ${h.vmaFrom.race ? 'ta course' : 'ta meilleure sortie'} « ${esc(h.vmaFrom.name || 'sans nom')} » (${h.vmaFrom.km} km en ${esc(h.vmaFrom.time)}, ${esc(U.fmtDateShort(U.parseDate(h.vmaFrom.date)))})` : '';
      const trail = h.trailShare >= 0.5 || h.dplusPerKm >= 25 ? `<div class="banner info">${icon('info')}<div>Tu cours surtout en nature (${Math.round(h.trailShare * 100)} % de trails, ${h.dplusPerKm} m D+/km en moyenne) : pense au terrain « Trail » si c'est ton objectif.</div></div>` : '';
      res = `<div class="hist">
        <div class="hist-grid"><div><b class="num">${h.currentKm}</b>km / sem.</div><div><b class="num">${String(h.perWeek).replace('.', ',')}</b>sorties / sem.</div><div><b class="num">${String(h.longestKm).replace('.', ',')}</b>km au plus long</div><div><b class="num">${h.vma ? String(h.vma).replace('.', ',') : '–'}</b>VMA km/h</div></div>
        <div class="chart" style="height:56px;margin-top:12px" aria-hidden="true">${bars}</div>
        <div class="chart-axis"><span>il y a 12 sem.</span><span>semaine dernière</span></div>
        <p class="small muted" style="margin:10px 0 0">Jours habituels : ${h.runDays.map((d) => U.DAYS_SHORT[d]).join(', ')} · sortie longue le ${U.DAYS[h.longDay].toLowerCase()} · niveau ${({ debutant: 'débutant', intermediaire: 'intermédiaire', confirme: 'confirmé' })[h.level]}${from}.</p>
        <p class="small" style="margin:8px 0 0"><b>Reporté dans le formulaire ci-dessous :</b> vérifie et ajuste si besoin.</p>
        ${trail}</div>`;
    } else if (h) {
      res = `<div class="banner warn">${icon('warn')}<div>${h.nRuns} sortie(s) de course trouvée(s) sur 6 mois (${h.count} activités lues) : il faut au moins 4 sorties sur les 8 dernières semaines pour analyser ton historique.</div></div>`;
    }
    const stravaPart = cfg.refresh
      ? `<button class="btn dark" type="button" data-action="history-strava" ${ui.busy ? 'disabled' : ''}>${icon('sync')}${ui.busy ? 'Analyse en cours…' : 'Analyser mon Strava'}</button>`
      : '';
    return `<div class="card"><h2>${icon('bolt')} Personnaliser avec ton historique</h2>
      <p class="muted small" style="margin-top:0">RunwoW lit tes sorties des 6 derniers mois et en déduit ton volume, ta plus longue sortie, tes jours habituels, ta VMA et ton niveau.</p>
      <div class="btn-group">${stravaPart}
        <label class="btn">${icon('download')}Importer l'export Strava<input type="file" accept=".zip,.csv,application/zip,text/csv" data-action="history-file" hidden></label></div>
      ${res}
      <details class="help"><summary>Comment obtenir l'export Strava ?</summary>
        <ol class="steps"><li>Sur strava.com (ordinateur) : Paramètres › Mon compte › <b>Télécharger ou supprimer votre compte</b> › Commencer.</li>
        <li>Clique sur <b>Demander une archive</b> : Strava t'envoie un e-mail avec un lien (quelques minutes à quelques heures).</li>
        <li>Télécharge le .zip et importe-le ici tel quel, ou seulement le fichier <code>activities.csv</code> qu'il contient.</li></ol>
        <p class="muted small">Le fichier est lu sur ton appareil, rien n'est envoyé ailleurs.</p></details>
      ${cfg.refresh ? '' : `<details class="help"><summary>Ou connecter Strava pour une analyse directe</summary>${stravaConnectHTML()}</details>`}
      </div>`;
  }

  function applyHistory(base, h) {
    const p = { ...base, currentKm: h.currentKm, longestKm: h.longestKm, runDays: h.runDays, longDay: h.longDay, level: h.level };
    if (h.vmaFrom && h.vmaFrom.race) Object.assign(p, { refDistKm: h.vmaFrom.km, refTime: h.vmaFrom.time, vma: '' });
    else if (h.vma) Object.assign(p, { vma: h.vma, refDistKm: '', refTime: '' });
    return p;
  }

  function runHistory(acts, src) {
    const form = document.querySelector('[data-form="setup"]');
    const base = form ? readSetup(form) : (ui.draft || state.profile);
    const h = RP.history.analyze(acts, U.todayISO());
    ui.history = { ...h, src, count: acts.length };
    if (h.enough) ui.draft = applyHistory(base, h);
    else if (form) ui.draft = base;
    render();
    toast(h.enough ? `Historique analysé (${src}) : profil pré-rempli.` : 'Pas assez de sorties récentes pour analyser ton historique.');
  }

  // ---------- Carte Garmin & Strava ----------
  function renderSyncCard() {
    const cfg = RP.strava.load();
    const wi = currentWeekIndex();
    const host = location.hostname;
    let strava;
    if (cfg.refresh) {
      const last = cfg.lastSync ? new Date(cfg.lastSync).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'jamais';
      strava = `<p style="margin:0 0 8px">Connecté${cfg.athlete && cfg.athlete.firstname ? ` (${esc(cfg.athlete.firstname)})` : ''} · dernière synchro : ${esc(last)}</p>
        ${state.lastSyncMsg ? `<p class="muted small" style="margin:0 0 10px">${esc(state.lastSyncMsg)}</p>` : ''}
        <div class="btn-group"><button class="btn primary" data-action="strava-sync" ${ui.syncing ? 'disabled' : ''}>${icon('sync')}${ui.syncing ? 'Synchro en cours…' : 'Synchroniser'}</button>
        <button class="strava-btn" data-action="open-strava">Ouvrir Strava${icon('ext')}</button>
        <button class="btn" data-action="strava-disconnect">Déconnecter</button></div>
        <p class="muted small">La synchro se lance aussi à l'ouverture de l'appli (au plus toutes les 30 min).</p>`;
    } else if (cfg.clientId && cfg.clientSecret) {
      strava = `<p style="margin:0 0 8px">Application Strava enregistrée (Client ID ${esc(cfg.clientId)}).</p>
        <div class="btn-group"><button class="btn primary" data-action="strava-connect">Connecter mon compte Strava</button><button class="btn" data-action="strava-forget">Changer d'application</button></div>`;
    } else {
      strava = stravaConnectHTML();
    }
    return `<div class="card"><h2>${icon('watch')} Montre Garmin</h2>
        <p class="muted small" style="margin-top:0">Chaque séance de course s'exporte en entraînement structuré : étapes, répétitions, allures cibles avec alerte.</p>
        <ol class="steps"><li>Télécharge la semaine (.zip) et décompresse-la, ou une séance depuis sa fiche.</li>
          <li>Branche la montre en USB, copie les <code>.fit</code> dans <code>GARMIN/NewFiles</code>.</li>
          <li>Débranche : les séances sont dans Entraînement › Entraînements.</li></ol>
        <div class="btn-group"><button class="btn dark" data-action="fit-week" data-week="${wi}">${icon('download')}Semaine en cours</button>
        ${plan.weeks[wi + 1] ? `<button class="btn" data-action="fit-week" data-week="${wi + 1}">${icon('download')}Semaine suivante</button>` : ''}</div></div>
      <div class="card"><h2>${icon('sync')} Strava</h2>
        <p class="muted small" style="margin-top:0">Tes sorties cochent automatiquement les séances (règle R7). Active d'abord dans Garmin Connect l'envoi automatique vers Strava.</p>
        ${strava}</div>`;
  }

  // ---------- Vue : Plus ----------
  function renderMore() {
    const rules = RP.RULES.map((g) => `<details><summary>${esc(g.group)}</summary><dl>${g.items.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></details>`).join('');
    const log = state.log.slice(0, 12).map((l) => `<li><span class="num">${esc(U.fmtDateShort(U.parseDate(l.date)))}</span> · ${esc(l.msg)}</li>`).join('');
    const t = U.todayISO();
    return `<div class="today-head"><h1>Réglages</h1></div>
      <div class="card"><h2>Mon profil</h2><p class="muted small" style="margin-top:0">Objectif ou mode entraînement, jours, matériel, zones fragiles…</p><a class="btn primary" href="#/profil">Modifier mon profil</a></div>
      ${renderSyncCard()}
      <div class="card"><h2>Coupure</h2>
        <p class="muted small" style="margin-top:0">Maladie, blessure, vacances : déclare les jours sans course, le plan applique la règle de reprise R4.</p>
        <form class="form" data-form="break"><div class="grid2">
          <div class="field"><label class="lbl" for="br-from">Du</label><input id="br-from" name="from" type="date" required value="${t}"></div>
          <div class="field"><label class="lbl" for="br-to">Au (inclus)</label><input id="br-to" name="to" type="date" required value="${t}"></div>
        </div><button class="btn dark" type="submit">Appliquer la règle de reprise</button></form></div>
      <div class="card rules"><h2>Les règles du plan</h2><p class="muted small" style="margin-top:0">Aucune IA : le plan est calculé uniquement avec ces règles. Mêmes entrées, même plan.</p>${rules}</div>
      ${log ? `<div class="card"><h2>Journal des ajustements</h2><ul class="notes" style="color:var(--text)">${log}</ul></div>` : ''}
      <div class="card"><h2>Mes données</h2><p class="muted small" style="margin-top:0">Tout est enregistré sur cet appareil. Exporte une sauvegarde pour changer de téléphone.</p>
        <div class="btn-group"><button class="btn" data-action="export">${icon('download')}Exporter</button>
        <label class="btn">Importer<input type="file" accept="application/json,.json" data-action="import" hidden></label>
        <button class="btn danger" data-action="reset">Tout effacer</button></div></div>
      <p class="muted small" style="padding:0 4px">${esc(RP.DISCLAIMER)}</p>`;
  }

  // ---------- Profil / création du plan ----------
  const PRESETS = [
    ['5 km', 5, 'route'], ['10 km', 10, 'route'], ['Semi', 21.1, 'route'], ['Marathon', 42.195, 'route'],
    ['Ultra route', 100, 'route'], ['Trail', 25, 'trail'], ['Trail long', 50, 'trail'], ['Ultra-trail', 110, 'trail'],
  ];
  function nextMonday() {
    const d = new Date();
    const m = U.mondayOf(d);
    return U.fmtISO(U.weekday(d) === 0 ? m : U.addDays(m, 7));
  }
  function renderSetup() {
    const p = ui.draft || state.profile || {
      mode: 'race', trainingWeeks: 12, distanceKm: 10, terrain: 'route', dplus: '', raceDate: '', startDate: nextMonday(), targetTime: '', raceName: '',
      level: 'intermediaire', currentKm: 20, longestKm: 10, refDistKm: '', refTime: '', vma: '',
      runDays: [1, 3, 6], longDay: 6, strengthPerWeek: 2, equipment: 'aucun', mobility: '3x', injuries: [],
    };
    const mode = p.mode || 'race';
    const trail = p.terrain === 'trail';
    const editing = !!state.profile;
    const radio = (name, value, label, checked) => `<label><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}>${label}</label>`;
    const check = (name, value, label, checked) => `<label><input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''}>${label}</label>`;
    const hide = (cond) => (cond ? '' : 'hidden');
    const errors = ui.setupErrors.length ? `<div class="banner warn">${icon('warn')}<div>${ui.setupErrors.map(esc).join('<br>')}</div></div>` : '';
    return `<div class="setup-hero">${editing ? '<a class="btn small" href="#/plan">← Retour</a>' : ''}
        <span class="wordmark">Run<em>woW</em></span>
        <h1>${editing ? 'Mon profil' : 'Ton plan course + renfo + mobilité'}</h1>
        <p>${editing ? 'Le plan est recalculé à l\'enregistrement. Ton suivi est conservé, sauf si tu changes la date de début.' : 'Calculé par des règles fixes et transparentes, adapté à ta semaine et à ton matériel.'}</p></div>
      <form class="form" data-form="setup" novalidate>
      ${errors}
      <div class="card">
        <div class="segmented" role="radiogroup" aria-label="Type de plan">
          <label><input type="radio" name="mode" value="race" ${mode === 'race' ? 'checked' : ''}>Préparer une course<span>avec une date</span></label>
          <label><input type="radio" name="mode" value="training" ${mode === 'training' ? 'checked' : ''}>Juste m'entraîner<span>cycles sans course</span></label>
        </div>
      </div>
      ${historyCardHTML()}
      <div class="card"><h2 data-when="race" ${hide(mode === 'race')}>Objectif</h2><h2 data-when="training" ${hide(mode === 'training')}>Orientation de l'entraînement</h2>
        <div class="field"><div class="choices" role="group" aria-label="Distances courantes">${PRESETS.map(([l, d, t]) => `<button type="button" class="btn small" data-action="preset" data-dist="${d}" data-terrain="${t}">${l}</button>`).join('')}</div></div>
        <div class="grid2">
          <div class="field"><label class="lbl" for="f-dist">Distance (km)</label><input id="f-dist" name="distanceKm" type="number" min="1" max="400" step="0.1" required value="${esc(p.distanceKm)}"></div>
          <div class="field"><label class="lbl" for="f-terrain">Terrain</label><select id="f-terrain" name="terrain"><option value="route" ${!trail ? 'selected' : ''}>Route / piste</option><option value="trail" ${trail ? 'selected' : ''}>Trail / nature</option></select></div>
        </div>
        <div class="field" data-when="trail" ${hide(trail)}><label class="lbl" for="f-dplus">Dénivelé positif (m)</label><input id="f-dplus" name="dplus" type="number" min="0" step="10" value="${esc(p.dplus)}"><div class="hint" data-when="training" ${hide(mode === 'training')}>Facultatif en mode entraînement (40 m par km par défaut).</div></div>
        <div class="grid2" data-when="race" ${hide(mode === 'race')}>
          <div class="field"><label class="lbl" for="f-date">Date de la course</label><input id="f-date" name="raceDate" type="date" value="${esc(p.raceDate)}"></div>
          <div class="field"><label class="lbl" for="f-name">Nom de la course <span class="muted">(facultatif)</span></label><input id="f-name" name="raceName" type="text" maxlength="60" value="${esc(p.raceName)}"></div>
        </div>
        <div class="field" data-when="training" ${hide(mode === 'training')}><label class="lbl" for="f-weeks">Durée du cycle</label><select id="f-weeks" name="trainingWeeks">
          ${[[8, '8 semaines'], [12, '12 semaines'], [16, '16 semaines'], [52, 'En continu (1 an, cycles de 12 semaines)']].map(([v, l]) => `<option value="${v}" ${+p.trainingWeeks === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <div class="hint">Chaque cycle finit par une semaine test pour mesurer tes progrès.</div></div>
        <div class="grid2">
          <div class="field"><label class="lbl" for="f-start">Début du plan</label><input id="f-start" name="startDate" type="date" required value="${esc(p.startDate)}"><div class="hint">Le plan démarre le lundi de cette semaine.</div></div>
          <div class="field" data-when="race route" ${hide(mode === 'race' && !trail)}><label class="lbl" for="f-target">Objectif de temps <span class="muted">(facultatif)</span></label><input id="f-target" name="targetTime" type="text" placeholder="ex. 49:30 ou 3:45:00" value="${esc(p.targetTime)}"></div>
        </div>
      </div>

      <div class="card"><h2>Ton niveau aujourd'hui</h2>
        <div class="field"><span class="lbl">Niveau</span><div class="choices">${radio('level', 'debutant', 'Débutant', p.level === 'debutant')}${radio('level', 'intermediaire', 'Intermédiaire', p.level === 'intermediaire')}${radio('level', 'confirme', 'Confirmé', p.level === 'confirme')}</div></div>
        <div class="grid2">
          <div class="field"><label class="lbl" for="f-cur">Volume actuel (km/semaine)</label><input id="f-cur" name="currentKm" type="number" min="0" max="250" required value="${esc(p.currentKm)}"><div class="hint">Moyenne des 4 dernières semaines. Le plan démarre ici.</div></div>
          <div class="field"><label class="lbl" for="f-long">Plus longue sortie récente (km)</label><input id="f-long" name="longestKm" type="number" min="0" max="100" value="${esc(p.longestKm)}"></div>
        </div>
        <div class="field"><span class="lbl">Course de référence récente <span class="muted">(pour tes allures)</span></span>
          <div class="grid2"><input name="refDistKm" type="number" min="1" max="100" step="0.1" placeholder="Distance (km), ex. 10" aria-label="Distance de référence (km)" value="${esc(p.refDistKm)}">
          <input name="refTime" type="text" placeholder="Temps, ex. 48:30" aria-label="Temps de référence" value="${esc(p.refTime)}"></div>
          <div class="hint">Ou indique directement ta VMA :</div>
          <input name="vma" type="number" min="7" max="25" step="0.1" placeholder="VMA (km/h), facultatif" aria-label="VMA (km/h)" value="${esc(p.vma)}" style="margin-top:6px"></div>
      </div>

      <div class="card"><h2>Ta semaine</h2>
        <div class="field"><span class="lbl">Jours de course</span><div class="choices days">${U.DAYS_SHORT.map((d, i) => check('runDays', i, d, (p.runDays || []).map(Number).includes(i))).join('')}</div></div>
        <div class="field"><label class="lbl" for="f-longday">Jour de la sortie longue</label><select id="f-longday" name="longDay">${U.DAYS.map((d, i) => `<option value="${i}" ${+p.longDay === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div class="field"><span class="lbl">Séances de renfo par semaine</span><div class="choices">${[0, 1, 2, 3].map((n) => radio('strengthPerWeek', n, n, +p.strengthPerWeek === n)).join('')}</div><div class="hint">2 recommandées, placées automatiquement les bons jours. Une 3e n'est ajoutée que si un jour respecte les règles.</div></div>
        <div class="field"><label class="lbl" for="f-eq">Matériel</label><select id="f-eq" name="equipment">${RP.EQUIP_LEVELS.map((e) => `<option value="${e}" ${p.equipment === e ? 'selected' : ''}>${RP.EQUIP_LABELS[e]}</option>`).join('')}</select></div>
        <div class="field"><span class="lbl">Mobilité</span><div class="choices">${radio('mobility', 'minimum', 'Minimum', p.mobility === 'minimum')}${radio('mobility', '3x', '3 fois / semaine', p.mobility === '3x')}${radio('mobility', 'quotidien', 'Tous les jours', p.mobility === 'quotidien')}</div></div>
      </div>

      <div class="card"><h2>Zones fragiles</h2><p class="muted small" style="margin-top:0">Des exercices de prévention ciblés seront ajoutés au renfo et à la mobilité.</p>
        <div class="choices">${Object.entries(RP.INJURY_ZONES).map(([k, l]) => check('injuries', k, l, (p.injuries || []).includes(k))).join('')}</div>
      </div>
      <p class="muted small" style="padding:0 4px">${esc(RP.DISCLAIMER)}</p>
      <button class="btn primary block" type="submit" style="min-height:54px;font-size:16px;margin-bottom:28px">${editing ? 'Enregistrer et recalculer' : 'Générer mon plan'}</button>
      </form>`;
  }

  function syncSetup(form) {
    const mode = (form.querySelector('[name=mode]:checked') || {}).value || 'race';
    const trail = form.terrain.value === 'trail';
    const ok = (c) => (c === 'race' ? mode === 'race' : c === 'training' ? mode === 'training' : c === 'trail' ? trail : c === 'route' ? !trail : true);
    form.querySelectorAll('[data-when]').forEach((el) => { el.hidden = !el.dataset.when.split(' ').every(ok); });
  }
  function initSetup() {
    const form = document.querySelector('[data-form="setup"]');
    if (!form) return;
    form.addEventListener('change', (ev) => { if (ev.target.name === 'mode' || ev.target.name === 'terrain') syncSetup(form); });
  }

  function readSetup(form) {
    const fd = new FormData(form);
    const num = (k) => (fd.get(k) === '' || fd.get(k) == null ? '' : +fd.get(k));
    return {
      mode: fd.get('mode') || 'race', trainingWeeks: num('trainingWeeks'),
      distanceKm: num('distanceKm'), terrain: fd.get('terrain'), dplus: num('dplus'), raceDate: fd.get('raceDate') || '',
      startDate: fd.get('startDate'), targetTime: (fd.get('targetTime') || '').trim(), raceName: (fd.get('raceName') || '').trim(),
      level: fd.get('level') || 'intermediaire', currentKm: num('currentKm'), longestKm: num('longestKm'),
      refDistKm: num('refDistKm'), refTime: (fd.get('refTime') || '').trim(), vma: num('vma'),
      runDays: fd.getAll('runDays').map(Number), longDay: +fd.get('longDay'), strengthPerWeek: +fd.get('strengthPerWeek') || 0,
      equipment: fd.get('equipment'), mobility: fd.get('mobility') || '3x', injuries: fd.getAll('injuries'),
    };
  }

  function validate(p) {
    const e = [];
    if (!(p.distanceKm > 0)) e.push('Indique une distance.');
    if (!p.startDate) e.push('Indique la date de début du plan.');
    if (p.mode === 'race') {
      if (!p.raceDate) e.push('Indique la date de la course (ou choisis « Juste m\'entraîner »).');
      if (p.raceDate && p.startDate && p.raceDate <= p.startDate) e.push('La course doit avoir lieu après le début du plan.');
      if (p.raceDate && p.startDate && U.daysBetween(U.mondayOf(U.parseDate(p.startDate)), U.parseDate(p.raceDate)) > 52 * 7) e.push('Le plan est limité à 52 semaines : rapproche la date de début.');
    } else if (![8, 12, 16, 52].includes(p.trainingWeeks)) e.push('Choisis la durée du cycle.');
    if (p.runDays.length < 2) e.push('Choisis au moins 2 jours de course.');
    if (!p.runDays.includes(p.longDay)) e.push('Le jour de la sortie longue doit faire partie de tes jours de course.');
    if (p.currentKm === '' || p.currentKm < 0) e.push('Indique ton volume actuel (0 si tu débutes).');
    if (p.refTime && !U.parseTime(p.refTime)) e.push('Temps de référence illisible : utilise le format 48:30 ou 1:45:00.');
    if (p.mode === 'race' && p.targetTime && !U.parseTime(p.targetTime)) e.push('Objectif de temps illisible : utilise le format 48:30 ou 1:45:00.');
    if (p.terrain === 'trail' && p.dplus === '') p.dplus = 0;
    if (p.mode === 'training') Object.assign(p, { targetTime: '', raceName: '', raceDate: '' });
    return e;
  }

  // ---------- Actions ----------
  document.addEventListener('click', (ev) => {
    const a = ev.target.closest('[data-action]');
    if (!a) return;
    const act = a.dataset.action;
    if (act === 'overlay' && ev.target !== a) return;
    switch (act) {
      case 'open':
        ui.modalId = a.dataset.id;
        ui.scrollToMove = a.dataset.move === '1';
        renderModal();
        break;
      case 'close':
      case 'overlay':
        ui.modalId = null;
        renderModal();
        break;
      case 'status': {
        const id = a.dataset.id;
        const v = state.statuses[id] === a.dataset.val ? '' : a.dataset.val; // toucher à nouveau = annuler
        if (v) { state.statuses[id] = v; state.statusSource[id] = 'manual'; } else { delete state.statuses[id]; delete state.statusSource[id]; }
        saveState();
        const changes = evaluate();
        render();
        if (changes.length) toast(changes[changes.length - 1].msg);
        break;
      }
      case 'downgrade':
        if (a.dataset.val === '1') state.downgrades[a.dataset.id] = true; else delete state.downgrades[a.dataset.id];
        saveState();
        regen();
        render();
        toast(a.dataset.val === '1' ? 'Séance remplacée par un footing facile (règle R6).' : 'Séance prévue rétablie.');
        break;
      case 'move': {
        const id = a.dataset.id;
        if (a.dataset.day === 'reset') delete state.moves[id]; else state.moves[id] = +a.dataset.day;
        saveState();
        regen();
        render();
        toast('Séance déplacée.');
        break;
      }
      case 'goto-week': {
        const i = +a.dataset.week;
        ui.openWeeks[i] = true;
        render();
        const el = document.getElementById(`week-${i}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'preset': {
        const form = a.closest('form');
        form.distanceKm.value = a.dataset.dist;
        form.terrain.value = a.dataset.terrain;
        syncSetup(form);
        break;
      }
      case 'open-strava':
        openStrava(a.dataset.url);
        break;
      case 'fit': {
        const f = findItem(a.dataset.id);
        if (!f) break;
        download(new Blob([RP.fit.encodeWorkout(f.it, f.w, plan.c)], { type: 'application/octet-stream' }), RP.fit.fileName(f.it, f.w));
        toast('Copie le fichier dans GARMIN/NewFiles sur ta montre.');
        break;
      }
      case 'fit-week': {
        const w = plan.weeks[+a.dataset.week];
        const items = w.days.flatMap((d) => d.items).filter((it) => RP.fit.canExport(it) && it.date >= U.todayISO());
        if (!items.length) { toast('Aucune séance de course à venir cette semaine.'); break; }
        const files = items.map((it) => ({ name: RP.fit.fileName(it, w), data: RP.fit.encodeWorkout(it, w, plan.c) }));
        download(RP.zip.zip(files), `runwow-semaine-${String(w.index + 1).padStart(2, '0')}.zip`);
        toast(`${files.length} séance(s) : décompresse puis copie les .fit dans GARMIN/NewFiles.`);
        break;
      }
      case 'strava-connect':
        location.href = RP.strava.authorizeUrl(RP.strava.load());
        break;
      case 'strava-save': {
        const box = a.parentElement;
        const clientId = (box.querySelector('[data-strava="clientId"]').value || '').trim();
        const clientSecret = (box.querySelector('[data-strava="clientSecret"]').value || '').trim();
        if (!/^\d+$/.test(clientId) || clientSecret.length < 20) { toast('Vérifie le Client ID (chiffres) et le Client Secret (longue suite de caractères).'); break; }
        const form = document.querySelector('[data-form="setup"]');
        if (form) ui.draft = readSetup(form); // garde la saisie en cours (perdue sinon au retour de Strava)
        try { sessionStorage.setItem('runwow-draft', JSON.stringify(ui.draft)); } catch (e) { /* facultatif */ }
        const cfg = { clientId, clientSecret };
        RP.strava.save(cfg);
        location.href = RP.strava.authorizeUrl(cfg);
        break;
      }
      case 'history-strava': {
        if (ui.busy) break;
        ui.busy = true;
        const form = document.querySelector('[data-form="setup"]');
        if (form) ui.draft = readSetup(form);
        render();
        RP.strava.fetchActivities(U.fmtISO(U.addDays(new Date(), -7 * RP.history.RULES.vmaWeeks - 7)))
          .then((acts) => { ui.busy = false; runHistory(acts, 'Strava'); })
          .catch((e) => { ui.busy = false; render(); toast(e.message); });
        break;
      }
      case 'strava-sync':
        syncStrava(false);
        break;
      case 'strava-disconnect':
        if (confirm('Déconnecter Strava ? Les séances déjà cochées par Strava restent cochées.')) {
          RP.strava.disconnect().then(() => { render(); toast('Strava déconnecté.'); });
        }
        break;
      case 'strava-forget':
        RP.strava.save({});
        render();
        break;
      case 'export':
        download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `runwow-sauvegarde-${U.todayISO()}.json`);
        break;
      case 'reset':
        if (confirm('Effacer ton profil, ton plan et tout ton suivi sur cet appareil ? Cette action est définitive.')) {
          state = blankState();
          saveState();
          regen();
          location.hash = '#/aujourdhui';
          render();
        }
        break;
      default:
    }
  });

  // Mémorise les semaines ouvertes / fermées
  document.addEventListener('toggle', (ev) => {
    const el = ev.target;
    if (el.classList && el.classList.contains('week')) ui.openWeeks[+el.dataset.week] = el.open;
  }, true);

  document.addEventListener('input', (ev) => {
    if (ev.target.dataset.action === 'search') {
      ui.search = ev.target.value;
      const pos = ev.target.selectionStart;
      render();
      const s = document.querySelector('[data-action="search"]');
      if (s) { s.focus(); s.setSelectionRange(pos, pos); }
    }
  });

  document.addEventListener('change', (ev) => {
    if (ev.target.dataset.action === 'history-file') {
      const file = ev.target.files[0];
      if (!file) return;
      toast('Lecture de l\'export…');
      RP.history.readExport(file).then((acts) => runHistory(acts, 'export Strava')).catch((e) => toast(e.message || 'Fichier illisible.'));
      return;
    }
    if (ev.target.dataset.action !== 'import') return;
    const file = ev.target.files[0];
    if (!file) return;
    file.text().then((txt) => {
      const s = JSON.parse(txt);
      if (!s || typeof s !== 'object' || !s.profile) throw new Error('format');
      state = Object.assign(blankState(), s);
      saveState();
      regen();
      render();
      toast('Sauvegarde importée.');
    }).catch(() => toast('Fichier non reconnu : choisis une sauvegarde exportée depuis RunwoW.'));
  });

  document.addEventListener('submit', (ev) => {
    const form = ev.target;
    ev.preventDefault();
    if (form.dataset.form === 'setup') {
      const p = readSetup(form);
      const errs = validate(p);
      ui.setupErrors = errs;
      if (errs.length) { ui.draft = p; render(); window.scrollTo(0, 0); return; }
      const first = !state.profile;
      // Le suivi est indexé par semaine : si le début du plan change, il ne correspond plus.
      if (!first && U.fmtISO(U.mondayOf(U.parseDate(state.profile.startDate))) !== U.fmtISO(U.mondayOf(U.parseDate(p.startDate)))) {
        if (!confirm('La date de début change : ton suivi (séances cochées, ajustements) sera remis à zéro. Continuer ?')) return;
        Object.assign(state, { statuses: {}, statusSource: {}, overrides: {}, moves: {}, downgrades: {}, evaluated: {}, breaks: [], syncInfo: {} });
        state.log.unshift({ date: U.todayISO(), rule: '-', msg: 'Nouveau plan : suivi remis à zéro.' });
      }
      state.profile = p;
      saveState();
      regen();
      if (planError) { ui.setupErrors = [planError]; ui.draft = p; render(); return; }
      ui.draft = null;
      ui.history = null;
      location.hash = '#/aujourdhui';
      render();
      toast(first ? `Plan généré : ${plan.nWeeks} semaines.` : 'Profil enregistré, plan recalculé.');
    } else if (form.dataset.form === 'strava') {
      const clientId = form.clientId.value.trim();
      const clientSecret = form.clientSecret.value.trim();
      if (!/^\d+$/.test(clientId) || clientSecret.length < 20) { toast('Vérifie le Client ID (chiffres) et le Client Secret (longue suite de caractères).'); return; }
      const cfg = { clientId, clientSecret };
      RP.strava.save(cfg);
      location.href = RP.strava.authorizeUrl(cfg);
    } else if (form.dataset.form === 'break') {
      try {
        const msgs = RP.replan.applyBreak(plan, state, form.from.value, form.to.value);
        msgs.forEach((m) => state.log.unshift({ date: U.todayISO(), rule: 'R4', msg: m }));
        saveState();
        regen();
        render();
        toast(msgs[0]);
      } catch (e) { toast(e.message); }
    }
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && ui.modalId) { ui.modalId = null; renderModal(); }
  });

  window.addEventListener('hashchange', () => {
    ui.modalId = null;
    ui.setupErrors = [];
    if (route() !== 'profil') { ui.draft = null; ui.history = null; }
    render();
    window.scrollTo(0, 0);
  });

  // ---------- Démarrage ----------
  try { // saisie du profil gardée pendant l'aller-retour vers Strava
    const d = sessionStorage.getItem('runwow-draft');
    if (d) { ui.draft = JSON.parse(d); sessionStorage.removeItem('runwow-draft'); }
  } catch (e) { /* facultatif */ }
  regen();
  evaluate();
  render();
  RP.strava.handleRedirect().then((r) => {
    if (r) {
      toast(r.msg);
      render();
      if (r.ok) syncStrava(false);
      return;
    }
    const cfg = RP.strava.load();
    if (cfg.refresh && (!cfg.lastSync || Date.now() - new Date(cfg.lastSync).getTime() > 30 * 60000)) syncStrava(true);
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.RunwoWDebug = { get state() { return state; }, get plan() { return plan; } };
})(window.RP);
