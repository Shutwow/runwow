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
  const ui = { modalId: null, openWeeks: {}, search: '', setupErrors: [] };

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
  };
  const icon = (name, cls = 'icon') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  // ---------- Aides d'affichage ----------
  const kindClass = (it) => (it.kind === 'strength' ? 'k-strength' : it.kind === 'mobility' ? 'k-mobility' : it.sub === 'race' ? 'k-race' : it.sub === 'long' ? 'k-long' : it.sub === 'quality' ? 'k-quality' : 'k-easy');
  const kindIcon = (it) => (it.kind === 'strength' ? 'strength' : it.kind === 'mobility' ? 'mobility' : it.sub === 'race' ? 'race' : 'run');
  const kindLabel = (it) => (it.kind === 'strength' ? 'Renforcement' : it.kind === 'mobility' ? 'Mobilité' : it.sub === 'race' ? 'Course' : it.sub === 'long' ? 'Sortie longue' : it.sub === 'quality' ? 'Séance de qualité' : 'Footing');
  const STATUS_LABELS = { done: 'Fait', partial: 'Partiel', missed: 'Raté', break: 'Coupure' };

  function itemMeta(it) {
    if (it.kind === 'run') {
      const parts = [];
      if (it.km) parts.push(`${it.km} km${state.profile && plan && plan.c.trail && it.sub === 'long' ? '-effort' : ''}`);
      if (it.min) parts.push(U.fmtDuration(it.min));
      return parts.join(' · ');
    }
    return `${it.min} min · ${it.exercises.length} exercices`;
  }

  const unit = () => (plan && plan.c.trail ? 'km-effort' : 'km');

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

  function toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => el.classList.remove('show'), 3800);
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

  function renderTopbar() {
    const p = state.profile;
    const days = U.daysBetween(U.parseDate(U.todayISO()), U.parseDate(p.raceDate));
    const cat = plan ? plan.c.cat.label : '';
    const name = p.raceName || cat;
    const cd = days > 0 ? `<b class="num">J-${days}</b><span>${esc(U.fmtDateShort(U.parseDate(p.raceDate)))}</span>` : days === 0 ? '<b>Jour J</b><span>Bonne course !</span>' : '<b>Terminé</b><span>Bravo</span>';
    return `<header class="topbar">
      <img class="logo" src="icon.svg" alt="">
      <div><h1>RunwoW</h1><div class="sub">${esc(name)}${p.terrain === 'trail' && p.dplus ? ` · ${esc(p.distanceKm)} km, ${esc(p.dplus)} m D+` : ''}</div></div>
      <div class="countdown">${cd}</div>
    </header>`;
  }

  function renderNav(r) {
    const items = [['aujourdhui', 'today', 'Aujourd\'hui'], ['plan', 'plan', 'Plan'], ['allures', 'pace', 'Allures'], ['exercices', 'list', 'Exercices'], ['plus', 'more', 'Plus']];
    return `<nav class="nav" aria-label="Navigation principale"><ul>${items.map(([id, ic, label]) =>
      `<li><a href="#/${id}" ${r === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${label}</span></a></li>`).join('')}</ul></nav>`;
  }

  // ---------- Vue : Aujourd'hui ----------
  function renderToday() {
    const t = U.todayISO();
    const wi = currentWeekIndex();
    const w = plan.weeks[wi];
    let html = '';
    if (state.log.length && state.log[0].date === t) html += `<div class="banner info">${icon('info')}<div>${esc(state.log[0].msg)}</div></div>`;

    if (t < plan.weeks[0].start) {
      html += `<div class="card"><h2>Ton plan commence le ${esc(U.fmtDateLong(U.parseDate(plan.weeks[0].start)))}</h2>
        <p class="muted">${plan.nWeeks} semaines de préparation. En attendant, tu peux parcourir le plan et les exercices.</p>
        <a class="btn primary" href="#/plan">Voir le plan</a></div>`;
      return html;
    }
    if (t > plan.raceDate) {
      html += `<div class="card"><h2>Préparation terminée</h2><p class="muted">Récupère bien. Tu peux créer un nouveau plan depuis ton profil.</p><a class="btn primary" href="#/profil">Nouvel objectif</a></div>`;
      return html;
    }
    const day = w.days.find((d) => d.date === t);
    const phase = RP.plan.PHASE_LABELS[w.phase];
    html += `<div class="row" style="margin:4px 2px 10px"><span class="tag phase ph-${w.phase}"><span class="dot"></span>${phase}</span>
      <span class="tag">Semaine ${wi + 1}/${plan.nWeeks}</span><span class="tag">${RP.plan.WEEK_TYPE_LABELS[w.type]}</span>
      <span class="spacer"></span><span class="muted small">${esc(U.fmtDateLong(U.parseDate(t)))}</span></div>`;

    if (day && day.items.length) {
      html += day.items.map((it) => renderSessionCard(it, w)).join('');
    } else {
      html += `<div class="card"><div class="row">${icon('rest')}<h2 style="margin:0">Repos</h2></div>
        <p class="muted">Le repos fait partie de l'entraînement : c'est pendant la récupération que le corps s'adapte.</p></div>`;
    }
    if (day && day.note) html += `<div class="banner info">${icon('info')}<div>${esc(day.note)}</div></div>`;

    // Prochaine séance
    const upcoming = [];
    plan.weeks.slice(wi).forEach((wk) => wk.days.forEach((d) => { if (d.date > t && d.items.length) upcoming.push(d); }));
    if (upcoming.length) {
      const d = upcoming[0];
      html += `<div class="section-title">Prochaine séance · ${esc(U.fmtDateLong(U.parseDate(d.date)))}</div>`;
      html += `<div class="card" style="padding:10px">${d.items.map((it) => chip(it)).join('<div style="height:6px"></div>')}</div>`;
    }

    // Progression de la semaine
    const comp = RP.replan.weekCompletion(w, state.statuses);
    const pct = comp.planned ? Math.round((comp.done / comp.planned) * 100) : 0;
    html += `<div class="section-title">Cette semaine</div><div class="card">
      <div class="row"><b class="num">${U.round1(comp.done)} / ${U.round1(comp.planned)} km</b><span class="spacer"></span><span class="muted small">${comp.marked}/${comp.total} séances renseignées</span></div>
      <div class="progress" style="margin-top:8px"><div style="width:${Math.min(100, pct)}%"></div></div>
      <p class="muted small" style="margin:8px 0 0">Quand toutes les courses de la semaine sont renseignées, les règles de recalcul s'appliquent automatiquement à la semaine suivante.</p>
      <a class="btn small" style="margin-top:8px" href="#/plan">Voir la semaine</a></div>`;
    return html;
  }

  function renderSessionCard(it, w) {
    return `<article class="card session ${kindClass(it)}">${sessionBody(it, w, false)}</article>`;
  }

  function sessionBody(it, w, inModal) {
    const st = state.statuses[it.id];
    let html = `<div class="kind">${kindLabel(it)}${it.moved ? ' · déplacée' : ''}${it.downgraded ? ' · allégée' : ''}</div>
      <h2>${esc(it.title)}</h2>`;
    if (inModal) html += `<div class="muted small">${esc(U.fmtDateLong(U.parseDate(it.date)))} · semaine ${w.index + 1}</div>`;
    const stats = [];
    if (it.kind === 'run') {
      if (it.km) stats.push(['Distance', `${it.km} km${plan.c.trail && (it.sub === 'long' || it.sub === 'race') ? '-effort' : ''}`]);
      if (it.min) stats.push(['Durée', U.fmtDuration(it.min)]);
      if (it.intensityMin) stats.push(['Dont intensité', U.fmtDuration(it.intensityMin)]);
    } else {
      stats.push(['Durée', `${it.min} min`], ['Exercices', it.exercises.length]);
    }
    html += `<div class="stats">${stats.map(([k, v]) => `<div>${k}<b class="num">${esc(v)}</b></div>`).join('')}</div>`;
    if (it.focus) html += `<p>${esc(it.focus)}</p>`;
    if (it.blocks && it.blocks.length) html += `<ol class="blocks">${it.blocks.map((b) => `<li>${esc(b.label)}</li>`).join('')}</ol>`;
    if (it.exercises) {
      html += `<ul class="ex-list">${it.exercises.map((e) => `<li><details><summary><span class="ex-name">${esc(e.name)}${e.slot === 'prev' ? '<span class="ex-tag">prévention</span>' : ''}</span><span class="ex-dose">${esc(e.dose)}</span></summary><div class="ex-how">${esc(e.how)}</div></details></li>`).join('')}</ul>`;
    }
    if (it.notes && it.notes.length) html += `<ul class="notes">${it.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`;
    const si = state.syncInfo && state.syncInfo[it.id];
    if (si) html += `<div class="banner info">${icon('info')}<div>Strava : ${esc(si.names.join(' + '))} · ${si.km} km (${Math.round(si.ratio * 100)} % du prévu)</div></div>`;
    else if (state.statusSource[it.id] === 'strava' && state.statuses[it.id] === 'missed') html += `<div class="banner warn">${icon('warn')}<div>Aucune sortie Strava trouvée pour cette séance. Corrige le statut si besoin.</div></div>`;
    if (RP.fit.canExport(it)) html += `<button class="btn small" style="margin-top:4px" data-action="fit" data-id="${it.id}">${icon('download')}Séance pour la montre (.FIT)</button>`;
    html += statusControls(it, w, inModal);
    return html;
  }

  function statusControls(it, w, inModal) {
    if (it.sub === 'race') return '';
    const st = state.statuses[it.id] || '';
    const opts = it.kind === 'run' ? [['done', 'Fait'], ['partial', 'Partiel'], ['missed', 'Raté']] : [['done', 'Fait'], ['missed', 'Pas fait']];
    let html = '<div class="btn-group" style="margin-top:12px">';
    html += opts.map(([v, l]) => `<button class="btn small" data-action="status" data-id="${it.id}" data-val="${v}" aria-pressed="${st === v}">${l}</button>`).join('');
    if (st && st !== 'break') html += `<button class="btn small" data-action="status" data-id="${it.id}" data-val="">Effacer</button>`;
    html += '</div>';
    const canDown = it.kind === 'run' && (it.hard || it.downgraded) && it.date >= U.todayISO();
    const extra = [];
    if (canDown) {
      extra.push(it.downgraded
        ? `<button class="btn small" data-action="downgrade" data-id="${it.id}" data-val="0">Rétablir la séance prévue</button>`
        : `<button class="btn small" data-action="downgrade" data-id="${it.id}" data-val="1">Pas à 100 % : footing facile à la place</button>`);
    }
    if (!inModal) extra.push(`<button class="btn small" data-action="open" data-id="${it.id}" data-move="1">Déplacer</button>`);
    if (extra.length) html += `<div class="btn-group" style="margin-top:8px">${extra.join('')}</div>`;
    return html;
  }

  function chip(it) {
    const st = state.statuses[it.id];
    return `<button class="chip ${kindClass(it)} ${st ? `st-${st}` : ''}" data-action="open" data-id="${it.id}">
      ${icon(kindIcon(it))}<span class="ctext"><span class="ctitle">${esc(it.title)}</span><span class="cmeta num">${esc(itemMeta(it))}</span></span>
      ${st ? `<span class="status ${st}">${STATUS_LABELS[st]}</span>` : ''}</button>`;
  }

  // ---------- Vue : Plan ----------
  function renderPlan() {
    const c = plan.c;
    const p = state.profile;
    const wi = currentWeekIndex();
    let html = '';
    html += `<div class="card"><h2>${esc(p.raceName || c.cat.label)}</h2>
      <div class="stats">
        <div>Course<b>${esc(U.fmtDateShort(U.parseDate(p.raceDate)))}</b></div>
        <div>Durée<b class="num">${plan.nWeeks} sem.</b></div>
        <div>Pic de volume<b class="num">${Math.round(plan.maxLoad)} ${unit()}</b></div>
        <div>VMA<b class="num">${U.round1(c.vma)} km/h</b></div>
        ${!c.trail ? `<div>${c.targetMin && !c.targetCapped ? 'Objectif' : 'Prédiction'}<b class="num">${U.fmtTime(c.targetMin && !c.targetCapped ? c.targetMin : c.predictedMin)}</b></div>` : ''}
      </div>
      <p class="muted small" style="margin:0">Catégorie : ${esc(c.cat.label)} · ${(p.runDays || []).length} jours de course · ${p.strengthPerWeek || 0} renfo/semaine</p></div>`;
    plan.warnings.forEach((wr) => { html += `<div class="banner warn">${icon('warn')}<div>${esc(wr)}</div></div>`; });
    html += renderChart(wi);
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
    return `<div class="card"><div class="row"><h2 style="margin:0">Volume par semaine</h2><span class="spacer"></span><span class="muted small">touche une barre</span></div>
      <div class="chart" role="group" aria-label="Volume hebdomadaire">${bars}</div>
      <div class="chart-axis"><span>S1</span><span>S${plan.nWeeks}</span></div>
      <div class="legend">${legend}<span style="--ph:var(--muted)"><i style="opacity:.45"></i>Semaine allégée</span></div></div>`;
  }

  function renderWeek(w, wi) {
    const open = ui.openWeeks[w.index] != null ? ui.openWeeks[w.index] : w.index === wi;
    const d0 = U.parseDate(w.start);
    const d6 = U.parseDate(w.end);
    const comp = RP.replan.weekCompletion(w, state.statuses);
    const ev = state.evaluated[w.index];
    const today = U.todayISO();
    const notes = [];
    if (w.reason) notes.push(['info', w.reason]);
    (w.notes || []).forEach((n) => notes.push(['warn', n]));
    if (ev && ev.rule && ev.rule !== 'R4') notes.push(['info', `Bilan : ${Math.round(ev.ratio * 100)} % du volume réalisé (règle ${ev.rule}).`]);
    const intens = Math.round(w.pctIntensity * 100);
    return `<details class="card week ph-${w.phase} ${w.index === wi ? 'current' : ''}" id="week-${w.index}" data-week="${w.index}" ${open ? 'open' : ''}>
      <summary><span class="wk-bar"></span>
        <span class="wk-main"><span class="wk-title">S${w.index + 1}<span class="muted small" style="font-weight:400">${esc(U.fmtDateShort(d0))} – ${esc(U.fmtDateShort(d6))}</span></span>
          <span class="wk-meta">${RP.plan.PHASE_LABELS[w.phase]} · ${RP.plan.WEEK_TYPE_LABELS[w.type]}${w.nStrength ? ` · ${w.nStrength} renfo` : ''}${intens ? ` · ${intens} % d'intensité` : ''}${comp.marked ? ` · ${comp.marked}/${comp.total} renseignées` : ''}</span></span>
        <span class="wk-km"><b class="num">${w.km}</b><span>${unit()} · ${U.fmtDuration(w.min)}</span></span>
        ${icon('chev', 'icon chev')}
      </summary>
      <div class="wk-body">
        ${notes.length ? `<div class="wk-notes">${notes.map(([t, n]) => `<div class="banner ${t}">${icon(t)}<div>${esc(n)}</div></div>`).join('')}</div>` : ''}
        ${w.days.map((d) => `<div class="day ${d.date === today ? 'today' : ''}">
          <div class="dname">${U.DAYS_SHORT[d.day]}<b class="num">${U.parseDate(d.date).getDate()}</b></div>
          <div class="items">${d.items.length ? d.items.map(chip).join('') : '<div class="rest">Repos</div>'}${d.note ? `<div class="dnote">${esc(d.note)}</div>` : ''}</div>
        </div>`).join('')}
        ${w.end >= today ? `<div class="day" style="grid-template-columns:1fr"><button class="btn small" data-action="fit-week" data-week="${w.index}">${icon('watch')}Séances de la semaine pour la montre (.zip)</button></div>` : ''}
      </div></details>`;
  }

  // ---------- Modale séance ----------
  function renderModal() {
    const root = document.getElementById('modal-root');
    if (!ui.modalId) { root.innerHTML = ''; return; }
    const f = findItem(ui.modalId);
    if (!f) { ui.modalId = null; root.innerHTML = ''; return; }
    const { it, w } = f;
    let html = `<button class="btn small close" data-action="close" aria-label="Fermer">${icon('close')}</button>`;
    html += sessionBody(it, w, true);
    if (it.sub !== 'race') {
      const opts = RP.replan.moveOptions(plan, w.index, it.id, U.todayISO());
      html += `<h3 id="move">Déplacer dans la semaine</h3>`;
      if (opts.length) {
        html += `<div class="btn-group">${opts.map((d) => `<button class="btn small" data-action="move" data-id="${it.id}" data-day="${d}">${U.DAYS[d]} ${U.parseDate(w.days[d].date).getDate()}</button>`).join('')}</div>`;
      } else {
        html += '<p class="muted small">Aucun autre jour de la semaine ne respecte les règles de placement.</p>';
      }
      if (it.moved) html += `<button class="btn small" style="margin-top:8px" data-action="move" data-id="${it.id}" data-day="reset">Remettre au ${U.DAYS[it.originalDay].toLowerCase()}</button>`;
      html += '<p class="muted small">Règle : jamais deux courses le même jour, jamais deux séances dures de suite, renfo jamais la veille d\'une séance dure.</p>';
    }
    root.innerHTML = `<div class="overlay" data-action="overlay"><div class="sheet card session ${kindClass(it)}" role="dialog" aria-modal="true" aria-label="${esc(it.title)}">${html}</div></div>`;
    if (ui.scrollToMove) {
      const el = document.getElementById('move');
      if (el) el.scrollIntoView({ block: 'start' });
      ui.scrollToMove = false;
    }
  }

  // ---------- Vue : Allures ----------
  function renderPaces() {
    const c = plan.c;
    const zones = P.ZONES.map((z) => {
      const color = { recup: 'var(--k-easy)', ef: 'var(--k-easy)', marathon: 'var(--k-long)', seuil: 'var(--ph-construction)', a10k: 'var(--k-quality)', a5k: 'var(--k-quality)', vma: 'var(--ph-specifique)' }[z.id];
      return `<tr><td><span class="zone-swatch" style="background:${color}"></span><b>${z.label}</b><div class="muted small">${esc(z.desc)}</div></td>
        <td class="num">${P.zoneRange(c.vma, z.id)}</td><td class="r num">${Math.round(z.lo * 100)}-${Math.round(z.hi * 100)} %</td><td class="r">${z.rpe}</td></tr>`;
    }).join('');
    const preds = [[5, '5 km'], [10, '10 km'], [21.1, 'Semi'], [42.195, 'Marathon']].map(([d, l]) => {
      const t = P.predictTime(c.vma, d);
      return `<tr><td>${l}</td><td class="r num">${U.fmtTime(t)}</td><td class="r num">${P.fmtPace((t * 60) / d)}/km</td></tr>`;
    }).join('');
    return `<div class="card"><h2>Ta VMA : ${U.round1(c.vma)} km/h</h2><p class="muted small" style="margin:0">${esc(c.vmaSource)}.</p>
      ${!c.trail ? `<p style="margin:10px 0 0">Allure course utilisée : <b class="num">${c.pace('race')}</b>${c.targetCapped ? ' (plafonnée, objectif trop ambitieux pour l\'instant)' : ''}</p>` : '<p class="muted small" style="margin:10px 0 0">En trail, on s\'entraîne à l\'effort plutôt qu\'à l\'allure : les allures ci-dessous valent sur terrain plat.</p>'}
      </div>
      <div class="card"><h2>Zones d'entraînement</h2><div style="overflow-x:auto"><table><thead><tr><th>Zone</th><th>Allure</th><th class="r">% VMA</th><th class="r">Effort</th></tr></thead><tbody>${zones}</tbody></table></div></div>
      <div class="card"><h2>Temps prédits sur route</h2><table><thead><tr><th>Distance</th><th class="r">Temps</th><th class="r">Allure</th></tr></thead><tbody>${preds}</tbody></table>
      <p class="muted small">Prédictions théoriques pour une préparation spécifique. Pour affiner, mets à jour ta course de référence dans ton profil.</p></div>`;
  }

  // ---------- Vue : Exercices ----------
  function renderLibrary() {
    const q = ui.search.trim().toLowerCase();
    const match = (e) => !q || `${e.name} ${e.how}`.toLowerCase().includes(q);
    const groups = [
      ['Renforcement', RP.EXERCISES.filter((e) => e.cat === 'force')],
      ['Gainage', RP.EXERCISES.filter((e) => e.cat === 'gainage')],
      ['Pliométrie', RP.EXERCISES.filter((e) => e.cat === 'plio')],
      ['Prévention ciblée', RP.EXERCISES.filter((e) => e.cat === 'prev')],
      ['Mobilité', RP.MOBILITY],
    ];
    let html = `<input class="search" type="search" placeholder="Rechercher un exercice" value="${esc(ui.search)}" data-action="search" aria-label="Rechercher un exercice">`;
    let any = false;
    groups.forEach(([title, list]) => {
      const items = list.filter(match);
      if (!items.length) return;
      any = true;
      html += `<div class="section-title">${title}</div><div class="card" style="padding:4px 16px"><ul class="ex-list" style="margin:0">${items.map((e) => {
        const meta = [];
        if (e.eq) meta.push(RP.EQUIP_LABELS[e.eq]);
        if (e.zones && e.zones.length) meta.push(e.zones.map((z) => RP.INJURY_ZONES[z].split(' (')[0]).join(', '));
        if (e.dose && !e.cat) meta.push(e.dose);
        return `<li style="border-top:0;border-bottom:1px solid var(--border)"><details><summary><span class="ex-name">${esc(e.name)}</span><span class="ex-dose">${esc(meta.join(' · '))}</span></summary><div class="ex-how">${esc(e.how)}</div></details></li>`;
      }).join('')}</ul></div>`;
    });
    if (!any) html += '<div class="empty">Aucun exercice ne correspond.</div>';
    return html;
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
        ${state.lastSyncMsg ? `<p class="muted small" style="margin:0 0 8px">${esc(state.lastSyncMsg)}</p>` : ''}
        <div class="btn-group"><button class="btn primary" data-action="strava-sync" ${ui.syncing ? 'disabled' : ''}>${icon('sync')}${ui.syncing ? 'Synchro en cours…' : 'Synchroniser maintenant'}</button>
        <button class="btn" data-action="strava-disconnect">Déconnecter</button></div>
        <p class="muted small">La synchro se lance aussi toute seule à l'ouverture de l'appli (au plus toutes les 30 min).</p>`;
    } else if (cfg.clientId && cfg.clientSecret) {
      strava = `<p style="margin:0 0 8px">Application Strava enregistrée (Client ID ${esc(cfg.clientId)}).</p>
        <div class="btn-group"><button class="btn primary" data-action="strava-connect">Connecter mon compte Strava</button><button class="btn" data-action="strava-forget">Changer d'application</button></div>`;
    } else {
      strava = `<ol class="blocks small">
          <li>Sur <a href="https://www.strava.com/settings/api" target="_blank" rel="noopener">strava.com/settings/api</a>, crée une application : nom « RunwoW », catégorie « Training », site web <code>http://${esc(host)}</code>, <b>Authorization Callback Domain : <code>${esc(host)}</code></b>.</li>
          <li>Copie ci-dessous le <b>Client ID</b> et le <b>Client Secret</b> affichés par Strava.</li>
          <li>Clique sur « Connecter mon compte Strava » et autorise l'accès aux activités.</li></ol>
        <form class="form" data-form="strava"><div class="grid2">
          <div class="field"><label class="lbl" for="st-id">Client ID</label><input id="st-id" name="clientId" type="text" inputmode="numeric" autocomplete="off" required></div>
          <div class="field"><label class="lbl" for="st-secret">Client Secret</label><input id="st-secret" name="clientSecret" type="text" autocomplete="off" spellcheck="false" required></div>
        </div><button class="btn primary" type="submit">Enregistrer et connecter</button></form>
        <p class="muted small">C'est ta propre application Strava : l'identifiant et le secret restent sur cet appareil et ne sont pas inclus dans l'export de sauvegarde.</p>`;
    }
    return `<div class="card"><h2>${icon('watch')} Montre Garmin</h2>
        <p class="muted small" style="margin-top:0">Chaque séance de course s'exporte en entraînement structuré (étapes, répétitions, allures cibles avec alerte).</p>
        <ol class="blocks small"><li>Télécharge les séances de la semaine (.zip) et décompresse-le, ou une séance seule depuis sa fiche (.FIT).</li>
          <li>Branche la montre en USB et copie les fichiers <code>.fit</code> dans le dossier <code>GARMIN/NewFiles</code>.</li>
          <li>Débranche la montre : les séances apparaissent dans Entraînement › Entraînements.</li></ol>
        <div class="btn-group"><button class="btn" data-action="fit-week" data-week="${wi}">${icon('download')}Semaine en cours</button>
        ${plan.weeks[wi + 1] ? `<button class="btn" data-action="fit-week" data-week="${wi + 1}">${icon('download')}Semaine suivante</button>` : ''}</div>
        <p class="muted small">Le renfo et la mobilité restent dans RunwoW. En trail, les montées et les footings se font à l'effort, donc sans allure cible.</p></div>
      <div class="card"><h2>${icon('sync')} Strava</h2>
        <p class="muted small" style="margin-top:0">Tes sorties cochent automatiquement les séances (règle R7). Active d'abord dans Garmin Connect l'envoi automatique vers Strava (Applications partenaires).</p>
        ${strava}</div>`;
  }

  // ---------- Vue : Plus ----------
  function renderMore() {
    const rules = RP.RULES.map((g, i) => `<details ${i === 0 ? '' : ''}><summary>${esc(g.group)}</summary><dl>${g.items.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></details>`).join('');
    const log = state.log.slice(0, 12).map((l) => `<li><span class="muted small num">${esc(U.fmtDateShort(U.parseDate(l.date)))}</span> · ${esc(l.msg)}</li>`).join('');
    const t = U.todayISO();
    return `${renderSyncCard()}<div class="card"><h2>Coupure (maladie, blessure, vacances)</h2>
        <p class="muted small" style="margin-top:0">Déclare les jours sans course : le plan applique la règle de reprise R4 à ton retour.</p>
        <form class="form" data-form="break"><div class="grid2">
          <div class="field"><label class="lbl" for="br-from">Du</label><input id="br-from" name="from" type="date" required value="${t}"></div>
          <div class="field"><label class="lbl" for="br-to">Au (inclus)</label><input id="br-to" name="to" type="date" required value="${t}"></div>
        </div><button class="btn primary" type="submit">Appliquer la règle de reprise</button></form></div>
      <div class="card rules"><h2>Les règles du plan</h2><p class="muted small" style="margin-top:0">Aucune IA : le plan est calculé uniquement avec les règles ci-dessous. Mêmes entrées, même plan.</p>${rules}</div>
      ${log ? `<div class="card"><h2>Journal des ajustements</h2><ul class="notes" style="color:var(--text)">${log}</ul></div>` : ''}
      <div class="card"><h2>Mon profil</h2><p class="muted small" style="margin-top:0">Objectif, jours disponibles, matériel, zones fragiles…</p><a class="btn" href="#/profil">Modifier mon profil</a></div>
      <div class="card"><h2>Mes données</h2><p class="muted small" style="margin-top:0">Tout est enregistré sur cet appareil uniquement. Exporte une sauvegarde pour changer de téléphone.</p>
        <div class="btn-group"><button class="btn" data-action="export">Exporter (JSON)</button>
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
    const p = state.profile || {
      distanceKm: 10, terrain: 'route', dplus: '', raceDate: '', startDate: nextMonday(), targetTime: '', raceName: '',
      level: 'intermediaire', currentKm: 20, longestKm: 10, refDistKm: '', refTime: '', vma: '',
      runDays: [1, 3, 6], longDay: 6, strengthPerWeek: 2, equipment: 'aucun', mobility: '3x', injuries: [],
    };
    const editing = !!state.profile;
    const radio = (name, value, label, checked) => `<label><input type="radio" name="${name}" value="${value}" ${checked ? 'checked' : ''}>${label}</label>`;
    const check = (name, value, label, checked) => `<label><input type="checkbox" name="${name}" value="${value}" ${checked ? 'checked' : ''}>${label}</label>`;
    const errors = ui.setupErrors.length ? `<div class="banner warn">${icon('warn')}<div>${ui.setupErrors.map(esc).join('<br>')}</div></div>` : '';
    return `<div class="hero">${editing ? '<a class="btn small" href="#/plan" style="margin-bottom:12px">← Retour</a>' : ''}
        <h1>${editing ? 'Mon profil' : 'Ton plan sur mesure'}</h1>
        <p>${editing ? 'Le plan est recalculé à l\'enregistrement. Ton suivi est conservé, sauf si tu changes la date de début.' : 'Course, renforcement et mobilité dans un seul plan, calculé par des règles fixes et transparentes.'}</p></div>
      <form class="form" data-form="setup" novalidate>
      ${errors}
      <div class="card"><h2>Objectif</h2>
        <div class="field"><div class="choices" role="group" aria-label="Distances courantes">${PRESETS.map(([l, d, t]) => `<button type="button" class="btn small" data-action="preset" data-dist="${d}" data-terrain="${t}">${l}</button>`).join('')}</div></div>
        <div class="grid2">
          <div class="field"><label class="lbl" for="f-dist">Distance (km)</label><input id="f-dist" name="distanceKm" type="number" min="1" max="400" step="0.1" required value="${esc(p.distanceKm)}"></div>
          <div class="field"><label class="lbl" for="f-terrain">Terrain</label><select id="f-terrain" name="terrain"><option value="route" ${p.terrain === 'route' ? 'selected' : ''}>Route / piste</option><option value="trail" ${p.terrain === 'trail' ? 'selected' : ''}>Trail / nature</option></select></div>
        </div>
        <div class="field" data-show="trail" ${p.terrain === 'trail' ? '' : 'hidden'}><label class="lbl" for="f-dplus">Dénivelé positif (m)</label><input id="f-dplus" name="dplus" type="number" min="0" step="10" value="${esc(p.dplus)}"></div>
        <div class="grid2">
          <div class="field"><label class="lbl" for="f-date">Date de la course</label><input id="f-date" name="raceDate" type="date" required value="${esc(p.raceDate)}"></div>
          <div class="field"><label class="lbl" for="f-start">Début du plan</label><input id="f-start" name="startDate" type="date" required value="${esc(p.startDate)}"><div class="hint">Le plan démarre le lundi de cette semaine.</div></div>
        </div>
        <div class="grid2">
          <div class="field"><label class="lbl" for="f-name">Nom de la course <span class="muted">(facultatif)</span></label><input id="f-name" name="raceName" type="text" maxlength="60" value="${esc(p.raceName)}"></div>
          <div class="field" data-show="route" ${p.terrain === 'trail' ? 'hidden' : ''}><label class="lbl" for="f-target">Objectif de temps <span class="muted">(facultatif)</span></label><input id="f-target" name="targetTime" type="text" placeholder="ex. 49:30 ou 3:45:00" value="${esc(p.targetTime)}"></div>
        </div>
      </div>

      <div class="card"><h2>Ton niveau aujourd'hui</h2>
        <div class="field"><span class="lbl">Niveau</span><div class="choices">${radio('level', 'debutant', 'Débutant', p.level === 'debutant')}${radio('level', 'intermediaire', 'Intermédiaire', p.level === 'intermediaire')}${radio('level', 'confirme', 'Confirmé', p.level === 'confirme')}</div></div>
        <div class="grid2">
          <div class="field"><label class="lbl" for="f-cur">Volume actuel (km/semaine)</label><input id="f-cur" name="currentKm" type="number" min="0" max="250" required value="${esc(p.currentKm)}"><div class="hint">Moyenne des 4 dernières semaines. Le plan démarre ici.</div></div>
          <div class="field"><label class="lbl" for="f-long">Plus longue sortie récente (km)</label><input id="f-long" name="longestKm" type="number" min="0" max="100" value="${esc(p.longestKm)}"></div>
        </div>
        <div class="field"><span class="lbl">Course de référence récente <span class="muted">(pour calculer tes allures)</span></span>
          <div class="grid2"><input name="refDistKm" type="number" min="1" max="100" step="0.1" placeholder="Distance (km), ex. 10" aria-label="Distance de référence (km)" value="${esc(p.refDistKm)}">
          <input name="refTime" type="text" placeholder="Temps, ex. 48:30" aria-label="Temps de référence" value="${esc(p.refTime)}"></div>
          <div class="hint">Ou indique directement ta VMA :</div>
          <input name="vma" type="number" min="7" max="25" step="0.1" placeholder="VMA (km/h), facultatif" aria-label="VMA (km/h)" value="${esc(p.vma)}" style="margin-top:6px"></div>
      </div>

      <div class="card"><h2>Ta semaine</h2>
        <div class="field"><span class="lbl">Jours de course</span><div class="choices days">${U.DAYS_SHORT.map((d, i) => check('runDays', i, d, (p.runDays || []).map(Number).includes(i))).join('')}</div></div>
        <div class="field"><label class="lbl" for="f-longday">Jour de la sortie longue</label><select id="f-longday" name="longDay">${U.DAYS.map((d, i) => `<option value="${i}" ${+p.longDay === i ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div class="field"><span class="lbl">Séances de renfo par semaine</span><div class="choices">${[0, 1, 2, 3].map((n) => radio('strengthPerWeek', n, n, +p.strengthPerWeek === n)).join('')}</div><div class="hint">2 recommandées, placées automatiquement les bons jours. Une 3e n'est ajoutée que si un jour de ta semaine respecte les règles (jamais la veille d'une séance dure).</div></div>
        <div class="field"><label class="lbl" for="f-eq">Matériel</label><select id="f-eq" name="equipment">${RP.EQUIP_LEVELS.map((e) => `<option value="${e}" ${p.equipment === e ? 'selected' : ''}>${RP.EQUIP_LABELS[e]}</option>`).join('')}</select></div>
        <div class="field"><span class="lbl">Mobilité</span><div class="choices">${radio('mobility', 'minimum', 'Minimum', p.mobility === 'minimum')}${radio('mobility', '3x', '3 fois / semaine', p.mobility === '3x')}${radio('mobility', 'quotidien', 'Tous les jours', p.mobility === 'quotidien')}</div></div>
      </div>

      <div class="card"><h2>Zones fragiles</h2><p class="muted small" style="margin-top:0">Des exercices de prévention ciblés seront ajoutés au renfo et à la mobilité.</p>
        <div class="choices">${Object.entries(RP.INJURY_ZONES).map(([k, l]) => check('injuries', k, l, (p.injuries || []).includes(k))).join('')}</div>
      </div>
      <p class="muted small" style="padding:0 4px">${esc(RP.DISCLAIMER)}</p>
      <button class="btn primary" type="submit" style="width:100%;min-height:48px;margin-bottom:24px">${editing ? 'Enregistrer et recalculer' : 'Générer mon plan'}</button>
      </form>`;
  }

  function initSetup() {
    const form = document.querySelector('[data-form="setup"]');
    if (!form) return;
    const sync = () => {
      const trail = form.terrain.value === 'trail';
      form.querySelectorAll('[data-show="trail"]').forEach((el) => { el.hidden = !trail; });
      form.querySelectorAll('[data-show="route"]').forEach((el) => { el.hidden = trail; });
    };
    form.terrain.addEventListener('change', sync);
  }

  function readSetup(form) {
    const fd = new FormData(form);
    const num = (k) => (fd.get(k) === '' || fd.get(k) == null ? '' : +fd.get(k));
    return {
      distanceKm: num('distanceKm'), terrain: fd.get('terrain'), dplus: num('dplus'), raceDate: fd.get('raceDate'),
      startDate: fd.get('startDate'), targetTime: (fd.get('targetTime') || '').trim(), raceName: (fd.get('raceName') || '').trim(),
      level: fd.get('level') || 'intermediaire', currentKm: num('currentKm'), longestKm: num('longestKm'),
      refDistKm: num('refDistKm'), refTime: (fd.get('refTime') || '').trim(), vma: num('vma'),
      runDays: fd.getAll('runDays').map(Number), longDay: +fd.get('longDay'), strengthPerWeek: +fd.get('strengthPerWeek') || 0,
      equipment: fd.get('equipment'), mobility: fd.get('mobility') || '3x', injuries: fd.getAll('injuries'),
    };
  }

  function validate(p) {
    const e = [];
    if (!(p.distanceKm > 0)) e.push('Indique la distance de la course.');
    if (!p.raceDate) e.push('Indique la date de la course.');
    if (!p.startDate) e.push('Indique la date de début du plan.');
    if (p.raceDate && p.startDate && p.raceDate <= p.startDate) e.push('La course doit avoir lieu après le début du plan.');
    if (p.raceDate && p.startDate && U.daysBetween(U.mondayOf(U.parseDate(p.startDate)), U.parseDate(p.raceDate)) > 52 * 7) e.push('Le plan est limité à 52 semaines : rapproche la date de début.');
    if (p.runDays.length < 2) e.push('Choisis au moins 2 jours de course.');
    if (!p.runDays.includes(p.longDay)) e.push('Le jour de la sortie longue doit faire partie de tes jours de course.');
    if (p.currentKm === '' || p.currentKm < 0) e.push('Indique ton volume actuel (0 si tu débutes).');
    if (p.refTime && !U.parseTime(p.refTime)) e.push('Temps de référence illisible : utilise le format 48:30 ou 1:45:00.');
    if (p.targetTime && !U.parseTime(p.targetTime)) e.push('Objectif de temps illisible : utilise le format 48:30 ou 1:45:00.');
    if (p.terrain === 'trail' && p.dplus === '') p.dplus = 0;
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
        const v = a.dataset.val;
        if (v) { state.statuses[a.dataset.id] = v; state.statusSource[a.dataset.id] = 'manual'; } else { delete state.statuses[a.dataset.id]; delete state.statusSource[a.dataset.id]; }
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
        form.terrain.dispatchEvent(new Event('change'));
        break;
      }
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
      case 'export': {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `runwow-sauvegarde-${U.todayISO()}.json`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        break;
      }
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
      if (errs.length) { render(); window.scrollTo(0, 0); return; }
      const first = !state.profile;
      // Le suivi est indexé par semaine : si le début du plan change, il ne correspond plus.
      if (!first && U.fmtISO(U.mondayOf(U.parseDate(state.profile.startDate))) !== U.fmtISO(U.mondayOf(U.parseDate(p.startDate)))) {
        if (!confirm('La date de début change : ton suivi (séances cochées, ajustements) sera remis à zéro. Continuer ?')) return;
        Object.assign(state, { statuses: {}, overrides: {}, moves: {}, downgrades: {}, evaluated: {}, breaks: [] });
        state.log.unshift({ date: U.todayISO(), rule: '-', msg: 'Nouveau plan : suivi remis à zéro.' });
      }
      state.profile = p;
      saveState();
      regen();
      if (planError) { ui.setupErrors = [planError]; render(); return; }
      location.hash = '#/plan';
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
      const from = form.from.value;
      const to = form.to.value;
      try {
        const msgs = RP.replan.applyBreak(plan, state, from, to);
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

  window.addEventListener('hashchange', () => { ui.modalId = null; ui.setupErrors = []; render(); window.scrollTo(0, 0); });

  // ---------- Démarrage ----------
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
