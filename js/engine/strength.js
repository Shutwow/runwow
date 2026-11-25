/* Séances de renforcement et de mobilité, construites par règles fixes. */
(function (RP) {
  const eqRank = (e) => RP.EQUIP_LEVELS.indexOf(e);
  const LEVELS = ['debutant', 'intermediaire', 'confirme'];
  const levelRank = (l) => LEVELS.indexOf(l);

  // Type de renfo selon la phase du plan (périodisation calée sur la course).
  const TYPES = {
    fondation: {
      title: 'Renfo · fondations', min: 35,
      slots: ['genou', 'hanche', 'unilateral', 'mollet', 'gainage_ant', 'gainage_lat'],
      focus: 'Construire une base solide : mouvements contrôlés, travail sur une jambe, gainage.',
    },
    force: {
      title: 'Renfo · force', min: 40,
      slots: ['genou', 'hanche', 'unilateral', 'mollet', 'plio_basse', 'gainage_lat'],
      focus: 'Gagner en force : charges plus lourdes et peu de répétitions. La force rend la foulée plus économique.',
    },
    puissance: {
      title: 'Renfo · puissance', min: 35,
      slots: ['plio_haute', 'genou', 'hanche', 'mollet', 'gainage_ant'],
      focus: 'Transformer la force en ressort : mouvements explosifs et pliométrie, volume réduit.',
    },
    entretien: {
      title: 'Renfo · entretien', min: 20,
      slots: ['genou', 'hanche', 'mollet', 'gainage_ant'],
      focus: 'Garder les acquis sans accumuler de fatigue.',
    },
  };

  function dose(type, ex, heavy) {
    if (ex.dose) return ex.dose;
    let d;
    heavy = heavy && ex.eq !== 'aucun';
    if (ex.slot === 'excentrique') {
      d = { fondation: '3 × 8, descente en 4 s', force: '3 × 8, descente en 4 s, lesté si possible', puissance: '2 × 8, descente en 4 s', entretien: '2 × 6, descente en 3 s' }[type];
    } else if (ex.slot === 'mollet') {
      d = { fondation: '3 × 12-15 (descente lente)', force: heavy ? '4 × 6-8 lourd' : '4 × 12-15, descente 3 s', puissance: '3 × 10 dynamiques', entretien: '2 × 12' }[type];
    } else if (ex.cat === 'force') {
      d = {
        fondation: '3 × 10-12, descente en 3 s',
        force: heavy ? '4 × 5-6 lourd (garde 2 répétitions en réserve)' : '4 × 8-10, descente 3 s, pause 1 s',
        puissance: '3 × 4-6 explosifs, charge modérée',
        entretien: '2 × 6-8, charge modérée',
      }[type];
    } else if (ex.cat === 'gainage') {
      d = { fondation: '3 × 30-45 s', force: '3 × 40 s', puissance: '2 × 40 s', entretien: '2 × 30 s' }[type];
    } else if (ex.cat === 'plio') {
      d = { fondation: '2 × 15 contacts', force: '3 × 20 contacts', puissance: '4 × 6-8, qualité maximale', entretien: '2 × 10 contacts légers' }[type];
    } else {
      d = { fondation: '3 × 12-15', force: '3 × 10-12', puissance: '2 × 10-12', entretien: '2 × 10' }[type];
    }
    return ex.per ? `${d} ${ex.per}` : d;
  }

  function candidates(slot, equipment, level) {
    return RP.EXERCISES
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.slot === slot && eqRank(e.eq) <= eqRank(equipment) && levelRank(level) >= levelRank(e.minLevel || 'debutant'))
      .sort((a, b) => eqRank(b.e.eq) - eqRank(a.e.eq) || a.i - b.i)
      .map(({ e }) => e);
  }

  // Exercices de prévention : ciblés sur les zones fragiles, sinon une rotation générale.
  function prevention(injuries, equipment, variant, max) {
    const pool = RP.EXERCISES.filter((e) => e.slot === 'prev' && eqRank(e.eq) <= eqRank(equipment));
    const out = [];
    const zones = injuries && injuries.length ? injuries : null;
    if (zones) {
      zones.forEach((z, zi) => {
        const list = pool.filter((e) => e.zones.includes(z));
        if (list.length) out.push(list[(variant + zi) % list.length]);
      });
    } else {
      const generic = ['abduction_couche', 'tibialis', 'equilibre', 'nordic'].map((id) => RP.EX_BY_ID[id]);
      out.push(generic[variant % generic.length]);
    }
    const unique = [...new Map(out.map((e) => [e.id, e])).values()];
    return unique.slice(0, max);
  }

  RP.strength = {
    TYPES,
    // type : fondation | force | puissance | entretien
    build({ type, equipment = 'aucun', level = 'intermediaire', injuries = [], trail = false, variant = 0 }) {
      const T = TYPES[type];
      const heavy = eqRank(equipment) >= eqRank('halteres');
      let slots = T.slots.slice();
      if (type === 'puissance' && level === 'debutant') slots = slots.map((s) => (s === 'plio_haute' ? 'plio_basse' : s));
      if (trail && type !== 'entretien') slots.splice(2, 0, 'excentrique');

      const exercises = [];
      slots.forEach((slot) => {
        const list = candidates(slot, equipment, level);
        if (!list.length) return;
        const pick = list[variant % Math.min(2, list.length)];
        exercises.push({ ...pick, dose: dose(type, pick, heavy) });
      });
      prevention(injuries, equipment, variant, type === 'entretien' ? 1 : 2).forEach((ex) => {
        if (!exercises.some((e) => e.id === ex.id)) exercises.push({ ...ex, dose: dose(type, ex, heavy) });
      });

      const notes = [
        'Échauffement 5 min : corde ou montées de genoux, puis 1 série légère de chaque exercice.',
        'Récupération 1 à 2 min entre les séries (2 à 3 min en force et en puissance).',
        'Augmente la charge quand les dernières répétitions deviennent faciles.',
      ];
      if (type === 'puissance') notes.push('La qualité prime : arrête la série dès que le geste ralentit.');
      return { title: T.title, focus: T.focus, min: T.min + (trail && type !== 'entretien' ? 5 : 0), exercises, notes };
    },
  };

  // ---------- Mobilité ----------
  const ROUTINES = {
    courte: {
      title: 'Mobilité · routine courte', min: 10,
      base: ['cheville_mur', 'hanche_9090', 'fente_basse', 'open_book', 'wgs'], extra: 1,
      focus: '10 minutes pour garder chevilles, hanches et dos mobiles.',
    },
    complete: {
      title: 'Mobilité · routine complète', min: 20,
      base: ['cheville_mur', 'hanche_9090', 'fente_basse', 'open_book', 'wgs', 'chat_vache', 'pigeon', 'balancier', 'couch_stretch', 'grenouille'], extra: 2,
      focus: 'Séance plus longue, à faire au calme un jour de repos.',
    },
    recup: {
      title: 'Mobilité · récupération', min: 12,
      base: ['mollet_mur', 'ischio_doux', 'couch_stretch', 'pigeon', 'enfant', 'jambes_mur'], extra: 1,
      focus: 'Après une séance longue ou une course : étirements doux, aucune douleur.',
    },
  };

  RP.mobility = {
    ROUTINES,
    build({ type, injuries = [], variant = 0 }) {
      const R = ROUTINES[type];
      const ids = R.base.slice();
      const targeted = [];
      (injuries || []).forEach((z, zi) => {
        const list = RP.MOBILITY.filter((m) => m.zones.includes(z) && !ids.includes(m.id) && !targeted.includes(m.id));
        if (list.length) targeted.push(list[(variant + zi) % list.length].id);
      });
      ids.push(...targeted.slice(0, R.extra));
      return {
        title: R.title, focus: R.focus, min: R.min + targeted.slice(0, R.extra).length * 2,
        exercises: ids.map((id) => RP.MOB_BY_ID[id]),
        notes: ['Mouvements lents, sans à-coups. Un étirement ne doit jamais faire mal.'],
      };
    },
  };
})(window.RP);
