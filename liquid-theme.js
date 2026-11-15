/**
 * LiquidThemeReveal - 液体主题切换动效模块（无音效、纯原生 JS + SVG clipPath + Shadow DOM 快照隔离）
 *
 * 原理（方案 A：真实新主题底层 + Shadow DOM 旧主题快照层 + 反向 evenodd SVG 镂空裁剪）：
 * 1. 样式双通道保障：
 *    - HTTP/HTTPS 环境下空闲预取同源 CSS 原文并做词法级根选择器改写，实现 0ms 同步启动；
 *    - file:// 本地双击打开或预取未完成时，直接在 Shadow DOM 内挂载真实 <html>/<body> 标签并克隆 <link>/<style>，
 *      等核心样式表加载就绪后再切底层与显形，彻底杜绝 file:// SecurityError 或无样式黑屏；
 * 2. 立即将真实页面无过渡切换为新主题并同步刷新环境光/分区光 Canvas；
 * 3. 单一 requestAnimationFrame 循环逐帧更新 SVG <clipPath>（clip-rule="evenodd"）路径：
 *    - 阶段 1：细长液柱从触发按钮下方涌出，带自然摆动、粗细变化与分离液滴；
 *    - 阶段 2：液柱触底产生飞溅小液滴与局部涟漪；
 *    - 阶段 3：液体在底部积聚形成起伏波浪液面，顺滑上涨并与液柱合流覆盖全屏。
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
    + '.lt-snap-viewport, .lt-snap-viewport *, .lt-snap-viewport *::before, .lt-snap-viewport *::after { transition: none !important; transition-duration: 0s !important; animation: none !important; animation-duration: 0s !important; }\n';

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
      return CSS.supports('clip-path', 'url(#x)') || CSS.supports('-webkit-clip-path', 'url(#x)');
    }
    return true;
  }

  function defaultReducedMotion() {
    if (typeof window === 'undefined') return true;
    var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var perf = document.body && document.body.classList && document.body.classList.contains('performance-mode');
    return !!(rm || perf);
  }

  /**
   * 词法级替换 CSS 选择器中的文档根选择器（跳过 [...] 与引号内部）
   */
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
        var prev = i > 0 ? selectorText.charAt(i - 1) : '';
        var isIdBoundaryPrev = !prev || !/[a-zA-Z0-9_.\-#:*]/.test(prev);
        var isPseudoRootBoundaryPrev = !prev || !/[a-zA-Z0-9_-]/.test(prev);

        if (isPseudoRootBoundaryPrev && selectorText.slice(i, i + 5) === ':root') {
          var nextR = selectorText.charAt(i + 5);
          if (!nextR || !/[a-zA-Z0-9_-]/.test(nextR)) {
            out += '.lt-snap-html';
            i += 5;
            continue;
          }
        }
        if (isIdBoundaryPrev && selectorText.slice(i, i + 4) === 'html') {
          var nextH = selectorText.charAt(i + 4);
          if (!nextH || !/[a-zA-Z0-9_-]/.test(nextH)) {
            out += '.lt-snap-html';
            i += 4;
            continue;
          }
        }
        if (isIdBoundaryPrev && selectorText.slice(i, i + 4) === 'body') {
          var nextB = selectorText.charAt(i + 4);
          if (!nextB || !/[a-zA-Z0-9_-]/.test(nextB)) {
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
        if (atName === 'media' || atName === 'supports' || atName === 'layer' || atName === 'container') {
          out += raw.slice(atStart, j + 1);
          atContainerDepth++;
          i = j + 1;
        } else {
          var blockEnd = scanBalancedBlock(raw, j);
          out += raw.slice(atStart, blockEnd);
          i = blockEnd;
        }
        continue;
      }

      var selStart = i;
      var qSel = '';
      while (i < n) {
        var c3 = raw.charAt(i);
        if (qSel) {
          if (c3 === '\\') { i += 2; continue; }
          if (c3 === qSel) qSel = '';
          i++;
          continue;
        }
        if (c3 === '"' || c3 === "'") { qSel = c3; i++; continue; }
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
        // 一并追加主文档内联 <style>（如有扩展或页面注入内联样式）
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
   * 构建 Shadow DOM 旧主题快照层。
   * - 若已预取同源 CSS 原文：同步注入改写后 CSS，立即就绪；
   * - 否则（如 file:// 本地双击打开）：直接挂载真实 <html>/<body> 标签并克隆 <link>/<style>，
   *   等待核心样式表加载完成再回调 onReady，确保 100% 完整样式与正确 scrollTop。
   */
  function createOldThemeSnapshotOverlay(clipId, onReady, onFail) {
    var body = document.body;
    var docEl = document.documentElement;
    var scrollX = window.pageXOffset || docEl.scrollLeft || 0;
    var scrollY = window.pageYOffset || docEl.scrollTop || 0;
    var vpW = docEl.clientWidth || window.innerWidth || 1;
    var vpH = docEl.clientHeight || window.innerHeight || 1;
    var oldBodyStyle = getComputedStyle(body);
    var oldBg = oldBodyStyle.backgroundColor;
    if (!oldBg || oldBg === 'rgba(0, 0, 0, 0)' || oldBg === 'transparent') {
      oldBg = body.classList.contains('light-mode') ? '#f2f2f6' : '#000000';
    }

    var host = document.createElement('div');
    host.id = '__ltOverlay';
    host.setAttribute('aria-hidden', 'true');
    host.setAttribute('inert', '');
    host.tabIndex = -1;
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483640;pointer-events:none;overflow:hidden;user-select:none;'
      + 'clip-path:url(#' + clipId + ');-webkit-clip-path:url(#' + clipId + ');';

    var shadow = host.attachShadow({ mode: 'open' });
    var useRawCache = rawShadowCssCache !== null;
    var waitLinks = [];

    if (useRawCache) {
      var cachedStyleEl = document.createElement('style');
      cachedStyleEl.textContent = rawShadowCssCache;
      shadow.appendChild(cachedStyleEl);
    } else {
      // file:// 或首屏未预取完成：仅克隆本地/同源核心 <link rel="stylesheet"> 和内联 <style>，避免外链字体触发 FOUT 错位
      host.style.visibility = 'hidden';
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
    backdrop.style.backgroundColor = oldBg;
    shadow.appendChild(backdrop);

    var snapViewport = document.createElement('div');
    snapViewport.className = 'lt-snap-viewport';
    snapViewport.style.width = vpW + 'px';
    snapViewport.style.height = vpH + 'px';

    // 使用真实 <html> / <body> 标签，保证兜底 <link> 下 body.ds-c / body.light-mode 选择器原生 100% 匹配
    var snapHtml = document.createElement('html');
    snapHtml.className = 'lt-snap-html ' + (docEl.className || '');
    snapHtml.style.colorScheme = docEl.style.colorScheme || (body.classList.contains('light-mode') ? 'light' : 'dark');
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

    var scrollRecords = [];
    var children = body.childNodes;
    var origList = [];
    var cloneList = [];
    for (var c = 0; c < children.length; c++) {
      var child = children[c];
      if (child.nodeType !== 1) continue;
      var tag = child.tagName;
      if (tag === 'SCRIPT' || tag === 'NOSCRIPT' || tag === 'IFRAME') continue;
      if (child.id === 'pvDiag' || child.id === '__ltOverlay' || child.id === '__ltSvg') continue;
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

    snapHtml.appendChild(snapBody);
    snapViewport.appendChild(snapHtml);
    shadow.appendChild(snapViewport);
    document.documentElement.appendChild(host);

    function applyScrollPositions() {
      snapViewport.scrollTop = window.pageYOffset || docEl.scrollTop || scrollY;
      snapViewport.scrollLeft = window.pageXOffset || docEl.scrollLeft || scrollX;
      for (var sr = 0; sr < scrollRecords.length; sr++) {
        scrollRecords[sr].el.scrollTop = scrollRecords[sr].top;
        scrollRecords[sr].el.scrollLeft = scrollRecords[sr].left;
      }
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
      applyScrollPositions();
      host.style.visibility = '';
      if (typeof onReady === 'function') onReady();
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

  function appendSmoothSegment(parts, pts, startWithMove) {
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

  function evalStreamColumn(y, originX, originY, tipY, elapsedSec, maxSpan) {
    var span = Math.max(1, tipY - originY);
    var u = clamp((y - originY) / span, 0, 1);
    // 顶部 u=0 严格锚定在按钮正下方中心，避免开始帧悬空甩尾
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

    // 宽大柔和的低频波浪（全屏 1~2.5 个自然大波），彻底杜绝高频锯齿
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

  function buildFramePaths(W, H, originX, originY, p, elapsedSec, splashList, streamDrops) {
    var clipParts = ['M 0 0 L', W.toFixed(1), '0 L', W.toFixed(1), H.toFixed(1), 'L 0', H.toFixed(1), 'Z'];
    var sheenParts = [];

    var tipY;
    var streamBottomY;
    var isPooled = p >= HIT_PHASE;

    if (!isPooled) {
      var fallT = clamp(p / HIT_PHASE, 0, 1);
      var fallEase = fallT * fallT * (0.28 + 0.72 * fallT);
      tipY = originY + 6 + (H - originY - 4) * fallEase;

      var steps = 28;
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

      appendSmoothSegment(clipParts, leftPts, true);
      clipParts.push(
        'Q', (tipInfo.cx - rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        tipInfo.cx.toFixed(1), (tipY + rxTip * 0.85).toFixed(1),
        'Q', (tipInfo.cx + rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        rightPts[rightPts.length - 1][0].toFixed(1), rightPts[rightPts.length - 1][1].toFixed(1)
      );
      var rightDesc = rightPts.slice().reverse();
      appendSmoothSegment(clipParts, rightDesc.slice(1), false);
      clipParts.push('A', '9 5 0 0 0', leftPts[0][0].toFixed(1), leftPts[0][1].toFixed(1), 'Z');

      appendSmoothSegment(sheenParts, leftPts, true);
      sheenParts.push(
        'Q', (tipInfo.cx - rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        tipInfo.cx.toFixed(1), (tipY + rxTip * 0.85).toFixed(1),
        'Q', (tipInfo.cx + rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        rightPts[rightPts.length - 1][0].toFixed(1), rightPts[rightPts.length - 1][1].toFixed(1)
      );
      appendSmoothSegment(sheenParts, rightDesc.slice(1), false);

      for (var di = 0; di < streamDrops.length; di++) {
        var sd = streamDrops[di];
        if (p < sd.startP) continue;
        var dt = clamp((p - sd.startP) / (HIT_PHASE - sd.startP + 0.08), 0, 1);
        var dy = originY + 28 + (H - originY) * (dt * dt * sd.speedMul);
        if (dy >= tipY - 6 || dy >= H - 4) continue;
        var colAtDy = evalStreamColumn(dy, originX, originY, tipY, elapsedSec, H - originY);
        var dx = colAtDy.cx + sd.side * (colAtDy.hw + sd.r + 3.5 + Math.sin(dt * Math.PI) * sd.offsetAmp);
        if (dx > 6 && dx < W - 6) {
          appendDropletPath(clipParts, dx, dy, sd.r, sd.r * 1.38);
          appendDropletPath(sheenParts, dx, dy, sd.r, sd.r * 1.38);
        }
      }

      return {
        clipD: clipParts.join(' '),
        sheenD: sheenParts.join(' ')
      };
    }

    var riseP = clamp((p - HIT_PHASE) / (1 - HIT_PHASE), 0, 1);
    var riseEase = riseP * riseP * (3 - 2 * riseP);
    var baseY = lerp(H - 2, -56, riseEase);
    var floorY = H + 80;

    var waveSamples = 72;
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
      var sSteps = 22;
      var neckH = Math.min(34, Math.max(10, (centerWaveY - originY) * 0.28));
      var neckSpread = (22 + Math.sin(riseP * Math.PI) * 18) * streamFade;
      var colTop = evalStreamColumn(originY, originX, originY, streamBottomY, elapsedSec, H - originY);
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

      var leftWaveDesc = [[leftJoinX, leftJoinY]];
      for (var wl = waveSamples; wl >= 0; wl--) {
        if (wavePts[wl][0] < leftJoinX - 2) leftWaveDesc.push(wavePts[wl]);
      }
      var rightWaveDesc = [];
      for (var wr = waveSamples; wr >= 0; wr--) {
        if (wavePts[wr][0] > rightJoinX + 2) rightWaveDesc.push(wavePts[wr]);
      }
      rightWaveDesc.push([rightJoinX, rightJoinY]);

      appendSmoothSegment(clipParts, sLeft, true);
      clipParts.push(
        'Q', (lastL[0] - neckSpread * 0.08).toFixed(1), leftJoinY.toFixed(1),
        leftJoinX.toFixed(1), leftJoinY.toFixed(1)
      );
      appendSmoothSegment(clipParts, leftWaveDesc.slice(1), false);
      clipParts.push('L 0', floorY.toFixed(1), 'L', W.toFixed(1), floorY.toFixed(1));
      appendSmoothSegment(clipParts, rightWaveDesc.slice(0, rightWaveDesc.length - 1), false);
      clipParts.push(
        'L', rightJoinX.toFixed(1), rightJoinY.toFixed(1),
        'Q', (lastR[0] + neckSpread * 0.08).toFixed(1), rightJoinY.toFixed(1),
        lastR[0].toFixed(1), lastR[1].toFixed(1)
      );
      var sRightDesc = sRight.slice().reverse();
      appendSmoothSegment(clipParts, sRightDesc.slice(1), false);
      var topHalf = Math.max(4, colTop.hw * (0.5 + 0.5 * streamFade));
      clipParts.push('A', topHalf.toFixed(1), '5 0 0 0', sLeft[0][0].toFixed(1), sLeft[0][1].toFixed(1), 'Z');

      var leftWaveAsc = leftWaveDesc.slice().reverse();
      appendSmoothSegment(sheenParts, leftWaveAsc, true);
      sheenParts.push(
        'Q', (lastL[0] - neckSpread * 0.08).toFixed(1), leftJoinY.toFixed(1),
        lastL[0].toFixed(1), lastL[1].toFixed(1)
      );
      var sLeftDesc = sLeft.slice().reverse();
      appendSmoothSegment(sheenParts, sLeftDesc.slice(1), false);

      appendSmoothSegment(sheenParts, sRight, true);
      sheenParts.push(
        'Q', (lastR[0] + neckSpread * 0.08).toFixed(1), rightJoinY.toFixed(1),
        rightJoinX.toFixed(1), rightJoinY.toFixed(1)
      );
      var rightWaveAsc = rightWaveDesc.slice().reverse();
      appendSmoothSegment(sheenParts, rightWaveAsc.slice(1), false);
    } else {
      appendSmoothSegment(clipParts, wavePts, true);
      clipParts.push('L', W.toFixed(1), floorY.toFixed(1), 'L 0', floorY.toFixed(1), 'Z');
      appendSmoothSegment(sheenParts, wavePts, true);
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
        appendDropletPath(clipParts, sx, sy, rx, ry);
        appendDropletPath(sheenParts, sx, sy, rx, ry);
      }
    }

    return {
      clipD: clipParts.join(' '),
      sheenD: sheenParts.join(' ')
    };
  }

  function cleanupActive(invokeCallbackKey) {
    if (!activeState) return;
    var st = activeState;
    activeState = null;

    if (st.cancelWait) st.cancelWait();
    if (st.rafId) cancelAnimationFrame(st.rafId);
    window.removeEventListener('scroll', st.onScroll);
    window.removeEventListener('resize', st.onResize);
    document.removeEventListener('visibilitychange', st.onVisibility);

    if (st.overlay && st.overlay.parentNode) st.overlay.parentNode.removeChild(st.overlay);
    if (st.svg && st.svg.parentNode) st.svg.parentNode.removeChild(st.svg);
    if (st.sheenSvg && st.sheenSvg.parentNode) st.sheenSvg.parentNode.removeChild(st.sheenSvg);
    document.documentElement.classList.remove('lt-no-trans');

    if (invokeCallbackKey && typeof st[invokeCallbackKey] === 'function') {
      try { st[invokeCallbackKey](); } catch (_) {}
    }
  }

  function run(options) {
    options = options || {};
    var applyTheme = typeof options.applyTheme === 'function' ? options.applyTheme : function () {};
    var isReduced = typeof options.isReducedMotion === 'function'
      ? options.isReducedMotion()
      : defaultReducedMotion();

    if (activeState) {
      if (!activeState.started) {
        // 上一次还在等样式加载，先清旧等待层
        cleanupActive(null);
      } else {
        cleanupActive('onInterrupt');
      }
    }

    if (isReduced || !supportsLiquidReveal()) {
      applyTheme();
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

    var uid = String(Date.now()) + '_' + Math.floor(Math.random() * 10000);
    var clipId = '__ltClip_' + uid;

    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.id = '__ltSvg';
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:0;height:0;pointer-events:none;';
    var defs = document.createElementNS(SVG_NS, 'defs');
    var clipPathEl = document.createElementNS(SVG_NS, 'clipPath');
    clipPathEl.setAttribute('id', clipId);
    clipPathEl.setAttribute('clipPathUnits', 'userSpaceOnUse');
    var pathEl = document.createElementNS(SVG_NS, 'path');
    pathEl.setAttribute('clip-rule', 'evenodd');
    clipPathEl.appendChild(pathEl);
    defs.appendChild(clipPathEl);
    svg.appendChild(defs);
    document.documentElement.appendChild(svg);

    var willBeLight = !(document.body && document.body.classList.contains('light-mode'));
    var sheenSvg = document.createElementNS(SVG_NS, 'svg');
    sheenSvg.setAttribute('aria-hidden', 'true');
    sheenSvg.setAttribute('width', String(W));
    sheenSvg.setAttribute('height', String(H));
    sheenSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    sheenSvg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483641;pointer-events:none;visibility:hidden;';
    var sheenPathEl = document.createElementNS(SVG_NS, 'path');
    sheenPathEl.setAttribute('fill', 'none');
    sheenPathEl.setAttribute('stroke-linecap', 'round');
    sheenPathEl.setAttribute('stroke-linejoin', 'round');
    sheenPathEl.setAttribute('stroke-width', '1.1');
    sheenPathEl.setAttribute('stroke', willBeLight ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.16)');
    sheenSvg.appendChild(sheenPathEl);
    document.documentElement.appendChild(sheenSvg);

    var state = {
      started: false,
      rafId: 0,
      overlay: null,
      snapViewport: null,
      cancelWait: null,
      svg: svg,
      sheenSvg: sheenSvg,
      onFinish: options.onFinish,
      onInterrupt: options.onInterrupt,
      onScroll: function () {
        if (!activeState || !activeState.snapViewport) return;
        activeState.snapViewport.scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        activeState.snapViewport.scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
      },
      onResize: function () {
        if (!activeState) return;
        W = document.documentElement.clientWidth || window.innerWidth || 1;
        H = window.innerHeight || 1;
        if (activeState.snapViewport) {
          activeState.snapViewport.style.width = W + 'px';
          activeState.snapViewport.style.height = (document.documentElement.clientHeight || H) + 'px';
        }
        sheenSvg.setAttribute('width', String(W));
        sheenSvg.setAttribute('height', String(H));
        sheenSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        if (triggerEl && triggerEl.getBoundingClientRect) {
          var r = triggerEl.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            originX = clamp(r.left + r.width / 2, 20, W - 20);
            originY = clamp(r.bottom - 5, 6, Math.max(40, H * 0.45));
          }
        }
      },
      onVisibility: function () {
        if (document.hidden) {
          if (!state.started) {
            applyTheme();
          }
          cleanupActive('onFinish');
        }
      }
    };
    activeState = state;

    window.addEventListener('scroll', state.onScroll, { passive: true });
    window.addEventListener('resize', state.onResize, { passive: true });
    document.addEventListener('visibilitychange', state.onVisibility);

    var snap = createOldThemeSnapshotOverlay(clipId, function () {
      if (activeState !== state) return;
      state.started = true;

      var splashList = createSplashParticles(originX, W);
      var streamDrops = createStreamDroplets();
      var initFrame = buildFramePaths(W, H, originX, originY, 0.001, 0, splashList, streamDrops);
      pathEl.setAttribute('d', initFrame.clipD);
      sheenPathEl.setAttribute('d', initFrame.sheenD);
      sheenSvg.style.visibility = '';

      document.documentElement.classList.add('lt-no-trans');
      applyTheme();
      void document.body.offsetHeight;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (!activeState || activeState === state) {
            document.documentElement.classList.remove('lt-no-trans');
          }
        });
      });

      var startTs = 0;
      function tick(now) {
        if (activeState !== state) return;
        if (!startTs) startTs = now;
        var elapsed = now - startTs;
        var p = clamp(elapsed / duration, 0, 1);

        var frame = buildFramePaths(W, H, originX, originY, p, elapsed / 1000, splashList, streamDrops);
        pathEl.setAttribute('d', frame.clipD);
        sheenPathEl.setAttribute('d', frame.sheenD);

        if (p >= 1) {
          cleanupActive('onFinish');
          return;
        }
        state.rafId = requestAnimationFrame(tick);
      }

      state.rafId = requestAnimationFrame(tick);
    }, function () {
      if (activeState !== state) return;
      applyTheme();
      cleanupActive('onFinish');
    });

    state.overlay = snap.host;
    state.snapViewport = snap.snapViewport;
    state.cancelWait = snap.cancelWait;

    return true;
  }

  function cancel() {
    cleanupActive('onInterrupt');
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
