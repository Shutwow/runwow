/* Tests des règles du moteur : ouvre tests/index.html (via le serveur local) et lis le résultat. */
(function (RP) {
  const U = RP.U;
  const out = [];
  let pass = 0;
  let fail = 0;
  const failures = [];
  const stats = { maxDev: 0, maxIntensity: 0, plans: 0, weeks: 0, strengthNotPlaced: 0 };

  function check(cond, msg) {
    if (cond) pass++;
    else { fail++; if (failures.length < 60) failures.push(msg); }
  }

  const GOALS = [
    { distanceKm: 5, terrain: 'route' },
    { distanceKm: 10, terrain: 'route' },
    { distanceKm: 21.1, terrain: 'route' },
    { distanceKm: 42.2, terrain: 'route' },
    { distanceKm: 100, terrain: 'route' },
    { distanceKm: 25, terrain: 'trail', dplus: 1200 },
    { distanceKm: 50, terrain: 'trail', dplus: 2800 },
    { distanceKm: 110, terrain: 'trail', dplus: 6000 },
  ];
  const DAYSETS = [[5, 6], [1, 3, 6], [1, 3, 5, 6], [0, 1, 3, 4, 6], [0, 1, 2, 3, 4, 5, 6], [1, 2, 4, 5]];
  const LEVELS = [['debutant', 10], ['intermediaire', 30], ['confirme', 55]];
  const DURATIONS = [5, 12, 20, 30, 'T8', 'T12', 'T52']; // Tn = mode entraînement, cycle de n semaines
  const start = '2026-12-07'; // un lundi

  function profileFor(g, days, lvl, weeks, k) {
    const training = typeof weeks === 'string';
    const race = training ? '' : U.fmtISO(U.addDays(U.parseDate(start), weeks * 7 - 1 - (k % 3)));
    return {
      mode: training ? 'training' : 'race', trainingWeeks: training ? +weeks.slice(1) : undefined,
      ...g, raceDate: race, startDate: start, level: lvl[0], currentKm: lvl[1], longestKm: lvl[1] * 0.4,
      runDays: days, longDay: days.includes(6) ? 6 : days[days.length - 1], strengthPerWeek: k % 4,
      equipment: RP.EQUIP_LEVELS[k % 4], mobility: ['minimum', '3x', 'quotidien'][k % 3],
      injuries: k % 2 ? ['achille', 'genou'] : [], refDistKm: 10, refTime: ['55:00', '45:00', '38:00'][LEVELS.indexOf(lvl)],
    };
  }

  let k = 0;
  GOALS.forEach((g) => DAYSETS.forEach((days) => LEVELS.forEach((lvl) => DURATIONS.forEach((weeks) => {
    k++;
    const profile = profileFor(g, days, lvl, weeks, k);
    const tag = `[${g.distanceKm}${g.terrain === 'trail' ? 'T' : ''} ${lvl[0]} j=${days.join('')} ${weeks}s]`;
    let plan;
    try { plan = RP.plan.generate(profile, {}); } catch (e) { check(false, `${tag} exception ${e.message}`); return; }
    stats.plans++;
    stats.weeks += plan.weeks.length;
    const ids = new Set();
    // Race on race date
    const last = plan.weeks[plan.weeks.length - 1];
    const raceItem = last.days.flatMap((d) => d.items).find((i) => i.sub === 'race');
    if (profile.mode === 'training') {
      stats.trainingPlans = (stats.trainingPlans || 0) + 1;
      check(plan.nWeeks === profile.trainingWeeks, `${tag} durée du cycle`);
      check(!plan.weeks.some((w) => w.type === 'race' || w.type === 'taper'), `${tag} course ou affûtage en mode entraînement`);
      check(last.type === 'test', `${tag} la dernière semaine n'est pas un test`);
      plan.weeks.filter((w) => w.type === 'test').forEach((w) => {
        const tst = w.days.flatMap((d) => d.items).find((i) => i.qType === 'test');
        check(tst || w.notes.length, `${tag} S${w.index + 1} semaine test sans test`);
      });
    } else {
      check(raceItem && raceItem.date === profile.raceDate, `${tag} course absente ou mauvaise date`);
    }

    let prevLoad = null;
    let prevTaper = null;
    plan.weeks.forEach((w, wi) => {
      // Progression
      if (w.type === 'load') {
        if (prevLoad != null) check(w.volume <= prevLoad * 1.15 + 0.1, `${tag} S${wi + 1} progression ${prevLoad} -> ${w.volume}`);
        prevLoad = w.volume;
      }
      if (w.type === 'taper' || w.type === 'race') {
        if (prevTaper != null) check(w.volume <= prevTaper + 0.1, `${tag} S${wi + 1} affûtage non décroissant`);
        prevTaper = w.volume;
      }
      if (w.notes && w.notes.some((n) => n.includes('renfo'))) stats.strengthNotPlaced++;
      const items = w.days.flatMap((d) => d.items);
      items.forEach((it) => {
        check(!ids.has(it.id), `${tag} id dupliqué ${it.id}`);
        ids.add(it.id);
        if (it.kind === 'run') check(isFinite(it.km) && it.km > 0 && (it.min == null || isFinite(it.min)), `${tag} ${it.id} km/min invalides`);
      });
      const hardDays = w.days.filter((d) => d.items.some((i) => i.kind === 'run' && i.hard)).map((d) => d.day);
      const longDays = w.days.filter((d) => d.items.some((i) => i.sub === 'long')).map((d) => d.day);
      const qDays = w.days.filter((d) => d.items.some((i) => i.sub === 'quality' && i.hard)).map((d) => d.day);
      const sDays = w.days.filter((d) => d.items.some((i) => i.kind === 'strength')).map((d) => d.day);
      const runsPerDay = w.days.map((d) => d.items.filter((i) => i.kind === 'run').length);
      check(runsPerDay.every((n) => n <= 1), `${tag} S${wi + 1} deux courses le même jour`);
      if (w.type !== 'race') {
        // Deux séances dures consécutives interdites (sauf enchaînement ultra sortie longue 1 + 2)
        for (let a = 0; a < hardDays.length; a++) for (let b = a + 1; b < hardDays.length; b++) {
          const da = hardDays[a];
          const db = hardDays[b];
          if (Math.abs(da - db) === 1) {
            const pair = longDays.includes(da) && longDays.includes(db);
            check(pair, `${tag} S${wi + 1} séances dures consécutives ${U.DAYS_SHORT[da]}/${U.DAYS_SHORT[db]}`);
          }
        }
        qDays.forEach((d) => check(!longDays.includes(d + 1), `${tag} S${wi + 1} qualité la veille de la sortie longue`));
        // Renfo
        sDays.forEach((d) => {
          check(!longDays.includes(d) && !longDays.includes(d + 1), `${tag} S${wi + 1} renfo jour/veille de sortie longue`);
          check(!qDays.includes(d + 1), `${tag} S${wi + 1} renfo veille de qualité`);
        });
        for (let a = 0; a < sDays.length; a++) for (let b = a + 1; b < sDays.length; b++) check(!U.adjacent(sDays[a], sDays[b]), `${tag} S${wi + 1} renfo deux jours de suite`);
        if (w.type === 'load') check(qDays.length <= 2, `${tag} S${wi + 1} plus de 2 qualités`);
        if (w.type === 'recovery') check(qDays.length === 0, `${tag} S${wi + 1} qualité en semaine allégée`);
        const dev = Math.abs(w.km - w.volume) / w.volume;
        stats.maxDev = Math.max(stats.maxDev, dev);
        if (dev > 0.2) { stats.devOver20 = (stats.devOver20 || 0) + 1; if (!stats.devEx) stats.devEx = `${tag} S${wi + 1} ${w.type} ${w.volume}->${w.km}`; }
        if (w.type === 'load') {
          stats.maxIntensity = Math.max(stats.maxIntensity, w.pctIntensity);
          if (w.pctIntensity > 0.25) { stats.intOver25 = (stats.intOver25 || 0) + 1; if (!stats.intEx) stats.intEx = `${tag} S${wi + 1} ${Math.round(w.pctIntensity * 100)} %`; }
        }
      } else {
        const rd = raceItem.day;
        sDays.forEach((d) => check(rd - d >= RP.plan.RULE.strengthRaceGap, `${tag} renfo trop proche de la course`));
      }
    });
  }))));

  // ---- Recalcul ----
  const base = { distanceKm: 42.2, terrain: 'route', raceDate: '2027-04-04', startDate: '2026-12-07', level: 'intermediaire', currentKm: 35, longestKm: 16,
    runDays: [1, 3, 5, 6], longDay: 6, strengthPerWeek: 2, equipment: 'halteres', mobility: '3x', injuries: [], refDistKm: 10, refTime: '45:00' };
  const st = { overrides: {}, statuses: {}, moves: {}, downgrades: {}, evaluated: {} };
  let plan = RP.plan.generate(base, st);
  const runsOf = (w) => w.days.flatMap((d) => d.items.filter((i) => i.kind === 'run' && i.sub !== 'race'));
  runsOf(plan.weeks[0]).forEach((it) => { st.statuses[it.id] = 'done'; });
  let ch = RP.replan.evaluateWeeks(plan, st);
  check(ch.length === 1 && ch[0].rule === 'R1', 'R1 attendu sur semaine complète');
  const w2before = plan.weeks[2].volume;
  runsOf(plan.weeks[1]).forEach((it, i) => { st.statuses[it.id] = i === 0 ? 'done' : 'missed'; });
  ch = RP.replan.evaluateWeeks(plan, st);
  check(ch.length === 1 && ch[0].rule === 'R3', `R3 attendu, obtenu ${ch.map((c) => c.rule)}`);
  plan = RP.plan.generate(base, st);
  check(plan.weeks[2].type === 'reprise' && plan.weeks[2].volume < w2before, `R3 : semaine 3 en reprise (${plan.weeks[2].type} ${plan.weeks[2].volume} vs ${w2before})`);
  check(runsOf(plan.weeks[2]).every((i) => i.sub !== 'quality'), 'R3 : pas de qualité en reprise');
  check(plan.weeks[3].volume <= plan.weeks[2].volume * 1.15 + 0.1, 'R3 : progression repart du volume de reprise');

  const msgs = RP.replan.applyBreak(plan, st, plan.weeks[5].days[2].date, plan.weeks[6].days[4].date); // 10 jours
  plan = RP.plan.generate(base, st);
  check(plan.weeks[6].type === 'reprise' || plan.weeks[6].noQuality, `R4 : semaine de retour sans qualité (${plan.weeks[6].type})`);
  check(plan.weeks[6].volume <= Math.max(plan.weeks[4].volume, plan.weeks[5].volume) * 0.5 + 0.1, `R4 : reprise à 50 % (${plan.weeks[6].volume})`);
  out.push('Messages R4 : ' + msgs.join(' | '));

  // Déplacement : options valides
  const w8 = plan.weeks[8];
  const q = w8.days.flatMap((d) => d.items).find((i) => i.sub === 'quality');
  if (q) {
    const opts = RP.replan.moveOptions(plan, 8, q.id, null);
    opts.forEach((d) => {
      const hardAround = w8.days.filter((x) => Math.abs(x.day - d) === 1).some((x) => x.items.some((i) => i.kind === 'run' && i.hard && i.id !== q.id));
      check(!hardAround, `R5 : option ${U.DAYS_SHORT[d]} à côté d'une séance dure`);
    });
    out.push(`Options de déplacement S9 ${q.title} (${U.DAYS_SHORT[q.day]}) : ${opts.map((d) => U.DAYS_SHORT[d]).join(', ') || 'aucune'}`);
  }

  // ---- Export montre (.FIT) ----
  check(RP.zip.crc32(new TextEncoder().encode('123456789')) === 0xcbf43926, 'CRC32 ZIP incorrect');
  let fitCount = 0;
  ['route', 'trail'].forEach((terrain) => {
    const prof = { ...base, terrain, distanceKm: terrain === 'trail' ? 50 : 21.1, dplus: 2500 };
    const pl = RP.plan.generate(prof, {});
    pl.weeks.forEach((w) => w.days.forEach((d) => d.items.forEach((it) => {
      if (!RP.fit.canExport(it)) return;
      fitCount++;
      const bytes = RP.fit.encodeWorkout(it, w, pl.c);
      const dec = RP.fit.decode(bytes);
      const tag = `[FIT ${it.id} ${it.title}]`;
      check(dec.headerOk && dec.crcOk, `${tag} en-tête ou CRC invalide`);
      const fid = dec.messages.find((m) => m.global === 0);
      const wk = dec.messages.find((m) => m.global === 26);
      const steps = dec.messages.filter((m) => m.global === 27);
      check(fid && fid[0] === 5, `${tag} file_id type ≠ workout`);
      check(wk && wk[4] === 1 && wk[6] === steps.length, `${tag} workout incohérent`);
      let totalMs = 0;
      steps.forEach((s, i) => {
        check(s[254] === i, `${tag} index d'étape`);
        if (s[1] === 6) {
          check(s[2] < i && s[4] >= 1, `${tag} répétition invalide`);
        } else {
          check((s[1] === 0 || s[1] === 1) && s[2] > 0, `${tag} durée invalide`);
          if (s[1] === 0) totalMs += s[2];
          if (s[3] === 0) check(s[5] > 0 && s[5] < s[6] && s[6] < 7000, `${tag} cible d'allure invalide ${s[5]}-${s[6]}`);
          else check(s[3] === 2, `${tag} type de cible inattendu`);
        }
      });
      check(steps.length >= 1 && steps.length <= 60, `${tag} nombre d'étapes ${steps.length}`);
      if (terrain === 'trail') steps.filter((s) => s[1] !== 6 && s[0] !== 'Echauffement').forEach((s) => check(s[3] === 2 || !['Endurance', 'Montee', 'Descente', 'Cote vite'].includes(s[0]), `${tag} trail : cible d'allure sur ${s[0]}`));
    })));
  });
  out.push(`Fichiers FIT contrôlés : ${fitCount}`);

  // ---- R7 : rapprochement Strava ----
  {
    const st2 = { statuses: {}, statusSource: {}, activities: {} };
    const pl = RP.plan.generate(base, st2);
    const runs = pl.weeks[2].days.flatMap((d) => d.items.filter((i) => i.kind === 'run'));
    const [r1, r2, r3, r4] = runs;
    st2.activities = {
      a: { id: 'a', type: 'Run', date: r1.date, km: r1.km * 0.85, name: 'A' },
      b: { id: 'b', type: 'Run', date: r2.date, km: r2.km * 0.5, name: 'B' },
      c: { id: 'c', type: 'Ride', date: r3.date, km: 40, name: 'Vélo' },
      d: { id: 'd', type: 'Run', date: U.fmtISO(U.addDays(U.parseDate(r4.date), -1)), km: r4.km, name: 'D' },
    };
    st2.statuses[r3.id] = 'done';
    st2.statusSource[r3.id] = 'manual';
    const rep = RP.match.apply(pl, st2, { sinceISO: pl.planStart, todayISO: '2027-01-30' });
    check(st2.statuses[r1.id] === 'done', 'R7 : 85 % devrait être fait');
    check(st2.statuses[r2.id] === 'partial', 'R7 : 50 % devrait être partiel');
    check(st2.statuses[r3.id] === 'done' && st2.statusSource[r3.id] === 'manual', 'R7 : saisie manuelle écrasée');
    check(st2.statuses[r4.id] === 'done', 'R7 : sortie de la veille non rapprochée');
    const other = pl.weeks[3].days.flatMap((d) => d.items.filter((i) => i.kind === 'run'))[0];
    check(st2.statuses[other.id] === 'missed' && st2.statusSource[other.id] === 'strava', 'R7 : séance sans sortie non marquée ratée');
    RP.match.apply(pl, st2, { sinceISO: pl.planStart, todayISO: '2027-01-30' });
    check(st2.statuses[r1.id] === 'done' && st2.statuses[r3.id] === 'done', 'R7 : deuxième synchro non idempotente');
    out.push(`R7 : ${JSON.stringify(rep)}`);
  }

  // ---- Historique Strava : lecture CSV (anglais / français) et analyse ----
  const TODAY = '2026-11-25';
  const monday = U.mondayOf(U.parseDate(TODAY));
  const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const FR_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const sample = [];
  for (let k = 1; k <= 10; k++) {
    const ws = U.addDays(monday, -7 * k);
    sample.push({ d: U.addDays(ws, 1), type: 'Run', km: 8, sec: 48 * 60, elev: 40, name: 'Footing' });
    sample.push({ d: U.addDays(ws, 3), type: 'Run', km: 10, sec: 55 * 60, elev: 60, name: 'Tempo' });
    sample.push({ d: U.addDays(ws, 6), type: 'Run', km: 15, sec: 90 * 60, elev: 120, name: 'Sortie longue' });
    sample.push({ d: U.addDays(ws, 5), type: 'Ride', km: 40, sec: 90 * 60, elev: 300, name: 'Vélo' });
  }
  sample.push({ d: U.addDays(monday, -10), type: 'Run', km: 5, sec: 12 * 60, elev: 0, name: 'GPS fou' });
  const enCSV = ['Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Elapsed Time,Moving Time,Distance,Elevation Gain']
    .concat(sample.map((s, i) => `${1000 + i},"${EN_MONTHS[s.d.getMonth()]} ${s.d.getDate()}, ${s.d.getFullYear()}, 6:45:00 AM",${s.name},${s.type},"Desc, avec virgule",${s.sec + 60},${s.km.toFixed(2)},150,${s.sec + 60},${s.sec},${(s.km * 1000).toFixed(1)},${s.elev}`)).join('\n');
  const frCSV = ["ID de l'activité,Date de l'activité,Nom de l'activité,Type d'activité,Temps écoulé,Distance,Temps de déplacement,Dénivelé positif"]
    .concat(sample.map((s, i) => `${1000 + i},"${s.d.getDate()} ${FR_MONTHS[s.d.getMonth()]} ${s.d.getFullYear()}, 06:45:00",${s.name},${s.type === 'Run' ? 'Course à pied' : 'Vélo'},${s.sec + 60},"${s.km.toFixed(2).replace('.', ',')}",${s.sec},${s.elev}`)).join('\n');
  const enActs = RP.history.activitiesFromCSV(enCSV);
  const frActs = RP.history.activitiesFromCSV(frCSV);
  check(enActs.length === sample.length && frActs.length === sample.length, `Historique : lignes lues ${enActs.length}/${frActs.length} sur ${sample.length}`);
  check(enActs[0].date === U.fmtISO(sample[0].d) && Math.abs(enActs[0].km - 8) < 0.01 && enActs[0].min === 48, `Historique : ligne anglaise mal lue ${JSON.stringify(enActs[0])}`);
  check(frActs[0].date === U.fmtISO(sample[0].d) && Math.abs(frActs[0].km - 8) < 0.01 && frActs[0].min === 48, `Historique : ligne française mal lue ${JSON.stringify(frActs[0])}`);
  const h = RP.history.analyze(enActs, TODAY);
  const hf = RP.history.analyze(frActs, TODAY);
  // 33 km/semaine + la sortie « GPS fou » de 5 km comptée en volume (semaine -2) : (33×4 + 5) / 4 = 34
  check(h.enough && h.currentKm === 34 && h.longestKm === 15, `Historique : volume ${h.currentKm} / plus longue ${h.longestKm}`);
  check(JSON.stringify(h.runDays) === '[1,3,6]' && h.longDay === 6, `Historique : jours ${h.runDays} / sortie longue ${h.longDay}`);
  check(h.vma > 11 && h.vma < 14 && h.vmaFrom.name === 'Tempo', `Historique : VMA ${h.vma} d'après ${h.vmaFrom && h.vmaFrom.name} (l'erreur GPS doit être écartée)`);
  check(h.level === 'intermediaire', `Historique : niveau ${h.level}`);
  check(JSON.stringify(hf.runDays) === JSON.stringify(h.runDays) && hf.currentKm === h.currentKm && hf.vma === h.vma, 'Historique : résultats anglais et français différents');
  check(!RP.history.analyze(enActs.slice(0, 3), TODAY).enough, 'Historique : 3 sorties ne devraient pas suffire');
  out.push(`Historique : ${h.currentKm} km/sem, ${h.perWeek} sorties/sem, plus longue ${h.longestKm} km, jours ${h.runDays.map((d) => U.DAYS_SHORT[d]).join(' ')}, VMA ${h.vma} (${h.vmaFrom.name}), niveau ${h.level}`);

  // ---- R8-R10 : ajustement des allures ----
  {
    const prof = { ...base, startDate: '2026-09-07', raceDate: '2027-03-28', vma: 14, refDistKm: '', refTime: '' };
    const pl = RP.plan.generate(prof, {});
    const past = (sub) => pl.weeks.flatMap((w) => w.days.flatMap((d) => d.items)).filter((i) => i.kind === 'run' && i.sub === sub && i.hard === (sub !== 'ef') && i.date < TODAY);
    const mk = (items, speedOf, elevPerKm = 5) => {
      const st = { activities: {}, syncInfo: {}, adapt: {} };
      items.forEach((it, i) => {
        const id = `a${i}`;
        const speed = speedOf(it);
        st.activities[id] = { id, type: 'Run', date: it.date, km: it.km, min: (it.km / speed) * 60, elev: it.km * elevPerKm, race: false, name: 'x' };
        st.syncInfo[it.id] = { ids: [id], date: it.date, ratio: 1, km: it.km, names: ['x'] };
      });
      return st;
    };
    const planned = (it) => it.km / (it.min / 60);
    const q3 = past('quality').slice(-3);
    let r = RP.adapt.evaluate(pl, mk(q3, (it) => planned(it) * 1.08), TODAY);
    check(r.update && r.update.rule === 'R9' && r.update.vma === 14.3, `R9 : +2 % attendu, obtenu ${JSON.stringify(r.update)}`);
    r = RP.adapt.evaluate(pl, mk(q3, (it) => planned(it) * 0.9), TODAY);
    check(!r.update && r.suggestion && r.suggestion.vma === 13.7, `R9 : proposition -2 % attendue, obtenu ${JSON.stringify(r.suggestion)}`);
    r = RP.adapt.evaluate(pl, mk(q3, (it) => planned(it) * 1.03), TODAY);
    check(!r.update && !r.suggestion, 'R9 : +3 % ne doit rien changer');
    r = RP.adapt.evaluate(pl, mk(q3, (it) => planned(it) * 1.08, 30), TODAY);
    check(!r.update, 'R9 : séances avec dénivelé à ignorer');
    // R8 : course marquée « course », prioritaire
    const stR = mk(q3, (it) => planned(it) * 1.08);
    stR.activities.race = { id: 'race', type: 'Run', date: '2026-11-15', km: 10, min: 40, elev: 20, race: true, name: '10 km de la ville' };
    r = RP.adapt.evaluate(pl, stR, TODAY);
    check(r.update && r.update.rule === 'R8' && r.update.vma > 16 && r.seenRaces.includes('race'), `R8 : mise à jour attendue, obtenu ${JSON.stringify(r.update)}`);
    stR.adapt = { applied: ['race'], lastChange: TODAY };
    r = RP.adapt.evaluate(pl, stR, TODAY);
    check(!r.update, 'R8/R9 : rien ne doit être réappliqué après un changement de VMA');
    const slowRace = mk([], () => 1);
    slowRace.activities.r2 = { id: 'r2', type: 'Run', date: '2026-11-15', km: 10, min: 60, elev: 0, race: true, name: 'lente' };
    check(!RP.adapt.evaluate(pl, slowRace, TODAY).update, 'R8 : une course lente ne doit pas baisser la VMA');
    // R10 : footings
    const e3 = past('ef').slice(-3);
    r = RP.adapt.evaluate(pl, mk(e3, () => 14 * 0.82), TODAY);
    check(r.easy && r.easy.n >= 2, `R10 : footings trop rapides non détectés ${JSON.stringify(r.easy)}`);
    r = RP.adapt.evaluate(pl, mk(e3, () => 14 * 0.7), TODAY);
    check(!r.easy, 'R10 : footings à la bonne allure signalés à tort');
    // Trail : pas de R9 / R10
    const plT = RP.plan.generate({ ...prof, terrain: 'trail', distanceKm: 30, dplus: 1200 }, {});
    const qT = plT.weeks.flatMap((w) => w.days.flatMap((d) => d.items)).filter((i) => i.sub === 'quality' && i.hard && i.date < TODAY).slice(-3);
    r = RP.adapt.evaluate(plT, mk(qT, (it) => planned(it) * 1.2), TODAY);
    check(!r.update && !r.easy, 'Trail : R9/R10 ne doivent pas s\'appliquer');
    out.push(`R8-R10 : ${q3.length} séances de qualité et ${e3.length} footings simulés`);
  }

  // ---- Export .zip (asynchrone : stocké et compressé) ----
  (async () => {
    const enc = new TextEncoder();
    const csvBytes = enc.encode(enCSV);
    const stored = RP.zip.zip([{ name: 'profile.csv', data: enc.encode('x') }, { name: 'activities.csv', data: csvBytes }]);
    const a1 = await RP.history.readExport(stored);
    // Archive compressée (deflate), construite à la main
    const comp = new Uint8Array(await new Response(new Blob([csvBytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const name = enc.encode('export_1/activities.csv');
    const crc = RP.zip.crc32(csvBytes);
    const u16 = (v) => [v & 0xff, (v >> 8) & 0xff];
    const u32 = (v) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff];
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0), ...u32(crc), ...u32(comp.length), ...u32(csvBytes.length), ...u16(name.length), ...u16(0)]);
    const central = new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(8), ...u16(0), ...u16(0), ...u32(crc), ...u32(comp.length), ...u32(csvBytes.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(0)]);
    const cdOff = local.length + name.length + comp.length;
    const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(1), ...u16(1), ...u32(central.length + name.length), ...u32(cdOff), ...u16(0)]);
    const a2 = await RP.history.readExport(new Blob([local, name, comp, central, name, end]));
    const a3 = await RP.history.readExport(new Blob([frCSV], { type: 'text/csv' }));
    const ok = a1.length === sample.length && a2.length === sample.length && a3.length === sample.length;
    const line = `Export .zip : stocké ${a1.length}, compressé ${a2.length}, CSV ${a3.length} lignes — ${ok ? 'OK' : 'ÉCHEC'}`;
    window.TEST_ZIP = ok;
    document.getElementById('out').textContent += `\n${line}`;
  })().catch((e) => { window.TEST_ZIP = false; document.getElementById('out').textContent += `\nExport .zip : ÉCHEC ${e.message}`; });

  const summary = `${fail === 0 ? 'OK' : 'ÉCHEC'} — ${pass} vérifications réussies, ${fail} échecs. Plans : ${stats.plans}, semaines : ${stats.weeks}. ` +
    `Écart max volume réel/cible : ${Math.round(stats.maxDev * 100)} %. Part d'intensité max (semaine de charge) : ${Math.round(stats.maxIntensity * 100)} %. ` +
    `Semaines avec renfo non placé : ${stats.strengthNotPlaced}. Semaines à plus de 20 % d'écart de volume : ${stats.devOver20 || 0} (ex. ${stats.devEx || '-'}). ` +
    `Semaines de charge à plus de 25 % d'intensité : ${stats.intOver25 || 0} (ex. ${stats.intEx || '-'}).`;
  out.unshift(summary);
  out.push(...failures);
  window.TEST_RESULT = { pass, fail, summary, failures, stats };
  document.getElementById('out').textContent = out.join('\n');
})(window.RP);
