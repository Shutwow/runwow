/* Allures : estimation de la VMA et zones d'entraînement (règles fixes). */
(function (RP) {
  const P = {};

  // % de VMA tenable selon la durée de l'effort (minutes). Interpolation logarithmique.
  const PCT_BY_DURATION = [
    [6, 1.0], [15, 0.95], [30, 0.92], [45, 0.89], [60, 0.87], [90, 0.84],
    [150, 0.8], [210, 0.77], [300, 0.72], [480, 0.66], [900, 0.6], [1800, 0.52],
  ];

  P.pctVma = (min) => {
    const T = PCT_BY_DURATION;
    if (min <= T[0][0]) return T[0][1];
    for (let i = 1; i < T.length; i++) {
      const [t1, p1] = T[i - 1];
      const [t2, p2] = T[i];
      if (min <= t2) {
        const r = (Math.log(min) - Math.log(t1)) / (Math.log(t2) - Math.log(t1));
        return p1 + (p2 - p1) * r;
      }
    }
    return T[T.length - 1][1];
  };

  // VMA (km/h) à partir d'une course de référence.
  P.estimateVma = (distKm, timeMin) => distKm / (timeMin / 60) / P.pctVma(timeMin);

  P.DEFAULT_VMA = { debutant: 11, intermediaire: 14, confirme: 17 };

  // Temps prédit (min) sur une distance plate pour une VMA donnée.
  P.predictTime = (vma, distKm) => {
    let t = (distKm / (vma * 0.85)) * 60;
    for (let i = 0; i < 60; i++) t = (distKm / (vma * P.pctVma(t))) * 60;
    return t;
  };

  P.ZONES = [
    { id: 'recup', label: 'Récupération', lo: 0.6, hi: 0.65, rpe: '2/10', desc: 'Très facile, on pourrait chanter.' },
    { id: 'ef', label: 'Endurance fondamentale', lo: 0.65, hi: 0.75, rpe: '3-4/10', desc: 'Facile, conversation aisée. 80 % de ton volume.' },
    { id: 'marathon', label: 'Allure marathon', lo: 0.78, hi: 0.82, rpe: '5-6/10', desc: 'Confortable mais engagé.' },
    { id: 'seuil', label: 'Seuil', lo: 0.85, hi: 0.88, rpe: '7/10', desc: 'Soutenu, phrases courtes.' },
    { id: 'a10k', label: 'Allure 10 km', lo: 0.89, hi: 0.92, rpe: '8/10', desc: 'Dur, quelques mots seulement.' },
    { id: 'a5k', label: 'Allure 5 km', lo: 0.93, hi: 0.97, rpe: '8-9/10', desc: 'Très dur.' },
    { id: 'vma', label: 'VMA', lo: 0.98, hi: 1.05, rpe: '9-10/10', desc: 'Effort maximal sur des fractions courtes.' },
  ];
  P.ZONE_BY_ID = Object.fromEntries(P.ZONES.map((z) => [z.id, z]));

  P.secPerKm = (kmh) => 3600 / kmh;
  P.fmtPace = (sec) => {
    sec = Math.round(sec);
    return `${Math.floor(sec / 60)}'${String(sec % 60).padStart(2, '0')}"`;
  };
  P.fmtPaceKmh = (kmh) => `${P.fmtPace(P.secPerKm(kmh))}/km`;

  P.zoneSpeed = (vma, id) => {
    const z = P.ZONE_BY_ID[id];
    return vma * (z.lo + z.hi) / 2;
  };
  // Fourchette d'allure : du plus lent au plus rapide.
  P.zoneRange = (vma, id) => {
    const z = P.ZONE_BY_ID[id];
    return `${P.fmtPace(P.secPerKm(vma * z.lo))}–${P.fmtPace(P.secPerKm(vma * z.hi))}/km`;
  };

  RP.paces = P;
})(window.RP);
