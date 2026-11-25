/* Export des séances de course en fichiers d'entraînement Garmin (.FIT, protocole FIT 2.0).
   Le fichier se copie dans le dossier GARMIN/NewFiles de la montre (USB). */
(function (RP) {
  const U = RP.U;
  const P = RP.paces;

  // ---------- Encodeur FIT minimal ----------
  const CRC_TABLE = [0x0000, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
  function crc16(bytes, start = 0, end = bytes.length) {
    let crc = 0;
    for (let i = start; i < end; i++) {
      const b = bytes[i];
      let tmp = CRC_TABLE[crc & 0xf];
      crc = (crc >> 4) & 0x0fff;
      crc = crc ^ tmp ^ CRC_TABLE[b & 0xf];
      tmp = CRC_TABLE[crc & 0xf];
      crc = (crc >> 4) & 0x0fff;
      crc = crc ^ tmp ^ CRC_TABLE[(b >> 4) & 0xf];
    }
    return crc;
  }

  const BT = { enum: [0x00, 1], uint8: [0x02, 1], uint16: [0x84, 2], uint32: [0x86, 4], uint32z: [0x8c, 4], string: [0x07, 0] };
  const INVALID = { enum: 0xff, uint8: 0xff, uint16: 0xffff, uint32: 0xffffffff, uint32z: 0 };

  // Texte FIT : UTF-8, tronqué sans couper un caractère, terminé par un zéro.
  function strBytes(s, size) {
    const enc = new TextEncoder();
    let str = String(s || '');
    let b = enc.encode(str);
    while (b.length > size - 1) { str = str.slice(0, -1); b = enc.encode(str); }
    const out = new Uint8Array(size);
    out.set(b);
    return out;
  }

  class FitWriter {
    constructor() { this.data = []; }
    push(...bytes) { this.data.push(...bytes); }
    val(type, v) {
      const n = BT[type][1];
      if (v == null) v = INVALID[type];
      for (let i = 0; i < n; i++) this.push((v >>> (8 * i)) & 0xff);
    }
    // fields: [[numéro, type, taille pour les textes]]
    define(local, global, fields) {
      this.push(0x40 | local, 0, 0, global & 0xff, (global >> 8) & 0xff, fields.length);
      fields.forEach(([num, type, size]) => this.push(num, size || BT[type][1], BT[type][0]));
      this.defs = this.defs || {};
      this.defs[local] = fields;
    }
    record(local, values) {
      this.push(local & 0x0f);
      this.defs[local].forEach(([num, type, size], i) => {
        if (type === 'string') this.push(...strBytes(values[i], size));
        else this.val(type, values[i]);
      });
    }
    finish() {
      const body = this.data;
      const header = [14, 0x20, 0x5c, 0x08, body.length & 0xff, (body.length >> 8) & 0xff, (body.length >> 16) & 0xff, (body.length >>> 24) & 0xff, 0x2e, 0x46, 0x49, 0x54];
      const hcrc = crc16(header);
      header.push(hcrc & 0xff, hcrc >> 8);
      const all = new Uint8Array(header.length + body.length + 2);
      all.set(header);
      all.set(body, header.length);
      const c = crc16(all, 0, header.length + body.length);
      all[all.length - 2] = c & 0xff;
      all[all.length - 1] = c >> 8;
      return all;
    }
  }

  const FIT_EPOCH = 631065600; // 31/12/1989 00:00 UTC
  const ascii = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '');

  // ---------- Séance -> étapes ----------
  const STEP_NAMES = {
    recup: 'Recup', ef: 'Endurance', ef_long: 'Endurance', marathon: 'Allure marathon', seuil: 'Seuil', a10k: 'Allure 10 km',
    a5k: 'Allure 5 km', vma: 'VMA', race: 'Allure course', cote: 'Cote', cote_seuil: 'Montee', descente: 'Descente', marche: 'Marche',
  };
  const INTENSITY = { active: 0, rest: 1, warmup: 2, cooldown: 3 };

  // Cible d'allure (m/s × 1000). Côtes, descentes, marche et trail en endurance : sans cible (à l'effort).
  function target(zone, c) {
    const open = { type: 2 };
    if (['cote', 'cote_seuil', 'descente', 'marche'].includes(zone)) return open;
    if (c.trail && ['ef', 'ef_long', 'recup'].includes(zone)) return open;
    let lo;
    let hi;
    if (zone === 'race') { lo = c.z.race * 0.98; hi = c.z.race * 1.02; } else if (zone === 'ef_long') { lo = c.vma * 0.63; hi = c.vma * 0.72; } else {
      const z = P.ZONE_BY_ID[zone];
      if (!z) return open;
      lo = c.vma * z.lo;
      hi = c.vma * z.hi;
    }
    return { type: 0, low: Math.round((lo / 3.6) * 1000), high: Math.round((hi / 3.6) * 1000) };
  }

  function sessionToSteps(it, c) {
    const steps = [];
    const step = (name, part, intensity) => steps.push({
      name: ascii(name),
      dur: part.km != null ? { type: 1, value: Math.round(part.km * 100000) } : { type: 0, value: Math.round(part.min * 60000) },
      target: target(part.zone, c),
      intensity,
    });
    (it.blocks || []).forEach((b) => {
      if (b.rep) {
        const series = b.rep.series || 1;
        for (let s = 0; s < series; s++) {
          const from = steps.length;
          step(b.rep.work.name || STEP_NAMES[b.rep.work.zone], b.rep.work, INTENSITY.active);
          step(b.rep.rest.name || 'Recup', b.rep.rest, INTENSITY.rest);
          steps.push({ repeatFrom: from, count: b.rep.n });
          if (s < series - 1 && b.rep.seriesRest) step('Recup serie', { zone: 'recup', min: b.rep.seriesRest }, INTENSITY.rest);
        }
      } else {
        (b.parts || []).forEach((pt) => {
          const intensity = b.kind === 'wu' ? INTENSITY.warmup : b.kind === 'cd' ? INTENSITY.cooldown : INTENSITY.active;
          const name = b.kind === 'wu' ? 'Echauffement' : b.kind === 'cd' ? 'Retour au calme' : STEP_NAMES[pt.zone] || 'Course';
          step(name, pt, intensity);
        });
      }
    });
    return steps;
  }

  function canExport(it) {
    return it && it.kind === 'run' && it.sub !== 'race' && (it.blocks || []).some((b) => b.rep || (b.parts && b.parts.length));
  }

  function workoutName(it, week) {
    return ascii(`S${week.index + 1} ${it.title}`).slice(0, 30);
  }

  function encodeWorkout(it, week, c) {
    const steps = sessionToSteps(it, c);
    const w = new FitWriter();
    w.define(0, 0, [[0, 'enum'], [1, 'uint16'], [2, 'uint16'], [4, 'uint32'], [3, 'uint32z']]);
    let serial = 0;
    for (const ch of it.id) serial = (serial * 31 + ch.charCodeAt(0)) >>> 0;
    w.record(0, [5, 255, 0, Math.floor(Date.now() / 1000) - FIT_EPOCH, serial || 1]);
    w.define(1, 26, [[4, 'enum'], [6, 'uint16'], [8, 'string', 32]]);
    w.record(1, [1, steps.length, workoutName(it, week)]);
    w.define(2, 27, [[254, 'uint16'], [0, 'string', 20], [1, 'enum'], [2, 'uint32'], [3, 'enum'], [4, 'uint32'], [5, 'uint32'], [6, 'uint32'], [7, 'enum']]);
    steps.forEach((s, i) => {
      if (s.repeatFrom != null) {
        // Répéter les étapes depuis « repeatFrom » jusqu'à atteindre « count » répétitions.
        w.record(2, [i, '', 6, s.repeatFrom, null, s.count, null, null, null]);
      } else {
        const t = s.target;
        w.record(2, [i, s.name, s.dur.type, s.dur.value, t.type, 0, t.type === 0 ? t.low : null, t.type === 0 ? t.high : null, s.intensity]);
      }
    });
    return w.finish();
  }

  function fileName(it, week) {
    const slug = ascii(it.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `runwow-s${String(week.index + 1).padStart(2, '0')}-${it.date}-${slug}.fit`;
  }

  // ---------- Lecture (pour les tests) ----------
  function decode(bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const hs = bytes[0];
    const size = dv.getUint32(4, true);
    const out = { headerOk: String.fromCharCode(...bytes.slice(8, 12)) === '.FIT', crcOk: crc16(bytes, 0, hs + size) === dv.getUint16(hs + size, true), messages: [] };
    const defs = {};
    let p = hs;
    while (p < hs + size) {
      const h = bytes[p++];
      const local = h & 0x0f;
      if (h & 0x40) {
        const global = dv.getUint16(p + 2, true);
        const n = bytes[p + 4];
        p += 5;
        const fields = [];
        for (let i = 0; i < n; i++) { fields.push([bytes[p], bytes[p + 1], bytes[p + 2]]); p += 3; }
        defs[local] = { global, fields };
      } else {
        const d = defs[local];
        const m = { global: d.global };
        d.fields.forEach(([num, sz, bt]) => {
          if (bt === 0x07) m[num] = new TextDecoder().decode(bytes.slice(p, p + sz)).replace(/\0.*$/, '');
          else if (sz === 1) m[num] = bytes[p];
          else if (sz === 2) m[num] = dv.getUint16(p, true);
          else m[num] = dv.getUint32(p, true);
          p += sz;
        });
        out.messages.push(m);
      }
    }
    return out;
  }

  RP.fit = { encodeWorkout, sessionToSteps, canExport, fileName, decode, crc16 };
})(window.RP);
