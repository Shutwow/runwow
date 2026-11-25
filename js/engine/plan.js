/* Générateur de plan : 100 % règles fixes, déterministe (mêmes entrées => même plan). */
(function (RP) {
  const U = RP.U;
  const P = RP.paces;

  // ---------- Paramètres des règles (décrits dans l'onglet « Règles ») ----------
  const RULE = {
    growthPct: 0.10,      // progression max du volume d'une semaine de charge à la suivante
    growthMinKm: 2,       // … mais au moins +2 km pour les petits volumes
    growthMaxPct: 0.15,   // … sans jamais dépasser +15 %
    cycle: 3,             // 3 semaines de charge puis 1 semaine allégée
    recoveryFactor: 0.7,  // semaine allégée = 70 % de la dernière semaine de charge
    longGrowthPct: 0.10,  // la sortie longue progresse de 10 % max…
    longGrowthMinKm: 1.5, // … ou 1,5 km
    intensityMax: 0.20,   // 20 % max du temps de course au-dessus de l'endurance fondamentale
    easyMaxMin: { debutant: 60, intermediaire: 75, confirme: 90 }, // durée max d'un footing
    strengthRaceGap: 4,   // pas de renfo dans les 3 jours qui précèdent la course
    targetMaxGain: 0.03,  // l'allure objectif ne peut pas dépasser la prédiction de plus de 3 %
  };
  const TAPER = { 1: [0.55], 2: [0.7, 0.45], 3: [0.8, 0.65, 0.45] };

  const CATS = {
    '5k': { label: '5 km', minWeeks: 6, idealWeeks: 8, taper: 1, peak: { debutant: 25, intermediaire: 40, confirme: 55 }, longMaxMin: 90, longKmMax: 18, minDays: 3 },
    '10k': { label: '10 km', minWeeks: 6, idealWeeks: 10, taper: 1, peak: { debutant: 30, intermediaire: 45, confirme: 65 }, longMaxMin: 100, longKmMax: 22, minDays: 3 },
    semi: { label: 'Semi-marathon', minWeeks: 8, idealWeeks: 12, taper: 2, peak: { debutant: 35, intermediaire: 55, confirme: 75 }, longMaxMin: 115, longKmMax: 24, minDays: 3 },
    marathon: { label: 'Marathon', minWeeks: 12, idealWeeks: 16, taper: 3, peak: { debutant: 45, intermediaire: 65, confirme: 90 }, longMaxMin: 180, longKmMax: 32, minDays: 4 },
    ultra_route: { label: 'Ultra sur route', minWeeks: 16, idealWeeks: 20, taper: 3, peak: { debutant: 55, intermediaire: 80, confirme: 110 }, longMaxMin: 240, longKmMax: 45, minDays: 4, b2b: true },
    // En trail, les volumes sont en km-effort (km + D+ / 100).
    trail_court: { label: 'Trail court (≤ 30 km)', minWeeks: 8, idealWeeks: 12, taper: 1, peak: { debutant: 40, intermediaire: 60, confirme: 80 }, longMaxMin: 150, minDays: 3, trail: true },
    trail_long: { label: 'Trail long (30-60 km)', minWeeks: 12, idealWeeks: 16, taper: 2, peak: { debutant: 55, intermediaire: 80, confirme: 105 }, longMaxMin: 240, minDays: 4, trail: true },
    ultra_trail: { label: 'Ultra-trail (> 60 km)', minWeeks: 16, idealWeeks: 20, taper: 3, peak: { debutant: 70, intermediaire: 95, confirme: 125 }, longMaxMin: 330, minDays: 4, trail: true, b2b: true },
  };

  // Séances de qualité par distance et par phase : [séance principale, séance secondaire]
  const QUALITY = {
    '5k': { base: ['cotes_courtes', 'fartlek'], construction: ['vma_courte', 'seuil'], specifique: ['specifique', 'vma_courte'] },
    '10k': { base: ['fartlek', 'cotes_courtes'], construction: ['seuil', 'vma_courte'], specifique: ['specifique', 'seuil'] },
    semi: { base: ['fartlek', 'cotes_courtes'], construction: ['seuil', 'vma_longue'], specifique: ['specifique', 'seuil_continu'] },
    marathon: { base: ['fartlek', 'cotes_courtes'], construction: ['seuil', 'vma_longue'], specifique: ['specifique', 'seuil_continu'] },
    ultra_route: { base: ['fartlek', 'cotes_courtes'], construction: ['seuil_continu', 'seuil'], specifique: ['specifique', 'seuil_continu'] },
    trail_court: { base: ['cotes_courtes', 'fartlek'], construction: ['cotes_longues', 'seuil'], specifique: ['cotes_longues', 'descente'] },
    trail_long: { base: ['cotes_courtes', 'fartlek'], construction: ['cotes_longues', 'seuil_continu'], specifique: ['rando_course', 'cotes_longues'] },
    ultra_trail: { base: ['fartlek', 'cotes_courtes'], construction: ['cotes_longues', 'seuil_continu'], specifique: ['rando_course', 'descente'] },
  };

  const PHASE_LABELS = { base: 'Base', construction: 'Construction', specifique: 'Spécifique', affutage: 'Affûtage' };
  const PHASE_GOALS = {
    base: 'Construire le moteur : beaucoup d\'endurance facile, des côtes et du renfo de fond.',
    construction: 'Développer la vitesse et le seuil, renfo orienté force.',
    specifique: 'Travailler l\'allure et les conditions de la course, renfo orienté puissance.',
    affutage: 'Réduire le volume en gardant un peu d\'intensité, pour arriver frais le jour J.',
  };
  const WEEK_TYPE_LABELS = { load: 'Charge', recovery: 'Semaine allégée', taper: 'Affûtage', race: 'Semaine de course', reprise: 'Reprise' };
  const HARD_ZONES = new Set(['marathon', 'seuil', 'a10k', 'a5k', 'vma', 'race', 'cote', 'cote_seuil']);

  function categorize(distKm, terrain) {
    if (terrain === 'trail') {
      if (distKm <= 30) return 'trail_court';
      if (distKm <= 60) return 'trail_long';
      return 'ultra_trail';
    }
    if (distKm <= 7) return '5k';
    if (distKm <= 15) return '10k';
    if (distKm <= 30) return 'semi';
    if (distKm <= 45) return 'marathon';
    return 'ultra_route';
  }

  // ---------- Contexte : VMA, allures, objectif ----------
  function makeContext(profile) {
    const catId = categorize(+profile.distanceKm, profile.terrain);
    const cat = CATS[catId];
    const warnings = [];
    let vma = null;
    let vmaSource = '';
    if (+profile.vma > 0) {
      vma = +profile.vma;
      vmaSource = 'VMA saisie';
    } else if (+profile.refDistKm > 0 && U.parseTime(profile.refTime)) {
      vma = P.estimateVma(+profile.refDistKm, U.parseTime(profile.refTime));
      vmaSource = `estimée d'après ${profile.refDistKm} km en ${profile.refTime}`;
    }
    if (!vma) {
      vma = P.DEFAULT_VMA[profile.level] || 13;
      vmaSource = 'valeur par défaut du niveau : renseigne une course récente pour l\'affiner';
    }
    vma = U.clamp(vma, 7, 25);

    const z = {};
    P.ZONES.forEach((zz) => { z[zz.id] = P.zoneSpeed(vma, zz.id); });
    const trail = !!cat.trail;
    const raceKm = +profile.distanceKm;
    const dplus = trail ? +profile.dplus || 0 : 0;
    const raceEffortKm = raceKm + dplus / 100;
    const refKm = trail ? raceEffortKm : raceKm;
    const predictedMin = P.predictTime(vma, refKm);
    let raceSpeed = refKm / (predictedMin / 60);
    const targetMin = U.parseTime(profile.targetTime);
    let targetCapped = false;
    if (targetMin && !trail) {
      const ts = refKm / (targetMin / 60);
      if (ts > raceSpeed * (1 + RULE.targetMaxGain)) {
        targetCapped = true;
        warnings.push(`Objectif de temps ambitieux : ta forme actuelle prédit ${U.fmtTime(predictedMin)}. Les séances utilisent une allure plafonnée à 3 % plus rapide que cette prédiction. Mets à jour ta course de référence quand tu progresses.`);
        raceSpeed *= 1 + RULE.targetMaxGain;
      } else {
        raceSpeed = ts;
      }
    }
    z.race = raceSpeed;
    z.ef_long = vma * 0.68;
    z.cote = vma * 0.55;
    z.cote_seuil = vma * 0.5;
    z.marche = 5.5;
    z.descente = z.ef;
    const pace = (id) => P.fmtPaceKmh(z[id]);
    return {
      catId, cat, vma, vmaSource, z, pace, trail, raceKm, dplus, raceEffortKm,
      dplusRatio: raceKm ? dplus / raceKm : 0, predictedMin, targetMin, targetCapped,
      level: profile.level, warnings,
    };
  }

  // ---------- Briques de séance ----------
  const WU = (c, min, gammes = true) => {
    const m = c.level === 'debutant' ? Math.min(min, 15) : min;
    return {
      label: `Échauffement : ${m}' en endurance fondamentale${gammes ? ' + gammes (montées de genoux, talons-fesses) et 3 accélérations progressives' : ''}`,
      parts: [{ zone: 'ef', min: m }],
      kind: 'wu',
    };
  };
  const CD = (c, min) => {
    const m = c.level === 'debutant' ? Math.min(min, 8) : min;
    return { label: `Retour au calme : ${m}' très facile`, parts: [{ zone: 'recup', min: m }], kind: 'cd' };
  };
  // Structure des répétitions (utilisée pour l'export vers la montre).
  const REP = (n, work, rest, extra = {}) => ({ n, work, rest, ...extra });

  // Nombre de répétitions : progression p (0 → 1 dans la phase) × facteur de dosage k (petit volume => moins).
  const R = (p, k, lo, hi, min) => Math.max(min, Math.round((lo + (hi - lo) * p) * k));

  const T = {
    fartlek: (p, c, k) => {
      const n = R(p, k, 6, 10, 4);
      return { title: 'Fartlek', focus: 'Relancer la vitesse en jouant avec les allures, sans se mettre dans le rouge.',
        blocks: [WU(c, 15), { label: `${n} × (1' vite ≈ ${c.pace('a10k')} / 1' footing lent)`, parts: [{ zone: 'a10k', min: n }, { zone: 'recup', min: n }], rep: REP(n, { zone: 'a10k', min: 1, name: 'Vite' }, { zone: 'recup', min: 1 }) }, CD(c, 10)] };
    },
    cotes_courtes: (p, c, k) => {
      const n = R(p, k, 6, 10, 4);
      return { title: 'Côtes courtes', focus: 'La musculation du coureur : force, foulée et économie de course.',
        blocks: [WU(c, 20), { label: `${n} × 15-20" en côte raide (6-8 %), vite et relâché — récupération en marchant à la descente`, parts: [{ zone: 'cote', min: n * 0.3 }, { zone: 'recup', min: n * 1.5 }], rep: REP(n, { zone: 'cote', min: 20 / 60, name: 'Cote vite' }, { zone: 'recup', min: 1.5, name: 'Descente' }) }, CD(c, 10)] };
    },
    vma_courte: (p, c, k) => {
      const series = k < 0.6 ? 1 : 2;
      const n = R(p, k, 8, 12, 5);
      const label = series === 1
        ? `${n} × (30" vite à ${c.pace('vma')} / 30" trot)`
        : `2 séries de ${n} × (30" vite à ${c.pace('vma')} / 30" trot) — 3' de récupération entre les séries`;
      return { title: 'VMA courte 30/30', focus: 'Développer ta vitesse maximale aérobie.',
        blocks: [WU(c, 20), { label, parts: [{ zone: 'vma', min: (series * n) / 2 }, { zone: 'recup', min: (series * n) / 2 + (series - 1) * 3 }],
          rep: REP(n, { zone: 'vma', min: 0.5, name: 'VMA' }, { zone: 'recup', min: 0.5 }, { series, seriesRest: 3 }) }, CD(c, 10)] };
    },
    vma_longue: (p, c, k) => {
      const n = R(p, k, 5, 8, 3);
      return { title: 'Fractionné long', focus: 'Tenir une allure rapide plus longtemps.',
        blocks: [WU(c, 20), { label: `${n} × 600 m à ${c.pace('a5k')} — récupération 1'30 en trottinant`, parts: [{ zone: 'a5k', km: n * 0.6 }, { zone: 'recup', min: n * 1.5 }], rep: REP(n, { zone: 'a5k', km: 0.6, name: '600 m' }, { zone: 'recup', min: 1.5 }) }, CD(c, 10)] };
    },
    seuil: (p, c, k) => {
      const n = R(p, k, 3, 4, 2);
      const d = R(p, k, 8, 12, 4);
      return { title: 'Seuil', focus: 'Repousser le moment où l\'effort devient dur : la séance clé de l\'endurance.',
        blocks: [WU(c, 20), { label: `${n} × ${d}' au seuil (${c.pace('seuil')}) — récupération 2' en trottinant`, parts: [{ zone: 'seuil', min: n * d }, { zone: 'recup', min: (n - 1) * 2 }], rep: REP(n, { zone: 'seuil', min: d, name: 'Seuil' }, { zone: 'recup', min: 2 }) }, CD(c, 10)] };
    },
    seuil_continu: (p, c, k) => {
      const d = R(p, k, 20, 35, 10);
      return { title: 'Tempo continu', focus: 'Tenir un effort soutenu et régulier, mentalement et physiquement.',
        blocks: [WU(c, 20), { label: `${d}' en continu à allure soutenue (${c.pace('seuil')}, ou un peu moins vite)`, parts: [{ zone: 'seuil', min: d }] }, CD(c, 10)] };
    },
    cotes_longues: (p, c, k) => {
      const n = R(p, k, 4, 8, 3);
      return { title: 'Côtes longues', focus: 'Force-endurance en montée : la base du trail.',
        blocks: [WU(c, 20), { label: `${n} × 3' en côte régulière à effort seuil (respiration forte mais contrôlée) — récupération en redescendant au trot`, parts: [{ zone: 'cote_seuil', min: n * 3 }, { zone: 'recup', min: n * 2.5 }], rep: REP(n, { zone: 'cote_seuil', min: 3, name: 'Montee' }, { zone: 'recup', min: 2.5, name: 'Descente' }) }, CD(c, 10)] };
    },
    descente: (p, c, k) => {
      const n = R(p, k, 5, 8, 3);
      return { title: 'Technique de descente', focus: 'Descendre vite sans casser les quadriceps : pas courts, regard loin.',
        blocks: [WU(c, 20), { label: `${n} × 2' de descente rapide et technique (pas courts, regard 3-4 m devant, bras écartés) — remontée en marche active`, parts: [{ zone: 'descente', min: n * 2 }, { zone: 'marche', min: n * 3 }], rep: REP(n, { zone: 'descente', min: 2, name: 'Descente' }, { zone: 'marche', min: 3, name: 'Remontee' }) },
          { label: '15\' en endurance fondamentale sur terrain vallonné', parts: [{ zone: 'ef', min: 15 }] }, CD(c, 5)] };
    },
    rando_course: (p, c, k) => {
      const n = R(p, k, 4, 6, 2);
      return { title: 'Rando-course', focus: 'Spécifique ultra : marche rapide en montée, relances sur le plat, descentes souples.',
        blocks: [WU(c, 15, false), { label: `${n} × 6' de montée en marche rapide ou course lente à effort soutenu (avec bâtons si tu en utilises en course) — descente en course souple`, parts: [{ zone: 'cote_seuil', min: n * 6 }, { zone: 'descente', min: n * 4 }], rep: REP(n, { zone: 'cote_seuil', min: 6, name: 'Montee' }, { zone: 'descente', min: 4, name: 'Descente' }) }, CD(c, 10)] };
    },
    specifique: (p, c, k) => {
      const race = c.pace('race');
      switch (c.catId) {
        case '5k': {
          const n = R(p, k, 5, 8, 3);
          return { title: 'Allure 5 km', focus: 'Habituer le corps à l\'allure du jour J.',
            blocks: [WU(c, 20), { label: `${n} × 1000 m à allure 5 km (${race}) — récupération 2' trot`, parts: [{ zone: 'race', km: n }, { zone: 'recup', min: (n - 1) * 2 }], rep: REP(n, { zone: 'race', km: 1, name: '1000 m' }, { zone: 'recup', min: 2 }) }, CD(c, 10)] };
        }
        case '10k': {
          const n = R(p, k, 3, 5, 2);
          return { title: 'Allure 10 km', focus: 'Habituer le corps à l\'allure du jour J.',
            blocks: [WU(c, 20), { label: `${n} × 2000 m à allure 10 km (${race}) — récupération 2' trot`, parts: [{ zone: 'race', km: n * 2 }, { zone: 'recup', min: (n - 1) * 2 }], rep: REP(n, { zone: 'race', km: 2, name: '2000 m' }, { zone: 'recup', min: 2 }) }, CD(c, 10)] };
        }
        case 'semi': {
          const d = Math.max(1, U.roundHalf((2 + 1.5 * p) * k));
          return { title: 'Allure semi', focus: 'Tenir l\'allure du semi sur des blocs de plus en plus longs.',
            blocks: [WU(c, 20), { label: `3 × ${d} km à allure semi (${race}) — récupération 3' trot`, parts: [{ zone: 'race', km: 3 * d }, { zone: 'recup', min: 6 }], rep: REP(3, { zone: 'race', km: d, name: 'Allure semi' }, { zone: 'recup', min: 3 }) }, CD(c, 10)] };
        }
        case 'marathon': {
          const n = R(p, k, 2, 3, 1);
          const d = R(p, k, 4, 6, 2);
          return { title: 'Allure marathon', focus: 'Automatiser l\'allure marathon.',
            blocks: [WU(c, 15), { label: `${n} × ${d} km à allure marathon (${race})${n > 1 ? ' — récupération 1 km en endurance' : ''}`, parts: [{ zone: 'race', km: n * d }, { zone: 'ef', km: n - 1 }], rep: REP(n, { zone: 'race', km: d, name: 'Allure marathon' }, { zone: 'ef', km: 1 }) }, CD(c, 10)] };
        }
        default: {
          const n = R(p, k, 2, 3, 1);
          const d = R(p, k, 20, 30, 10);
          return { title: 'Allure course', focus: 'Mémoriser l\'allure de course et tester le ravitaillement.',
            blocks: [WU(c, 15), { label: `${n} × ${d}' à allure course (${race})${n > 1 ? ' — récupération 3\'' : ''}`, parts: [{ zone: 'race', min: n * d }, { zone: 'recup', min: (n - 1) * 3 }], rep: REP(n, { zone: 'race', min: d, name: 'Allure course' }, { zone: 'recup', min: 3 }) }, CD(c, 10)] };
        }
      }
    },
    rappel: (p, c, k) => {
      if (c.trail) {
        const n = R(1, k, 4, 4, 2);
        return { title: 'Rappel d\'effort', focus: 'Garder du tonus sans accumuler de fatigue.',
          blocks: [WU(c, 15), { label: `${n} × 3' en côte à effort seuil — récupération en redescendant`, parts: [{ zone: 'cote_seuil', min: n * 3 }, { zone: 'recup', min: n * 2 }], rep: REP(n, { zone: 'cote_seuil', min: 3, name: 'Montee' }, { zone: 'recup', min: 2, name: 'Descente' }) }, CD(c, 10)] };
      }
      if (c.catId === 'ultra_route') {
        return { title: 'Rappel allure course', focus: 'Mémoriser l\'allure du jour J, sans fatigue.',
          blocks: [WU(c, 15), { label: `2 × 15' à allure course (${c.pace('race')}) — récupération 3'`, parts: [{ zone: 'race', min: 30 }, { zone: 'recup', min: 3 }], rep: REP(2, { zone: 'race', min: 15, name: 'Allure course' }, { zone: 'recup', min: 3 }) }, CD(c, 10)] };
      }
      const [n, d] = { '5k': [3, 0.8], '10k': [3, 1.5], semi: [2, 3], marathon: [2, 4] }[c.catId];
      const dd = Math.max(0.5, U.roundHalf(d * Math.max(k, 0.5)));
      return { title: 'Rappel allure course', focus: 'Mémoriser l\'allure du jour J, sans fatigue.',
        blocks: [WU(c, 20), { label: `${n} × ${dd} km à allure course (${c.pace('race')}) — récupération 2' trot`, parts: [{ zone: 'race', km: n * dd }, { zone: 'recup', min: (n - 1) * 2 }], rep: REP(n, { zone: 'race', km: dd, name: 'Allure course' }, { zone: 'recup', min: 2 }) }, CD(c, 10)] };
    },
    activation: (p, c) => ({
      title: 'Activation pré-course', focus: 'Réveiller les jambes sans fatigue, 2 à 4 jours avant la course.',
      blocks: [
        { label: `20' en endurance fondamentale (${c.pace('ef')})`, parts: [{ zone: 'ef', min: 20 }] },
        { label: c.trail ? '3 × 1\' à effort seuil — récupération 1\'' : `3 × 1' à allure course (${c.pace('race')}) — récupération 1'`, parts: [{ zone: c.trail ? 'seuil' : 'race', min: 3 }, { zone: 'recup', min: 3 }],
          rep: REP(3, { zone: c.trail ? 'seuil' : 'race', min: 1, name: c.trail ? 'Seuil' : 'Allure course' }, { zone: 'recup', min: 1 }) },
        { label: '4 lignes droites de 80 m, relâchées', parts: [{ zone: 'a5k', min: 1.5 }, { zone: 'recup', min: 2 }], rep: REP(4, { zone: 'a5k', min: 20 / 60, name: 'Ligne droite' }, { zone: 'recup', min: 0.5 }) },
        CD(c, 5),
      ],
    }),
  };

  function compute(s, c) {
    let km = 0;
    let min = 0;
    let intens = 0;
    s.blocks.forEach((b) => {
      let bk = 0;
      let bm = 0;
      (b.parts || []).forEach((pt) => {
        const sp = c.z[pt.zone];
        const pk = pt.km != null ? pt.km : (pt.min * sp) / 60;
        const pm = pt.km != null ? (pt.km / sp) * 60 : pt.min;
        bk += pk;
        bm += pm;
        if (HARD_ZONES.has(pt.zone)) intens += pm;
      });
      b.km = bk;
      b.min = bm;
      km += bk;
      min += bm;
    });
    return { ...s, km: U.round1(km), min: Math.round(min), intensityMin: Math.round(intens), notes: s.notes || [] };
  }

  const isPaceLong = (c, w) => w.phase === 'specifique' && w.type === 'load' && w.weekInPhase % 2 === 1 && (c.catId === 'marathon' || c.catId === 'semi');

  function longRun(km, c, w) {
    const parts = [];
    let title = 'Sortie longue';
    let label;
    const notes = [];
    const focus = 'Développer l\'endurance : allure facile et régulière du début à la fin.';
    const min = (km / c.z.ef_long) * 60;
    if (c.trail) {
      const factor = { base: 0.5, construction: 0.75, specifique: 1, affutage: 0.6 }[w.phase];
      const dplus = Math.round((km * c.dplusRatio * factor) / 10) * 10;
      title = 'Sortie longue nature';
      label = `${U.fmtDuration(min)} en terrain vallonné (≈ ${U.round1(km)} km-effort${dplus ? `, ≈ ${dplus} m D+` : ''}) — marche dans les montées raides`;
      parts.push({ zone: 'ef_long', km });
      if (w.phase === 'specifique') notes.push('Teste ton matériel de course : chaussures, sac, bâtons, ravitaillement.');
    } else if (isPaceLong(c, w)) {
      title = 'Sortie longue avec allure';
      if (c.catId === 'marathon') {
        const mp = U.roundHalf(km * 0.3);
        label = `${km} km dont les ${mp} derniers à allure marathon (${c.pace('race')})`;
        parts.push({ zone: 'ef_long', km: km - mp }, { zone: 'race', km: mp });
      } else {
        const b = U.roundHalf(km * 0.15);
        label = `${km} km dont 2 × ${b} km à allure semi (${c.pace('race')}) au milieu, 1 km facile entre les deux`;
        parts.push({ zone: 'ef_long', km: km - 2 * b }, { zone: 'race', km: 2 * b });
      }
    } else {
      label = `${km} km en endurance fondamentale (${c.pace('ef')})`;
      parts.push({ zone: 'ef_long', km });
    }
    if (min >= 75) notes.push('Au-delà de 1h15 : emporte de l\'eau. Au-delà de 1h30 : un apport sucré toutes les 30 à 45 min.');
    return compute({ title, focus, blocks: [{ label, parts }], notes }, c);
  }

  function easyRun(km, c, profile, w, p, strides) {
    const min = (km / c.z.ef) * 60;
    const runWalk = profile.level === 'debutant' && w.volume < 15 && w.phase === 'base';
    if (runWalk) {
      const runMin = Math.round(2 + 4 * p);
      const reps = Math.max(3, Math.round(min / (runMin + 1)));
      return compute({ title: 'Course / marche', focus: 'Construire l\'endurance en douceur : la marche fait partie de l\'entraînement.',
        blocks: [{ label: `${reps} × (${runMin}' de course très facile / 1' de marche)`, parts: [{ zone: 'ef', min: reps * runMin }, { zone: 'marche', min: reps }],
          rep: REP(reps, { zone: 'ef', min: runMin, name: 'Course' }, { zone: 'marche', min: 1, name: 'Marche' }) }] }, c);
    }
    const blocks = [{ label: `${km} km en endurance fondamentale (${c.pace('ef')}), soit environ ${U.fmtDuration(min)}`, parts: [{ zone: 'ef', km }] }];
    if (strides) blocks.push({ label: '+ 6 lignes droites de 80 m : accélérations progressives et relâchées, retour en marchant', parts: [{ zone: 'a5k', min: 2 }, { zone: 'recup', min: 3 }],
      rep: REP(6, { zone: 'a5k', min: 20 / 60, name: 'Ligne droite' }, { zone: 'recup', min: 0.5 }) });
    return compute({ title: strides ? 'Footing + lignes droites' : 'Footing', focus: 'Endurance facile : tu dois pouvoir parler sans effort.', blocks }, c);
  }

  // ---------- Placement des séances dures ----------
  // Contraintes fixes : jamais deux séances dures consécutives, jamais la veille d'une sortie longue.
  // Préférences : espacer au maximum les séances dures, éviter le lendemain de la sortie longue.
  function pickQualityDays(cand, n, longDay, fixedHard) {
    for (let k = Math.min(n, cand.length); k >= 1; k--) {
      let best = null;
      let bestScore = -Infinity;
      for (const combo of U.combinations(cand, k)) {
        let ok = true;
        for (let a = 0; a < combo.length; a++) for (let b = a + 1; b < combo.length; b++) if (U.adjacent(combo[a], combo[b])) ok = false;
        for (const d of combo) for (const h of fixedHard) if ((d + 1) % 7 === h) ok = false;
        if (!ok) continue;
        const all = [...combo, ...fixedHard].sort((a, b) => a - b);
        let minGap = 7;
        for (let j = 0; j < all.length; j++) {
          const g = (all[(j + 1) % all.length] - all[j] + 7) % 7 || 7;
          minGap = Math.min(minGap, g);
        }
        let score = minGap * 10;
        for (const d of combo) if (d === (longDay + 1) % 7) score -= 15;
        if (score > bestScore) { best = combo; bestScore = score; }
      }
      if (best) return best;
    }
    return [];
  }

  // Renfo : pas le jour ni la veille d'une sortie longue, pas la veille d'une séance de qualité,
  // jamais deux jours de suite. Préférence : le jour d'une séance de qualité (« dur dur, facile facile »),
  // puis un jour de repos, puis un jour de footing.
  function placeStrength(n, { qDays, longDays, restDays, easyDays, extraForbidden = () => false }) {
    const forbidden = (d) =>
      longDays.includes(d) || longDays.includes((d + 1) % 7) || qDays.includes((d + 1) % 7) || extraForbidden(d);
    const order = [...qDays, ...restDays, ...easyDays];
    const chosen = [];
    for (const d of order) {
      if (chosen.length >= n) break;
      if (forbidden(d) || chosen.includes(d) || chosen.some((x) => U.adjacent(x, d))) continue;
      chosen.push(d);
    }
    return chosen;
  }

  function strengthTypeFor(w, k) {
    if (w.type === 'recovery' || w.type === 'taper' || w.type === 'race') return 'entretien';
    if (w.type === 'reprise') return 'fondation';
    if (w.phase === 'specifique') return ['puissance', 'force', 'entretien'][k] || 'entretien';
    if (w.phase === 'construction') return k < 2 ? 'force' : 'fondation';
    return 'fondation';
  }

  function placeMobility(freq, { longDay, restDays, runDaysNoLong, strengthDays }) {
    const out = []; // [jour, type]
    if (longDay != null) out.push([longDay, 'recup']);
    const free = restDays.filter((d) => !strengthDays.includes(d));
    const pool = [...free, ...restDays.filter((d) => strengthDays.includes(d)), ...runDaysNoLong];
    const take = (type) => {
      const d = pool.find((x) => !out.some(([y]) => y === x));
      if (d != null) out.push([d, type]);
    };
    if (freq === 'minimum') take('courte');
    else if (freq === 'quotidien') {
      for (let d = 0; d < 7; d++) {
        if (out.some(([y]) => y === d)) continue;
        const isRest = restDays.includes(d);
        out.push([d, isRest && !out.some(([, t]) => t === 'complete') ? 'complete' : 'courte']);
      }
    } else {
      take('complete');
      take('courte');
    }
    return out;
  }

  const longCapKm = (c) => Math.min((c.cat.longMaxMin / 60) * c.z.ef_long, c.cat.longKmMax || Infinity);
  const easyMaxKm = (c, level) => (c.z.ef * (RULE.easyMaxMin[level] || 75)) / 60;

  // ---------- Construction d'une semaine ----------
  function buildWeek(ctx, w) {
    const { profile, c } = ctx;
    const start = U.addDays(ctx.planStart, w.index * 7);
    const days = U.DAYS.map((name, d) => ({ day: d, name, date: U.fmtISO(U.addDays(start, d)), items: [] }));
    const notes = [];
    const runDays = [...new Set((profile.runDays || []).map(Number))].sort((a, b) => a - b);
    const p = w.phaseLen > 1 ? w.weekInPhase / (w.phaseLen - 1) : 1;
    const injuries = profile.injuries || [];
    const add = (d, item) => {
      const same = days[d].items.filter((x) => x.kind === item.kind).length;
      item.id = `w${w.index}-d${d}-${item.kind}${same}`;
      item.day = d;
      item.date = days[d].date;
      days[d].items.push(item);
    };
    const nStrengthWanted = +profile.strengthPerWeek || 0;
    const variant = w.index;
    const weekMin = (w.volume / c.z.ef) * 60;
    const k0 = U.clamp(weekMin / 300, 0.35, 1);

    if (w.type === 'race') {
      const raceDay = U.weekday(U.parseDate(profile.raceDate));
      add(raceDay, buildRace(c, profile));
      const pre = runDays.filter((d) => d < raceDay);
      const act = [3, 2, 4].map((g) => raceDay - g).find((d) => pre.includes(d));
      let used = 0;
      if (act != null) {
        const s = compute(T.activation(1, c, 1), c);
        add(act, { kind: 'run', sub: 'quality', hard: false, ...s });
        used += s.km;
      }
      const eve = raceDay - 1;
      if (pre.includes(eve) && eve !== act) {
        const s = compute({ title: 'Veille de course (facultatif)', focus: 'Dérouiller les jambes, rien de plus.',
          blocks: [{ label: '15\' très facile + 3 lignes droites', parts: [{ zone: 'recup', min: 15 }, { zone: 'a5k', min: 1 }] }] }, c);
        add(eve, { kind: 'run', sub: 'ef', hard: false, ...s });
        used += s.km;
      }
      const easy = pre.filter((d) => d !== act && d !== eve && raceDay - d >= 2);
      if (easy.length) {
        const km = U.roundHalf(U.clamp((w.volume - used) / easy.length, (c.z.ef * 20) / 60, (c.z.ef * 40) / 60));
        easy.forEach((d) => add(d, { kind: 'run', sub: 'ef', hard: false, ...easyRun(km, c, profile, w, 1, false) }));
      }
      if (nStrengthWanted > 0) {
        const runSet = new Set(days.filter((d) => d.items.some((i) => i.kind === 'run')).map((d) => d.day));
        const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => d < raceDay && !runSet.has(d));
        const [sd] = placeStrength(1, {
          qDays: [], longDays: [], restDays, easyDays: easy,
          extraForbidden: (d) => raceDay - d < RULE.strengthRaceGap || d === (act != null ? act - 1 : -9),
        });
        if (sd != null) add(sd, { kind: 'strength', sType: 'entretien', ...RP.strength.build({ type: 'entretien', equipment: profile.equipment, level: profile.level, injuries, trail: c.trail, variant }) });
      }
      const mobDay = [raceDay - 2, raceDay - 3].find((d) => d >= 0);
      if (mobDay != null) add(mobDay, { kind: 'mobility', mType: 'courte', ...RP.mobility.build({ type: 'courte', injuries, variant }) });
      if (raceDay + 1 <= 6) {
        add(raceDay + 1, { kind: 'mobility', mType: 'recup', ...RP.mobility.build({ type: 'recup', injuries, variant }) });
        days[raceDay + 1].note = 'Récupération : repos complet ou marche. Pas de course avant 3 à 7 jours selon la distance.';
      }
      return { days, notes };
    }

    const longDay = runDays.includes(+profile.longDay) ? +profile.longDay : runDays[runDays.length - 1];
    let b2bDay = null;
    if (c.cat.b2b && w.phase === 'specifique' && w.type === 'load') {
      const prev = (longDay + 6) % 7;
      if (runDays.includes(prev)) b2bDay = prev;
    }
    const b2bF = b2bDay != null ? 0.6 : 0;

    // 1) Sortie longue : part du volume, plafonnée en durée et en progression
    const nRun = runDays.length;
    let share = nRun <= 2 ? 0.45 : nRun === 3 ? 0.38 : nRun === 4 ? 0.33 : nRun === 5 ? 0.3 : 0.27;
    if (b2bDay != null) share = 0.3;
    let longCapNow = longCapKm(c);
    if (w.type === 'load' || w.type === 'reprise') {
      longCapNow = Math.min(longCapNow, ctx.lastLong + Math.max(RULE.longGrowthMinKm, ctx.lastLong * RULE.longGrowthPct));
    }
    let longKm = Math.min(w.volume * share, longCapNow);

    // 2) Séances de qualité : nombre, jours, puis dosage dans la limite de 20 % d'intensité
    let nQ = 0;
    if (w.type === 'load') nQ = runDays.length >= 4 ? 2 : 1;
    else if (w.type === 'taper') nQ = 1;
    if (profile.level === 'debutant' && w.phase === 'base') nQ = Math.min(nQ, 1);
    if (w.noQuality) nQ = 0;
    const fixedHard = [longDay, b2bDay].filter((d) => d != null);
    const cand = runDays.filter((d) => !fixedHard.includes(d));
    const qDays = nQ ? pickQualityDays(cand, nQ, longDay, fixedHard).sort((a, b) => a - b) : [];
    if (qDays.length < nQ) notes.push(`${nQ - qDays.length} séance(s) de qualité non placée(s) : il faudrait un jour de course qui ne soit ni la veille ni le lendemain d'une autre séance dure.`);

    let qTypes;
    if (w.type === 'taper') qTypes = ['rappel'];
    else {
      const list = QUALITY[c.catId][w.phase];
      qTypes = qDays.length >= 2 ? [list[0], list[1]] : [list[w.loadIndex % 2]];
    }
    const longIntens = !c.trail && isPaceLong(c, w) ? ((longKm * 0.3) / c.z.race) * 60 : 0;
    const budget = Math.max(RULE.intensityMax * weekMin - longIntens, 0.08 * weekMin);
    let k = k0;
    let qSessions = [];
    for (let guard = 0; guard < 12; guard++) {
      qSessions = qDays.map((d, i) => compute(T[qTypes[i]](p, c, k), c));
      const tot = qSessions.reduce((s, x) => s + x.intensityMin, 0);
      if (tot <= budget || k <= 0.3) break;
      k *= 0.85;
    }
    const qKm = qSessions.reduce((s, x) => s + x.km, 0);

    // 3) Footings : volume restant réparti ; un footing trop court est supprimé
    const easyDays = runDays.filter((d) => d !== longDay && d !== b2bDay && !qDays.includes(d));
    const minEasy = (c.z.ef * (profile.level === 'debutant' ? 20 : 25)) / 60;
    let rem = w.volume - longKm * (1 + b2bF) - qKm;
    const dropScore = (d) => (d === (longDay + 1) % 7 ? 2 : 0) + (qDays.includes((d + 1) % 7) ? 1 : 0);
    const dropOrder = easyDays.slice().sort((a, b) => dropScore(b) - dropScore(a) || b - a);
    let kept = easyDays.slice();
    while (kept.length && rem / kept.length < minEasy) {
      const d = dropOrder.shift();
      kept = kept.filter((x) => x !== d);
    }
    // Rééquilibrage : un footing ne doit pas être plus long que la sortie longue
    if (kept.length && rem / kept.length > longKm) {
      const eq = (w.volume - qKm) / (kept.length + 1 + b2bF);
      longKm = Math.min(Math.max(longKm, eq), longCapNow);
      rem = w.volume - longKm * (1 + b2bF) - qKm;
    }
    // Volume qui ne tient pas dans les footings (durée max) : d'abord la sortie longue (dans sa limite),
    // puis un complément d'endurance facile ajouté aux séances de qualité (aucune intensité en plus).
    const maxEasyFor = (lk) => Math.max(minEasy, Math.min(lk, easyMaxKm(c, profile.level)));
    let easyKm = kept.length ? U.clamp(rem / kept.length, minEasy, maxEasyFor(longKm)) : 0;
    let leftover = rem - easyKm * kept.length;
    if (leftover > 0.5) {
      const addL = Math.max(0, Math.min(longCapNow - longKm, leftover / (1 + b2bF)));
      longKm += addL;
      leftover -= addL * (1 + b2bF);
      if (kept.length) {
        const e2 = U.clamp(rem / kept.length, minEasy, maxEasyFor(longKm));
        leftover -= (e2 - easyKm) * kept.length;
        easyKm = e2;
      }
    }
    if (leftover > 0.5 && qSessions.length) {
      const per = leftover / qSessions.length;
      qSessions = qSessions.map((s) => {
        const room = easyMaxKm(c, profile.level) * 1.15 - s.km;
        const extMin = Math.floor(((Math.min(per, room) / c.z.ef) * 60) / 5) * 5;
        if (extMin < 10) return s;
        const last = s.blocks[s.blocks.length - 1];
        const ext = { label: `Complément : ${extMin}' en endurance fondamentale (${c.pace('ef')})`, parts: [{ zone: 'ef', min: extMin }] };
        return compute({ ...s, blocks: [...s.blocks.slice(0, -1), ext, last] }, c);
      });
    }
    longKm = Math.max(3, U.roundHalf(longKm));
    if (w.type === 'load' || w.type === 'reprise') ctx.lastLong = longKm;

    qDays.forEach((d, i) => add(d, { kind: 'run', sub: 'quality', hard: true, qType: qTypes[i], ...qSessions[i] }));
    add(longDay, { kind: 'run', sub: 'long', hard: true, ...longRun(longKm, c, w) });
    if (b2bDay != null) {
      const b2bKm = U.roundHalf(longKm * 0.6);
      const s = compute({ title: 'Sortie longue 1 (enchaînement)', focus: 'Veille de la sortie longue : apprendre à courir sur jambes fatiguées.',
        blocks: [{ label: `${b2bKm} km faciles${c.trail ? ' en terrain vallonné' : ''} (${c.pace('ef')})`, parts: [{ zone: 'ef_long', km: b2bKm }] }],
        notes: ['Le lendemain, la sortie longue se court sans chercher la vitesse.'] }, c);
      add(b2bDay, { kind: 'run', sub: 'long', hard: true, b2b: true, ...s });
    }
    if (kept.length) {
      const km = U.roundHalf(easyKm);
      kept.forEach((d, i) => add(d, { kind: 'run', sub: 'ef', hard: false, ...easyRun(km, c, profile, w, p, i === 0) }));
    }

    // 4) Renfo
    const runSet = new Set(days.filter((d) => d.items.some((i) => i.kind === 'run')).map((d) => d.day));
    const restDays = [0, 1, 2, 3, 4, 5, 6].filter((d) => !runSet.has(d));
    let nS = nStrengthWanted;
    if (['recovery', 'taper', 'reprise'].includes(w.type)) nS = Math.min(nS, 1);
    const sDays = placeStrength(nS, { qDays, longDays: fixedHard, restDays, easyDays: kept });
    sDays.sort((a, b) => a - b).forEach((d, i) => {
      const type = strengthTypeFor(w, i);
      const s = RP.strength.build({ type, equipment: profile.equipment, level: profile.level, injuries, trail: c.trail, variant: variant + i });
      if (qDays.includes(d)) s.notes = ['À faire après la séance de course (idéalement 6 h plus tard) : on garde les jours faciles vraiment faciles.', ...s.notes];
      add(d, { kind: 'strength', sType: type, ...s });
    });
    if (nS > sDays.length) notes.push(`${nS - sDays.length} séance(s) de renfo non placée(s) : aucun jour libre ne respecte les règles (ni le jour ni la veille d'une sortie longue, ni la veille d'une séance de qualité).`);

    // 5) Mobilité
    const mob = placeMobility(profile.mobility || '3x', {
      longDay, restDays, runDaysNoLong: runDays.filter((d) => d !== longDay && d !== b2bDay), strengthDays: sDays,
    });
    mob.forEach(([d, type], i) => add(d, { kind: 'mobility', mType: type, ...RP.mobility.build({ type, injuries, variant: variant + i }) }));

    return { days, notes };
  }

  function buildRace(c, profile) {
    const label = profile.raceName ? profile.raceName : c.cat.label;
    const blocks = [];
    const notes = [];
    if (c.trail) {
      blocks.push({ label: `${c.raceKm} km${c.dplus ? ` · ${c.dplus} m D+` : ''} — pars lentement, marche dès les premières montées raides` });
      notes.push('Mange et bois dès la première heure, avant d\'avoir faim ou soif.', 'Rien de nouveau le jour J : chaussures, sac et nutrition déjà testés à l\'entraînement.');
    } else {
      const warm = ['5k', '10k'].includes(c.catId) ? '15\' de footing + 3 accélérations' : '5 à 10\' de footing très léger';
      blocks.push({ label: `Échauffement : ${warm}` });
      blocks.push({ label: `${c.raceKm} km — allure cible ${c.pace('race')}. Les 2 premiers km un peu plus lents, accélère seulement dans le dernier quart.` });
      if (['marathon', 'ultra_route', 'semi'].includes(c.catId)) notes.push('Ravitaillement : bois à chaque poste et prends un apport sucré toutes les 30 à 45 min.');
      notes.push('Rien de nouveau le jour J : chaussures, tenue et petit-déjeuner déjà testés.');
    }
    const min = c.trail ? null : Math.round((c.raceKm / c.z.race) * 60);
    return { kind: 'run', sub: 'race', hard: true, title: `Jour J · ${label}`, focus: 'Profite, tu as fait le travail.', blocks, notes,
      km: c.trail ? U.round1(c.raceEffortKm) : c.raceKm, min, intensityMin: 0 };
  }

  function buildPhases(nWeeks, cat) {
    let taper = cat.taper;
    if (nWeeks < cat.minWeeks) taper = Math.max(1, taper - 1);
    taper = Math.min(taper, nWeeks);
    const R0 = nWeeks - taper;
    const ideal = cat.idealWeeks - cat.taper;
    let base;
    let cons;
    let spec;
    if (R0 >= ideal) {
      cons = Math.round(ideal * 0.3);
      spec = Math.round(ideal * 0.3);
      base = R0 - cons - spec;
    } else {
      base = Math.round(R0 * 0.4);
      cons = Math.round(R0 * 0.3);
      spec = R0 - base - cons;
    }
    const out = [];
    const push = (phase, len) => { for (let i = 0; i < len; i++) out.push({ phase, weekInPhase: i, phaseLen: len }); };
    push('base', base);
    push('construction', cons);
    push('specifique', spec);
    push('affutage', taper);
    return out;
  }

  function summarize(week) {
    let km = 0;
    let min = 0;
    let intens = 0;
    let nS = 0;
    let nM = 0;
    let nR = 0;
    week.days.forEach((d) => d.items.forEach((it) => {
      if (it.kind === 'run' && it.sub !== 'race') { km += it.km || 0; min += it.min || 0; intens += it.intensityMin || 0; nR++; }
      if (it.kind === 'strength') nS++;
      if (it.kind === 'mobility') nM++;
    }));
    week.km = U.round1(km);
    week.min = Math.round(min);
    week.intensityMin = intens;
    week.pctIntensity = min ? intens / min : 0;
    week.nStrength = nS;
    week.nMobility = nM;
    week.nRuns = nR;
  }

  function downgrade(it, c, profile) {
    const min = profile.level === 'debutant' ? 25 : 35;
    Object.assign(it, compute({ title: 'Footing facile (séance allégée)', focus: 'Tu n\'étais pas à 100 % : la séance prévue est remplacée par un footing facile. Elle n\'est pas rattrapée.',
      blocks: [{ label: `${min}' en endurance fondamentale (${c.pace('ef')})`, parts: [{ zone: 'ef', min }] }] }, c), { sub: 'ef', hard: false, downgraded: true });
  }

  // ---------- Point d'entrée ----------
  function generate(profile, state = {}) {
    const overrides = state.overrides || {};
    const c = makeContext(profile);
    const planStart = U.mondayOf(U.parseDate(profile.startDate));
    const raceDate = U.parseDate(profile.raceDate);
    const totalDays = U.daysBetween(planStart, raceDate);
    if (!(totalDays >= 0)) throw new Error('La date de course doit être après la date de début.');
    const nWeeks = Math.floor(totalDays / 7) + 1;
    const phases = buildPhases(nWeeks, c.cat);
    const taperStart = phases.findIndex((x) => x.phase === 'affutage');
    const nDays = (profile.runDays || []).length;

    // Volume faisable avec les jours disponibles (sortie longue plafonnée + footings de durée max)
    const feasible = longCapKm(c) + Math.max(0, nDays - 1) * easyMaxKm(c, profile.level);
    const startVol = Math.min(Math.max(+profile.currentKm || 0, 8), feasible);
    const peakWanted = Math.max(c.cat.peak[profile.level] || c.cat.peak.intermediaire, startVol);
    const peakTarget = Math.min(peakWanted, feasible);
    const warnings = c.warnings.slice();
    if (nWeeks < c.cat.minWeeks) warnings.push(`Préparation courte : ${nWeeks} semaine(s) pour un objectif ${c.cat.label.toLowerCase()}, ${c.cat.minWeeks} conseillées au minimum. Le plan est compressé.`);
    if (nDays < c.cat.minDays) warnings.push(`${nDays} jour(s) de course par semaine : ${c.cat.minDays} sont conseillés pour cet objectif.`);
    if (feasible < peakWanted * 0.95) warnings.push(`Avec ${nDays} jour(s) de course, le volume est plafonné à environ ${Math.round(feasible)} km par semaine (footings de ${RULE.easyMaxMin[profile.level]} min maximum, sortie longue limitée à ${U.fmtDuration(c.cat.longMaxMin)}). Ajoute un jour de course pour atteindre les ${Math.round(peakWanted)} km conseillés.`);

    let lastLoad = startVol;
    let maxLoad = startVol;
    let loadCount = 0;
    let loadIndex = 0;
    const metas = [];
    for (let i = 0; i < nWeeks; i++) {
      const ph = phases[i];
      const ov = overrides[i] || null;
      let type;
      let v;
      if (ph.phase === 'affutage') {
        type = i === nWeeks - 1 ? 'race' : 'taper';
        v = Math.min(maxLoad * TAPER[ph.phaseLen][ph.weekInPhase], lastLoad);
      } else if (i === 0) {
        type = 'load';
        v = startVol;
        loadCount = 1;
      } else if (loadCount >= RULE.cycle && i !== taperStart - 1) {
        type = 'recovery';
        v = lastLoad * RULE.recoveryFactor;
        loadCount = 0;
      } else {
        type = 'load';
        const inc = Math.min(Math.max(lastLoad * RULE.growthPct, RULE.growthMinKm), lastLoad * RULE.growthMaxPct);
        v = Math.max(Math.min(lastLoad + inc, peakTarget), Math.min(lastLoad, peakTarget));
        loadCount++;
      }
      let noQuality = false;
      let reason = null;
      if (ov && type !== 'race') {
        const caps = [];
        if (ov.cap != null) caps.push(ov.cap);
        if (ov.capFactor != null) caps.push(lastLoad * ov.capFactor);
        const cap = caps.length ? Math.min(...caps) : null;
        const binding = cap != null && cap < v;
        if (binding) v = cap;
        noQuality = !!ov.noQuality;
        reason = ov.reason || null;
        // Une semaine plafonnée devient le nouveau point de départ de la progression.
        if (type === 'load' || (type === 'recovery' && binding)) {
          type = noQuality ? 'reprise' : 'load';
          lastLoad = v;
          if (noQuality) loadCount = 0;
        }
      } else if (type === 'load') {
        lastLoad = v;
      }
      if (type === 'load') maxLoad = Math.max(maxLoad, v);
      metas.push({ index: i, ...ph, type, volume: U.round1(v), noQuality, reason, loadIndex: type === 'load' ? loadIndex++ : loadIndex });
    }
    if (maxLoad < peakTarget * 0.85 && nWeeks >= c.cat.minWeeks) {
      warnings.push(`Avec une progression de 10 % maximum par semaine, le pic sera de ${Math.round(maxLoad)} km au lieu des ${Math.round(peakTarget)} km visés. Pars d'un volume plus élevé ou allonge la préparation.`);
    }

    const ctx = { profile, c, planStart, lastLong: Math.max(+profile.longestKm || startVol * 0.35, 3) };
    const weeks = metas.map((m) => {
      const { days, notes } = buildWeek(ctx, m);
      return { ...m, start: U.fmtISO(U.addDays(planStart, m.index * 7)), end: U.fmtISO(U.addDays(planStart, m.index * 7 + 6)), days, notes };
    });

    // Séances allégées et déplacements choisis par l'utilisateur
    const moves = state.moves || {};
    const downs = state.downgrades || {};
    weeks.forEach((w) => {
      w.days.forEach((d) => d.items.forEach((it) => { if (downs[it.id] && it.kind === 'run' && it.sub !== 'race') downgrade(it, c, profile); }));
      const toMove = [];
      w.days.forEach((d) => d.items.forEach((it) => { if (moves[it.id] != null && moves[it.id] !== it.day) toMove.push(it); }));
      toMove.forEach((it) => {
        const from = w.days[it.day];
        from.items = from.items.filter((x) => x !== it);
        const to = w.days[moves[it.id]];
        it.originalDay = it.day;
        it.day = to.day;
        it.date = to.date;
        it.moved = true;
        to.items.push(it);
      });
      const rank = { run: 0, strength: 1, mobility: 2 };
      w.days.forEach((d) => d.items.sort((a, b) => rank[a.kind] - rank[b.kind]));
      summarize(w);
    });

    return {
      profile, c, weeks, nWeeks, peakTarget: U.round1(peakTarget), maxLoad: U.round1(maxLoad), warnings,
      planStart: U.fmtISO(planStart), raceDate: profile.raceDate,
    };
  }

  RP.plan = { generate, categorize, CATS, RULE, TAPER, QUALITY, PHASE_LABELS, PHASE_GOALS, WEEK_TYPE_LABELS, compute, pickQualityDays, placeStrength };
})(window.RP);
