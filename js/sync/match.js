/* R7 : rapprochement des sorties Strava avec les séances du plan (règles fixes). */
(function (RP) {
  const U = RP.U;
  const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun', 'Treadmill']);
  const DONE = 0.8;    // ≥ 80 % de la distance prévue : fait
  const PARTIAL = 0.4; // 40 à 80 % : partiel ; en dessous : la sortie ne compte pas

  // Recalcule entièrement les statuts venant de Strava (les statuts saisis à la main sont prioritaires).
  function apply(plan, state, { sinceISO, todayISO }) {
    state.statusSource = state.statusSource || {};
    state.syncInfo = {};
    Object.keys(state.statusSource).forEach((id) => {
      if (state.statusSource[id] === 'strava') { delete state.statuses[id]; delete state.statusSource[id]; }
    });
    const manual = (id) => state.statuses[id] && state.statusSource[id] !== 'strava';
    const report = { done: 0, partial: 0, missed: 0, ignored: 0, offPlan: 0 };

    // Sorties de course regroupées par jour (plusieurs sorties le même jour s'additionnent)
    const byDate = {};
    Object.values(state.activities || {}).forEach((a) => {
      if (!RUN_TYPES.has(a.type) || a.date < plan.planStart || a.date > plan.raceDate) return;
      const g = byDate[a.date] || (byDate[a.date] = { km: 0, elev: 0, names: [], ids: [] });
      g.km += a.km;
      g.elev += a.elev || 0;
      g.names.push(a.name);
      g.ids.push(a.id);
    });

    const runsOfWeek = (w) => w.days.flatMap((d) => d.items.filter((i) => i.kind === 'run'));
    const used = new Set();
    Object.keys(byDate).sort().forEach((date) => {
      const g = byDate[date];
      const w = plan.weeks.find((x) => date >= x.start && date <= x.end);
      if (!w) return;
      const runs = runsOfWeek(w).filter((i) => !used.has(i.id) && !manual(i.id));
      // Même jour d'abord ; sinon une séance de la veille ou du lendemain qui n'a pas sa propre sortie
      let it = runs.find((i) => i.date === date);
      if (!it) {
        it = runs.find((i) => Math.abs(U.daysBetween(U.parseDate(i.date), U.parseDate(date))) === 1 && !byDate[i.date]);
      }
      if (!it) { report.offPlan++; return; }
      const km = plan.c.trail ? g.km + g.elev / 100 : g.km;
      const ratio = it.km ? km / it.km : 1;
      used.add(it.id);
      state.syncInfo[it.id] = { km: U.round1(km), names: g.names, ids: g.ids, date, ratio };
      if (ratio >= DONE || it.sub === 'race') { state.statuses[it.id] = 'done'; report.done++; } else if (ratio >= PARTIAL) { state.statuses[it.id] = 'partial'; report.partial++; } else { report.ignored++; return; }
      state.statusSource[it.id] = 'strava';
    });

    // Séance passée depuis 2 jours, sans sortie ni saisie : ratée (seulement depuis la connexion à Strava)
    const limit = U.fmtISO(U.addDays(U.parseDate(todayISO), -2));
    plan.weeks.forEach((w) => runsOfWeek(w).forEach((it) => {
      if (it.sub === 'race' || state.statuses[it.id] || it.date < sinceISO || it.date > limit) return;
      state.statuses[it.id] = 'missed';
      state.statusSource[it.id] = 'strava';
      report.missed++;
    }));
    return report;
  }

  RP.match = { apply, RUN_TYPES, DONE, PARTIAL };
})(window.RP);
