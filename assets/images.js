/* ============================================================
   images.js —— 自动配图引擎（window.IMAGES）
   目标：任何 image 页在缺图时都能得到一张「讲得清」的示意图，
   不再出现空框占位。

   能力：
   1) 本地 Canvas 生成 1600×900 教学示意图（默认，离线可用）
   2) 可选 Wikimedia Commons 在线实拍图（CORS，失败自动回退）
   3) 按标题 / 副标题 / 图注 / 要点自动选择版式：
      沃克环流、光的折射、字母卡、对话、对比、流程、循环、时间线、概念图
   4) 生成结果写回 slide.image.src（dataURL），网页 / 图片版导出 / 原生 PPTX 共用

   对外 API：
     IMAGES.ensureDeck(deck, theme, {force, online, onProgress}) -> Promise<deck>
     IMAGES.ensureDeckSync(deck, theme, {force})                 -> deck
     IMAGES.figureFor(slide, theme, {force})                     -> dataURL
     IMAGES.generateInto(slide, theme, {force})                  -> dataURL
     IMAGES.findOnline(slide, theme)                             -> Promise<{src,credit}|null>
     IMAGES.needsImage(slide)
     IMAGES.status(deck) -> {total, auto, upload, missing}
     IMAGES.templateName(id)
   ============================================================ */
(function (global) {
  'use strict';

  var W = 1600;
  var H = 900;
  var PAD = 70;
  var CACHE_LIMIT = 48;

  var SANS = '"Microsoft YaHei","Noto Sans SC","PingFang SC","Hiragino Sans GB","Segoe UI",sans-serif';
  var SERIF = '"Songti SC","Noto Serif SC","SimSun",Georgia,serif';
  var EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

  var FALLBACK = {
    bg: '#ffffff', surface: '#f4f6fa', text: '#0f172a', muted: '#64748b',
    primary: '#2563eb', accent: '#f59e0b', line: 'rgba(15,23,42,.10)'
  };

  var cache = new Map();

  /* ============================================================
     颜色 / 基础绘图
     ============================================================ */
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function parseColor(v) {
    if (!v) return null;
    v = String(v).trim();
    if (v.charAt(0) === '#') {
      var h = v.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      if (h.length === 8) h = h.slice(0, 6);
      var n = parseInt(h, 16);
      if (!isFinite(n)) return null;
      return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }
    var m = v.match(/rgba?\(([^)]+)\)/i);
    if (m) {
      var p = m[1].split(',').map(function (x) { return parseFloat(x); });
      return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: p.length > 3 ? p[3] : 1 };
    }
    return null;
  }

  function mix(a, b, t) {
    var x = parseColor(a) || { r: 0, g: 0, b: 0 };
    var y = parseColor(b) || { r: 0, g: 0, b: 0 };
    t = clamp(Number(t) || 0, 0, 1);
    return 'rgb(' + Math.round(x.r + (y.r - x.r) * t) + ',' +
      Math.round(x.g + (y.g - x.g) * t) + ',' +
      Math.round(x.b + (y.b - x.b) * t) + ')';
  }

  function alpha(color, a) {
    var c = parseColor(color) || { r: 0, g: 0, b: 0 };
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + clamp(a, 0, 1) + ')';
  }

  function lum(color) {
    var c = parseColor(color) || { r: 255, g: 255, b: 255 };
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
  }

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r == null ? 16 : r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function fillRR(ctx, x, y, w, h, r, fill) {
    ctx.save(); rr(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }

  function strokeRR(ctx, x, y, w, h, r, stroke, width) {
    ctx.save(); rr(ctx, x, y, w, h, r);
    ctx.strokeStyle = stroke; ctx.lineWidth = width || 1; ctx.stroke(); ctx.restore();
  }

  function line(ctx, x1, y1, x2, y2, color, width, dash) {
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.stroke(); ctx.restore();
  }

  function arrow(ctx, x1, y1, x2, y2, opts) {
    opts = opts || {};
    var color = opts.color || '#2563eb';
    var width = opts.width || 7;
    var head = opts.head || Math.max(15, width * 2.4);
    var ang = Math.atan2(y2 - y1, x2 - x1);
    var bx = x2 - Math.cos(ang) * head * 0.72;
    var by = y2 - Math.sin(ang) * head * 0.72;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx, by);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    if (opts.dash) ctx.setLineDash(opts.dash);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(ang - 0.44) * head, y2 - Math.sin(ang - 0.44) * head);
    ctx.lineTo(x2 - Math.cos(ang + 0.44) * head, y2 - Math.sin(ang + 0.44) * head);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  function curveArrow(ctx, x1, y1, cx, cy, x2, y2, opts) {
    opts = opts || {};
    var color = opts.color || '#2563eb';
    var width = opts.width || 7;
    var head = opts.head || Math.max(15, width * 2.4);
    var ang = Math.atan2(y2 - cy, x2 - cx);
    var bx = x2 - Math.cos(ang) * head * 0.72;
    var by = y2 - Math.sin(ang) * head * 0.72;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, bx, by);
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    if (opts.dash) ctx.setLineDash(opts.dash);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - Math.cos(ang - 0.44) * head, y2 - Math.sin(ang - 0.44) * head);
    ctx.lineTo(x2 - Math.cos(ang + 0.44) * head, y2 - Math.sin(ang + 0.44) * head);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  function textWidth(ctx, s, size, weight, font) {
    ctx.save();
    ctx.font = (weight || 400) + ' ' + (size || 24) + 'px ' + (font || SANS);
    var w = ctx.measureText(String(s == null ? '' : s)).width;
    ctx.restore();
    return w;
  }

  function truncate(ctx, s, maxW, size, weight, font) {
    s = String(s == null ? '' : s);
    if (textWidth(ctx, s, size, weight, font) <= maxW) return s;
    var chars = Array.from(s);
    var out = '';
    for (var i = 0; i < chars.length; i++) {
      var t = out + chars[i];
      if (textWidth(ctx, t + '…', size, weight, font) > maxW) break;
      out = t;
    }
    return out.replace(/[，。；、\s]+$/, '') + '…';
  }

  function T(ctx, s, x, y, o) {
    o = o || {};
    s = String(s == null ? '' : s);
    if (!s) return 0;
    ctx.save();
    ctx.font = o.font || ((o.weight || 400) + ' ' + (o.size || 24) + 'px ' + (o.serif ? SERIF : SANS));
    ctx.fillStyle = o.color || '#0f172a';
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = o.baseline || 'alphabetic';
    if (o.alpha != null) ctx.globalAlpha = clamp(o.alpha, 0, 1);
    if (o.spacing) { try { ctx.letterSpacing = o.spacing; } catch (e) { /* ignore */ } }
    if (o.maxWidth) s = truncate(ctx, s, o.maxWidth, o.size || 24, o.weight || 400, o.font);
    var w = ctx.measureText(s).width;
    if (o.stroke) {
      ctx.strokeStyle = o.stroke; ctx.lineWidth = o.strokeWidth || 1;
      ctx.strokeText(s, x, y);
    }
    ctx.fillText(s, x, y);
    ctx.restore();
    return w;
  }

  function wrap(ctx, s, maxW, size, weight, maxLines) {
    s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    if (!s) return [];
    ctx.save();
    ctx.font = (weight || 400) + ' ' + size + 'px ' + SANS;
    var chars = Array.from(s);
    var lines = [], cur = '';
    var maxL = maxLines || 4;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch === '\n') { lines.push(cur); cur = ''; continue; }
      var test = cur + ch;
      if (ctx.measureText(test).width > maxW && cur) {
        if (/[，。；：、！？）】》”’]/.test(ch) && cur.length > 1) {
          lines.push(cur + ch); cur = '';
        } else {
          lines.push(cur); cur = ch;
        }
        if (lines.length >= maxL) break;
      } else {
        cur = test;
      }
    }
    if (cur && lines.length < maxL) lines.push(cur);
    if (lines.length === maxL) {
      var total = lines.join('');
      if (total.length < s.replace(/\s+/g, '').length) {
        lines[maxL - 1] = truncate(ctx, lines[maxL - 1] + '…', maxW, size, weight, SANS);
      }
    }
    ctx.restore();
    return lines;
  }

  function chip(ctx, label, x, y, o) {
    o = o || {};
    var size = o.size || 18;
    var padX = o.padX || 14;
    var h = o.h || (size + 18);
    var w = textWidth(ctx, label, size, o.weight || 600) + padX * 2;
    fillRR(ctx, x, y, w, h, h / 2, o.bg || 'rgba(37,99,235,.12)');
    T(ctx, label, x + w / 2, y + h / 2 + 1, {
      size: size, weight: o.weight || 600, color: o.color || '#2563eb',
      align: 'center', baseline: 'middle'
    });
    return w;
  }

  /* ============================================================
     主题
     ============================================================ */
  function paletteFor(theme) {
    if (theme && theme.colors && theme.colors.bg) {
      var c = {};
      ['bg', 'surface', 'text', 'muted', 'primary', 'accent', 'line'].forEach(function (k) {
        c[k] = theme.colors[k] || FALLBACK[k];
      });
      return c;
    }
    try {
      if (global.PRESETS && PRESETS.get) {
        var r = PRESETS.get(theme || {});
        if (r && r.palette && r.palette.colors) {
          return Object.assign({}, FALLBACK, r.palette.colors);
        }
      }
    } catch (e) { /* ignore */ }
    return FALLBACK;
  }

  function styleIdFor(theme) {
    if (theme && theme.styleId) return theme.styleId;
    try { if (global.PRESETS && PRESETS.get) return PRESETS.get(theme || {}).style.id; } catch (e) { /* ignore */ }
    return 'editorial';
  }

  function look(theme) {
    var c = paletteFor(theme);
    var dark = lum(c.bg) < 0.36;
    var style = styleIdFor(theme);
    var ink = dark ? mix(c.text, '#ffffff', 0.86) : c.text;
    var card = dark ? mix(c.bg, '#ffffff', 0.075) : mix(c.bg, '#ffffff', 0.62);
    var card2 = dark ? mix(c.bg, '#ffffff', 0.12) : mix(c.bg, c.surface, 0.55);
    var lineC = dark ? 'rgba(255,255,255,.16)' : alpha(c.text, 0.13);
    var soft = dark ? 'rgba(255,255,255,.075)' : alpha(c.primary, 0.075);
    return {
      c: c, dark: dark, style: style, ink: ink,
      muted: dark ? mix(c.text, c.bg, 0.42) : c.muted,
      card: card, card2: card2, line: lineC, soft: soft,
      primary: c.primary, accent: c.accent,
      onPrimary: lum(c.primary) > 0.58 ? '#0b1020' : '#ffffff'
    };
  }

  /* ============================================================
     通用装饰
     ============================================================ */
  function bg(ctx, L) {
    var c = L.c;
    var g = ctx.createLinearGradient(0, 0, W, H);
    if (L.dark) {
      g.addColorStop(0, c.bg);
      g.addColorStop(0.62, mix(c.bg, c.primary, 0.12));
      g.addColorStop(1, mix(c.bg, c.accent, 0.08));
    } else {
      g.addColorStop(0, c.bg);
      g.addColorStop(0.62, mix(c.bg, c.primary, 0.045));
      g.addColorStop(1, mix(c.bg, c.accent, 0.06));
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // 大面积柔光
    var blobs = [
      { x: 1280, y: 120, r: 420, col: c.primary, a: L.dark ? 0.18 : 0.09 },
      { x: 190, y: 790, r: 380, col: c.accent, a: L.dark ? 0.13 : 0.08 },
      { x: 900, y: 560, r: 310, col: c.primary, a: L.dark ? 0.08 : 0.04 }
    ];
    blobs.forEach(function (b) {
      var rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      rg.addColorStop(0, alpha(b.col, b.a));
      rg.addColorStop(1, alpha(b.col, 0));
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
    });

    // 点阵
    ctx.save();
    ctx.fillStyle = L.dark ? 'rgba(255,255,255,.055)' : alpha(c.text, 0.055);
    for (var y = 36; y < H; y += 44) {
      for (var x = 36; x < W; x += 44) {
        ctx.beginPath(); ctx.arc(x, y, 1.35, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  function frame(ctx, slide, L, template) {
    bg(ctx, L);
    T(ctx, '示意图', PAD, 58, {
      size: 19, weight: 700, color: L.primary, spacing: '5px'
    });
    T(ctx, 'DIAGRAM', PAD + 88, 58, {
      size: 15, weight: 600, color: L.muted, spacing: '3px', alpha: 0.8
    });
    var rightLabel = templateLabel(template);
    T(ctx, rightLabel, W - PAD, 58, {
      size: 16, weight: 600, color: L.muted, align: 'right', spacing: '1px'
    });
    line(ctx, PAD, 96, W - PAD, 96, L.line, 1.5);

    // 页脚
    line(ctx, PAD, 852, W - PAD, 852, L.line, 1);
    T(ctx, '课件工坊 · 自动配图', PAD, 879, { size: 16, weight: 500, color: L.muted });
    T(ctx, '箭头 = 方向 / 变化　·　画面为教学示意，不按真实比例', W - PAD, 879, {
      size: 15, weight: 500, color: L.muted, align: 'right'
    });
  }

  function templateLabel(id) {
    return {
      walker: 'WALKER CIRCULATION',
      refraction: 'REFRACTION',
      alphabet: 'ALPHABET',
      dialogue: 'DIALOGUE',
      compare: 'COMPARE',
      flow: 'PROCESS',
      cycle: 'CYCLE',
      timeline: 'TIMELINE',
      concept: 'CONCEPT MAP'
    }[id] || 'DIAGRAM';
  }

  function panel(ctx, L, x, y, w, h, o) {
    o = o || {};
    fillRR(ctx, x, y, w, h, o.r || 22, o.fill || L.card);
    strokeRR(ctx, x, y, w, h, o.r || 22, o.stroke || L.line, 1.5);
  }

  function sun(ctx, x, y, r, color) {
    ctx.save();
    ctx.strokeStyle = alpha(color, 0.55); ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10));
      ctx.lineTo(x + Math.cos(a) * (r + 24), y + Math.sin(a) * (r + 24));
      ctx.stroke();
    }
    var g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
    g.addColorStop(0, mix(color, '#ffffff', 0.55));
    g.addColorStop(1, color);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function cloud(ctx, x, y, w, h, color, a) {
    ctx.save();
    ctx.fillStyle = alpha(color, a == null ? 0.96 : a);
    ctx.beginPath();
    ctx.arc(x + w * 0.26, y + h * 0.58, w * 0.20, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(x + w * 0.46, y + h * 0.40, w * 0.25, Math.PI, Math.PI * 1.78);
    ctx.arc(x + w * 0.70, y + h * 0.50, w * 0.20, Math.PI * 1.2, Math.PI * 1.95);
    ctx.arc(x + w * 0.72, y + h * 0.74, w * 0.17, Math.PI * 1.5, Math.PI * 0.5);
    ctx.lineTo(x + w * 0.24, y + h * 0.92);
    ctx.arc(x + w * 0.24, y + h * 0.72, w * 0.17, Math.PI * 0.5, Math.PI * 1.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function rain(ctx, x, y, w, h, color) {
    ctx.save();
    ctx.strokeStyle = alpha(color, 0.55); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (var i = 0; i < 6; i++) {
      var px = x + w * (0.18 + i * 0.13);
      ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px - 8, y + h);
      ctx.stroke();
    }
    ctx.restore();
  }

  function wave(ctx, x, y, w, color) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i <= w; i += 4) {
      var yy = y + Math.sin(i / 30) * 4;
      if (i === 0) ctx.moveTo(x + i, yy); else ctx.lineTo(x + i, yy);
    }
    ctx.stroke(); ctx.restore();
  }

  function person(ctx, x, y, scale, o) {
    o = o || {};
    var skin = o.skin || '#f5c6a5';
    var hair = o.hair || '#3b2a20';
    var cloth = o.cloth || '#2563eb';
    var s = scale || 1;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    // 身体
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(-44, 118);
    ctx.quadraticCurveTo(-42, 42, 0, 42);
    ctx.quadraticCurveTo(42, 42, 44, 118);
    ctx.closePath(); ctx.fill();
    // 脖子
    ctx.fillStyle = skin; ctx.fillRect(-13, 18, 26, 30);
    // 头
    ctx.beginPath(); ctx.arc(0, -12, 40, 0, Math.PI * 2); ctx.fill();
    // 头发
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.arc(0, -18, 41, Math.PI * 0.94, Math.PI * 2.06);
    ctx.lineTo(38, -2);
    ctx.quadraticCurveTo(18, -30, 0, -30);
    ctx.quadraticCurveTo(-18, -30, -38, -2);
    ctx.closePath(); ctx.fill();
    // 眼睛
    ctx.fillStyle = '#24303f';
    ctx.beginPath(); ctx.arc(-14, -10, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -10, 3.4, 0, Math.PI * 2); ctx.fill();
    // 笑
    ctx.strokeStyle = '#b4533f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 0, 12, 0.25, Math.PI - 0.25); ctx.stroke();
    ctx.restore();
  }

  function bubble(ctx, x, y, w, h, fill, tail) {
    fillRR(ctx, x, y, w, h, 20, fill);
    ctx.save();
    ctx.fillStyle = fill;
    ctx.beginPath();
    if (tail === 'left') {
      ctx.moveTo(x + 26, y + h - 2);
      ctx.lineTo(x + 8, y + h + 22);
      ctx.lineTo(x + 54, y + h - 2);
    } else {
      ctx.moveTo(x + w - 26, y + h - 2);
      ctx.lineTo(x + w - 8, y + h + 22);
      ctx.lineTo(x + w - 54, y + h - 2);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     模板 1：沃克环流 / 厄尔尼诺
     ============================================================ */
  function oceanColors(L) {
    return {
      deep: mix(L.c.primary, '#0c4a6e', 0.58),
      mid: mix(L.c.primary, '#0ea5e9', 0.42),
      warm: mix(L.c.accent, '#f97316', 0.42),
      land: L.dark ? mix(L.c.bg, '#d6bd8a', 0.42) : '#dcc79a',
      landEdge: L.dark ? 'rgba(0,0,0,.25)' : 'rgba(120,90,40,.22)'
    };
  }

  function tplWalker(ctx, slide, L, box) {
    var gap = 24;
    var h = (box.h - gap) / 2;
    walkerPanel(ctx, L, box.x, box.y, box.w, h, false);
    walkerPanel(ctx, L, box.x, box.y + h + gap, box.w, h, true);
    T(ctx, '注：箭头表示气流方向；暖色海域为暖池，冷色为冷水上涌区。', box.x, box.y + box.h + 18, {
      size: 15, color: L.muted
    });
  }

  function walkerPanel(ctx, L, x, y, w, h, elnino) {
    var oc = oceanColors(L);
    var headH = 48;
    var oceanH = 86;
    var oceanY = y + h - oceanH;
    var skyY = y + headH;
    var skyH = oceanY - skyY;
    var warmX = elnino ? x + w * 0.60 : x + w * 0.23;
    var warmW = elnino ? w * 0.48 : w * 0.40;

    ctx.save();
    rr(ctx, x, y, w, h, 20); ctx.clip();
    fillRR(ctx, x, y, w, h, 0, L.card);

    // 标题条
    ctx.fillStyle = L.dark ? 'rgba(255,255,255,.055)' : alpha(L.c.primary, 0.075);
    ctx.fillRect(x, y, w, headH);
    ctx.fillStyle = elnino ? L.c.accent : L.c.primary;
    ctx.beginPath(); ctx.arc(x + 30, y + headH / 2, 13, 0, Math.PI * 2); ctx.fill();
    T(ctx, elnino ? '02' : '01', x + 30, y + headH / 2 + 1, {
      size: 13, weight: 700, color: L.dark ? '#0b1020' : '#ffffff', align: 'center', baseline: 'middle'
    });
    T(ctx, elnino ? '厄尔尼诺年 · 环流东移' : '正常年份 · 沃克环流', x + 54, y + headH / 2 + 1, {
      size: 21, weight: 700, color: L.ink, baseline: 'middle'
    });
    T(ctx, elnino ? '信风减弱 → 西暖东冷被打破' : '信风强 → 西暖东冷', x + w - 22, y + headH / 2 + 1, {
      size: 16, weight: 600, color: L.muted, align: 'right', baseline: 'middle'
    });

    // 天空
    var sg = ctx.createLinearGradient(0, skyY, 0, oceanY);
    sg.addColorStop(0, L.dark ? mix(L.c.bg, '#0ea5e9', 0.10) : mix(L.c.bg, '#bae6fd', 0.55));
    sg.addColorStop(1, L.dark ? mix(L.c.bg, '#0ea5e9', 0.04) : mix(L.c.bg, '#e0f2fe', 0.55));
    ctx.fillStyle = sg; ctx.fillRect(x, skyY, w, skyH);

    // 太阳
    sun(ctx, elnino ? x + w * 0.20 : x + w * 0.12, skyY + 46, elnino ? 25 : 29, mix(L.c.accent, '#fbbf24', 0.55));

    // 海洋
    var og = ctx.createLinearGradient(x, oceanY, x + w, oceanY);
    og.addColorStop(0, oc.deep);
    og.addColorStop(0.45, oc.mid);
    og.addColorStop(1, oc.deep);
    ctx.fillStyle = og; ctx.fillRect(x, oceanY, w, oceanH);

    // 暖池
    var wg = ctx.createRadialGradient(warmX, oceanY + oceanH * 0.42, 10, warmX, oceanY + oceanH * 0.42, warmW * 0.58);
    wg.addColorStop(0, alpha(oc.warm, elnino ? 0.92 : 0.86));
    wg.addColorStop(0.55, alpha(oc.warm, 0.46));
    wg.addColorStop(1, alpha(oc.warm, 0));
    ctx.fillStyle = wg;
    ctx.beginPath(); ctx.ellipse(warmX, oceanY + oceanH * 0.45, warmW * 0.58, oceanH * 0.52, 0, 0, Math.PI * 2); ctx.fill();

    // 温跃层虚线
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 2; ctx.setLineDash([8, 7]);
    ctx.beginPath();
    if (elnino) {
      ctx.moveTo(x + w * 0.10, oceanY + 30);
      ctx.quadraticCurveTo(x + w * 0.50, oceanY + 40, x + w * 0.92, oceanY + 34);
    } else {
      ctx.moveTo(x + w * 0.10, oceanY + 24);
      ctx.quadraticCurveTo(x + w * 0.30, oceanY + 34, x + w * 0.58, oceanY + 60);
      ctx.lineTo(x + w * 0.92, oceanY + 68);
    }
    ctx.stroke(); ctx.restore();
    T(ctx, '温跃层', x + w * 0.84, oceanY + (elnino ? 22 : 58), {
      size: 13, color: 'rgba(255,255,255,.72)', align: 'right'
    });

    // 波浪
    wave(ctx, x + 16, oceanY + 12, w - 32, 'rgba(255,255,255,.22)');

    // 陆地
    landLeft(ctx, x, oceanY, oc);
    landRight(ctx, x + w, oceanY, oc);

    // 云与雨
    var cloudX = elnino ? x + w * 0.63 : x + w * 0.30;
    var cloudY = skyY + 34;
    cloud(ctx, cloudX, cloudY, 190, 82, L.dark ? '#e2e8f0' : '#ffffff', 0.96);
    rain(ctx, cloudX + 26, cloudY + 70, 140, skyH - 92, L.c.primary);

    // 箭头路径
    if (!elnino) {
      var ascentX = cloudX + 96;
      arrow(ctx, ascentX, oceanY - 8, ascentX, cloudY + 22, { color: L.c.accent, width: 8, head: 20 });
      arrow(ctx, cloudX + 170, skyY + 22, x + w * 0.80, skyY + 22, { color: L.c.primary, width: 8, head: 20 });
      arrow(ctx, x + w * 0.80, skyY + 40, x + w * 0.80, oceanY - 12, { color: L.c.primary, width: 8, head: 20 });
      arrow(ctx, x + w * 0.76, oceanY - 26, cloudX + 230, oceanY - 26, { color: L.c.accent, width: 7, head: 18 });

      label(ctx, L, '上升气流', ascentX - 16, cloudY - 4, 'right');
      label(ctx, L, '高空向东', x + w * 0.58, skyY + 12, 'center');
      label(ctx, L, '下沉气流', x + w * 0.80 + 16, skyY + 92, 'left');
      label(ctx, L, '信风（自东向西）', x + w * 0.56, oceanY - 36, 'center');
      seaLabel(ctx, '暖池 · 对流旺盛', warmX, oceanY + 56, 'center');
      seaLabel(ctx, '冷水上涌 · 干燥', x + w * 0.865, oceanY + 48, 'center');
    } else {
      var aX = x + w * 0.66;
      arrow(ctx, aX, oceanY - 6, aX, cloudY + 20, { color: L.c.accent, width: 8, head: 20 });
      // 高空辐散
      arrow(ctx, aX - 90, skyY + 22, x + w * 0.30, skyY + 22, { color: L.c.primary, width: 7, head: 18 });
      arrow(ctx, aX + 90, skyY + 22, x + w * 0.82, skyY + 22, { color: L.c.primary, width: 7, head: 18 });
      // 两侧下沉
      arrow(ctx, x + w * 0.30, skyY + 40, x + w * 0.30, oceanY - 12, { color: L.c.primary, width: 7, head: 18 });
      arrow(ctx, x + w * 0.82, skyY + 40, x + w * 0.82, oceanY - 12, { color: L.c.primary, width: 7, head: 18 });
      // 弱信风 / 表层辐合
      arrow(ctx, x + w * 0.34, oceanY - 26, x + w * 0.56, oceanY - 26, { color: L.c.accent, width: 6, head: 16, dash: [10, 8] });
      arrow(ctx, x + w * 0.78, oceanY - 26, x + w * 0.60, oceanY - 26, { color: L.c.accent, width: 6, head: 16, dash: [10, 8] });

      label(ctx, L, '对流东移', aX, cloudY - 4, 'center');
      label(ctx, L, '西太平洋干旱', x + w * 0.22, skyY + 78, 'center');
      label(ctx, L, '东太平洋多雨', x + w * 0.865, skyY + 78, 'center');
      label(ctx, L, '信风减弱', x + w * 0.55, oceanY - 38, 'center');
      seaLabel(ctx, '暖水东移', warmX, oceanY + 52, 'center');
    }

    // 陆地标签
    T(ctx, '印度尼西亚', x + 20, oceanY - 86, { size: 14, weight: 600, color: alpha('#3f2d12', 0.78) });
    T(ctx, '南美洲', x + w - 20, oceanY - 86, { size: 14, weight: 600, color: alpha('#3f2d12', 0.78), align: 'right' });
    T(ctx, '赤道太平洋', x + w / 2, oceanY + oceanH - 10, {
      size: 13, weight: 600, color: 'rgba(255,255,255,.62)', align: 'center'
    });

    ctx.restore();
    strokeRR(ctx, x, y, w, h, 20, L.line, 1.5);
  }

  function landLeft(ctx, x, oceanY, oc) {
    ctx.save();
    ctx.fillStyle = oc.land;
    ctx.beginPath();
    ctx.moveTo(x, oceanY + 2);
    ctx.lineTo(x, oceanY - 54);
    ctx.quadraticCurveTo(x + 46, oceanY - 74, x + 82, oceanY - 92);
    ctx.quadraticCurveTo(x + 126, oceanY - 110, x + 150, oceanY - 62);
    ctx.quadraticCurveTo(x + 168, oceanY - 30, x + 186, oceanY + 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = oc.landEdge; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  function landRight(ctx, x, oceanY, oc) {
    ctx.save();
    ctx.fillStyle = oc.land;
    ctx.beginPath();
    ctx.moveTo(x, oceanY + 2);
    ctx.lineTo(x, oceanY - 48);
    ctx.quadraticCurveTo(x - 42, oceanY - 70, x - 78, oceanY - 92);
    ctx.quadraticCurveTo(x - 118, oceanY - 112, x - 140, oceanY - 58);
    ctx.quadraticCurveTo(x - 158, oceanY - 24, x - 176, oceanY + 2);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = oc.landEdge; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  function label(ctx, L, s, x, y, align) {
    var w = textWidth(ctx, s, 16, 700);
    var bx = align === 'right' ? x - w - 12 : align === 'center' ? x - w / 2 - 12 : x - 12;
    fillRR(ctx, bx, y - 23, w + 24, 34, 17, L.dark ? 'rgba(2,6,23,.62)' : 'rgba(255,255,255,.82)');
    T(ctx, s, bx + 12, y - 5, { size: 16, weight: 700, color: L.ink });
  }

  function seaLabel(ctx, s, x, y, align) {
    T(ctx, s, x, y, {
      size: 15, weight: 600, color: 'rgba(255,255,255,.92)', align: align || 'center'
    });
  }

  /* ============================================================
     模板 2：光的折射
     ============================================================ */
  function tplRefraction(ctx, slide, L, box) {
    var x = box.x, y = box.y, w = box.w, h = box.h;
    var surfaceY = y + h * 0.44;
    var hitX = x + w * 0.46;

    // 空气 / 水
    var air = ctx.createLinearGradient(0, y, 0, surfaceY);
    air.addColorStop(0, L.dark ? mix(L.c.bg, '#ffffff', 0.02) : mix(L.c.bg, '#e0f2fe', 0.35));
    air.addColorStop(1, L.dark ? mix(L.c.bg, '#0ea5e9', 0.07) : mix(L.c.bg, '#bae6fd', 0.32));
    ctx.fillStyle = air; ctx.fillRect(x, y, w, surfaceY - y);
    var water = ctx.createLinearGradient(0, surfaceY, 0, y + h);
    water.addColorStop(0, L.dark ? mix(L.c.primary, '#0c4a6e', 0.55) : '#7dd3fc');
    water.addColorStop(1, L.dark ? mix(L.c.primary, '#082f49', 0.75) : '#0369a1');
    ctx.fillStyle = water; ctx.fillRect(x, surfaceY, w, y + h - surfaceY);
    // 水波
    for (var i = 0; i < 5; i++) {
      wave(ctx, x + 30, surfaceY + 46 + i * 74, w - 60, 'rgba(255,255,255,.22)');
    }
    // 水面
    line(ctx, x, surfaceY, x + w, surfaceY, 'rgba(255,255,255,.85)', 5);
    T(ctx, '空气  n₁ = 1.00', x + 22, y + 34, { size: 17, weight: 600, color: L.ink });
    T(ctx, '水  n₂ = 1.33', x + 22, surfaceY + 40, { size: 17, weight: 600, color: '#e0f2fe' });

    // 法线
    line(ctx, hitX, y + 22, hitX, y + h - 22, 'rgba(255,255,255,.62)', 2.5, [9, 8]);
    T(ctx, '法线', hitX + 12, y + 30, { size: 15, color: 'rgba(255,255,255,.8)' });

    // 入射光
    var inX = x + w * 0.18, inY = y + 70;
    arrow(ctx, inX, inY, hitX, surfaceY, { color: '#fde68a', width: 8, head: 22 });
    arrow(ctx, inX, inY, hitX - 8, surfaceY - 8, { color: 'rgba(253,230,138,.35)', width: 2, head: 2 });
    // 反射光
    arrow(ctx, hitX, surfaceY, x + w * 0.78, y + 54, { color: 'rgba(255,255,255,.55)', width: 4, head: 16, dash: [9, 8] });
    T(ctx, '反射光', x + w * 0.73, y + 34, { size: 15, color: 'rgba(255,255,255,.72)' });

    // 折射光（向法线偏折）
    var outX = x + w * 0.60, outY = y + h - 44;
    arrow(ctx, hitX, surfaceY, outX, outY, { color: '#fbbf24', width: 9, head: 24 });
    T(ctx, '折射光', outX + 16, outY - 8, { size: 17, weight: 700, color: '#fde68a' });

    // 角度弧
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(hitX, surfaceY, 78, Math.PI * 1.12, Math.PI * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(hitX, surfaceY, 92, Math.PI * 0.5, Math.PI * 0.66); ctx.stroke();
    ctx.restore();
    T(ctx, '入射角 i', hitX - 132, surfaceY - 40, { size: 16, weight: 700, color: '#fde68a' });
    T(ctx, '折射角 r', hitX + 58, surfaceY + 76, { size: 16, weight: 700, color: '#fde68a' });

    // 结论卡
    var cardW = 350, cardX = x + w - cardW - 24, cardY = y + h - 186;
    fillRR(ctx, cardX, cardY, cardW, 158, 20, L.dark ? 'rgba(2,6,23,.58)' : 'rgba(255,255,255,.9)');
    strokeRR(ctx, cardX, cardY, cardW, 158, 20, L.line, 1.2);
    T(ctx, '光从空气斜射入水中', cardX + 22, cardY + 38, { size: 17, weight: 700, color: L.ink });
    T(ctx, '折射角小于入射角', cardX + 22, cardY + 72, { size: 23, weight: 800, color: L.c.primary });
    T(ctx, '折射光线靠近法线偏折', cardX + 22, cardY + 110, { size: 16, color: L.muted });
    T(ctx, 'r < i', cardX + cardW - 22, cardY + 124, { size: 26, weight: 800, color: L.c.accent, align: 'right' });

    // 观察者
    person(ctx, x + w * 0.86, y + 80, 0.62, { cloth: L.c.primary });
    T(ctx, '眼睛看到的是', x + w * 0.80, y + 34, { size: 14, color: L.muted });
  }

  /* ============================================================
     模板 3：字母卡
     ============================================================ */
  function tplAlphabet(ctx, slide, L, box) {
    var items = [
      { letter: 'A', word: 'Apple', emoji: '🍎' },
      { letter: 'B', word: 'Ball', emoji: '⚽' },
      { letter: 'C', word: 'Cat', emoji: '🐱' },
      { letter: 'D', word: 'Dog', emoji: '🐶' },
      { letter: 'E', word: 'Egg', emoji: '🥚' },
      { letter: 'F', word: 'Fish', emoji: '🐟' },
      { letter: 'G', word: 'Girl', emoji: '👧' }
    ];
    var gap = 18;
    var cw = (box.w - gap * (items.length - 1)) / items.length;
    items.forEach(function (it, i) {
      var x = box.x + i * (cw + gap);
      var y = box.y + 20;
      var h = box.h - 70;
      panel(ctx, L, x, y, cw, h, { fill: L.card, r: 24 });
      // 顶部色条
      fillRR(ctx, x, y, cw, 10, 5, i % 2 ? L.c.accent : L.c.primary);
      T(ctx, it.letter, x + cw / 2, y + 128, {
        size: 118, weight: 800, color: i % 2 ? L.c.accent : L.c.primary, align: 'center', serif: true
      });
      T(ctx, it.letter.toLowerCase(), x + cw / 2, y + 178, {
        size: 52, weight: 700, color: L.muted, align: 'center', serif: true
      });
      T(ctx, it.emoji, x + cw / 2, y + 330, {
        size: 92, align: 'center', font: '92px ' + EMOJI
      });
      T(ctx, it.word, x + cw / 2, y + h - 30, {
        size: 26, weight: 700, color: L.ink, align: 'center'
      });
    });
    T(ctx, 'A–G · 看见字母，就能读出它的名字和开头的单词', box.x, box.y + box.h - 14, {
      size: 17, weight: 600, color: L.muted
    });
  }

  /* ============================================================
     模板 4：英语对话
     ============================================================ */
  function tplDialogue(ctx, slide, L, box) {
    var phrases = (slide.bullets || []).map(function (s) {
      return String(s).split(/[；;]/)[0].trim();
    }).filter(Boolean).slice(0, 4);
    if (!phrases.length) phrases = ['Hello!', 'Hi!', 'Good morning!', 'How are you?'];

    // 教室背景
    var boardW = box.w * 0.46, boardX = box.x + box.w / 2 - boardW / 2, boardY = box.y + 26;
    fillRR(ctx, boardX, boardY, boardW, 240, 16, L.dark ? mix(L.c.primary, '#052e16', 0.6) : '#22543d');
    strokeRR(ctx, boardX, boardY, boardW, 240, 16, 'rgba(255,255,255,.22)', 4);
    T(ctx, 'HELLO!', boardX + boardW / 2, boardY + 118, {
      size: 58, weight: 800, color: 'rgba(255,255,255,.92)', align: 'center', spacing: '3px'
    });
    T(ctx, 'Nice to meet you.', boardX + boardW / 2, boardY + 176, {
      size: 26, weight: 500, color: 'rgba(255,255,255,.72)', align: 'center', serif: true
    });

    person(ctx, box.x + 190, box.y + 430, 1.25, { cloth: L.c.primary, hair: '#2b2118' });
    person(ctx, box.x + box.w - 190, box.y + 430, 1.25, { cloth: L.c.accent, hair: '#4a2f1c' });

    bubble(ctx, box.x + 60, box.y + 300, 330, 108, L.dark ? 'rgba(255,255,255,.1)' : '#ffffff', 'left');
    T(ctx, phrases[0], box.x + 225, box.y + 354, {
      size: 30, weight: 700, color: L.ink, align: 'center', maxWidth: 290
    });
    bubble(ctx, box.x + box.w - 390, box.y + 360, 330, 108, L.dark ? 'rgba(255,255,255,.1)' : '#ffffff', 'right');
    T(ctx, phrases[1] || 'Hi!', box.x + box.w - 225, box.y + 414, {
      size: 30, weight: 700, color: L.ink, align: 'center', maxWidth: 290
    });

    // 底部短语条
    var y = box.y + box.h - 106;
    var x = box.x + 70;
    phrases.slice(0, 4).forEach(function (p, i) {
      var col = i % 2 ? L.c.accent : L.c.primary;
      var w = Math.min(330, textWidth(ctx, p, 19, 700) + 46);
      fillRR(ctx, x, y, w, 54, 27, alpha(col, L.dark ? 0.22 : 0.12));
      T(ctx, p, x + w / 2, y + 28, { size: 19, weight: 700, color: col, align: 'center', baseline: 'middle', maxWidth: w - 24 });
      x += w + 16;
    });
  }

  /* ============================================================
     模板 5：对比
     ============================================================ */
  function splitPair(s) {
    var t = String(s || '').replace(/^建议配图[:：]?/, '').trim();
    var parts = t.split(/与|和| vs | VS |对比|、|：|:/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (parts.length >= 2) return [parts[0], parts[1]];
    return ['正常 / 方案 A', '变化 / 方案 B'];
  }

  function tplCompare(ctx, slide, L, box) {
    var pair = splitPair((slide.image && slide.image.caption) || slide.subtitle || slide.title);
    var bullets = (slide.bullets || []).map(function (s) { return String(s).split(/[；;]/)[0].trim(); }).filter(Boolean);
    var half = Math.ceil(bullets.length / 2);
    var groups = [bullets.slice(0, half), bullets.slice(half)];
    if (!groups[0].length) groups[0] = ['特征一', '特征二'];
    if (!groups[1].length) groups[1] = ['变化一', '变化二'];

    var gap = 30, cw = (box.w - gap) / 2;
    [0, 1].forEach(function (k) {
      var x = box.x + k * (cw + gap);
      var y = box.y;
      var h = box.h - 36;
      panel(ctx, L, x, y, cw, h, { fill: L.card, r: 26 });
      fillRR(ctx, x, y, cw, 84, 26, k ? alpha(L.c.accent, 0.16) : alpha(L.c.primary, 0.14));
      ctx.save(); rr(ctx, x, y, cw, 84, 26); ctx.clip();
      ctx.fillRect(x, y + 60, cw, 24); ctx.restore();
      T(ctx, k ? 'B' : 'A', x + 34, y + 44, {
        size: 30, weight: 800, color: k ? L.c.accent : L.c.primary, baseline: 'middle'
      });
      T(ctx, truncate(ctx, pair[k], cw - 130, 25, 800), x + 76, y + 45, {
        size: 25, weight: 800, color: L.ink, baseline: 'middle'
      });

      // 图标
      var iconY = y + 180;
      iconFor(ctx, k ? 'change' : 'normal', x + cw / 2, iconY, L, k);

      var ly = y + 300;
      groups[k].slice(0, 4).forEach(function (t, i) {
        ctx.fillStyle = k ? L.c.accent : L.c.primary;
        ctx.beginPath(); ctx.arc(x + 40, ly + 12, 5, 0, Math.PI * 2); ctx.fill();
        var lines = wrap(ctx, t, cw - 90, 20, 600, 2);
        lines.forEach(function (ln, j) {
          T(ctx, ln, x + 58, ly + 18 + j * 28, { size: 20, weight: 600, color: L.ink });
        });
        ly += 30 + lines.length * 28;
      });
    });

    // 中间 VS
    var cx = box.x + box.w / 2;
    ctx.fillStyle = L.card;
    ctx.beginPath(); ctx.arc(cx, box.y + box.h / 2 - 10, 40, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = L.line; ctx.lineWidth = 2; ctx.stroke();
    T(ctx, 'VS', cx, box.y + box.h / 2 - 2, {
      size: 22, weight: 900, color: L.primary, align: 'center', baseline: 'middle'
    });
  }

  function iconFor(ctx, kind, x, y, L, alt) {
    var col = alt ? L.c.accent : L.c.primary;
    ctx.save();
    if (kind === 'normal') {
      sun(ctx, x - 55, y - 10, 30, mix(L.c.accent, '#fbbf24', 0.5));
      cloud(ctx, x + 5, y - 38, 130, 66, L.dark ? '#e2e8f0' : '#ffffff', 0.98);
      wave(ctx, x - 85, y + 48, 170, alpha(col, 0.55));
    } else {
      cloud(ctx, x - 65, y - 34, 150, 70, L.dark ? '#cbd5e1' : '#e2e8f0', 0.98);
      rain(ctx, x - 40, y + 30, 110, 46, col);
      arrow(ctx, x + 84, y + 8, x + 28, y + 8, { color: col, width: 5, head: 14 });
    }
    ctx.restore();
  }

  /* ============================================================
     模板 6：流程
     ============================================================ */
  function tplFlow(ctx, slide, L, box) {
    var raw = (slide.bullets || []).slice(0, 4);
    if (!raw.length) {
      raw = String(slide.subtitle || slide.image && slide.image.caption || '观察 → 思考 → 表达 → 应用')
        .split(/→|->|、|，/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4);
    }
    if (!raw.length) raw = ['观察现象', '提出问题', '动手验证', '总结规律'];
    var steps = raw.map(function (s) {
      var p = String(s).split(/[；;]/);
      return { title: p[0].trim(), desc: (p[1] || '').trim() };
    });
    var n = steps.length;
    var gap = 34;
    var cw = (box.w - gap * (n - 1)) / n;
    var y = box.y + 40;
    var h = box.h - 160;

    steps.forEach(function (st, i) {
      var x = box.x + i * (cw + gap);
      panel(ctx, L, x, y, cw, h, { fill: L.card, r: 24 });
      // 顶部大号数字
      T(ctx, ('0' + (i + 1)).slice(-2), x + 24, y + 78, {
        size: 58, weight: 800, color: alpha(L.c.primary, L.dark ? 0.55 : 0.22)
      });
      ctx.fillStyle = i % 2 ? L.c.accent : L.c.primary;
      ctx.beginPath(); ctx.arc(x + cw - 46, y + 48, 18, 0, Math.PI * 2); ctx.fill();
      T(ctx, String(i + 1), x + cw - 46, y + 49, {
        size: 17, weight: 800, color: L.dark ? '#0b1020' : '#ffffff', align: 'center', baseline: 'middle'
      });
      var lines = wrap(ctx, st.title, cw - 52, 27, 800, 3);
      lines.forEach(function (ln, j) {
        T(ctx, ln, x + 26, y + 150 + j * 38, { size: 27, weight: 800, color: L.ink });
      });
      if (st.desc) {
        var dl = wrap(ctx, st.desc, cw - 52, 18, 500, 4);
        dl.forEach(function (ln, j) {
          T(ctx, ln, x + 26, y + 150 + lines.length * 38 + 18 + j * 27, {
            size: 18, weight: 500, color: L.muted
          });
        });
      }
      // 装饰
      fillRR(ctx, x + 26, y + h - 26, 46, 6, 3, i % 2 ? L.c.accent : L.c.primary);

      if (i < n - 1) {
        var ax = x + cw + 6, ay = y + h / 2;
        arrow(ctx, ax, ay, ax + gap - 12, ay, { color: L.muted, width: 4, head: 12 });
      }
    });

    T(ctx, '把过程拆成可讲述的几步：先做什么、看到什么、得出什么。', box.x, box.y + box.h - 60, {
      size: 18, weight: 500, color: L.muted
    });
  }

  /* ============================================================
     模板 7：循环
     ============================================================ */
  function tplCycle(ctx, slide, L, box) {
    var labels = (slide.bullets || []).map(function (s) { return String(s).split(/[；;]/)[0].trim(); })
      .filter(Boolean).slice(0, 4);
    if (labels.length < 3) labels = ['输入', '变化', '输出', '反馈'];
    var cx = box.x + box.w / 2;
    var cy = box.y + box.h / 2 - 12;
    var rx = 380, ry = 210;

    // 中心
    ctx.save();
    var cg = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190);
    cg.addColorStop(0, alpha(L.c.primary, 0.18));
    cg.addColorStop(1, alpha(L.c.primary, 0));
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, 190, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = L.card;
    ctx.beginPath(); ctx.arc(cx, cy, 122, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = L.line; ctx.lineWidth = 2; ctx.stroke();
    var key = String(slide.title || '核心概念').replace(/[：:，,。.].*$/, '').slice(0, 8);
    T(ctx, key, cx, cy - 6, {
      size: 34, weight: 800, color: L.ink, align: 'center', maxWidth: 190
    });
    T(ctx, 'CORE', cx, cy + 30, {
      size: 14, weight: 700, color: L.muted, align: 'center', spacing: '3px'
    });

    // 节点
    var pts = [];
    for (var i = 0; i < labels.length; i++) {
      var a = -Math.PI / 2 + i * Math.PI * 2 / labels.length;
      pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, a: a });
    }
    // 弧线箭头
    for (var k = 0; k < pts.length; k++) {
      var p1 = pts[k], p2 = pts[(k + 1) % pts.length];
      var mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      curveArrow(ctx,
        p1.x + Math.cos(p1.a) * 0.16 * rx, p1.y + Math.sin(p1.a) * 0.16 * ry,
        mid.x * 1.22 - cx * 0.22, mid.y * 1.22 - cy * 0.22,
        p2.x - Math.cos(p2.a) * 0.16 * rx, p2.y - Math.sin(p2.a) * 0.16 * ry,
        { color: alpha(L.c.primary, 0.55), width: 4, head: 12 });
    }
    // 节点卡
    pts.forEach(function (p, i) {
      var w = 250, h = 78;
      var x = p.x - w / 2, y = p.y - h / 2;
      fillRR(ctx, x, y, w, h, 18, L.card);
      strokeRR(ctx, x, y, w, h, 18, L.line, 1.5);
      ctx.fillStyle = i % 2 ? L.c.accent : L.c.primary;
      ctx.beginPath(); ctx.arc(x + 24, y + h / 2, 13, 0, Math.PI * 2); ctx.fill();
      T(ctx, String(i + 1), x + 24, y + h / 2 + 1, {
        size: 13, weight: 800, color: L.dark ? '#0b1020' : '#ffffff', align: 'center', baseline: 'middle'
      });
      var lines = wrap(ctx, labels[i], w - 66, 18, 700, 2);
      lines.forEach(function (ln, j) {
        T(ctx, ln, x + 46, y + 34 + j * 22 - (lines.length - 1) * 8, {
          size: 18, weight: 700, color: L.ink
        });
      });
    });
  }

  /* ============================================================
     模板 8：时间线
     ============================================================ */
  function tplTimeline(ctx, slide, L, box) {
    var items = (slide.bullets || []).map(function (s) { return String(s).split(/[；;]/)[0].trim(); })
      .filter(Boolean).slice(0, 5);
    if (items.length < 3) items = ['起点', '发展', '转折', '至今'];
    var lineY = box.y + box.h / 2;
    var x0 = box.x + 90, x1 = box.x + box.w - 90;
    line(ctx, x0, lineY, x1, lineY, alpha(L.c.primary, 0.35), 6);
    arrow(ctx, x1 - 20, lineY, x1 + 16, lineY, { color: L.c.primary, width: 6, head: 18 });

    var step = (x1 - x0) / Math.max(1, items.length - 1);
    items.forEach(function (label, i) {
      var x = x0 + step * i;
      var up = i % 2 === 0;
      ctx.fillStyle = L.card;
      ctx.beginPath(); ctx.arc(x, lineY, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = i % 2 ? L.c.accent : L.c.primary;
      ctx.beginPath(); ctx.arc(x, lineY, 9, 0, Math.PI * 2); ctx.fill();

      var cardW = Math.min(280, step - 26);
      var cardH = 118;
      var cardY = up ? lineY - 160 : lineY + 44;
      fillRR(ctx, x - cardW / 2, cardY, cardW, cardH, 18, L.card);
      strokeRR(ctx, x - cardW / 2, cardY, cardW, cardH, 18, L.line, 1.4);
      line(ctx, x, up ? cardY + cardH : cardY, x, lineY + (up ? -16 : 16), L.line, 2, [5, 6]);
      T(ctx, String(i + 1), x - cardW / 2 + 18, cardY + 30, {
        size: 13, weight: 800, color: i % 2 ? L.c.accent : L.c.primary
      });
      var lines = wrap(ctx, label, cardW - 40, 19, 700, 3);
      lines.forEach(function (ln, j) {
        T(ctx, ln, x - cardW / 2 + 18, cardY + 60 + j * 27, {
          size: 19, weight: 700, color: L.ink
        });
      });
    });
  }

  /* ============================================================
     模板 9：概念图
     ============================================================ */
  function tplConcept(ctx, slide, L, box) {
    var labels = (slide.bullets || []).map(function (s) { return String(s).split(/[；;]/)[0].trim(); })
      .filter(Boolean).slice(0, 4);
    if (labels.length < 2) {
      labels = String(slide.subtitle || slide.image && slide.image.caption || '是什么、为什么、怎么用')
        .replace(/^建议配图[:：]?/, '').split(/、|，|；|→/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 4);
    }
    if (!labels.length) labels = ['核心概念', '关键特征', '典型例子', '实际应用'];

    var cx = box.x + box.w / 2;
    var cy = box.y + box.h / 2;
    var key = String(slide.title || '核心概念').replace(/^[一二三四五六七八九十]+、/, '').slice(0, 12);

    // 中心
    fillRR(ctx, cx - 220, cy - 82, 440, 164, 34, alpha(L.c.primary, L.dark ? 0.22 : 0.12));
    strokeRR(ctx, cx - 220, cy - 82, 440, 164, 34, alpha(L.c.primary, 0.4), 2);
    T(ctx, truncate(ctx, key, 380, 36, 800), cx, cy + 2, {
      size: 36, weight: 800, color: L.ink, align: 'center', maxWidth: 380
    });
    T(ctx, '核心概念', cx, cy + 44, {
      size: 16, weight: 600, color: L.primary, align: 'center', spacing: '2px'
    });

    var positions = [
      { x: box.x + 210, y: box.y + 130 },
      { x: box.x + box.w - 210, y: box.y + 130 },
      { x: box.x + 210, y: box.y + box.h - 130 },
      { x: box.x + box.w - 210, y: box.y + box.h - 130 }
    ];
    labels.slice(0, 4).forEach(function (label, i) {
      var p = positions[i];
      var w = 300, h = 108;
      // 连线
      line(ctx, cx + (p.x > cx ? 220 : -220) * 0.8, cy + (p.y > cy ? 70 : -70), p.x, p.y, alpha(L.c.primary, 0.3), 3, [7, 7]);
      fillRR(ctx, p.x - w / 2, p.y - h / 2, w, h, 22, L.card);
      strokeRR(ctx, p.x - w / 2, p.y - h / 2, w, h, 22, L.line, 1.4);
      ctx.fillStyle = i % 2 ? L.c.accent : L.c.primary;
      ctx.beginPath(); ctx.arc(p.x - w / 2 + 30, p.y, 15, 0, Math.PI * 2); ctx.fill();
      T(ctx, String(i + 1), p.x - w / 2 + 30, p.y + 1, {
        size: 14, weight: 800, color: L.dark ? '#0b1020' : '#ffffff', align: 'center', baseline: 'middle'
      });
      var lines = wrap(ctx, label, w - 80, 20, 700, 2);
      lines.forEach(function (ln, j) {
        T(ctx, ln, p.x - w / 2 + 56, p.y + 8 + j * 26 - (lines.length - 1) * 10, {
          size: 20, weight: 700, color: L.ink
        });
      });
    });
  }

  /* ============================================================
     模板选择 / 生成
     ============================================================ */
  function templateFor(slide) {
    var img = slide.image || {};
    var all = [
      slide.title, slide.subtitle, img.caption,
      (slide.bullets || []).join(' '),
      slide.notes
    ].join(' ').toLowerCase();
    if (/沃克|厄尔尼诺|拉尼娜|walker|el niño|el nino/.test(all)) return 'walker';
    if (/折射|入射角|折射角|refraction|透镜/.test(all)) return 'refraction';
    if (/字母|alphabet|abc|phonics|自然拼读/.test(all)) return 'alphabet';
    if (/对话|问候|打招呼|greeting|hello|hi!|how are you/.test(all)) return 'dialogue';
    if (/对比|比较|区别| vs | versus |不同|优势|劣势/.test(all)) return 'compare';
    if (/时间线|历史|发展|演变|年代|timeline|历程/.test(all)) return 'timeline';
    if (/循环|cycle|水循环|碳循环|过程图/.test(all)) return 'cycle';
    if (/步骤|流程|实验|首先|然后|第一步|process/.test(all)) return 'flow';
    if ((slide.bullets || []).length >= 3) return 'flow';
    return 'concept';
  }

  function cacheKey(slide, L, tpl) {
    var img = slide.image || {};
    return [tpl, L.c.bg, L.c.primary, L.c.accent, L.ink, slide.title, slide.subtitle, img.caption,
      (slide.bullets || []).join('|')].join('§');
  }

  function generate(slide, theme) {
    var L = look(theme);
    var tpl = templateFor(slide);
    var key = cacheKey(slide, L, tpl);
    if (cache.has(key)) return { src: cache.get(key), template: tpl };

    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    ctx.textBaseline = 'alphabetic';
    var box = { x: PAD, y: 126, w: W - PAD * 2, h: 700 };

    try {
      frame(ctx, slide, L, tpl);
      var fn = {
        walker: tplWalker, refraction: tplRefraction, alphabet: tplAlphabet,
        dialogue: tplDialogue, compare: tplCompare, flow: tplFlow,
        cycle: tplCycle, timeline: tplTimeline, concept: tplConcept
      }[tpl] || tplConcept;
      fn(ctx, slide, L, box);
    } catch (e) {
      // 极端情况下也要给出可用的画面，而不是空白
      bg(ctx, L);
      T(ctx, '课堂示意图', W / 2, H / 2 - 20, {
        size: 54, weight: 800, color: L.ink, align: 'center'
      });
      T(ctx, String(slide.title || ''), W / 2, H / 2 + 50, {
        size: 28, weight: 500, color: L.muted, align: 'center', maxWidth: W - 240
      });
    }

    var url = '';
    try { url = cv.toDataURL('image/jpeg', 0.9); }
    catch (e) { try { url = cv.toDataURL('image/png'); } catch (e2) { url = ''; } }

    if (url) {
      if (cache.size >= CACHE_LIMIT) {
        var first = cache.keys().next().value;
        cache.delete(first);
      }
      cache.set(key, url);
    }
    return { src: url, template: tpl };
  }

  function needsImage(slide) {
    if (!slide || slide.type !== 'image') return false;
    var img = slide.image || {};
    return !img.src && img.kind !== 'video' && img.kind !== 'audio';
  }

  function generateInto(slide, theme, opts) {
    opts = opts || {};
    if (!slide) return '';
    slide.image = slide.image || { caption: '', src: '', layout: 'right' };
    if (slide.image.src && !opts.force) return slide.image.src;
    var out = generate(slide, theme);
    if (!out.src) return '';
    slide.image.src = out.src;
    slide.image.auto = true;
    slide.image.kind = 'image';
    slide.image.template = out.template;
    slide.image.credit = '示意图 · 课件工坊自动绘制';
    slide.image.generatedAt = Date.now();
    delete slide.image.stale;
    delete slide.image.online;
    return out.src;
  }

  function figureFor(slide, theme, opts) {
    if (!slide) return '';
    var img = slide.image || {};
    if (img.src && !(opts && opts.force)) return img.src;
    return generate(slide, theme).src;
  }

  function ensureDeckSync(deck, theme, opts) {
    opts = opts || {};
    if (!deck || !Array.isArray(deck.slides)) return deck;
    deck.slides.forEach(function (s) {
      if (!s || s.type !== 'image') return;
      if (!s.image) s.image = { caption: '', src: '', layout: 'right' };
      var img = s.image;
      if (img.kind === 'video' || img.kind === 'audio') return;
      if (!img.src || (opts.force && img.auto)) generateInto(s, theme, { force: true });
    });
    return deck;
  }

  async function ensureDeck(deck, theme, opts) {
    opts = opts || {};
    if (!deck || !Array.isArray(deck.slides)) return deck;
    var targets = [];
    deck.slides.forEach(function (s) {
      if (!s || s.type !== 'image') return;
      if (!s.image) s.image = { caption: '', src: '', layout: 'right' };
      var img = s.image;
      if (img.kind === 'video' || img.kind === 'audio') return;
      if (!img.src || (opts.force && img.auto)) targets.push(s);
    });

    for (var i = 0; i < targets.length; i++) {
      var s = targets[i];
      if (opts.online) {
        try {
          var found = await findOnline(s, theme);
          if (found && found.src) {
            s.image.src = found.src;
            s.image.auto = false;
            s.image.online = true;
            s.image.credit = found.credit || 'Wikimedia Commons';
            s.image.pageUrl = found.page || '';
            delete s.image.template;
            if (opts.onProgress) opts.onProgress(i + 1, targets.length, 'online');
            await tick();
            continue;
          }
        } catch (e) { /* fall through to local */ }
      }
      generateInto(s, theme, { force: !!opts.force });
      if (opts.onProgress) opts.onProgress(i + 1, targets.length, 'local');
      await tick();
    }
    return deck;
  }

  function tick() {
    return new Promise(function (r) { setTimeout(r, 0); });
  }

  /* ============================================================
     在线实拍图（Wikimedia Commons）
     ============================================================ */
  var TERM_MAP = [
    [/沃克|walker/i, 'Walker circulation'],
    [/厄尔尼诺|el niño|el nino/i, 'El Nino'],
    [/拉尼娜|la niña|la nina/i, 'La Nina'],
    [/水循环|water cycle/i, 'water cycle'],
    [/光合作用|photosynthesis/i, 'photosynthesis'],
    [/折射|refraction/i, 'refraction'],
    [/反射|reflection/i, 'reflection of light'],
    [/细胞|cell/i, 'cell biology'],
    [/电路|circuit/i, 'electric circuit'],
    [/太阳系|solar system/i, 'solar system'],
    [/火山|volcano/i, 'volcano'],
    [/地震|earthquake/i, 'earthquake'],
    [/长城|great wall/i, 'Great Wall of China'],
    [/熊猫|panda/i, 'giant panda'],
    [/海洋|ocean/i, 'ocean'],
    [/森林|forest/i, 'forest'],
    [/字母|alphabet/i, 'alphabet'],
    [/问候|greeting/i, 'greeting']
  ];

  function searchTerms(slide) {
    var img = slide.image || {};
    var textAll = [slide.title, slide.subtitle, img.caption, (slide.bullets || []).join(' ')].join(' ');
    var out = [];
    TERM_MAP.forEach(function (m) { if (m[0].test(textAll) && out.indexOf(m[1]) < 0) out.push(m[1]); });
    if (!out.length) {
      var t = String(img.caption || slide.subtitle || slide.title || '').replace(/^建议配图[:：]?/, '').trim();
      if (t) out.push(t);
    }
    return out.slice(0, 2);
  }

  async function findOnline(slide) {
    if (!global.fetch || !global.AbortController) return null;
    var terms = searchTerms(slide);
    if (!terms.length) return null;
    for (var i = 0; i < terms.length; i++) {
      try {
        var hit = await commonsSearch(terms[i]);
        if (hit) return hit;
      } catch (e) { /* try next */ }
    }
    return null;
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () { reject(new Error('timeout')); }, ms);
      promise.then(function (v) { clearTimeout(timer); resolve(v); },
        function (e) { clearTimeout(timer); reject(e); });
    });
  }

  async function commonsSearch(term) {
    var q = encodeURIComponent(term + ' filetype:bitmap');
    var url = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
      '&gsrsearch=' + q + '&gsrnamespace=6&gsrlimit=8' +
      '&prop=imageinfo&iiprop=url%7Cmime%7Csize%7Cextmetadata&iiurlwidth=1600' +
      '&format=json&origin=*';
    var res = await withTimeout(fetch(url, { mode: 'cors', credentials: 'omit' }), 6500);
    if (!res.ok) return null;
    var data = await res.json();
    var pages = data && data.query && data.query.pages ? Object.keys(data.query.pages).map(function (k) {
      return data.query.pages[k];
    }) : [];
    // 按页面顺序（generator 的 index）
    pages.sort(function (a, b) { return (a.index || 99) - (b.index || 99); });
    for (var i = 0; i < pages.length; i++) {
      var info = pages[i].imageinfo && pages[i].imageinfo[0];
      if (!info) continue;
      var mime = String(info.mime || '');
      if (!/^image\/(jpeg|png|webp)$/.test(mime)) continue;
      var w = info.width || 0, h = info.height || 0;
      if (w < 640 || h < 360) continue;
      var ratio = w / h;
      if (ratio < 0.55 || ratio > 2.3) continue;
      var src = info.thumburl || info.url;
      if (!src) continue;
      var dataUrl = await toDataURL(src);
      if (!dataUrl) continue;
      var meta = info.extmetadata || {};
      var artist = meta.Artist && meta.Artist.value ? stripHtml(meta.Artist.value) : '';
      var license = meta.LicenseShortName && meta.LicenseShortName.value ? stripHtml(meta.LicenseShortName.value) : '';
      return {
        src: dataUrl,
        credit: '图：Wikimedia Commons' + (artist ? ' / ' + artist.slice(0, 40) : '') + (license ? ' · ' + license : ''),
        page: info.descriptionurl || ''
      };
    }
    return null;
  }

  async function toDataURL(src) {
    try {
      var r = await withTimeout(fetch(src, { mode: 'cors', credentials: 'omit' }), 8000);
      if (!r.ok) return '';
      var blob = await r.blob();
      if (!blob || blob.size < 6000) return '';
      var dataUrl = await new Promise(function (resolve) {
        var fr = new FileReader();
        fr.onload = function () { resolve(String(fr.result || '')); };
        fr.onerror = function () { resolve(''); };
        fr.readAsDataURL(blob);
      });
      if (!dataUrl) return '';
      // 统一缩到 1600 宽，转 JPEG，减小 PPTX 体积
      return await downscale(dataUrl);
    } catch (e) { return ''; }
  }

  function downscale(dataUrl) {
    return new Promise(function (resolve) {
      var im = new Image();
      im.onload = function () {
        try {
          var maxW = 1600, maxH = 1000;
          var sc = Math.min(1, maxW / im.width, maxH / im.height);
          var cv = document.createElement('canvas');
          cv.width = Math.max(1, Math.round(im.width * sc));
          cv.height = Math.max(1, Math.round(im.height * sc));
          var cx = cv.getContext('2d');
          cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cv.width, cv.height);
          cx.drawImage(im, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL('image/jpeg', 0.86));
        } catch (e) { resolve(dataUrl); }
      };
      im.onerror = function () { resolve(''); };
      im.src = dataUrl;
    });
  }

  function stripHtml(s) {
    return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  }

  function status(deck) {
    var out = { total: 0, auto: 0, upload: 0, missing: 0 };
    if (!deck || !Array.isArray(deck.slides)) return out;
    deck.slides.forEach(function (s) {
      if (!s || s.type !== 'image') return;
      out.total++;
      var img = s.image || {};
      if (!img.src) out.missing++;
      else if (img.auto || img.online) out.auto++;
      else out.upload++;
    });
    return out;
  }

  global.IMAGES = {
    version: '1.1.0',
    WIDTH: W,
    HEIGHT: H,
    ensureDeck: ensureDeck,
    ensureDeckSync: ensureDeckSync,
    generateInto: generateInto,
    figureFor: figureFor,
    findOnline: findOnline,
    needsImage: needsImage,
    status: status,
    templateFor: templateFor,
    templateName: templateLabel,
    look: look,
    _cache: cache
  };

  if (global.console && console.log) console.log('[IMAGES] ready, canvas auto-figure v1.1');
})(typeof window !== 'undefined' ? window : this);
