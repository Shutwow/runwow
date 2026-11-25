/* Recalcul du plan : règles fixes appliquées quand la réalité s'écarte du plan. */
(function (RP) {
  const U = RP.U;

  // Coupure (maladie, blessure, vacances) : reprise selon la durée de l'arrêt.
  const BREAK_RULES = [
    { maxDays: 3, factor: null, noQualityWeeks: 0 },
    { maxDays: 7, factor: 0.7, noQualityWeeks: 1 },
    { maxDays: 14, factor: 0.5, noQualityWeeks: 1 },
    { maxDays: 28, factor: 0.4, noQualityWeeks: 2 },
    { maxDays: Infinity, factor: 0.3, noQualityWeeks: 2, warn: true },
  ];

  const runItems = (week) => week.days.flatMap((d) => d.items.filter((i) => i.kind === 'run' && i.sub !== 'race'));

  function weekCompletion(week, statuses) {
    let planned = 0;
    let done = 0;
    let marked = 0;
    let total = 0;
    runItems(week).forEach((it) => {
      const st = statuses[it.id];
      if (st === 'break') return;
      total++;
      planned += it.km || 0;
      if (st) {
        marked++;
        if (st === 'done') done += it.km || 0;
        else if (st === 'partial') done += (it.km || 0) * 0.5;
      }
    });
    return { planned, done, marked, total, complete: total > 0 && marked === total, ratio: planned ? done / planned : 1 };
  }

  function mergeOverride(state, i, ov) {
    const cur = state.overrides[i];
    if (!cur) { state.overrides[i] = ov; return; }
    const caps = [cur.cap, ov.cap].filter((x) => x != null);
    const factors = [cur.capFactor, ov.capFactor].filter((x) => x != null);
    state.overrides[i] = {
      cap: caps.length ? Math.min(...caps) : undefined,
      capFactor: factors.length ? Math.min(...factors) : undefined,
      noQuality: !!(cur.noQuality || ov.noQuality),
      reason: [cur.reason, ov.reason].filter(Boolean).join(' '),
    };
  }

  // R1-R3 : appliquées automatiquement dès que toutes les séances de course d'une semaine sont renseignées.
  function evaluateWeeks(plan, state) {
    const changes = [];
    state.evaluated = state.evaluated || {};
    state.overrides = state.overrides || {};
    const statuses = state.statuses || {};
    plan.weeks.forEach((w, i) => {
      if (state.evaluated[i] || w.type === 'race') return;
      const comp = weekCompletion(w, statuses);
      if (!comp.complete) return;
      const pct = Math.round(comp.ratio * 100);
      const next = plan.weeks[i + 1];
      let rule = 'R1';
      let msg;
      if (comp.ratio >= 0.8) {
        msg = `Semaine ${i + 1} réalisée à ${pct} % : le plan continue sans changement.`;
      } else if (!next || next.type === 'race') {
        msg = `Semaine ${i + 1} réalisée à ${pct} % : la semaine de course n'est jamais modifiée.`;
      } else if (comp.ratio >= 0.5) {
        rule = 'R2';
        const cap = U.round1(comp.done * 1.1);
        msg = `Semaine ${i + 1} réalisée à ${pct} % : la semaine ${i + 2} est plafonnée à ${cap} km (réalisé + 10 %), sans rattrapage des séances manquées.`;
        mergeOverride(state, i + 1, { cap, reason: `Règle R2 : ${msg}` });
      } else {
        rule = 'R3';
        const cap = U.round1(Math.max(comp.done * 1.1, comp.planned * 0.5));
        msg = `Semaine ${i + 1} réalisée à ${pct} % : la semaine ${i + 2} devient une semaine de reprise (${cap} km, sans séance de qualité).`;
        mergeOverride(state, i + 1, { cap, noQuality: true, reason: `Règle R3 : ${msg}` });
      }
      state.evaluated[i] = { rule, ratio: comp.ratio, at: U.todayISO() };
      changes.push({ week: i, rule, msg });
    });
    return changes;
  }

  // R4 : coupure déclarée (dates incluses).
  function applyBreak(plan, state, fromISO, toISO) {
    const from = U.parseDate(fromISO);
    const to = U.parseDate(toISO);
    const days = U.daysBetween(from, to) + 1;
    if (!(days > 0)) throw new Error('La date de fin doit être après la date de début.');
    state.statuses = state.statuses || {};
    state.overrides = state.overrides || {};
    state.evaluated = state.evaluated || {};
    plan.weeks.forEach((w) => w.days.forEach((d) => {
      const dt = U.parseDate(d.date);
      if (dt >= from && dt <= to) d.items.forEach((it) => { if (it.kind === 'run' && it.sub !== 'race') state.statuses[it.id] = 'break'; });
    }));
    const rule = BREAK_RULES.find((r) => days <= r.maxDays);
    const ret = U.addDays(to, 1);
    const weekOf = (dt) => plan.weeks.findIndex((w) => dt >= U.parseDate(w.start) && dt <= U.parseDate(w.end));
    const retWeek = weekOf(ret);
    const startWeek = Math.max(0, weekOf(from));
    const msgs = [];
    if (rule.factor == null) {
      msgs.push(`Coupure de ${days} jour(s) : moins de 4 jours, le plan reprend normalement, sans rattrapage.`);
    } else if (retWeek < 0) {
      msgs.push('Le retour est prévu après la course : rien à recalculer.');
    } else {
      const base = Math.max(...plan.weeks.slice(Math.max(0, startWeek - 1), startWeek + 1).map((w) => w.volume));
      const cap = U.round1(base * rule.factor);
      const reason = `Règle R4 : coupure de ${days} jours, reprise à ${Math.round(rule.factor * 100)} % du volume (${cap} km) sans séance de qualité.`;
      if (plan.weeks[retWeek].type !== 'race') mergeOverride(state, retWeek, { cap, noQuality: true, reason });
      msgs.push(reason);
      if (rule.noQualityWeeks >= 2 && plan.weeks[retWeek + 1] && plan.weeks[retWeek + 1].type !== 'race') {
        mergeOverride(state, retWeek + 1, { noQuality: true, reason: 'Règle R4 : 2e semaine de reprise sans séance de qualité.' });
        msgs.push('La semaine suivante reste sans séance de qualité.');
      }
      for (let i = startWeek; i < retWeek; i++) state.evaluated[i] = { rule: 'R4' };
      const taperStart = plan.weeks.findIndex((w) => w.phase === 'affutage');
      if (taperStart >= 0 && retWeek >= taperStart - 1) msgs.push('Attention : la reprise tombe juste avant l\'affûtage. Revois ton objectif de temps à la baisse.');
      if (rule.warn) msgs.push('Coupure de plus de 4 semaines : l\'objectif est probablement à repousser. Tu peux recréer un plan depuis les réglages.');
    }
    state.breaks = state.breaks || [];
    state.breaks.push({ from: fromISO, to: toISO, days });
    return msgs;
  }

  // R5 : jours où une séance peut être déplacée (même semaine, jamais dans le passé).
  function moveOptions(plan, weekIndex, itemId, todayISO) {
    const w = plan.weeks[weekIndex];
    const all = w.days.flatMap((d) => d.items);
    const it = all.find((x) => x.id === itemId);
    if (!it || it.sub === 'race') return [];
    const others = all.filter((x) => x !== it);
    const hardOn = (d) => others.some((x) => x.day === d && x.kind === 'run' && x.hard);
    const runOn = (d) => others.some((x) => x.day === d && x.kind === 'run');
    const longOn = (d) => others.some((x) => x.day === d && x.sub === 'long');
    const qualOn = (d) => others.some((x) => x.day === d && x.sub === 'quality' && x.hard);
    const strengthOn = (d) => others.some((x) => x.day === d && x.kind === 'strength');
    const race = others.find((x) => x.sub === 'race');
    const opts = [];
    for (let d = 0; d < 7; d++) {
      if (d === it.day) continue;
      if (todayISO && w.days[d].date < todayISO) continue;
      if (race && d >= race.day) continue;
      if (it.kind === 'run') {
        if (runOn(d)) continue;
        if (it.hard && (hardOn(d - 1) || hardOn(d + 1))) continue;
        if (it.hard && race && race.day - d < 3) continue;
      } else if (it.kind === 'strength') {
        if (longOn(d) || longOn(d + 1) || qualOn(d + 1)) continue;
        if (strengthOn(d) || strengthOn(d - 1) || strengthOn(d + 1)) continue;
        if (race && race.day - d < RP.plan.RULE.strengthRaceGap) continue;
      } else if (it.kind === 'mobility') {
        if (others.some((x) => x.day === d && x.kind === 'mobility')) continue;
      }
      opts.push(d);
    }
    return opts;
  }

  RP.replan = { BREAK_RULES, weekCompletion, evaluateWeeks, applyBreak, moveOptions, mergeOverride };
})(window.RP);
