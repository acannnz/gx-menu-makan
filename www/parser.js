/*
 * Parser Excel "Menu Makan GX" → data menu per tanggal.
 * Dipakai di browser (window.GXParser) dan di Node (require('./parser.js')).
 *
 * Format Excel yang dikenali (seperti file bulanan dari kantor):
 *   - satu baris header nama hari (Sunday..Saturday / Minggu..Sabtu)
 *   - baris tanggal (angka 1–31) per minggu
 *   - di bawahnya blok Pagi / Siang / Sore (label di kolom paling kiri, boleh merged)
 *   - bulan dibaca dari sel tanggal di judul (mis. A1), atau dari nama file
 *
 * Hasil:
 *   { month: '2026-10', label: 'Oktober 2026', source, generatedAt,
 *     days: { '2026-10-01': { pagi: [['Nasi Putih'], ['Sup Ayam Sayur'], ['Kerupuk']], siang: ..., sore: ... } } }
 */
(function (root) {
  'use strict';

  var MEALS = [
    { key: 'pagi', re: /pagi|sarapan|breakfast/i },
    { key: 'siang', re: /siang|lunch/i },
    { key: 'sore', re: /sore|malam|dinner/i },
  ];
  var WEEKDAY_RE = /^\s*(sun|mon|tue|wed|thu|fri|sat|minggu|senin|selasa|rabu|kamis|jum'?at|sabtu)/i;
  var MONTHS_ID = ['januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus', 'september', 'oktober', 'november', 'desember'];
  var MONTHS_EN = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function monthLabel(y, m) {
    var name = MONTHS_ID[m - 1];
    return name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y;
  }

  // Serial tanggal Excel (sistem 1900) → {y, m}
  function serialToYM(n) {
    var d = new Date(Math.round((n - 25569) * 86400000));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
  }

  // "Menu Makan GX - Oktober 2026" → {y: 2026, m: 10}
  function monthFromText(text) {
    if (typeof text !== 'string') return null;
    var t = text.toLowerCase();
    var year = t.match(/\b(20\d{2})\b/);
    for (var i = 0; i < 12; i++) {
      if (t.indexOf(MONTHS_ID[i]) !== -1 || t.indexOf(MONTHS_EN[i]) !== -1) {
        return year ? { y: +year[1], m: i + 1 } : null;
      }
    }
    return null;
  }

  function dayNumber(v) {
    var n = typeof v === 'number' ? v
      : (typeof v === 'string' && /^\s*\d{1,2}\s*$/.test(v) ? +v : NaN);
    return Number.isInteger(n) && n >= 1 && n <= 31 ? n : null;
  }

  function isBlank(v) {
    return v === null || v === undefined || String(v).trim() === '';
  }

  // Rapikan teks: spasi ganda, kata huruf kecil semua → huruf depan kapital
  function tidy(s) {
    return s.replace(/\s+/g, ' ').trim()
      .replace(/(^|\s)([a-z])([a-z]*)(?=\s|$)/g, function (_, sp, a, b) { return sp + a.toUpperCase() + b; });
  }

  function splitItems(v) {
    if (v === null || v === undefined || typeof v === 'number') return [];
    var s = String(v);
    if (/^[\s\d.,]*$/.test(s)) return [];
    return s.split(/[,;\n]+/).map(tidy).filter(Boolean);
  }

  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function addMonths(ym, delta) {
    var idx = ym.y * 12 + (ym.m - 1) + delta;
    return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
  }

  /**
   * grid: array baris → array nilai sel (indeks 0 = baris/kolom pertama sheet)
   * hint: teks bantuan untuk menebak bulan (nama file)
   */
  function parseGrid(grid, hint) {
    // 1. Kolom hari dari baris header nama hari
    var dayCols = null;
    for (var r = 0; r < Math.min(grid.length, 20) && !dayCols; r++) {
      var cols = [];
      (grid[r] || []).forEach(function (v, c) {
        if (typeof v === 'string' && WEEKDAY_RE.test(v)) cols.push(c);
      });
      if (cols.length >= 5) dayCols = cols;
    }
    if (!dayCols) dayCols = [1, 2, 3, 4, 5, 6, 7];
    var labelCol = Math.max(0, dayCols[0] - 1);

    // 2. Bulan & tahun: sel tanggal di bagian atas → teks judul → nama file
    var ym = null;
    for (var r2 = 0; r2 < Math.min(grid.length, 5) && !ym; r2++) {
      var row2 = grid[r2] || [];
      for (var c2 = 0; c2 < row2.length && !ym; c2++) {
        var v = row2[c2];
        if (typeof v === 'number' && v > 36526 && v < 73051) ym = serialToYM(v);
        else if (v instanceof Date) ym = { y: v.getFullYear(), m: v.getMonth() + 1 };
        else if (typeof v === 'string') ym = monthFromText(v);
      }
    }
    if (!ym) ym = monthFromText(hint);
    if (!ym) return null;

    // 3. Telusuri baris: baris tanggal membuka blok minggu baru, label Pagi/Siang/Sore mengatur kolom makan
    var blocks = [];
    var cur = null, meal = null;
    grid.forEach(function (row) {
      row = row || [];
      var nums = {}, numCount = 0, other = 0;
      dayCols.forEach(function (c) {
        if (isBlank(row[c])) return;
        var n = dayNumber(row[c]);
        if (n) { nums[c] = n; numCount++; } else other++;
      });
      if (numCount > 0 && other === 0 && isBlank(row[labelCol])) {
        cur = { nums: nums, meals: {} };
        blocks.push(cur);
        meal = null;
        return;
      }
      if (!cur) return;
      var label = row[labelCol];
      if (typeof label === 'string' && label.trim()) {
        var found = MEALS.filter(function (m) { return m.re.test(label); })[0];
        meal = found ? found.key : null;
      }
      if (!meal) return;
      Object.keys(cur.nums).forEach(function (c) {
        var items = splitItems(row[c]);
        if (!items.length) return;
        var perDay = cur.meals[c] || (cur.meals[c] = {});
        (perDay[meal] || (perDay[meal] = [])).push(items);
      });
    });

    // 4. Tanggal → bulan sebenarnya (kalender kadang memuat ekor bulan lalu / awal bulan depan)
    var seq = [];
    blocks.forEach(function (b) {
      dayCols.forEach(function (c) { if (b.nums[c]) seq.push({ day: b.nums[c], meals: b.meals[c] || {} }); });
    });
    var firstOne = -1;
    for (var i = 0; i < seq.length; i++) if (seq[i].day === 1) { firstOne = i; break; }
    var offset = firstOne > 0 ? -1 : 0, prev = 0;
    var days = {};
    seq.forEach(function (s, idx) {
      if (idx === firstOne) offset = 0;
      else if (idx > firstOne && firstOne !== -1 && s.day < prev) offset++;
      prev = s.day;
      var t = addMonths(ym, offset);
      if (s.day > daysInMonth(t.y, t.m)) return;
      if (!Object.keys(s.meals).length) return;
      days[t.y + '-' + pad(t.m) + '-' + pad(s.day)] = s.meals;
    });

    var count = Object.keys(days).length;
    if (!count) return null;
    return {
      month: ym.y + '-' + pad(ym.m),
      label: monthLabel(ym.y, ym.m),
      source: hint || null,
      generatedAt: new Date().toISOString(),
      dayCount: count,
      days: days,
    };
  }

  function sheetToGrid(XLSX, ws) {
    if (!ws || !ws['!ref']) return [];
    var range = XLSX.utils.decode_range(ws['!ref']);
    var grid = [];
    for (var r = 0; r <= range.e.r; r++) {
      var row = [];
      for (var c = 0; c <= range.e.c; c++) {
        var cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
        row.push(cell ? cell.v : null);
      }
      grid.push(row);
    }
    return grid;
  }

  // Coba semua sheet, ambil yang menghasilkan hari terbanyak
  function parseWorkbook(XLSX, wb, fileName) {
    var best = null;
    wb.SheetNames.forEach(function (name) {
      var res = parseGrid(sheetToGrid(XLSX, wb.Sheets[name]), fileName || '');
      if (res && (!best || res.dayCount > best.dayCount)) best = res;
    });
    return best;
  }

  var api = { parseGrid: parseGrid, parseWorkbook: parseWorkbook, monthLabel: monthLabel, MEALS: MEALS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GXParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
