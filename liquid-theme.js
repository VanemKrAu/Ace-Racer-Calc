/**
 * LiquidThemeReveal - 液体主题切换动效模块（无音效、跨端零闪烁、原生 CSS clip-path: polygon + Shadow DOM 揭示层）
 *
 * 架构设计（方案 B 增强版：底层稳固旧主题 + 顶层新主题 Shadow DOM 快照正向 polygon 裁剪 + 双帧无缝提交）：
 * 1. 动画全程底层保持当前真实旧主题不动，绝不因合成器时序/瓦片重绘出现整屏黑白爆闪；
 * 2. 顶层 #__ltOverlay 在 Shadow DOM 内构建目标新主题视觉快照，禁用全部 transition/animation/backdrop-filter，
 *    从源头上消除克隆挂载闪烁与移动端动态 clip-path + backdrop-filter 合成闪烁；
 * 3. 使用 CSS 原生 clip-path: polygon(...) 描述单一连续闭环液体轮廓（液柱 + 弯月面 + 平滑起伏波浪），
 *    彻底告别 iOS Safari / 移动端 WebView 上跨 Shadow Host 引用外部 SVG <clipPath> url(#) 的兼容闪烁问题；
 * 4. 分离小液滴、触底飞溅水花与微弱液面高光由轻量化独立顶层 <svg> 绘制；
 * 5. 动画覆盖全屏（p >= 1）后：禁止 transition → 提交真实底层 applyTheme() → 双 rAF 确认底层已绘制上屏 → 移除揭示层。
 */
(function (root) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var DEFAULT_DURATION = 1300;
  var HIT_PHASE = 0.27;

  var activeState = null;
  var rawShadowCssCache = null;
  var rawShadowCssPromise = null;

  var SHADOW_HOST_OVERRIDE_CSS = '\n'
    + ':host { display: block; width: 100%; height: 100%; pointer-events: none; user-select: none; }\n'
    + '.lt-snap-backdrop { position: fixed; inset: 0; z-index: -1; pointer-events: none; }\n'
    + '.lt-snap-viewport { position: fixed; top: 0; left: 0; overflow-x: hidden; overflow-y: auto; scrollbar-width: none; -ms-overflow-style: none; pointer-events: none; }\n'
    + '.lt-snap-viewport::-webkit-scrollbar { display: none; }\n'
    + '.lt-snap-viewport > .lt-snap-html { display: block; position: static !important; width: 100% !important; min-height: 100% !important; height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; background: transparent !important; background-color: transparent !important; }\n'
    + '.lt-snap-viewport > .lt-snap-html > .lt-snap-body { display: block; position: relative; width: 100%; min-height: 100%; margin: 0; isolation: isolate; background: transparent !important; background-color: transparent !important; }\n'
    + '.lt-snap-viewport, .lt-snap-viewport *, .lt-snap-viewport *::before, .lt-snap-viewport *::after {\n'
    + '  transition: none !important; transition-duration: 0s !important;\n'
    + '  animation: none !important; animation-duration: 0s !important;\n'
    + '  -webkit-backdrop-filter: none !important; backdrop-filter: none !important;\n'
    + '}\n'
    + '.lt-snap-body.ds-c .ds-dock { background: rgba(26, 27, 34, .94) !important; }\n'
    + '.lt-snap-body.ds-c.light-mode .ds-dock { background: rgba(250, 250, 252, .94) !important; }\n';

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(edge0, edge1, x) {
    var t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function supportsLiquidReveal() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    if (!document.createElementNS || !Element.prototype.attachShadow) return false;
    if (typeof requestAnimationFrame !== 'function') return false;
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
      return CSS.supports('clip-path', 'polygon(0px 0px, 10px 0px, 10px 10px)')
        || CSS.supports('-webkit-clip-path', 'polygon(0px 0px, 10px 0px, 10px 10px)');
    }
    return true;
  }

  function defaultReducedMotion() {
    if (typeof window === 'undefined') return true;
    var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var perf = document.body && document.body.classList && document.body.classList.contains('performance-mode');
    return !!(rm || perf);
  }

  function rewriteSelector(selectorText) {
    if (!selectorText) return selectorText;
    var out = '';
    var i = 0;
    var n = selectorText.length;
    var bracketDepth = 0;
    var quote = '';

    while (i < n) {
      var ch = selectorText.charAt(i);
      if (quote) {
        out += ch;
        if (ch === '\\' && i + 1 < n) {
          out += selectorText.charAt(i + 1);
          i += 2;
          continue;
        }
        if (ch === quote) quote = '';
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        out += ch;
        i++;
        continue;
      }
      if (ch === '[') {
        bracketDepth++;
        out += ch;
        i++;
        continue;
      }
      if (ch === ']') {
        if (bracketDepth > 0) bracketDepth--;
        out += ch;
        i++;
        continue;
      }

      if (bracketDepth === 0) {
        var prev = i === 0 ? '' : selectorText.charAt(i - 1);
        var isBoundaryBefore = i === 0 || /[\s,>+~(]/.test(prev);
        if (isBoundaryBefore) {
          if (selectorText.slice(i, i + 5) === ':root' && !/[a-zA-Z0-9_-]/.test(selectorText.charAt(i + 5) || '')) {
            out += '.lt-snap-html';
            i += 5;
            continue;
          }
          if (selectorText.slice(i, i + 4) === 'html' && !/[a-zA-Z0-9_-]/.test(selectorText.charAt(i + 4) || '')) {
            out += '.lt-snap-html';
            i += 4;
            continue;
          }
          if (selectorText.slice(i, i + 4) === 'body' && !/[a-zA-Z0-9_-]/.test(selectorText.charAt(i + 4) || '')) {
            out += '.lt-snap-body';
            i += 4;
            continue;
          }
        }
      }

      out += ch;
      i++;
    }
    return out;
  }

  function scanBalancedBlock(src, startIdx) {
    var n = src.length;
    var depth = 0;
    var i = startIdx;
    var quote = '';
    while (i < n) {
      var ch = src.charAt(i);
      if (quote) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === quote) quote = '';
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
      if (ch === '/' && src.charAt(i + 1) === '*') {
        var endC = src.indexOf('*/', i + 2);
        i = endC >= 0 ? endC + 2 : n;
        continue;
      }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return i + 1;
      }
      i++;
    }
    return n;
  }

  function rewriteRawCss(raw) {
    var out = '';
    var i = 0;
    var n = raw.length;
    var atContainerDepth = 0;

    while (i < n) {
      var ch = raw.charAt(i);
      if (/\s/.test(ch)) { out += ch; i++; continue; }
      if (ch === '/' && raw.charAt(i + 1) === '*') {
        var endC = raw.indexOf('*/', i + 2);
        var nextI = endC >= 0 ? endC + 2 : n;
        out += raw.slice(i, nextI);
        i = nextI;
        continue;
      }
      if (ch === '}' && atContainerDepth > 0) {
        atContainerDepth--;
        out += '}';
        i++;
        continue;
      }
      if (ch === '@') {
        var atStart = i;
        var j = i + 1;
        while (j < n && /[a-zA-Z0-9_-]/.test(raw.charAt(j))) j++;
        var atName = raw.slice(i + 1, j).toLowerCase();
        var q = '';
        while (j < n) {
          var c2 = raw.charAt(j);
          if (q) {
            if (c2 === '\\') { j += 2; continue; }
            if (c2 === q) q = '';
            j++;
            continue;
          }
          if (c2 === '"' || c2 === "'") { q = c2; j++; continue; }
          if (c2 === '/' && raw.charAt(j + 1) === '*') {
            var ec2 = raw.indexOf('*/', j + 2);
            j = ec2 >= 0 ? ec2 + 2 : n;
            continue;
          }
          if (c2 === ';' || c2 === '{') break;
          j++;
        }
        if (j >= n || raw.charAt(j) === ';') {
          var endSemi = j < n ? j + 1 : n;
          out += raw.slice(atStart, endSemi);
          i = endSemi;
          continue;
        }
        if (atName === 'media' || atName === 'supports' || atName === 'layer' || atName === 'container' || atName === 'document') {
          out += raw.slice(atStart, j + 1);
          atContainerDepth++;
          i = j + 1;
          continue;
        }
        var atBlockEnd = scanBalancedBlock(raw, j);
        out += raw.slice(atStart, atBlockEnd);
        i = atBlockEnd;
        continue;
      }

      var selStart = i;
      var q3 = '';
      while (i < n) {
        var c3 = raw.charAt(i);
        if (q3) {
          if (c3 === '\\') { i += 2; continue; }
          if (c3 === q3) q3 = '';
          i++;
          continue;
        }
        if (c3 === '"' || c3 === "'") { q3 = c3; i++; continue; }
        if (c3 === '/' && raw.charAt(i + 1) === '*') {
          var ec3 = raw.indexOf('*/', i + 2);
          i = ec3 >= 0 ? ec3 + 2 : n;
          continue;
        }
        if (c3 === '{' || c3 === '}') break;
        i++;
      }
      if (i >= n) {
        out += raw.slice(selStart);
        break;
      }
      if (raw.charAt(i) === '}') {
        out += raw.slice(selStart, i);
        continue;
      }
      var rawSel = raw.slice(selStart, i);
      var bEnd = scanBalancedBlock(raw, i);
      out += rewriteSelector(rawSel) + raw.slice(i, bEnd);
      i = bEnd;
    }
    return out;
  }

  function prefetchRawShadowCss() {
    if (rawShadowCssCache !== null) return Promise.resolve(rawShadowCssCache);
    if (rawShadowCssPromise) return rawShadowCssPromise;
    if (typeof fetch !== 'function' || !window.location) return Promise.resolve(null);
    if (window.location.protocol !== 'http:' && window.location.protocol !== 'https:') {
      return Promise.resolve(null);
    }

    var origin = window.location.origin;
    var links = document.querySelectorAll('link[rel="stylesheet"][href]');
    var sameOriginUrls = [];
    for (var i = 0; i < links.length; i++) {
      try {
        var u = new URL(links[i].href, window.location.href);
        if (u.origin === origin) sameOriginUrls.push(u.href);
      } catch (_) {}
    }
    if (!sameOriginUrls.length) return Promise.resolve(null);

    rawShadowCssPromise = Promise.all(sameOriginUrls.map(function (href) {
      return fetch(href, { cache: 'force-cache' })
        .then(function (r) { return r.ok ? r.text() : ''; })
        .catch(function () { return ''; });
    })).then(function (texts) {
      var combined = '';
      for (var k = 0; k < texts.length; k++) {
        if (texts[k]) combined += rewriteRawCss(texts[k]) + '\n';
      }
      if (combined) {
        var inlineStyles = document.querySelectorAll('head style, body style');
        for (var s = 0; s < inlineStyles.length; s++) {
          if (inlineStyles[s].textContent) {
            combined += rewriteRawCss(inlineStyles[s].textContent) + '\n';
          }
        }
        rawShadowCssCache = combined + SHADOW_HOST_OVERRIDE_CSS;
      }
      return rawShadowCssCache;
    }).catch(function () {
      return null;
    });
    return rawShadowCssPromise;
  }

  function syncClonedControlsAndScroll(origRoot, cloneRoot) {
    var origInputs = origRoot.querySelectorAll('input, textarea, select, details');
    var cloneInputs = cloneRoot.querySelectorAll('input, textarea, select, details');
    var len = Math.min(origInputs.length, cloneInputs.length);
    for (var i = 0; i < len; i++) {
      var o = origInputs[i];
      var c = cloneInputs[i];
      if (o.tagName !== c.tagName) continue;
      if (o.tagName === 'INPUT') {
        if (o.type === 'checkbox' || o.type === 'radio') {
          c.checked = o.checked;
          c.indeterminate = o.indeterminate;
        } else {
          c.value = o.value;
        }
      } else if (o.tagName === 'TEXTAREA') {
        c.value = o.value;
        c.textContent = o.value;
      } else if (o.tagName === 'SELECT') {
        c.selectedIndex = o.selectedIndex;
      } else if (o.tagName === 'DETAILS') {
        c.open = o.open;
      }
    }

    var origCvs = origRoot.querySelectorAll('canvas');
    var cloneCvs = cloneRoot.querySelectorAll('canvas');
    var cvLen = Math.min(origCvs.length, cloneCvs.length);
    for (var k = 0; k < cvLen; k++) {
      var oc = origCvs[k];
      var cc = cloneCvs[k];
      if (oc.id === 'dsAmbientImg' || oc.id === 'dsAmbientImg2' || oc.id === 'dsZoneGlow') continue;
      if (!oc.width || !oc.height) continue;
      try {
        cc.width = oc.width;
        cc.height = oc.height;
        var ctx = cc.getContext('2d');
        if (ctx) ctx.drawImage(oc, 0, 0);
      } catch (_) {}
    }

    var scrollRecords = [];
    var origAll = origRoot.getElementsByTagName('*');
    var cloneAll = cloneRoot.getElementsByTagName('*');
    var allLen = Math.min(origAll.length, cloneAll.length);
    for (var m = 0; m < allLen; m++) {
      var el = origAll[m];
      if (el.scrollTop > 0 || el.scrollLeft > 0) {
        scrollRecords.push({ el: cloneAll[m], top: el.scrollTop, left: el.scrollLeft });
      }
    }
    return scrollRecords;
  }

  /**
   * 构建顶层「目标新主题」Shadow DOM 快照层（始终先隐藏，就绪后用原生 polygon 裁剪揭示）。
   */
  function createNewThemeSnapshotOverlay(toLight, onReady, onFail) {
    var body = document.body;
    var docEl = document.documentElement;
    var scrollX = window.pageXOffset || docEl.scrollLeft || 0;
    var scrollY = window.pageYOffset || docEl.scrollTop || 0;
    var vpW = docEl.clientWidth || window.innerWidth || 1;
    var vpH = docEl.clientHeight || window.innerHeight || 1;
    var targetBg = toLight ? '#f2f2f6' : '#000000';

    var host = document.createElement('div');
    host.id = '__ltOverlay';
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('inert', '');
    host.tabIndex = -1;
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483640;pointer-events:none;overflow:hidden;user-select:none;'
      + 'visibility:hidden;-webkit-transform:translateZ(0);transform:translateZ(0);';

    var shadow = host.attachShadow({ mode: 'open' });
    var useRawCache = rawShadowCssCache !== null;
    var waitLinks = [];

    if (useRawCache) {
      var cachedStyleEl = document.createElement('style');
      cachedStyleEl.textContent = rawShadowCssCache;
      shadow.appendChild(cachedStyleEl);
    } else {
      var allLinks = document.querySelectorAll('link[rel="stylesheet"][href]');
      for (var i = 0; i < allLinks.length; i++) {
        var origLink = allLinks[i];
        var rawHref = origLink.getAttribute('href') || '';
        var isExternal = /^https?:\/\//i.test(rawHref);
        if (isExternal && (!window.location || origLink.href.indexOf(window.location.origin) !== 0)) {
          continue;
        }
        var linkEl = document.createElement('link');
        linkEl.rel = 'stylesheet';
        linkEl.href = origLink.href;
        waitLinks.push(linkEl);
        shadow.appendChild(linkEl);
      }
      var inlineEls = document.querySelectorAll('head style, body style');
      for (var s = 0; s < inlineEls.length; s++) {
        if (inlineEls[s].textContent) {
          var stEl = document.createElement('style');
          stEl.textContent = inlineEls[s].textContent;
          shadow.appendChild(stEl);
        }
      }
      var overrideEl = document.createElement('style');
      overrideEl.textContent = SHADOW_HOST_OVERRIDE_CSS;
      shadow.appendChild(overrideEl);
    }

    var backdrop = document.createElement('div');
    backdrop.className = 'lt-snap-backdrop';
    backdrop.style.backgroundColor = targetBg;
    shadow.appendChild(backdrop);

    var snapViewport = document.createElement('div');
    snapViewport.className = 'lt-snap-viewport';
    snapViewport.style.width = vpW + 'px';
    snapViewport.style.height = vpH + 'px';

    var snapHtml = document.createElement('html');
    snapHtml.className = 'lt-snap-html ' + (docEl.className || '');
    snapHtml.style.colorScheme = toLight ? 'light' : 'dark';
    if (docEl.attributes) {
      for (var da = 0; da < docEl.attributes.length; da++) {
        var dattr = docEl.attributes[da];
        if (dattr.name.indexOf('data-') === 0) {
          snapHtml.setAttribute(dattr.name, dattr.value);
        }
      }
    }

    var snapBody = document.createElement('body');
    snapBody.className = 'lt-snap-body ' + (body.className || '');
    if (toLight) snapBody.classList.add('light-mode');
    else snapBody.classList.remove('light-mode');
    snapBody.style.cssText = body.style.cssText || '';
    snapBody.style.background = 'transparent';
    snapBody.style.backgroundColor = 'transparent';
    if (body.attributes) {
      for (var a = 0; a < body.attributes.length; a++) {
        var attr = body.attributes[a];
        if (attr.name.indexOf('data-') === 0) {
          snapBody.setAttribute(attr.name, attr.value);
        }
      }
    }
    snapBody.dataset.themeMode = toLight ? 'light' : 'dark';

    var scrollRecords = [];
    var children = body.childNodes;
    var origList = [];
    var cloneList = [];
    for (var c = 0; c < children.length; c++) {
      var child = children[c];
      if (child.nodeType !== 1) continue;
      var tag = child.tagName;
      if (tag === 'SCRIPT' || tag === 'NOSCRIPT' || tag === 'IFRAME') continue;
      if (child.id === 'pvDiag' || child.id === '__ltOverlay' || child.id === '__ltParticles' || child.id === '__ltSvg') continue;
      var cloned = child.cloneNode(true);
      var bad = cloned.querySelectorAll ? cloned.querySelectorAll('script, iframe') : [];
      for (var b = bad.length - 1; b >= 0; b--) {
        if (bad[b].parentNode) bad[b].parentNode.removeChild(bad[b]);
      }
      origList.push(child);
      cloneList.push(cloned);
      snapBody.appendChild(cloned);
    }

    for (var j = 0; j < origList.length; j++) {
      var recs = syncClonedControlsAndScroll(origList[j], cloneList[j]);
      for (var r = 0; r < recs.length; r++) scrollRecords.push(recs[r]);
      if (origList[j].scrollTop > 0 || origList[j].scrollLeft > 0) {
        scrollRecords.push({ el: cloneList[j], top: origList[j].scrollTop, left: origList[j].scrollLeft });
      }
    }

    var clonedThemeIcon = snapBody.querySelector('#themeIcon');
    if (clonedThemeIcon) {
      clonedThemeIcon.textContent = toLight ? '☀️' : '🌙';
    }

    snapHtml.appendChild(snapBody);
    snapViewport.appendChild(snapHtml);
    shadow.appendChild(snapViewport);
    document.documentElement.appendChild(host);

    function applyScrollAndCanvases() {
      snapViewport.scrollTop = window.pageYOffset || docEl.scrollTop || scrollY;
      snapViewport.scrollLeft = window.pageXOffset || docEl.scrollLeft || scrollX;
      for (var sr = 0; sr < scrollRecords.length; sr++) {
        scrollRecords[sr].el.scrollTop = scrollRecords[sr].top;
        scrollRecords[sr].el.scrollLeft = scrollRecords[sr].left;
      }
      if (typeof root.__pvPaintSnapshotCanvases === 'function') {
        try {
          root.__pvPaintSnapshotCanvases(snapBody, toLight);
        } catch (_) {}
      }
      try {
        var compBg = getComputedStyle(snapBody).getPropertyValue('--bg');
        if (compBg && compBg.trim()) backdrop.style.backgroundColor = compBg.trim();
      } catch (_) {}
    }

    function hasLoadedStylesheets() {
      if (useRawCache || waitLinks.length === 0) return true;
      for (var wi = 0; wi < waitLinks.length; wi++) {
        if (waitLinks[wi].sheet) return true;
      }
      return false;
    }

    var readyCalled = false;
    var fallbackTimer = 0;
    function finishReady() {
      if (readyCalled) return;
      readyCalled = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = 0;
      }
      if (!hasLoadedStylesheets()) {
        if (typeof onFail === 'function') onFail();
        return;
      }
      void snapViewport.offsetHeight;
      applyScrollAndCanvases();
      if (typeof onReady === 'function') onReady(host, targetBg);
    }

    if (waitLinks.length === 0) {
      finishReady();
    } else {
      var pending = waitLinks.length;
      var onOneDone = function () {
        pending--;
        if (pending <= 0) finishReady();
      };
      for (var w = 0; w < waitLinks.length; w++) {
        var wl = waitLinks[w];
        if (wl.sheet) {
          onOneDone();
        } else {
          wl.addEventListener('load', onOneDone, { once: true });
          wl.addEventListener('error', onOneDone, { once: true });
        }
      }
      fallbackTimer = setTimeout(finishReady, 220);
    }

    return {
      host: host,
      snapViewport: snapViewport,
      cancelWait: function () {
        readyCalled = true;
        if (fallbackTimer) {
          clearTimeout(fallbackTimer);
          fallbackTimer = 0;
        }
      }
    };
  }

  function createSplashParticles(originX, W) {
    var count = W < 520 ? 7 : 9;
    var list = [];
    for (var i = 0; i < count; i++) {
      var side = i % 2 === 0 ? -1 : 1;
      var rank = Math.floor(i / 2);
      var spreadRatio = (rank + 0.45) / Math.ceil(count / 2);
      var angleDeg = 28 + spreadRatio * 44 + ((i * 17) % 9) - 4;
      var rad = (angleDeg * Math.PI) / 180;
      var speed = (W < 520 ? 190 : 250) + spreadRatio * (W < 520 ? 210 : 300) + ((i * 37) % 50);
      list.push({
        vx: side * Math.cos(rad) * speed,
        vy: -Math.sin(rad) * speed,
        r: 2.1 + ((i * 19) % 4) * 0.72,
        delay: (i % 3) * 0.014,
        x0: originX + side * (3 + rank * 3.0)
      });
    }
    return list;
  }

  function createStreamDroplets() {
    return [
      { startP: 0.07, side: -1, offsetAmp: 7, speedMul: 0.90, r: 3.0 },
      { startP: 0.13, side: 1, offsetAmp: 8, speedMul: 0.85, r: 3.5 },
      { startP: 0.19, side: -1, offsetAmp: 6, speedMul: 0.96, r: 2.5 }
    ];
  }

  function appendDropletPath(parts, cx, cy, rx, ry) {
    parts.push(
      'M', (cx - rx).toFixed(1), cy.toFixed(1),
      'A', rx.toFixed(1), ry.toFixed(1), '0 1 0', (cx + rx).toFixed(1), cy.toFixed(1),
      'A', rx.toFixed(1), ry.toFixed(1), '0 1 0', (cx - rx).toFixed(1), cy.toFixed(1),
      'Z'
    );
  }

  function appendSmoothSvgSegment(parts, pts, startWithMove) {
    var len = pts.length;
    if (len === 0) return;
    parts.push(startWithMove ? 'M' : 'L', pts[0][0].toFixed(1), pts[0][1].toFixed(1));
    if (len === 1) return;
    if (len === 2) {
      parts.push('L', pts[1][0].toFixed(1), pts[1][1].toFixed(1));
      return;
    }
    var m0x = (pts[0][0] + pts[1][0]) * 0.5;
    var m0y = (pts[0][1] + pts[1][1]) * 0.5;
    parts.push('L', m0x.toFixed(1), m0y.toFixed(1));
    for (var i = 1; i < len - 1; i++) {
      var mx = (pts[i][0] + pts[i + 1][0]) * 0.5;
      var my = (pts[i][1] + pts[i + 1][1]) * 0.5;
      parts.push('Q', pts[i][0].toFixed(1), pts[i][1].toFixed(1), mx.toFixed(1), my.toFixed(1));
    }
    parts.push('L', pts[len - 1][0].toFixed(1), pts[len - 1][1].toFixed(1));
  }

  function pushPolyPt(polyPts, x, y) {
    polyPts.push(x.toFixed(1) + 'px ' + y.toFixed(1) + 'px');
  }

  function pushQuadBezierPoly(polyPts, x0, y0, cx, cy, x1, y1, steps) {
    for (var i = 1; i <= steps; i++) {
      var t = i / steps;
      var mt = 1 - t;
      var px = mt * mt * x0 + 2 * mt * t * cx + t * t * x1;
      var py = mt * mt * y0 + 2 * mt * t * cy + t * t * y1;
      pushPolyPt(polyPts, px, py);
    }
  }

  function evalStreamColumn(y, originX, originY, tipY, elapsedSec, maxSpan) {
    var span = Math.max(1, tipY - originY);
    var u = clamp((y - originY) / span, 0, 1);
    var env = u * Math.sin(u * Math.PI * 0.86);
    var swayAmp = clamp(maxSpan * 0.0085, 2.8, 6.2);
    var sway = (
      Math.sin((y - originY) * 0.014 - elapsedSec * 9.5) * 0.68
      + Math.sin((y - originY) * 0.028 - elapsedSec * 14.0) * 0.32
    ) * swayAmp * env;

    var topWidth = 8.8;
    var waist = 3.9 + Math.sin(u * Math.PI * 2.4 - elapsedSec * 7.5) * 0.55;
    var tipBulge = u > 0.76 ? smoothstep(0.76, 1.0, u) * 4.4 : 0;
    var topFlare = u < 0.22 ? (1 - smoothstep(0, 0.22, u)) * (topWidth - 3.9) : 0;
    var hw = Math.max(2.6, waist + topFlare + tipBulge);

    return { cx: originX + sway, hw: hw };
  }

  function evalWaveY(x, baseY, W, H, originX, p, elapsedSec) {
    var riseP = clamp((p - HIT_PHASE) / (1 - HIT_PHASE), 0, 1);
    var ampScale = smoothstep(0.0, 0.18, riseP) * (1 - smoothstep(0.80, 0.99, riseP));
    var baseAmp = clamp(H * 0.026, 12, 24) * ampScale;
    var nx = x / Math.max(1, W);

    var w1 = Math.sin(nx * Math.PI * 2.2 + elapsedSec * 3.8) * (baseAmp * 0.60);
    var w2 = Math.sin(nx * Math.PI * 4.2 - elapsedSec * 5.2 + 1.05) * (baseAmp * 0.26);
    var w3 = Math.cos(nx * Math.PI * 1.4 + elapsedSec * 2.3) * (baseAmp * 0.22);

    var impactP = clamp((p - HIT_PHASE) / 0.44, 0, 1);
    var ripple = 0;
    if (impactP > 0 && impactP < 1) {
      var dist = Math.abs(x - originX);
      var front = impactP * Math.max(W * 0.9, 520);
      var band = Math.exp(-Math.pow((dist - front * 0.6) / (130 + impactP * 140), 2));
      var decay = (1 - impactP) * (1 - impactP);
      ripple = Math.cos((dist - front) * 0.015) * (clamp(H * 0.018, 9, 17) * decay * band);
      var crater = Math.exp(-Math.pow(dist / 78, 2)) * Math.sin(impactP * Math.PI * 2.4) * (10 * decay);
      ripple += crater;
    }

    return baseY - (w1 + w2 + w3) - ripple;
  }

  /**
   * 生成正向 CSS clip-path: polygon(...) 多边形字符串与轻量粒子/高光 SVG 路径
   */
  function buildFrameGeometry(W, H, originX, originY, p, elapsedSec, splashList, streamDrops) {
    var polyPts = [];
    var dropParts = [];
    var sheenParts = [];

    var tipY;
    var streamBottomY;
    var isPooled = p >= HIT_PHASE;

    if (!isPooled) {
      var fallT = clamp(p / HIT_PHASE, 0, 1);
      var fallEase = fallT * fallT * (0.28 + 0.72 * fallT);
      tipY = originY + 6 + (H - originY - 4) * fallEase;

      var steps = 24;
      var leftPts = [];
      var rightPts = [];
      for (var i = 0; i <= steps; i++) {
        var frac = i / steps;
        var y = lerp(originY, tipY - 5, frac);
        var st = evalStreamColumn(y, originX, originY, tipY, elapsedSec, H - originY);
        leftPts.push([st.cx - st.hw, y]);
        rightPts.push([st.cx + st.hw, y]);
      }
      var tipInfo = evalStreamColumn(tipY, originX, originY, tipY, elapsedSec, H - originY);
      var rxTip = Math.max(4, tipInfo.hw);

      for (var li = 0; li < leftPts.length; li++) {
        pushPolyPt(polyPts, leftPts[li][0], leftPts[li][1]);
      }
      var tipL = leftPts[leftPts.length - 1];
      var tipR = rightPts[rightPts.length - 1];
      pushQuadBezierPoly(polyPts, tipL[0], tipL[1], tipInfo.cx - rxTip * 0.9, tipY + rxTip * 0.75, tipInfo.cx, tipY + rxTip * 0.85, 4);
      pushQuadBezierPoly(polyPts, tipInfo.cx, tipY + rxTip * 0.85, tipInfo.cx + rxTip * 0.9, tipY + rxTip * 0.75, tipR[0], tipR[1], 4);
      for (var ri = rightPts.length - 2; ri >= 0; ri--) {
        pushPolyPt(polyPts, rightPts[ri][0], rightPts[ri][1]);
      }
      pushQuadBezierPoly(polyPts, rightPts[0][0], rightPts[0][1], originX, originY - 4, leftPts[0][0], leftPts[0][1], 4);

      appendSmoothSvgSegment(sheenParts, leftPts, true);
      sheenParts.push(
        'Q', (tipInfo.cx - rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        tipInfo.cx.toFixed(1), (tipY + rxTip * 0.85).toFixed(1),
        'Q', (tipInfo.cx + rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        tipR[0].toFixed(1), tipR[1].toFixed(1)
      );
      appendSmoothSvgSegment(sheenParts, rightPts.slice().reverse().slice(1), false);

      for (var di = 0; di < streamDrops.length; di++) {
        var sd = streamDrops[di];
        if (p < sd.startP) continue;
        var dt = clamp((p - sd.startP) / (HIT_PHASE - sd.startP + 0.08), 0, 1);
        var dy = originY + 28 + (H - originY) * (dt * dt * sd.speedMul);
        if (dy >= tipY - 6 || dy >= H - 4) continue;
        var colAtDy = evalStreamColumn(dy, originX, originY, tipY, elapsedSec, H - originY);
        var dx = colAtDy.cx + sd.side * (colAtDy.hw + sd.r + 3.5 + Math.sin(dt * Math.PI) * sd.offsetAmp);
        if (dx > 6 && dx < W - 6) {
          appendDropletPath(dropParts, dx, dy, sd.r, sd.r * 1.38);
          appendDropletPath(sheenParts, dx, dy, sd.r, sd.r * 1.38);
        }
      }

      return {
        clipCss: 'polygon(' + polyPts.join(',') + ')',
        dropD: dropParts.join(' '),
        sheenD: sheenParts.join(' ')
      };
    }

    var riseP = clamp((p - HIT_PHASE) / (1 - HIT_PHASE), 0, 1);
    var riseEase = riseP * riseP * (3 - 2 * riseP);
    var baseY = lerp(H - 2, -56, riseEase);
    var floorY = H + 60;

    var waveSamples = 96;
    var wavePts = new Array(waveSamples + 1);
    for (var wi = 0; wi <= waveSamples; wi++) {
      var wx = (wi / waveSamples) * W;
      var wy = evalWaveY(wx, baseY, W, H, originX, p, elapsedSec);
      wavePts[wi] = [wx, wy];
    }

    var centerWaveY = evalWaveY(originX, baseY, W, H, originX, p, elapsedSec);
    var streamFade = 1 - smoothstep(0.56, 0.78, riseP);
    var hasStream = centerWaveY > originY + 24 && streamFade > 0.08;

    if (hasStream) {
      streamBottomY = centerWaveY;
      var sSteps = 20;
      var neckH = Math.min(34, Math.max(10, (centerWaveY - originY) * 0.28));
      var neckSpread = (22 + Math.sin(riseP * Math.PI) * 18) * streamFade;
      var sLeft = [];
      var sRight = [];
      for (var si = 0; si <= sSteps; si++) {
        var sf = si / sSteps;
        var sy = lerp(originY, Math.max(originY + 2, centerWaveY - neckH), sf);
        var sc = evalStreamColumn(sy, originX, originY, streamBottomY, elapsedSec, H - originY);
        var halfW = Math.max(1.8, sc.hw * (0.42 + 0.58 * streamFade));
        sLeft.push([clamp(sc.cx - halfW, 8, W - 16), sy]);
        sRight.push([clamp(sc.cx + halfW, 16, W - 8), sy]);
      }
      var lastL = sLeft[sLeft.length - 1];
      var lastR = sRight[sRight.length - 1];
      var leftJoinX = clamp(lastL[0] - neckSpread, 2, lastL[0] - 3);
      var rightJoinX = clamp(lastR[0] + neckSpread, lastR[0] + 3, W - 2);
      var leftJoinY = evalWaveY(leftJoinX, baseY, W, H, originX, p, elapsedSec);
      var rightJoinY = evalWaveY(rightJoinX, baseY, W, H, originX, p, elapsedSec);

      for (var sl = 0; sl < sLeft.length; sl++) {
        pushPolyPt(polyPts, sLeft[sl][0], sLeft[sl][1]);
      }
      pushQuadBezierPoly(polyPts, lastL[0], lastL[1], lastL[0] - neckSpread * 0.08, leftJoinY, leftJoinX, leftJoinY, 6);
      for (var wl = waveSamples; wl >= 0; wl--) {
        if (wavePts[wl][0] < leftJoinX - 1) {
          pushPolyPt(polyPts, wavePts[wl][0], wavePts[wl][1]);
        }
      }
      pushPolyPt(polyPts, 0, floorY);
      pushPolyPt(polyPts, W, floorY);
      for (var wr = waveSamples; wr >= 0; wr--) {
        if (wavePts[wr][0] > rightJoinX + 1) {
          pushPolyPt(polyPts, wavePts[wr][0], wavePts[wr][1]);
        }
      }
      pushPolyPt(polyPts, rightJoinX, rightJoinY);
      pushQuadBezierPoly(polyPts, rightJoinX, rightJoinY, lastR[0] + neckSpread * 0.08, rightJoinY, lastR[0], lastR[1], 6);
      for (var sr = sRight.length - 2; sr >= 0; sr--) {
        pushPolyPt(polyPts, sRight[sr][0], sRight[sr][1]);
      }
      pushQuadBezierPoly(polyPts, sRight[0][0], sRight[0][1], originX, originY - 4, sLeft[0][0], sLeft[0][1], 4);

      var leftWaveAsc = [];
      for (var swl = 0; swl <= waveSamples; swl++) {
        if (wavePts[swl][0] < leftJoinX - 2) leftWaveAsc.push(wavePts[swl]);
      }
      leftWaveAsc.push([leftJoinX, leftJoinY]);
      appendSmoothSvgSegment(sheenParts, leftWaveAsc, true);
      sheenParts.push(
        'Q', (lastL[0] - neckSpread * 0.08).toFixed(1), leftJoinY.toFixed(1),
        lastL[0].toFixed(1), lastL[1].toFixed(1)
      );
      appendSmoothSvgSegment(sheenParts, sLeft.slice().reverse().slice(1), false);

      appendSmoothSvgSegment(sheenParts, sRight, true);
      sheenParts.push(
        'Q', (lastR[0] + neckSpread * 0.08).toFixed(1), rightJoinY.toFixed(1),
        rightJoinX.toFixed(1), rightJoinY.toFixed(1)
      );
      var rightWaveAsc = [[rightJoinX, rightJoinY]];
      for (var swr = 0; swr <= waveSamples; swr++) {
        if (wavePts[swr][0] > rightJoinX + 2) rightWaveAsc.push(wavePts[swr]);
      }
      appendSmoothSvgSegment(sheenParts, rightWaveAsc.slice(1), false);
    } else {
      for (var wi2 = 0; wi2 <= waveSamples; wi2++) {
        pushPolyPt(polyPts, wavePts[wi2][0], wavePts[wi2][1]);
      }
      pushPolyPt(polyPts, W, floorY);
      pushPolyPt(polyPts, 0, floorY);
      appendSmoothSvgSegment(sheenParts, wavePts, true);
    }

    var ringP = clamp((p - HIT_PHASE) / 0.36, 0, 1);
    if (ringP > 0 && ringP < 1) {
      var ringRx = 18 + ringP * Math.min(W * 0.32, 220);
      var ringRy = 3.5 + ringP * 11;
      var ringCy = Math.min(H - 5, centerWaveY + 4);
      sheenParts.push(
        'M', (originX - ringRx).toFixed(1), ringCy.toFixed(1),
        'A', ringRx.toFixed(1), ringRy.toFixed(1), '0 1 0', (originX + ringRx).toFixed(1), ringCy.toFixed(1),
        'A', ringRx.toFixed(1), ringRy.toFixed(1), '0 1 0', (originX - ringRx).toFixed(1), ringCy.toFixed(1)
      );
    }

    var splashTime = (p - HIT_PHASE) * 1.12;
    if (splashTime > 0 && splashTime < 0.7) {
      var gravity = clamp(H * 1.65, 1100, 1850);
      var launchY = H - 6;
      for (var pi = 0; pi < splashList.length; pi++) {
        var sp = splashList[pi];
        var tau = splashTime - sp.delay;
        if (tau <= 0) continue;
        var sx = sp.x0 + sp.vx * tau;
        var sy = launchY + sp.vy * tau + 0.5 * gravity * tau * tau;
        if (sx <= sp.r + 2 || sx >= W - sp.r - 2 || sy <= -sp.r) continue;
        var localWaveY = evalWaveY(sx, baseY, W, H, originX, p, elapsedSec);
        if (sy + sp.r * 1.3 >= localWaveY - 3) continue;
        if (hasStream && sy > originY) {
          var colCheck = evalStreamColumn(sy, originX, originY, streamBottomY, elapsedSec, H - originY);
          if (Math.abs(sx - colCheck.cx) <= colCheck.hw + sp.r + 3) continue;
        }
        var shrink = 1 - smoothstep(0.4, 0.68, tau);
        var rx = sp.r * shrink;
        var ry = sp.r * 1.24 * shrink;
        if (rx < 1.1) continue;
        appendDropletPath(dropParts, sx, sy, rx, ry);
        appendDropletPath(sheenParts, sx, sy, rx, ry);
      }
    }

    return {
      clipCss: 'polygon(' + polyPts.join(',') + ')',
      dropD: dropParts.join(' '),
      sheenD: sheenParts.join(' ')
    };
  }

  function cleanupState(st, invokeCallbackKey) {
    if (!st || st.cleaned) return;
    st.cleaned = true;
    if (activeState === st) activeState = null;

    if (st.cancelWait) st.cancelWait();
    if (st.rafId) cancelAnimationFrame(st.rafId);
    if (st.commitRaf1) cancelAnimationFrame(st.commitRaf1);
    if (st.commitRaf2) cancelAnimationFrame(st.commitRaf2);
    window.removeEventListener('scroll', st.onScroll);
    window.removeEventListener('resize', st.onResize);
    document.removeEventListener('visibilitychange', st.onVisibility);

    if (st.overlay && st.overlay.parentNode) st.overlay.parentNode.removeChild(st.overlay);
    if (st.particleSvg && st.particleSvg.parentNode) st.particleSvg.parentNode.removeChild(st.particleSvg);
    if (!activeState) document.documentElement.classList.remove('lt-no-trans');

    if (invokeCallbackKey && typeof st[invokeCallbackKey] === 'function') {
      try { st[invokeCallbackKey](); } catch (_) {}
    }
  }

  function run(options) {
    options = options || {};
    var applyTheme = typeof options.applyTheme === 'function' ? options.applyTheme : function () {};
    var toLight = typeof options.toLight === 'boolean'
      ? options.toLight
      : !(document.body && document.body.classList.contains('light-mode'));
    var isReduced = typeof options.isReducedMotion === 'function'
      ? options.isReducedMotion()
      : defaultReducedMotion();

    if (activeState) {
      var prev = activeState;
      cleanupState(prev, prev.started ? 'onInterrupt' : null);
    }

    if (isReduced || !supportsLiquidReveal()) {
      document.documentElement.classList.add('lt-no-trans');
      applyTheme();
      void document.body.offsetHeight;
      requestAnimationFrame(function () {
        if (!activeState) document.documentElement.classList.remove('lt-no-trans');
      });
      if (typeof options.onFinish === 'function') options.onFinish();
      return false;
    }

    var duration = typeof options.duration === 'number' && options.duration > 100
      ? options.duration
      : DEFAULT_DURATION;
    var triggerEl = options.triggerEl || null;
    var W = document.documentElement.clientWidth || window.innerWidth || 1;
    var H = window.innerHeight || 1;

    var originX = W - 40;
    var originY = 48;
    if (triggerEl && triggerEl.getBoundingClientRect) {
      var rect = triggerEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        originX = clamp(rect.left + rect.width / 2, 20, W - 20);
        originY = clamp(rect.bottom - 5, 6, Math.max(40, H * 0.45));
      }
    }

    var particleSvg = document.createElementNS(SVG_NS, 'svg');
    particleSvg.id = '__ltParticles';
    particleSvg.setAttribute('aria-hidden', 'true');
    particleSvg.setAttribute('width', String(W));
    particleSvg.setAttribute('height', String(H));
    particleSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    particleSvg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483641;pointer-events:none;visibility:hidden;';

    var dropPathEl = document.createElementNS(SVG_NS, 'path');
    dropPathEl.setAttribute('fill', toLight ? '#f2f2f6' : '#000000');
    particleSvg.appendChild(dropPathEl);

    var sheenPathEl = document.createElementNS(SVG_NS, 'path');
    sheenPathEl.setAttribute('fill', 'none');
    sheenPathEl.setAttribute('stroke-linecap', 'round');
    sheenPathEl.setAttribute('stroke-linejoin', 'round');
    sheenPathEl.setAttribute('stroke-width', '1.1');
    sheenPathEl.setAttribute('stroke', toLight ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.16)');
    particleSvg.appendChild(sheenPathEl);
    document.documentElement.appendChild(particleSvg);

    var state = {
      started: false,
      committing: false,
      cleaned: false,
      rafId: 0,
      commitRaf1: 0,
      commitRaf2: 0,
      overlay: null,
      snapViewport: null,
      cancelWait: null,
      particleSvg: particleSvg,
      onFinish: options.onFinish,
      onInterrupt: options.onInterrupt,
      onScroll: function () {
        if (!activeState || activeState !== state || !state.snapViewport) return;
        state.snapViewport.scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        state.snapViewport.scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
      },
      onResize: function () {
        if (!activeState || activeState !== state) return;
        var hr = state.overlay ? state.overlay.getBoundingClientRect() : null;
        W = (hr && hr.width > 0) ? hr.width : (document.documentElement.clientWidth || window.innerWidth || 1);
        H = (hr && hr.height > 0) ? hr.height : (window.innerHeight || 1);
        if (state.snapViewport) {
          state.snapViewport.style.width = (document.documentElement.clientWidth || W) + 'px';
          state.snapViewport.style.height = (document.documentElement.clientHeight || H) + 'px';
        }
        particleSvg.setAttribute('width', String(W));
        particleSvg.setAttribute('height', String(H));
        particleSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        if (triggerEl && triggerEl.getBoundingClientRect) {
          var r = triggerEl.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            originX = clamp(r.left + r.width / 2, 20, W - 20);
            originY = clamp(r.bottom - 5, 6, Math.max(40, H * 0.45));
          }
        }
      },
      onVisibility: function () {
        if (document.hidden && activeState === state) {
          if (!state.committing) {
            state.committing = true;
            document.documentElement.classList.add('lt-no-trans');
            applyTheme();
          }
          cleanupState(state, 'onFinish');
        }
      }
    };
    activeState = state;

    window.addEventListener('scroll', state.onScroll, { passive: true });
    window.addEventListener('resize', state.onResize, { passive: true });
    document.addEventListener('visibilitychange', state.onVisibility);

    function commitAndFinish(host) {
      if (state.cleaned || state.committing || activeState !== state) return;
      state.committing = true;
      host.style.clipPath = 'none';
      host.style.webkitClipPath = 'none';
      dropPathEl.setAttribute('d', '');
      sheenPathEl.setAttribute('d', '');

      document.documentElement.classList.add('lt-no-trans');
      applyTheme();
      void document.body.offsetHeight;

      // 保持全屏覆盖等待两帧，确保真实新主题已在底层合成完毕再撤下揭示层，彻底消灭收尾闪烁
      state.commitRaf1 = requestAnimationFrame(function () {
        if (activeState !== state) return;
        state.commitRaf2 = requestAnimationFrame(function () {
          cleanupState(state, 'onFinish');
        });
      });
    }

    var snap = createNewThemeSnapshotOverlay(toLight, function (host, resolvedBg) {
      if (activeState !== state) return;
      state.started = true;

      var hr = host.getBoundingClientRect();
      if (hr.width > 0) W = hr.width;
      if (hr.height > 0) H = hr.height;
      particleSvg.setAttribute('width', String(W));
      particleSvg.setAttribute('height', String(H));
      particleSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      dropPathEl.setAttribute('fill', resolvedBg || (toLight ? '#f2f2f6' : '#000000'));

      if (triggerEl && triggerEl.getBoundingClientRect) {
        var tr = triggerEl.getBoundingClientRect();
        if (tr.width > 0 && tr.height > 0) {
          originX = clamp(tr.left + tr.width / 2, 20, W - 20);
          originY = clamp(tr.bottom - 5, 6, Math.max(40, H * 0.45));
        }
      }

      var splashList = createSplashParticles(originX, W);
      var streamDrops = createStreamDroplets();
      var initFrame = buildFrameGeometry(W, H, originX, originY, 0.001, 0, splashList, streamDrops);
      host.style.clipPath = initFrame.clipCss;
      host.style.webkitClipPath = initFrame.clipCss;
      dropPathEl.setAttribute('d', initFrame.dropD);
      sheenPathEl.setAttribute('d', initFrame.sheenD);

      // 必须在 clip-path 与初始几何落位后再显形，确保第 0 帧绝不闪现未裁剪的新主题层
      host.style.visibility = '';
      particleSvg.style.visibility = '';

      var startTs = 0;
      function tick(now) {
        if (activeState !== state || state.committing) return;
        if (!startTs) startTs = now;
        var elapsed = now - startTs;
        var p = clamp(elapsed / duration, 0, 1);

        var frame = buildFrameGeometry(W, H, originX, originY, p, elapsed / 1000, splashList, streamDrops);
        host.style.clipPath = frame.clipCss;
        host.style.webkitClipPath = frame.clipCss;
        dropPathEl.setAttribute('d', frame.dropD);
        sheenPathEl.setAttribute('d', frame.sheenD);

        if (p >= 1) {
          commitAndFinish(host);
          return;
        }
        state.rafId = requestAnimationFrame(tick);
      }

      state.rafId = requestAnimationFrame(tick);
    }, function () {
      if (activeState !== state) return;
      document.documentElement.classList.add('lt-no-trans');
      applyTheme();
      void document.body.offsetHeight;
      cleanupState(state, 'onFinish');
    });

    state.overlay = snap.host;
    state.snapViewport = snap.snapViewport;
    state.cancelWait = snap.cancelWait;

    return true;
  }

  function cancel() {
    if (activeState) {
      cleanupState(activeState, 'onInterrupt');
    }
  }

  function isRunning() {
    return !!activeState;
  }

  if (typeof window !== 'undefined') {
    var schedulePrefetch = function () {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () { prefetchRawShadowCss(); }, { timeout: 1000 });
      } else {
        setTimeout(prefetchRawShadowCss, 120);
      }
    };
    if (document.readyState === 'complete') schedulePrefetch();
    else window.addEventListener('load', schedulePrefetch, { once: true });
  }

  root.LiquidThemeReveal = {
    run: run,
    cancel: cancel,
    isRunning: isRunning,
    prefetch: prefetchRawShadowCss
  };
})(typeof window !== 'undefined' ? window : this);
