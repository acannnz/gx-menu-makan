(function () {
  'use strict';

  var LS_KEY = 'menugx.imported.v1';
  var SHEETJS_URL = 'vendor/xlsx.full.min.js';
  // Opsional: link menu.json yang di-online-kan, supaya aplikasi Android ikut dapat menu baru tanpa import
  var REMOTE_MENU_URL = '';
  var MEAL_ORDER = ['pagi', 'siang', 'sore'];
  var MEAL_LABEL = { pagi: 'Pagi', siang: 'Siang', sore: 'Sore' };
  // Perkiraan jam makan untuk tanda "Sekarang" (menit sejak 00:00) — sesuaikan dengan jadwal kantor
  var NOW_SLOTS = [['pagi', 0, 10 * 60], ['siang', 10 * 60, 15 * 60], ['sore', 15 * 60, 24 * 60]];
  var HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var HARI_PENDEK = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  var BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  var ICONS = {
    pagi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v8M4.9 10.9l1.4 1.4M2 18h2M20 18h2M19.1 10.9l-1.4 1.4M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0"/></svg>',
    siang: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>',
    sore: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10V2M4.9 10.9l1.4 1.4M2 18h2M20 18h2M19.1 10.9l-1.4 1.4M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0"/></svg>',
  };

  var $ = function (id) { return document.getElementById(id); };
  var months = {};   // 'YYYY-MM' → { label, days, source, generatedAt }
  var range = [];    // semua tanggal di strip
  var selected = null;
  var lastToday = null;
  // Berjalan di dalam aplikasi Android (Capacitor) → widget & berbagi lewat plugin MenuGX
  var NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

  function nativeCall(method, options) {
    return window.Capacitor.nativePromise('MenuGX', method, options || {});
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function todayKey() { return keyOf(new Date()); }
  function diffDays(a, b) { return Math.round((parseKey(a) - parseKey(b)) / 86400000); }
  function menuFor(k) { var m = months[k.slice(0, 7)]; return (m && m.days[k]) || null; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---------- Data ----------
  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeLocal(obj) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); return true; } catch (e) { return false; }
  }
  // Per bulan, pakai versi yang paling baru dibuat (import di HP vs menu.json di server)
  function merge(hosted, local) {
    var out = {};
    Object.keys(hosted).forEach(function (k) { out[k] = hosted[k]; });
    Object.keys(local).forEach(function (k) {
      if (!out[k] || (local[k].generatedAt || '') > (out[k].generatedAt || '')) out[k] = local[k];
    });
    return out;
  }
  function fetchMonths(url) {
    return fetch(url, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { return j.months || {}; })
      .catch(function () { return {}; });
  }
  function loadHosted() {
    return Promise.all([fetchMonths('menu.json'), REMOTE_MENU_URL ? fetchMonths(REMOTE_MENU_URL) : {}])
      .then(function (r) { return merge(r[0], r[1]); });
  }

  // Kirim menu ke widget Android (bulan lalu ke depan saja, supaya ringkas)
  function syncWidget() {
    if (!NATIVE) return Promise.resolve(null);
    var d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    var from = d.getFullYear() + '-' + pad(d.getMonth() + 1);
    var recent = {};
    Object.keys(months).forEach(function (ym) { if (ym >= from) recent[ym] = months[ym]; });
    return nativeCall('setMenu', { months: JSON.stringify(recent) }).catch(function () { return null; });
  }

  // ---------- Tampilan ----------
  function currentSlot() {
    var d = new Date(), min = d.getHours() * 60 + d.getMinutes();
    for (var i = 0; i < NOW_SLOTS.length; i++) if (min >= NOW_SLOTS[i][1] && min < NOW_SLOTS[i][2]) return NOW_SLOTS[i][0];
    return null;
  }

  function buildStrip() {
    var t = todayKey();
    var set = {};
    Object.keys(months).forEach(function (ym) { set[ym] = 1; });
    set[t.slice(0, 7)] = 1;
    range = [];
    Object.keys(set).sort().forEach(function (ym) {
      var p = ym.split('-'), n = new Date(+p[0], +p[1], 0).getDate();
      for (var d = 1; d <= n; d++) range.push(ym + '-' + pad(d));
    });
    $('strip').innerHTML = range.map(function (k, i) {
      var d = parseKey(k);
      var sep = d.getDate() === 1 && i > 0 ? '<span class="strip-sep">' + BULAN[d.getMonth()].slice(0, 3) + '</span>' : '';
      var cls = 'chip' + (menuFor(k) ? '' : ' chip--empty') + (k === t ? ' chip--today' : '');
      return sep + '<button type="button" class="' + cls + '" data-k="' + k + '" aria-label="' +
        HARI[d.getDay()] + ' ' + d.getDate() + ' ' + BULAN[d.getMonth()] + '">' +
        '<span class="dow">' + HARI_PENDEK[d.getDay()] + '</span><span class="num">' + d.getDate() + '</span></button>';
    }).join('');
    lastToday = t;
  }

  function scrollStripTo(k, smooth) {
    var strip = $('strip'), chip = strip.querySelector('[data-k="' + k + '"]');
    if (!chip) return;
    var left = chip.offsetLeft - strip.clientWidth / 2 + chip.offsetWidth / 2;
    strip.scrollTo({ left: Math.max(0, left), behavior: smooth ? 'smooth' : 'auto' });
  }

  function mealCard(meal, rows, isNow) {
    var rice = null, rest = rows;
    if (rows.length && rows[0].every(function (x) { return /^nasi\b/i.test(x); })) {
      rice = rows[0].join(' / ');
      rest = rows.slice(1);
    }
    var main = rest[0] || [];
    var sides = [].concat.apply([], rest.slice(1));
    var special = rice && !/^nasi putih$/i.test(rice);
    return '<article class="meal meal--' + meal + (isNow ? ' is-now' : '') + '">' +
      '<header class="meal-head">' +
        '<span class="meal-ico">' + ICONS[meal] + '</span>' +
        '<h3>' + MEAL_LABEL[meal] + '</h3>' +
        (isNow ? '<span class="now">Sekarang</span>' : '') +
        (rice ? '<span class="rice' + (special ? ' rice--special' : '') + '">' + esc(rice) + '</span>' : '') +
      '</header>' +
      '<ul class="dishes">' +
        main.map(function (x) { return '<li class="main">' + esc(x) + '</li>'; }).join('') +
        sides.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') +
      '</ul></article>';
  }

  function emptyState() {
    return '<div class="empty"><h3>Belum ada menu untuk tanggal ini</h3>' +
      '<p>Import file Excel menu bulan ini supaya menunya muncul.</p>' +
      '<button type="button" class="btn" data-action="import">Import Excel</button></div>';
  }

  function relLabel(diff) {
    if (diff === 0) return 'Hari ini';
    if (diff === 1) return 'Besok';
    if (diff === -1) return 'Kemarin';
    return diff > 0 ? diff + ' hari lagi' : -diff + ' hari lalu';
  }

  function renderDay(dir) {
    var k = selected, d = parseKey(k), diff = diffDays(k, todayKey());
    var menu = menuFor(k), month = months[k.slice(0, 7)];

    $('relLabel').textContent = relLabel(diff);
    $('dayTitle').textContent = HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()];
    $('todayBtn').hidden = diff === 0;
    $('monthLabel').textContent = month ? month.label : BULAN[d.getMonth()] + ' ' + d.getFullYear();
    $('sourceLabel').textContent = month && month.source ? 'Sumber: ' + month.source : '';

    var now = diff === 0 ? currentSlot() : null;
    var box = $('meals');
    box.innerHTML = menu
      ? MEAL_ORDER.filter(function (m) { return menu[m] && menu[m].length; })
          .map(function (m) { return mealCard(m, menu[m], m === now); }).join('')
      : emptyState();

    box.classList.remove('enter-next', 'enter-prev');
    if (dir) { void box.offsetWidth; box.classList.add(dir > 0 ? 'enter-next' : 'enter-prev'); }
  }

  function select(k, opts) {
    opts = opts || {};
    if (range.indexOf(k) === -1) return;
    var dir = selected && opts.animate !== false ? Math.sign(diffDays(k, selected)) : 0;
    selected = k;
    var chips = $('strip').querySelectorAll('.chip');
    for (var i = 0; i < chips.length; i++) {
      var on = chips[i].getAttribute('data-k') === k;
      chips[i].classList.toggle('is-selected', on);
      chips[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    scrollStripTo(k, opts.smooth !== false);
    renderDay(dir);
  }

  function step(n) {
    var i = range.indexOf(selected) + n;
    if (i >= 0 && i < range.length) select(range[i]);
  }

  // ---------- Toast ----------
  var toastTimer = null;
  function toast(msg, sticky) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  // ---------- Bagikan ----------
  function shareText() {
    var k = selected, d = parseKey(k), menu = menuFor(k);
    if (!menu) return null;
    var lines = ['🍽️ Menu GX — ' + HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear(), ''];
    MEAL_ORDER.forEach(function (m) {
      if (menu[m]) lines.push('*' + MEAL_LABEL[m] + '*: ' + [].concat.apply([], menu[m]).join(', '));
    });
    return lines.join('\n');
  }

  function share() {
    var text = shareText();
    if (!text) return toast('Tidak ada menu di tanggal ini');
    if (NATIVE) {
      nativeCall('share', { text: text }).catch(function () { toast('Gagal membuka menu bagikan'); });
      return;
    }
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
        .then(function () { toast('Menu disalin — tinggal tempel di WhatsApp'); })
        .catch(function () { toast('Gagal menyalin menu'); });
    } else {
      toast('Browser ini belum bisa berbagi');
    }
  }

  // ---------- Import Excel ----------
  function loadSheetJS() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SHEETJS_URL;
      s.onload = function () { resolve(window.XLSX); };
      s.onerror = function () { reject(new Error('net')); };
      document.head.appendChild(s);
    });
  }

  function importFile(file) {
    toast('Membaca ' + file.name + '…', true);
    Promise.all([loadSheetJS(), file.arrayBuffer()])
      .then(function (r) {
        var XLSX = r[0];
        var res = window.GXParser.parseWorkbook(XLSX, XLSX.read(r[1], { type: 'array' }), file.name);
        if (!res) return toast('Format Excel tidak dikenali — pastikan ini file menu bulanan');
        var month = { label: res.label, source: res.source, generatedAt: res.generatedAt, days: res.days };
        var local = readLocal();
        local[res.month] = month;
        var saved = writeLocal(local);
        months[res.month] = month;
        buildStrip();
        var t = todayKey();
        select(t.slice(0, 7) === res.month ? t : res.month + '-01', { animate: false });
        syncWidget();
        toast('Menu ' + res.label + ' dimuat (' + res.dayCount + ' hari)' + (saved ? '' : ' — belum tersimpan permanen di HP ini'));
      })
      .catch(function (e) {
        toast(e && e.message === 'net' ? 'Perlu internet untuk import pertama kali' : 'Gagal membaca file Excel');
      });
  }

  // ---------- Widget (aplikasi Android) ----------
  function pinWidget() {
    nativeCall('pinWidget').then(function (r) {
      if (!r || !r.ok) toast('Tekan lama layar utama → Widget → Menu GX');
    }).catch(function () { toast('Tekan lama layar utama → Widget → Menu GX'); });
  }

  function updateWidgetButton(info) {
    // Tombol muncul kalau widget belum dipasang
    $('widgetBtn').hidden = !(info && info.widgets === 0);
  }

  // ---------- Event ----------
  function bind() {
    $('strip').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (chip) select(chip.getAttribute('data-k'));
    });
    $('todayBtn').addEventListener('click', function () { select(todayKey()); });
    $('shareBtn').addEventListener('click', share);
    var pick = function () { $('fileInput').click(); };
    $('importBtn').addEventListener('click', pick);
    $('importLink').addEventListener('click', pick);
    $('widgetBtn').addEventListener('click', pinWidget);
    $('meals').addEventListener('click', function (e) {
      if (e.target.closest('[data-action="import"]')) pick();
    });
    $('fileInput').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (f) importFile(f);
      e.target.value = '';
    });

    // Geser kiri/kanan di area menu untuk pindah hari
    var sx = 0, sy = 0, st = 0;
    var main = $('main');
    main.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
    }, { passive: true });
    main.addEventListener('touchend', function (e) {
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5 && Date.now() - st < 700) step(dx < 0 ? 1 : -1);
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
    });

    // Aplikasi dibuka lagi (mis. besok pagi): lompat ke hari ini & segarkan tanda "Sekarang"
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (lastToday !== todayKey()) { buildStrip(); select(todayKey(), { animate: false, smooth: false }); }
      else renderDay(0);
      syncWidget().then(updateWidgetButton);
    });
    setInterval(function () { if (!document.hidden && selected === todayKey()) renderDay(0); }, 60000);
  }

  function init() {
    bind();
    var local = readLocal();
    loadHosted().then(function (hosted) {
      months = merge(hosted, local);
      buildStrip();
      select(todayKey(), { animate: false, smooth: false });
      syncWidget().then(updateWidgetButton);
    });
    if (!NATIVE && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  init();
})();
