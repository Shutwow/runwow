/* Historique de course : lecture de l'export Strava (.zip ou activities.csv) et analyse par règles fixes
   pour pré-remplir le profil (volume, sortie longue, jours habituels, VMA, niveau). */
(function (RP) {
  const U = RP.U;
  const P = RP.paces;

  // ---------- Règles d'analyse ----------
  const RULES = {
    volumeWeeks: 4,     // volume actuel = moyenne des 4 dernières semaines complètes
    longWeeks: 8,       // plus longue sortie sur 8 semaines
    habitWeeks: 8,      // jours habituels : courus au moins 3 semaines sur 8
    habitMin: 3,
    vmaWeeks: 26,       // VMA estimée sur 6 mois
    vmaMinKm: 3,        // sorties d'au moins 3 km et 10 min…
    vmaMinMin: 10,
    vmaMaxDplusPerKm: 15, // … et assez plates (moins de 15 m D+ par km)
  };

  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’`]/g, "'").toLowerCase().trim();
  const isRunType = (t) => /run|course|trail|footing|jog/.test(norm(t)) && !/velo|ride|bike|ski|swim|nage|walk|marche|hike|rando/.test(norm(t));
  const isTrailType = (t) => /trail/.test(norm(t));

  // ---------- CSV ----------
  function parseCSV(text) {
    const firstLine = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length);
    const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [];
    let field = '';
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  const MONTHS = {
    jan: 1, janv: 1, janvier: 1, january: 1, feb: 2, fev: 2, fevr: 2, fevrier: 2, february: 2, mar: 3, mars: 3, march: 3,
    apr: 4, avr: 4, avril: 4, april: 4, may: 5, mai: 5, jun: 6, juin: 6, june: 6, jul: 7, juil: 7, juillet: 7, july: 7,
    aug: 8, aou: 8, aout: 8, august: 8, sep: 9, sept: 9, septembre: 9, september: 9, oct: 10, octobre: 10, october: 10,
    nov: 11, novembre: 11, november: 11, dec: 12, decembre: 12, december: 12,
  };
  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  function parseDate(s) {
    const t = norm(s);
    let m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = t.match(/([a-z]+)\.? (\d{1,2}),? (\d{4})/); // Nov 20, 2026
    if (m && MONTHS[m[1]]) return iso(m[3], MONTHS[m[1]], m[2]);
    m = t.match(/(\d{1,2}) ([a-z]+)\.? (\d{4})/); // 20 nov. 2026
    if (m && MONTHS[m[2]]) return iso(m[3], MONTHS[m[2]], m[1]);
    m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); // 20/11/2026
    if (m) return iso(m[3], m[2], m[1]);
    return null;
  }
  function parseNum(s) {
    let v = String(s || '').trim().replace(/\s/g, '');
    if (!v) return NaN;
    if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.');
    else v = v.replace(/,/g, '');
    return parseFloat(v);
  }

  // activities.csv de l'export Strava (en-têtes anglais ou français).
  function activitiesFromCSV(text) {
    const rows = parseCSV(text.replace(/^﻿/, ''));
    if (rows.length < 2) throw new Error('Fichier vide.');
    const head = rows[0].map(norm);
    const find = (...names) => head.findIndex((h) => names.includes(h));
    const findAll = (...names) => head.map((h, i) => (names.includes(h) ? i : -1)).filter((i) => i >= 0);
    const col = {
      id: find('activity id', "id de l'activite"),
      date: find('activity date', "date de l'activite"),
      name: find('activity name', "nom de l'activite"),
      type: find('activity type', "type d'activite", "type de l'activite"),
      moving: find('moving time', 'temps de deplacement', 'temps en mouvement'),
      elapsed: find('elapsed time', 'temps ecoule'),
      elev: find('elevation gain', 'denivele positif', "gain d'altitude", 'gain de denivele'),
      dist: findAll('distance'),
    };
    if (col.date < 0 || col.type < 0 || !col.dist.length) throw new Error('Colonnes introuvables : choisis le fichier activities.csv de l\'export Strava.');
    const out = [];
    rows.slice(1).forEach((r, i) => {
      if (r.length < head.length / 2) return;
      const date = parseDate(r[col.date]);
      if (!date) return;
      // Deux colonnes « Distance » dans l'export : la seconde est en mètres. Sinon, km.
      let km = NaN;
      if (col.dist.length > 1) km = parseNum(r[col.dist[col.dist.length - 1]]) / 1000;
      if (!(km > 0)) km = parseNum(r[col.dist[0]]);
      if (km > 1000) km /= 1000;
      const sec = parseNum(r[col.moving >= 0 ? col.moving : col.elapsed]) || parseNum(r[col.elapsed]);
      out.push({
        id: col.id >= 0 ? String(r[col.id]) : `csv${i}`, name: col.name >= 0 ? r[col.name] : '', type: r[col.type], date,
        km: Math.round((km || 0) * 100) / 100, min: Math.round(((sec || 0) / 60) * 10) / 10, elev: Math.round(parseNum(r[col.elev]) || 0), race: false,
      });
    });
    return out;
  }

  // ---------- ZIP (export complet Strava) : on n'extrait que activities.csv ----------
  async function readZipEntry(file, wanted) {
    const tailLen = Math.min(file.size, 65557);
    const tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer());
    const tdv = new DataView(tail.buffer);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) if (tdv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Archive .zip illisible.');
    let n = tdv.getUint16(eocd + 10, true);
    let cdSize = tdv.getUint32(eocd + 12, true);
    let cdOff = tdv.getUint32(eocd + 16, true);
    if (cdOff === 0xffffffff || cdSize === 0xffffffff || n === 0xffff) { // ZIP64
      const loc = eocd - 20;
      if (loc < 0 || tdv.getUint32(loc, true) !== 0x07064b50) throw new Error('Archive trop grande : décompresse-la et choisis activities.csv.');
      const z64off = Number(tdv.getBigUint64(loc + 8, true));
      const z = new DataView(await file.slice(z64off, z64off + 56).arrayBuffer());
      cdSize = Number(z.getBigUint64(40, true));
      cdOff = Number(z.getBigUint64(48, true));
    }
    const cd = new Uint8Array(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const dv = new DataView(cd.buffer);
    const dec = new TextDecoder();
    for (let p = 0; p + 46 <= cd.length && dv.getUint32(p, true) === 0x02014b50;) {
      const method = dv.getUint16(p + 10, true);
      let comp = dv.getUint32(p + 20, true);
      let unc = dv.getUint32(p + 24, true);
      const nl = dv.getUint16(p + 28, true);
      const el = dv.getUint16(p + 30, true);
      const cl = dv.getUint16(p + 32, true);
      let off = dv.getUint32(p + 42, true);
      const name = dec.decode(cd.slice(p + 46, p + 46 + nl));
      if (wanted.test(name)) {
        // Champs étendus ZIP64 si besoin
        for (let e = p + 46 + nl; e + 4 <= p + 46 + nl + el;) {
          const id = dv.getUint16(e, true);
          const sz = dv.getUint16(e + 2, true);
          if (id === 0x0001) {
            let q = e + 4;
            if (unc === 0xffffffff) { unc = Number(dv.getBigUint64(q, true)); q += 8; }
            if (comp === 0xffffffff) { comp = Number(dv.getBigUint64(q, true)); q += 8; }
            if (off === 0xffffffff) { off = Number(dv.getBigUint64(q, true)); }
          }
          e += 4 + sz;
        }
        const lh = new DataView(await file.slice(off, off + 30).arrayBuffer());
        const start = off + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        const blob = file.slice(start, start + comp);
        if (method === 0) return new Uint8Array(await blob.arrayBuffer());
        if (method === 8) {
          if (typeof DecompressionStream === 'undefined') throw new Error('Ton navigateur ne sait pas décompresser : décompresse l\'archive et choisis activities.csv.');
          return new Uint8Array(await new Response(blob.stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        }
        throw new Error('Format de compression non pris en charge : décompresse l\'archive et choisis activities.csv.');
      }
      p += 46 + nl + el + cl;
    }
    throw new Error('activities.csv introuvable dans l\'archive : est-ce bien l\'export Strava ?');
  }

  async function readExport(file) {
    const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
    const isZip = head[0] === 0x50 && head[1] === 0x4b;
    const text = isZip
      ? new TextDecoder().decode(await readZipEntry(file, /(^|\/)activities\.csv$/i))
      : await file.text();
    return activitiesFromCSV(text);
  }

  // ---------- Analyse ----------
  function analyze(acts, todayISO) {
    const today = U.parseDate(todayISO);
    const thisMonday = U.mondayOf(today);
    const runs = acts.filter((a) => isRunType(a.type) && a.km >= 0.5 && a.min > 0 && a.date <= todayISO);
    const weekStart = (k) => U.addDays(thisMonday, -7 * k); // k = 1 : semaine complète précédente
    const inWeeks = (a, k) => a.date >= U.fmtISO(weekStart(k)) && a.date < U.fmtISO(thisMonday);
    const recent = runs.filter((a) => inWeeks(a, RULES.vmaWeeks));
    const res = { enough: false, nRuns: recent.length, rules: RULES };
    const last8 = runs.filter((a) => inWeeks(a, RULES.habitWeeks));
    if (last8.length < 4) return res;
    res.enough = true;

    // Volume par semaine (semaines complètes, de la plus récente à la plus ancienne)
    const weekly = [];
    for (let k = 1; k <= 12; k++) {
      const s = U.fmtISO(weekStart(k));
      const e = U.fmtISO(weekStart(k - 1));
      const list = runs.filter((a) => a.date >= s && a.date < e);
      weekly.push({ start: s, km: list.reduce((t, a) => t + a.km, 0), n: list.length, list });
    }
    res.weekly = weekly;
    res.currentKm = Math.round(weekly.slice(0, RULES.volumeWeeks).reduce((t, w) => t + w.km, 0) / RULES.volumeWeeks);
    res.longestKm = Math.round(Math.max(...runs.filter((a) => inWeeks(a, RULES.longWeeks)).map((a) => a.km)) * 10) / 10;
    res.perWeek = Math.round((last8.length / RULES.habitWeeks) * 10) / 10;

    // Jours habituels et jour de sortie longue
    const dayWeeks = [0, 0, 0, 0, 0, 0, 0];
    const longDayCount = [0, 0, 0, 0, 0, 0, 0];
    weekly.slice(0, RULES.habitWeeks).forEach((w) => {
      const days = new Set(w.list.map((a) => U.weekday(U.parseDate(a.date))));
      days.forEach((d) => dayWeeks[d]++);
      if (w.list.length) {
        const longest = w.list.reduce((b, a) => (a.km > b.km ? a : b));
        longDayCount[U.weekday(U.parseDate(longest.date))]++;
      }
    });
    let runDays = dayWeeks.map((c, d) => (c >= RULES.habitMin ? d : -1)).filter((d) => d >= 0);
    if (runDays.length < 2) runDays = dayWeeks.map((c, d) => [c, d]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, 2).map(([, d]) => d).sort((a, b) => a - b);
    res.runDays = runDays;
    res.longDay = longDayCount.indexOf(Math.max(...longDayCount));
    if (!runDays.includes(res.longDay)) res.runDays = [...runDays, res.longDay].sort((a, b) => a - b);

    // Terrain
    const km = recent.reduce((t, a) => t + a.km, 0);
    res.trailShare = recent.length ? recent.filter((a) => isTrailType(a.type)).length / recent.length : 0;
    res.dplusPerKm = km ? Math.round(recent.reduce((t, a) => t + (a.elev || 0), 0) / km) : 0;

    // VMA : course officielle si présente, sinon 2e meilleure sortie plate (écarte une erreur GPS)
    const cands = recent.filter((a) => a.km >= RULES.vmaMinKm && a.min >= RULES.vmaMinMin && (a.elev || 0) / a.km < RULES.vmaMaxDplusPerKm)
      .map((a) => ({ a, vma: P.estimateVma(a.km, a.min) }))
      .filter((x) => x.vma > 7 && x.vma < 25)
      .sort((x, y) => y.vma - x.vma);
    const races = cands.filter((x) => x.a.race);
    const pick = races[0] || cands[Math.min(1, cands.length - 1)];
    if (pick) {
      res.vma = Math.round(pick.vma * 10) / 10;
      res.vmaFrom = { name: pick.a.name, date: pick.a.date, km: pick.a.km, time: U.fmtTime(pick.a.min), race: !!pick.a.race };
    }

    // Niveau
    const v = res.vma || 13;
    const k = res.currentKm;
    res.level = k < 15 || v < 11.5 ? 'debutant' : (k >= 40 && v >= 15) || k >= 60 || v >= 17 ? 'confirme' : 'intermediaire';
    return res;
  }

  RP.history = { parseCSV, activitiesFromCSV, readZipEntry, readExport, analyze, parseDate, RULES };
})(window.RP);
