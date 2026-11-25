/* Ajustement des allures d'après les sorties Strava (règles fixes R8 à R10).
   R8 : une course plus rapide que la VMA actuelle met la VMA à jour.
   R9 : 3 séances de qualité de suite nettement plus rapides => VMA +2 % ; nettement plus lentes => proposition de -2 %.
   R10 : footings trop rapides => conseil (le plan ne change pas). */
(function (RP) {
  const U = RP.U;
  const P = RP.paces;

  const RULES = {
    raceMinKm: 3,        // course d'au moins 3 km…
    raceMinMin: 10,      // … et 10 min
    flatMax: 15,         // sorties « plates » : moins de 15 m de D+ par km
    raceMinGain: 0.005,  // la course doit donner une VMA au moins 0,5 % plus haute
    qStreak: 3,          // 3 séances de qualité consécutives
    qFast: 1.05,         // ≥ 5 % plus rapides que prévu
    qSlow: 0.93,         // ≥ 7 % plus lentes que prévu
    qStep: 0.02,         // pas d'ajustement : 2 %
    qMinRatio: 0.8,      // séance réalisée à 80 % au moins de la distance
    easyMargin: 1.03,    // footing trop rapide : plus de 3 % au-dessus du haut de l'endurance fondamentale
    easyWindow: 3,       // sur les 3 derniers footings…
    easyMin: 2,          // … au moins 2 trop rapides
    easyDays: 21,        // footings des 3 dernières semaines
  };

  const round1 = (x) => Math.round(x * 10) / 10;
  const flat = (x) => x.km > 0 && (x.elev || 0) / x.km < RULES.flatMax;

  // Séances du plan rapprochées d'une sortie Strava, dans l'ordre chronologique.
  function matchedSessions(plan, state) {
    const out = [];
    plan.weeks.forEach((w) => w.days.forEach((d) => d.items.forEach((it) => {
      const si = state.syncInfo && state.syncInfo[it.id];
      if (!si || !si.ids || it.kind !== 'run') return;
      const acts = si.ids.map((id) => (state.activities || {})[id]).filter(Boolean);
      if (!acts.length) return;
      const km = acts.reduce((t, a) => t + a.km, 0);
      const min = acts.reduce((t, a) => t + a.min, 0);
      const elev = acts.reduce((t, a) => t + (a.elev || 0), 0);
      if (min > 0) out.push({ it, km, min, elev, date: si.date, ratio: si.ratio, speed: km / (min / 60) });
    })));
    return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  function evaluate(plan, state, todayISO) {
    const c = plan.c;
    const ad = state.adapt || {};
    const current = round1(c.vma);
    const res = { update: null, suggestion: null, easy: null, seenRaces: [] };

    // R8 : courses marquées « course » dans Strava, depuis le début du plan
    const applied = new Set(ad.applied || []);
    const races = Object.values(state.activities || {}).filter((a) => a.race && a.date >= plan.planStart && a.date <= todayISO
      && !applied.has(a.id) && a.km >= RULES.raceMinKm && a.min >= RULES.raceMinMin && flat(a));
    res.seenRaces = races.map((a) => a.id);
    let best = null;
    races.forEach((a) => { const v = P.estimateVma(a.km, a.min); if (!best || v > best.vma) best = { vma: v, a }; });
    if (best && best.vma > current * (1 + RULES.raceMinGain) && best.vma < 25) {
      const to = round1(best.vma);
      res.update = { vma: to, rule: 'R8', msg: `Course « ${best.a.name || 'sans nom'} » (${best.a.km} km en ${U.fmtTime(best.a.min)}) : VMA ${current} → ${to} km/h, allures recalculées.` };
    }

    if (c.trail) return res; // en trail, les allures dépendent trop du terrain

    const since = ad.lastChange && ad.lastChange > plan.planStart ? ad.lastChange : plan.planStart;
    const list = matchedSessions(plan, state).filter((x) => x.date >= since && x.date <= todayISO && flat(x));

    // R9 : séances de qualité
    const q = list.filter((x) => x.it.sub === 'quality' && x.it.hard && !x.it.downgraded && x.ratio >= RULES.qMinRatio && x.it.min > 0);
    const lastQ = q.slice(-RULES.qStreak);
    if (lastQ.length === RULES.qStreak) {
      const rs = lastQ.map((x) => x.speed / (x.it.km / (x.it.min / 60)));
      const avg = rs.reduce((t, r) => t + r, 0) / rs.length;
      if (rs.every((r) => r >= RULES.qFast) && !res.update) {
        const to = round1(current * (1 + RULES.qStep));
        res.update = { vma: to, rule: 'R9', msg: `Tes 3 dernières séances de qualité ont été courues ${Math.round((avg - 1) * 100)} % plus vite que prévu : VMA ${current} → ${to} km/h, allures recalculées.` };
      } else if (rs.every((r) => r <= RULES.qSlow)) {
        const to = round1(current * (1 - RULES.qStep));
        res.suggestion = { vma: to, key: lastQ.map((x) => x.it.id).join(','),
          msg: `Tes 3 dernières séances de qualité ont été ${Math.round((1 - avg) * 100)} % plus lentes que prévu. Baisser ta VMA de 2 % (${current} → ${to} km/h) rendrait les allures plus réalistes.` };
      }
    }

    // R10 : footings trop rapides (conseil uniquement)
    const from = U.fmtISO(U.addDays(U.parseDate(todayISO), -RULES.easyDays));
    const easy = list.filter((x) => x.it.sub === 'ef' && !x.it.downgraded && x.date >= from).slice(-RULES.easyWindow);
    const efMax = c.vma * P.ZONE_BY_ID.ef.hi * RULES.easyMargin;
    const fast = easy.filter((x) => x.speed > efMax);
    if (fast.length >= RULES.easyMin) {
      const sp = fast.reduce((t, x) => t + x.speed, 0) / fast.length;
      res.easy = { n: fast.length, of: easy.length, pace: P.fmtPaceKmh(sp), target: P.zoneRange(c.vma, 'ef') };
    }
    return res;
  }

  RP.adapt = { RULES, evaluate, matchedSessions };
})(window.RP);
