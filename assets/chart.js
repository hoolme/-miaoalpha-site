/* 双子星图表：累计收益线图、月度柱状图、FGI 仪表盘。颜色全部取自容器上的 CSS 变量，
 * 所以同一份脚本在三种风格、深浅两种主题下都能用。数据来自 gemini-data.js（window.GEMINI）。 */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function tok(el, name, fallback) {
    var v = getComputedStyle(el).getPropertyValue(name).trim();
    return v || fallback;
  }
  function mk(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function pct(v, d) {
    d = d === undefined ? 2 : d;
    return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d) + '%';
  }
  function niceStep(span, count) {
    var raw = span / Math.max(count, 1);
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }
  function ticks(min, max, count) {
    var step = niceStep(max - min, count);
    var out = [];
    for (var t = Math.floor(min / step) * step; t <= max + 1e-9; t += step) out.push(+t.toFixed(6));
    return out;
  }
  function tokens(el) {
    return {
      strat: tok(el, '--c-strat', '#4a6b12'),
      bench: tok(el, '--c-bench', '#3f72c4'),
      up: tok(el, '--c-up', '#a81c16'),
      down: tok(el, '--c-down', '#34a866'),
      grid: tok(el, '--c-grid', '#e5e7e2'),
      axis: tok(el, '--c-axis', '#c9cdc4'),
      ink: tok(el, '--c-ink', '#16150f'),
      muted: tok(el, '--c-muted', '#5e6358'),
      surface: tok(el, '--c-surface', '#ffffff'),
      font: tok(el, '--chart-font', 'system-ui, sans-serif')
    };
  }
  function tooltip(el) {
    var tip = el.querySelector('.mc-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'mc-tip';
      tip.hidden = true;
      el.appendChild(tip);
    }
    return tip;
  }
  function placeTip(el, tip, x, y) {
    var w = el.clientWidth, tw = tip.offsetWidth;
    var left = x + 14;
    if (left + tw > w - 4) left = x - tw - 14;
    tip.style.left = Math.max(4, left) + 'px';
    tip.style.top = Math.max(4, y - tip.offsetHeight / 2) + 'px';
  }
  function roundedBar(x, y0, w, v, h, r) {
    // 数据端 4px 圆角，基线端方角；v>=0 向上，v<0 向下
    r = Math.min(r, w / 2, Math.abs(h));
    if (v >= 0) {
      var top = y0 - h;
      return 'M' + x + ',' + y0 + 'V' + (top + r) + 'Q' + x + ',' + top + ' ' + (x + r) + ',' + top +
        'H' + (x + w - r) + 'Q' + (x + w) + ',' + top + ' ' + (x + w) + ',' + (top + r) + 'V' + y0 + 'Z';
    }
    var bot = y0 + h;
    return 'M' + x + ',' + y0 + 'V' + (bot - r) + 'Q' + x + ',' + bot + ' ' + (x + r) + ',' + bot +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + bot + ' ' + (x + w) + ',' + (bot - r) + 'V' + y0 + 'Z';
  }

  /* ---------- 累计收益线图 ---------- */
  function drawLine(el, opt) {
    var G = window.GEMINI, T = tokens(el);
    var start = opt.start || 0;
    var dates = G.dates.slice(start);
    // 从区间第一天重新起算：start=0 时基数就是年初的 1，结果与今年以来一致
    var rebase = function (arr) { var b = arr[start]; return arr.slice(start).map(function (n) { return (n / b - 1) * 100; }); };
    var series = [
      { name: opt.stratName || '双子星 5 手', color: T.strat, v: rebase(G.g5), area: true },
      { name: opt.benchName || '沪深300股指期货', color: T.bench, v: rebase(G['if']) }
    ];
    var box = el.querySelector('.mc-plot') || el;
    box.innerHTML = '';
    var W = Math.max(box.clientWidth, 280);
    var narrow = W < 520;
    var H = opt.height ? (narrow ? Math.round(opt.height * 0.78) : opt.height) : (narrow ? 240 : 320);
    var m = { l: 40, r: narrow ? 72 : 96, t: 14, b: 26 };
    var all = series[0].v.concat(series[1].v, [0]);
    var yMin = Math.min.apply(null, all), yMax = Math.max.apply(null, all);
    var yt = ticks(yMin, yMax, narrow ? 4 : 5);
    yMin = Math.min(yMin, yt[0]); yMax = Math.max(yMax, yt[yt.length - 1]);
    var n = dates.length;
    var X = function (i) { return m.l + (W - m.l - m.r) * (n === 1 ? 0 : i / (n - 1)); };
    var Y = function (v) { return m.t + (H - m.t - m.b) * (1 - (v - yMin) / (yMax - yMin)); };

    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img',
      'aria-label': series[0].name + ' 今年以来 ' + pct(series[0].v[n - 1]) + '，' + series[1].name + ' ' + pct(series[1].v[n - 1]) }, box);
    svg.style.fontFamily = T.font;

    yt.forEach(function (t) {
      mk('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: t === 0 ? T.axis : T.grid, 'stroke-width': 1 }, svg);
      var lab = mk('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', 'font-size': 11, fill: T.muted }, svg);
      lab.textContent = (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t) + '%';
    });
    var lastMonth = -1, shown = 0;
    dates.forEach(function (d, i) {
      var mo = +d.slice(5, 7);
      if (mo !== lastMonth) {
        lastMonth = mo;
        if (!narrow || shown % 2 === 0) {
          var t = mk('text', { x: X(i), y: H - 6, 'font-size': 11, fill: T.muted, 'text-anchor': i === 0 ? 'start' : 'middle' }, svg);
          t.textContent = mo + '月';
        }
        shown++;
      }
    });

    series.slice().reverse().forEach(function (s) {
      var d = s.v.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join('');
      if (s.area) {
        mk('path', { d: d + 'L' + X(n - 1) + ',' + Y(0) + 'L' + X(0) + ',' + Y(0) + 'Z', fill: s.color, 'fill-opacity': 0.1, stroke: 'none' }, svg);
      }
      mk('path', { d: d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    });
    // 末端点 + 直接标注
    var labY = series.map(function (s) { return Y(s.v[n - 1]); });
    if (Math.abs(labY[0] - labY[1]) < 30) labY[1] = labY[0] + (labY[1] >= labY[0] ? 30 : -30);
    series.forEach(function (s, k) {
      mk('circle', { cx: X(n - 1), cy: Y(s.v[n - 1]), r: 4, fill: s.color, stroke: T.surface, 'stroke-width': 2 }, svg);
      var tx = mk('text', { x: X(n - 1) + 10, y: labY[k] - 2, 'font-size': narrow ? 12 : 13, 'font-weight': 700, fill: T.ink }, svg);
      tx.textContent = pct(s.v[n - 1]);
      var tn = mk('text', { x: X(n - 1) + 10, y: labY[k] + 13, 'font-size': 11, fill: T.muted }, svg);
      tn.textContent = k === 0 ? (narrow ? '双子星' : '双子星 5 手') : (narrow ? 'IF' : 'IF 期货');
    });

    // 悬停十字线
    var cross = mk('line', { y1: m.t, y2: H - m.b, stroke: T.muted, 'stroke-width': 1, visibility: 'hidden' }, svg);
    var dots = series.map(function (s) {
      return mk('circle', { r: 4, fill: s.color, stroke: T.surface, 'stroke-width': 2, visibility: 'hidden' }, svg);
    });
    var hit = mk('rect', { x: m.l, y: m.t, width: W - m.l - m.r, height: H - m.t - m.b, fill: 'transparent' }, svg);
    var tip = tooltip(el);
    function move(ev) {
      var r = svg.getBoundingClientRect();
      var px = (ev.clientX - r.left) * (W / r.width);
      var i = Math.round((px - m.l) / (W - m.l - m.r) * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      var x = X(i);
      cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
      dots.forEach(function (c, k) { c.setAttribute('cx', x); c.setAttribute('cy', Y(series[k].v[i])); c.setAttribute('visibility', 'visible'); });
      tip.innerHTML = '<b>' + dates[i] + '</b>' + series.map(function (s) {
        return '<span><i style="background:' + s.color + '"></i>' + s.name + '<em>' + pct(s.v[i]) + '</em></span>';
      }).join('');
      tip.hidden = false;
      var br = el.getBoundingClientRect();
      placeTip(el, tip, r.left - br.left + x * (r.width / W), r.top - br.top + Y(series[0].v[i]) * (r.height / H));
    }
    function leave() {
      cross.setAttribute('visibility', 'hidden');
      dots.forEach(function (c) { c.setAttribute('visibility', 'hidden'); });
      tip.hidden = true;
    }
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerdown', move);
    hit.addEventListener('pointerleave', leave);
  }

  /* ---------- 月度柱状图 ---------- */
  function drawBars(el, opt) {
    var G = window.GEMINI, T = tokens(el);
    var data = G.g5_monthly;
    var box = el.querySelector('.mc-plot') || el;
    box.innerHTML = '';
    var W = Math.max(box.clientWidth, 260);
    var H = (opt && opt.height) || 220;
    var m = { l: 40, r: 8, t: 20, b: 26 };
    var vals = data.map(function (d) { return d.r; }).concat([0]);
    var yt = ticks(Math.min.apply(null, vals), Math.max.apply(null, vals), 4);
    var yMin = yt[0], yMax = yt[yt.length - 1];
    var Y = function (v) { return m.t + (H - m.t - m.b) * (1 - (v - yMin) / (yMax - yMin)); };
    var band = (W - m.l - m.r) / data.length;
    var bw = Math.min(24, band * 0.62);
    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': '双子星 5 手 2026 年各月收益' }, box);
    svg.style.fontFamily = T.font;
    yt.forEach(function (t) {
      mk('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), stroke: t === 0 ? T.axis : T.grid, 'stroke-width': 1 }, svg);
      var lab = mk('text', { x: m.l - 8, y: Y(t) + 4, 'text-anchor': 'end', 'font-size': 11, fill: T.muted }, svg);
      lab.textContent = (t > 0 ? '+' : t < 0 ? '−' : '') + Math.abs(t) + '%';
    });
    var tip = tooltip(el);
    data.forEach(function (d, i) {
      var cx = m.l + band * i + band / 2, x = cx - bw / 2;
      var h = Math.abs(Y(d.r) - Y(0));
      var g = mk('g', {}, svg);
      mk('path', { d: roundedBar(x, Y(0), bw, d.r, Math.max(h, 1), 4), fill: d.r >= 0 ? T.up : T.down }, g);
      var lab = mk('text', { x: cx, y: d.r >= 0 ? Y(d.r) - 6 : Y(d.r) + 14, 'text-anchor': 'middle', 'font-size': W < 420 ? 9.5 : 11, fill: T.ink }, g);
      lab.textContent = pct(d.r, 1);
      var ml = mk('text', { x: cx, y: H - 6, 'text-anchor': 'middle', 'font-size': 11, fill: T.muted }, g);
      ml.textContent = d.m;
      var hit = mk('rect', { x: m.l + band * i, y: m.t, width: band, height: H - m.t - m.b, fill: 'transparent' }, g);
      function show(ev) {
        tip.innerHTML = '<b>2026 年 ' + d.m + '</b><span><i style="background:' + (d.r >= 0 ? T.up : T.down) + '"></i>双子星 5 手<em>' + pct(d.r) + '</em></span>';
        tip.hidden = false;
        var r = svg.getBoundingClientRect(), br = el.getBoundingClientRect();
        placeTip(el, tip, r.left - br.left + cx * (r.width / W), r.top - br.top + Y(d.r) * (r.height / H));
      }
      hit.addEventListener('pointermove', show);
      hit.addEventListener('pointerdown', show);
      hit.addEventListener('pointerleave', function () { tip.hidden = true; });
    });
  }

  /* ---------- FGI 仪表盘（区间与文字沿用双子星项目 _fgi_label） ---------- */
  var FGI_ZONES = [[0, 6, '极端恐慌'], [6, 20, '恐慌'], [20, 40, '偏恐慌'], [40, 60, '中性'], [60, 80, '偏贪婪'], [80, 95, '贪婪'], [95, 100, '极端贪婪']];
  function fgiLabel(v) {
    for (var i = 0; i < FGI_ZONES.length; i++) if (v < FGI_ZONES[i][1] || i === FGI_ZONES.length - 1) return FGI_ZONES[i][2];
  }
  function drawGauge(el) {
    var G = window.GEMINI, T = tokens(el);
    var v = G.fgi[G.fgi.length - 1];
    var box = el.querySelector('.mc-plot') || el;
    box.innerHTML = '';
    var W = 268, H = 136, cx = 134, cy = 120, R = 100, rw = 14;
    var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': '恐惧贪婪指数 ' + v.toFixed(2) + '，' + fgiLabel(v) }, box);
    svg.style.fontFamily = T.font;
    svg.style.maxWidth = '280px';
    function pt(val, r) { var a = Math.PI * (1 - val / 100); return [cx + r * Math.cos(a), cy - r * Math.sin(a)]; }
    var cols = [T.down, T.down, T.down, T.axis, T.up, T.up, T.up];
    var ops = [1, 0.75, 0.5, 1, 0.5, 0.75, 1];
    FGI_ZONES.forEach(function (z, i) {
      var a = pt(z[0] + 0.6, R), b = pt(z[1] - 0.6, R);
      mk('path', { d: 'M' + a[0] + ',' + a[1] + 'A' + R + ',' + R + ' 0 0 1 ' + b[0] + ',' + b[1], fill: 'none', stroke: cols[i], 'stroke-opacity': ops[i], 'stroke-width': rw }, svg);
    });
    var tip = pt(v, R - 22), base = pt(v, 0);
    mk('line', { x1: base[0], y1: base[1], x2: tip[0], y2: tip[1], stroke: T.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
    mk('circle', { cx: cx, cy: cy, r: 6, fill: T.ink }, svg);
    [[0, '0'], [50, '50'], [100, '100']].forEach(function (p) {
      var q = pt(p[0], R + 14);
      var t = mk('text', { x: q[0], y: q[1] + 4, 'text-anchor': 'middle', 'font-size': 10, fill: T.muted }, svg);
      t.textContent = p[1];
    });
    return { value: v, label: fgiLabel(v) };
  }

  function monthlyTable(el) {
    var G = window.GEMINI;
    var rows = G.g5_monthly.map(function (d) { return '<tr><td>' + d.m + '</td><td>' + pct(d.r) + '</td></tr>'; }).join('');
    el.innerHTML = '<table class="mc-table"><thead><tr><th>月份</th><th>双子星 5 手</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }

  var jobs = [];
  function mount(el, fn, opt) {
    var job = function () { fn(el, opt || {}); };
    jobs.push(job);
    job();
  }
  var timer;
  function redrawAll() { clearTimeout(timer); timer = setTimeout(function () { jobs.forEach(function (j) { j(); }); }, 60); }
  window.addEventListener('resize', redrawAll);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', redrawAll);
  }
  new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  window.MiaoChart = {
    line: function (el, opt) { mount(el, drawLine, opt); },
    bars: function (el, opt) { mount(el, drawBars, opt); },
    gauge: function (el) { return drawGauge(el); },
    table: monthlyTable,
    pct: pct,
    fgiLabel: fgiLabel,
    redraw: redrawAll
  };
})();
