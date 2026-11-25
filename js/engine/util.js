/* Utilitaires partagés (dates, formats, combinaisons). Aucune dépendance. */
window.RP = window.RP || {};
(function (RP) {
  const U = {};

  U.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  U.round1 = (x) => Math.round(x * 10) / 10;
  U.roundHalf = (x) => Math.round(x * 2) / 2;

  // Dates locales au format AAAA-MM-JJ (jamais d'UTC pour éviter les décalages).
  U.parseDate = (s) => {
    const [y, m, d] = String(s).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  U.fmtISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  U.addDays = (d, n) => {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    x.setDate(x.getDate() + n);
    return x;
  };
  U.weekday = (d) => (d.getDay() + 6) % 7; // 0 = lundi … 6 = dimanche
  U.mondayOf = (d) => U.addDays(d, -U.weekday(d));
  U.daysBetween = (a, b) => Math.round((b - a) / 86400000);
  U.todayISO = () => U.fmtISO(new Date());

  U.DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  U.DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  U.fmtDateShort = (d) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  U.fmtDateLong = (d) => d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  U.fmtDuration = (min) => {
    min = Math.round(min);
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
  };
  U.fmtTime = (min) => {
    const s = Math.round(min * 60);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h ? `${h}h${String(m).padStart(2, '0')}'${String(sec).padStart(2, '0')}` : `${m}'${String(sec).padStart(2, '0')}`;
  };
  // "1:45:30" ou "45:30" -> minutes
  U.parseTime = (str) => {
    if (!str) return null;
    const parts = String(str).trim().split(/[:h']/).filter((p) => p !== '').map(Number);
    if (parts.some((n) => isNaN(n))) return null;
    if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
    if (parts.length === 2) return parts[0] + parts[1] / 60;
    if (parts.length === 1) return parts[0];
    return null;
  };

  U.combinations = (arr, k) => {
    const out = [];
    const rec = (start, combo) => {
      if (combo.length === k) { out.push(combo.slice()); return; }
      for (let i = start; i < arr.length; i++) { combo.push(arr[i]); rec(i + 1, combo); combo.pop(); }
    };
    rec(0, []);
    return out;
  };

  // Deux jours de la semaine sont consécutifs (dimanche -> lundi compris).
  U.adjacent = (a, b) => {
    const d = Math.abs(a - b);
    return d === 1 || d === 6;
  };

  U.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  RP.U = U;
})(window.RP);
