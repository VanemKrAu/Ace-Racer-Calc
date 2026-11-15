/**
 * LiquidThemeReveal - 液体主题切换动效模块（无音效、跨端零闪烁）
 *
 * 双引擎零闪烁架构：
 * 1. Tier 1（主引擎：原生 View Transitions 单层平面合成 + 动态 polygon clip-path）：
 *    - 现代 Chrome / Android Chrome / Via (System WebView) / Safari 18+ 等支持 document.startViewTransition 的浏览器优先启用；
 *    - 启动前预置 ::view-transition-new(root) 为不可见闭合零面积裁剪 polygon(0 0, 0 0, 0 0)，确保第 0 帧零全屏露底闪烁；
 *    - 浏览器将新旧主题各合成为一张纯平面 GPU 贴图（零 Shadow DOM、零嵌套 fixed/scroll/canvas/feTurbulence 合成层），
 *      从架构上根治 Android 瓦片 GPU 合成器在动态 clip-path 下的爆闪问题；
 *    - 独立粒子层 #__ltParticles 绑定 view-transition-name: lt-particles 置于顶层绘制分离小液滴、触底飞溅与边缘高光。
 * 2. Tier 2（降级引擎：层扁平化 Shadow DOM 快照揭示层）：
 *    - 用于不支持 startViewTransition 或调用方显式指定 shadow 引擎的环境；
 *    - 彻底剥离宿主 translateZ(0)、内部 overflow-y: auto（改为 margin 偏移）、内部所有 position: fixed（转为绝对定位）、
 *      will-change、mix-blend-mode 及全屏 <feTurbulence> 噪声滤镜，消除移动端 RenderSurface/Mask 脱节闪烁。
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
    + ':host { display: block; width: 100%; height: 100%; pointer-events: none; user-select: none; contain: layout paint style; isolation: isolate; }\n'
    + '.lt-snap-backdrop { position: absolute; inset: 0; z-index: 0; pointer-events: none; }\n'
    + '.lt-snap-viewport { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; }\n'
    + '.lt-snap-viewport > .lt-snap-html { display: block; position: relative !important; width: 100% !important; min-height: 100% !important; height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; background: transparent !important; background-color: transparent !important; }\n'
    + '.lt-snap-viewport > .lt-snap-html > .lt-snap-body { display: block; position: relative; width: 100%; min-height: 100%; margin: 0; background: transparent !important; background-color: transparent !important; }\n'
    + '.lt-snap-viewport, .lt-snap-viewport *, .lt-snap-viewport *::before, .lt-snap-viewport *::after {\n'
    + '  transition: none !important; transition-duration: 0s !important;\n'
    + '  animation: none !important; animation-duration: 0s !important;\n'
    + '  -webkit-backdrop-filter: none !important; backdrop-filter: none !important;\n'
    + '  will-change: auto !important;\n'
    + '  mix-blend-mode: normal !important;\n'
    + '}\n'
    + '.lt-snap-body .ds-ambient::after { content: none !important; display: none !important; }\n'
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

  function supportsPolygonClip() {
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
      return CSS.supports('clip-path', 'polygon(0px 0px, 10px 0px, 10px 10px)')
        || CSS.supports('-webkit-clip-path', 'polygon(0px 0px, 10px 0px, 10px 10px)');
    }
    return true;
  }

  function supportsViewTransitionReveal() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    if (typeof document.startViewTransition !== 'function') return false;
    if (!document.createElementNS || typeof requestAnimationFrame !== 'function') return false;
    if (!supportsPolygonClip()) return false;
    if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
      return CSS.supports('selector(::view-transition-new(root))');
    }
    return false;
  }

  function supportsLiquidReveal() {
    if (typeof document === 'undefined' || typeof window === 'undefined') return false;
    if (!document.createElementNS || typeof requestAnimationFrame !== 'function') return false;
    if (!supportsPolygonClip()) return false;
    return supportsViewTransitionReveal() || !!Element.prototype.attachShadow;
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
    var fixedRecords = [];
    function captureNodeScrollAndFixed(origNode, cloneNode) {
      if (origNode.scrollTop > 0 || origNode.scrollLeft > 0) {
        scrollRecords.push({ el: cloneNode, top: origNode.scrollTop, left: origNode.scrollLeft });
      }
      try {
        var cs = getComputedStyle(origNode);
        if (cs && cs.position === 'fixed') {
          var rect = origNode.getBoundingClientRect();
          fixedRecords.push({
            cloneEl: cloneNode,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            sized: (rect.width > 0 || rect.height > 0)
          });
        }
      } catch (_) {}
    }

    captureNodeScrollAndFixed(origRoot, cloneRoot);
    var origAll = origRoot.getElementsByTagName('*');
    var cloneAll = cloneRoot.getElementsByTagName('*');
    var allLen = Math.min(origAll.length, cloneAll.length);
    for (var m = 0; m < allLen; m++) {
      captureNodeScrollAndFixed(origAll[m], cloneAll[m]);
    }
    return { scrollRecords: scrollRecords, fixedRecords: fixedRecords };
  }

  /**
   * 构建顶层「目标新主题」层扁平化 Shadow DOM 快照揭示层（Tier 2 降级引擎）。
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
      + 'contain:layout paint style;isolation:isolate;visibility:hidden;';

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
    var fixedRecords = [];
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
      var synced = syncClonedControlsAndScroll(origList[j], cloneList[j]);
      for (var r = 0; r < synced.scrollRecords.length; r++) scrollRecords.push(synced.scrollRecords[r]);
      for (var fr = 0; fr < synced.fixedRecords.length; fr++) fixedRecords.push(synced.fixedRecords[fr]);
    }

    var clonedThemeIcon = snapBody.querySelector('#themeIcon');
    if (clonedThemeIcon) {
      clonedThemeIcon.textContent = toLight ? '☀️' : '🌙';
    }

    snapHtml.appendChild(snapBody);
    snapViewport.appendChild(snapHtml);
    shadow.appendChild(snapViewport);
    document.documentElement.appendChild(host);

    function syncScrollOffset(curScrollX, curScrollY) {
      snapHtml.style.setProperty('margin-top', (-curScrollY) + 'px', 'important');
      snapHtml.style.setProperty('margin-left', (-curScrollX) + 'px', 'important');
      for (var fi = 0; fi < fixedRecords.length; fi++) {
        var rec = fixedRecords[fi];
        var ce = rec.cloneEl;
        ce.style.setProperty('position', 'absolute', 'important');
        if (rec.sized) {
          ce.style.setProperty('top', (rec.top + curScrollY) + 'px', 'important');
          ce.style.setProperty('left', (rec.left + curScrollX) + 'px', 'important');
          ce.style.setProperty('right', 'auto', 'important');
          ce.style.setProperty('bottom', 'auto', 'important');
          ce.style.setProperty('width', rec.width + 'px', 'important');
          ce.style.setProperty('height', rec.height + 'px', 'important');
          ce.style.setProperty('margin', '0', 'important');
          ce.style.setProperty('transform', 'none', 'important');
        }
      }
    }

    function applyScrollAndCanvases() {
      var sx = window.pageXOffset || docEl.scrollLeft || scrollX;
      var sy = window.pageYOffset || docEl.scrollTop || scrollY;
      syncScrollOffset(sx, sy);
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
      syncScroll: syncScrollOffset,
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

      var rightWaveAsc = [[rightJoinX, rightJoinY]];
      for (var swr = 0; swr <= waveSamples; swr++) {
        if (wavePts[swr][0] > rightJoinX + 2) rightWaveAsc.push(wavePts[swr]);
      }
      appendSmoothSvgSegment(sheenParts, rightWaveAsc, true);
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

  function removeNodeSafe(node) {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  }

  function cleanupState(st, invokeCallbackKey) {
    if (!st || st.cleaned) return;
    st.cleaned = true;
    if (activeState === st) activeState = null;

    if (st.cancelWait) st.cancelWait();
    if (st.readyTimer) {
      clearTimeout(st.readyTimer);
      st.readyTimer = 0;
    }
    if (st.rafId) cancelAnimationFrame(st.rafId);
    if (st.commitRaf1) cancelAnimationFrame(st.commitRaf1);
    if (st.commitRaf2) cancelAnimationFrame(st.commitRaf2);
    if (st.onScroll) window.removeEventListener('scroll', st.onScroll);
    if (st.onResize) window.removeEventListener('resize', st.onResize);
    if (st.onVisibility) document.removeEventListener('visibilitychange', st.onVisibility);

    if (st.keepAliveAnim) {
      try { st.keepAliveAnim.cancel(); } catch (_) {}
      st.keepAliveAnim = null;
    }
    if (st.vt) {
      try { st.vt.skipTransition(); } catch (_) {}
      st.vt = null;
    }

    removeNodeSafe(st.vtClipStyle);
    removeNodeSafe(st.vtBaseStyle);
    removeNodeSafe(st.anchorEl);
    removeNodeSafe(st.overlay);
    removeNodeSafe(st.particleSvg);

    if (!activeState) {
      if (st.deferRemoveNoTrans) {
        requestAnimationFrame(function () {
          if (!activeState) document.documentElement.classList.remove('lt-no-trans');
        });
      } else {
        document.documentElement.classList.remove('lt-no-trans');
      }
    }

    if (invokeCallbackKey && typeof st[invokeCallbackKey] === 'function') {
      try { st[invokeCallbackKey](); } catch (_) {}
    }
  }

  function readPseudoGroupBox(pseudoSelector) {
    try {
      var cs = getComputedStyle(document.documentElement, pseudoSelector);
      if (!cs) return null;
      var w = parseFloat(cs.width);
      var h = parseFloat(cs.height);
      if (!(w > 0) || !(h > 0)) return null;
      var left = parseFloat(cs.left) || 0;
      var top = parseFloat(cs.top) || 0;
      var tr = cs.transform;
      if (tr && tr !== 'none') {
        var m2 = tr.match(/^matrix\(([^)]+)\)$/);
        if (m2) {
          var p2 = m2[1].split(',');
          if (p2.length === 6) {
            left += parseFloat(p2[4]) || 0;
            top += parseFloat(p2[5]) || 0;
          }
        } else {
          var m3 = tr.match(/^matrix3d\(([^)]+)\)$/);
          if (m3) {
            var p3 = m3[1].split(',');
            if (p3.length === 16) {
              left += parseFloat(p3[12]) || 0;
              top += parseFloat(p3[13]) || 0;
            }
          }
        }
      }
      return { left: left, top: top, width: w, height: h };
    } catch (_) {
      return null;
    }
  }

  function createParticleLayer(W, H, toLight, withViewTransitionName) {
    var particleSvg = document.createElementNS(SVG_NS, 'svg');
    particleSvg.id = '__ltParticles';
    particleSvg.setAttribute('aria-hidden', 'true');
    particleSvg.setAttribute('width', String(W));
    particleSvg.setAttribute('height', String(H));
    particleSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    particleSvg.setAttribute('preserveAspectRatio', 'none');
    particleSvg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483641;pointer-events:none;'
      + (withViewTransitionName ? 'view-transition-name:lt-particles;' : 'visibility:hidden;');

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

    return {
      svg: particleSvg,
      dropPathEl: dropPathEl,
      sheenPathEl: sheenPathEl
    };
  }

  function resolveTriggerOrigin(triggerEl, W, H) {
    var originX = W - 40;
    var originY = 48;
    if (triggerEl && triggerEl.getBoundingClientRect) {
      var rect = triggerEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        originX = clamp(rect.left + rect.width / 2, 20, W - 20);
        originY = clamp(rect.bottom - 5, 6, Math.max(40, H * 0.45));
      }
    }
    return { x: originX, y: originY };
  }

  function runViewTransition(options, applyTheme, toLight, duration, triggerEl) {
    var W = document.documentElement.clientWidth || window.innerWidth || 1;
    var H = window.innerHeight || 1;
    var origin = resolveTriggerOrigin(triggerEl, W, H);
    var originX = origin.x;
    var originY = origin.y;

    // 视口定位锚点：用于在 vt.ready 时读出 Android Chrome/WebView 的真实 Snapshot Containing Block 坐标系位置，抵消动态地址栏偏移
    var anchorEl = null;
    if (triggerEl && triggerEl.getBoundingClientRect) {
      var trBtn = triggerEl.getBoundingClientRect();
      if (trBtn.width > 0 && trBtn.height > 0) {
        anchorEl = document.createElement('div');
        anchorEl.id = '__ltAnchor';
        anchorEl.setAttribute('aria-hidden', 'true');
        anchorEl.style.cssText = 'position:fixed;left:' + trBtn.left.toFixed(2) + 'px;'
          + 'top:' + trBtn.top.toFixed(2) + 'px;'
          + 'width:' + trBtn.width.toFixed(2) + 'px;'
          + 'height:' + trBtn.height.toFixed(2) + 'px;'
          + 'margin:0;padding:0;pointer-events:none;opacity:0.001;z-index:2147483640;'
          + 'view-transition-name:lt-anchor;';
        document.documentElement.appendChild(anchorEl);
      }
    }

    var particles = createParticleLayer(W, H, toLight, true);
    var particleSvg = particles.svg;
    var dropPathEl = particles.dropPathEl;
    var sheenPathEl = particles.sheenPathEl;

    var vtBaseCssPrefix = ''
      + '::view-transition { pointer-events: none !important; }\n'
      + '::view-transition-group(*), ::view-transition-image-pair(*), ::view-transition-old(*), ::view-transition-new(*) {\n'
      + '  animation: none !important;\n'
      + '  mix-blend-mode: normal !important;\n'
      + '}\n'
      + '::view-transition-group(lt-anchor) { opacity: 0 !important; pointer-events: none !important; }\n'
      + '::view-transition-group(root) { z-index: 1 !important; }\n'
      + '::view-transition-group(lt-particles) { z-index: 2 !important; }\n'
      + '::view-transition-old(lt-particles) { display: none !important; }\n';

    var vtBaseStyle = document.createElement('style');
    vtBaseStyle.id = '__ltVtBaseStyle';
    vtBaseStyle.textContent = vtBaseCssPrefix;
    (document.head || document.documentElement).appendChild(vtBaseStyle);

    // 启动 ViewTransition 前预设闭合裁剪，确保第 0 帧绝不闪出未裁剪的新主题全屏快照
    var vtClipStyle = document.createElement('style');
    vtClipStyle.id = '__ltVtClipStyle';
    vtClipStyle.textContent = '::view-transition-new(root){clip-path:polygon(0px 0px,0px 0px,0px 0px) !important;-webkit-clip-path:polygon(0px 0px,0px 0px,0px 0px) !important;}';
    (document.head || document.documentElement).appendChild(vtClipStyle);

    var state = {
      engine: 'view-transition',
      started: false,
      themeApplied: false,
      committing: false,
      cleaned: false,
      deferRemoveNoTrans: true,
      rafId: 0,
      commitRaf1: 0,
      commitRaf2: 0,
      readyTimer: 0,
      vt: null,
      keepAliveAnim: null,
      anchorEl: anchorEl,
      vtBaseStyle: vtBaseStyle,
      vtClipStyle: vtClipStyle,
      particleSvg: particleSvg,
      onFinish: options.onFinish,
      onInterrupt: options.onInterrupt,
      onResize: function () {
        if (activeState !== state) return;
        cleanupState(state, 'onFinish');
      },
      onVisibility: function () {
        if (document.hidden && activeState === state) {
          if (!state.themeApplied) {
            state.themeApplied = true;
            document.documentElement.classList.add('lt-no-trans');
            applyTheme();
          }
          cleanupState(state, 'onFinish');
        }
      }
    };
    activeState = state;

    window.addEventListener('resize', state.onResize, { passive: true });
    document.addEventListener('visibilitychange', state.onVisibility);

    var vt;
    try {
      vt = document.startViewTransition(function () {
        if (activeState !== state || state.cleaned) return;
        document.documentElement.classList.add('lt-no-trans');
        applyTheme();
        state.themeApplied = true;
        try {
          var bg = getComputedStyle(document.body).backgroundColor || '';
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            dropPathEl.setAttribute('fill', bg);
          }
        } catch (_) {}
        void document.body.offsetHeight;
      });
    } catch (_) {
      if (!state.themeApplied) {
        document.documentElement.classList.add('lt-no-trans');
        applyTheme();
        state.themeApplied = true;
      }
      cleanupState(state, 'onFinish');
      return false;
    }

    state.vt = vt;
    if (vt && vt.finished && typeof vt.finished.catch === 'function') {
      vt.finished.catch(function () {});
    }

    state.readyTimer = setTimeout(function () {
      if (activeState === state && !state.started && !state.cleaned) {
        if (!state.themeApplied) {
          document.documentElement.classList.add('lt-no-trans');
          applyTheme();
          state.themeApplied = true;
        }
        cleanupState(state, 'onFinish');
      }
    }, 600);

    vt.ready.then(function () {
      if (activeState !== state || state.cleaned) return;
      if (state.readyTimer) {
        clearTimeout(state.readyTimer);
        state.readyTimer = 0;
      }
      state.started = true;

      // 在 Android Chrome 上读取真实的 Snapshot Containing Block 盒子，校准起点与粒子层坐标
      var rootBox = readPseudoGroupBox('::view-transition-group(root)');
      var partBox = readPseudoGroupBox('::view-transition-group(lt-particles)');
      var anchorBox = anchorEl ? readPseudoGroupBox('::view-transition-group(lt-anchor)') : null;
      if (rootBox && rootBox.width > 0 && rootBox.height > 0) {
        W = rootBox.width;
        H = rootBox.height;
        if (anchorBox && anchorBox.width > 0 && anchorBox.height > 0) {
          originX = clamp((anchorBox.left - rootBox.left) + anchorBox.width / 2, 20, W - 20);
          originY = clamp((anchorBox.top - rootBox.top) + anchorBox.height - 5, 6, Math.max(40, H * 0.65));
        } else if (partBox && partBox.width > 0 && partBox.height > 0) {
          originX = clamp(originX + (partBox.left - rootBox.left), 20, W - 20);
          originY = clamp(originY + (partBox.top - rootBox.top), 6, Math.max(40, H * 0.65));
        }
        particleSvg.setAttribute('width', String(W));
        particleSvg.setAttribute('height', String(H));
        particleSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        vtBaseStyle.textContent = vtBaseCssPrefix
          + '::view-transition-group(lt-particles) {\n'
          + '  top: 0px !important; left: 0px !important; right: auto !important; bottom: auto !important;\n'
          + '  width: ' + W.toFixed(2) + 'px !important; height: ' + H.toFixed(2) + 'px !important;\n'
          + '  transform: translate(' + rootBox.left.toFixed(2) + 'px, ' + rootBox.top.toFixed(2) + 'px) !important;\n'
          + '  z-index: 2 !important;\n'
          + '}\n'
          + '::view-transition-new(lt-particles) { width: 100% !important; height: 100% !important; object-fit: fill !important; }\n';
      }

      // 在 old(root) 挂一个零视觉改变的 WAAPI 动画，防止 Chromium 因无活跃 CSS 动画而在首帧提前结束转场
      try {
        state.keepAliveAnim = document.documentElement.animate(
          { opacity: [1, 1] },
          { duration: duration + 2000, fill: 'forwards', pseudoElement: '::view-transition-old(root)' }
        );
      } catch (_) {}

      var splashList = createSplashParticles(originX, W);
      var streamDrops = createStreamDroplets();
      var initFrame = buildFrameGeometry(W, H, originX, originY, 0.001, 0, splashList, streamDrops);
      vtClipStyle.textContent = '::view-transition-new(root){clip-path:' + initFrame.clipCss + ' !important;-webkit-clip-path:' + initFrame.clipCss + ' !important;}';
      dropPathEl.setAttribute('d', initFrame.dropD);
      sheenPathEl.setAttribute('d', initFrame.sheenD);

      var startTs = 0;
      function tick(now) {
        if (activeState !== state || state.cleaned || state.committing) return;
        if (!startTs) startTs = now;
        var elapsed = now - startTs;
        var p = clamp(elapsed / duration, 0, 1);

        var frame = buildFrameGeometry(W, H, originX, originY, p, elapsed / 1000, splashList, streamDrops);
        vtClipStyle.textContent = '::view-transition-new(root){clip-path:' + frame.clipCss + ' !important;-webkit-clip-path:' + frame.clipCss + ' !important;}';
        dropPathEl.setAttribute('d', frame.dropD);
        sheenPathEl.setAttribute('d', frame.sheenD);

        if (p >= 1) {
          state.committing = true;
          vtClipStyle.textContent = '::view-transition-new(root){clip-path:none !important;-webkit-clip-path:none !important;}';
          dropPathEl.setAttribute('d', '');
          sheenPathEl.setAttribute('d', '');
          state.commitRaf1 = requestAnimationFrame(function () {
            if (activeState !== state || state.cleaned) return;
            cleanupState(state, 'onFinish');
          });
          return;
        }
        state.rafId = requestAnimationFrame(tick);
      }

      state.rafId = requestAnimationFrame(tick);
    }, function () {
      if (activeState !== state || state.cleaned) return;
      if (!state.themeApplied) {
        document.documentElement.classList.add('lt-no-trans');
        applyTheme();
        state.themeApplied = true;
      }
      cleanupState(state, 'onFinish');
    });

    return true;
  }

  function runShadowFallback(options, applyTheme, toLight, duration, triggerEl) {
    var W = document.documentElement.clientWidth || window.innerWidth || 1;
    var H = window.innerHeight || 1;
    var origin = resolveTriggerOrigin(triggerEl, W, H);
    var originX = origin.x;
    var originY = origin.y;

    var particles = createParticleLayer(W, H, toLight, false);
    var particleSvg = particles.svg;
    var dropPathEl = particles.dropPathEl;
    var sheenPathEl = particles.sheenPathEl;

    var state = {
      engine: 'shadow',
      started: false,
      committing: false,
      cleaned: false,
      deferRemoveNoTrans: true,
      rafId: 0,
      commitRaf1: 0,
      commitRaf2: 0,
      overlay: null,
      snapViewport: null,
      syncScroll: null,
      cancelWait: null,
      particleSvg: particleSvg,
      onFinish: options.onFinish,
      onInterrupt: options.onInterrupt,
      onScroll: function () {
        if (!activeState || activeState !== state || !state.syncScroll) return;
        var sx = window.pageXOffset || document.documentElement.scrollLeft || 0;
        var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
        state.syncScroll(sx, sy);
      },
      onResize: function () {
        if (!activeState || activeState !== state) return;
        var hr = state.overlay ? state.overlay.getBoundingClientRect() : null;
        W = (hr && hr.width > 0) ? hr.width : (document.documentElement.clientWidth || window.innerWidth || 1);
        H = (hr && hr.height > 0) ? hr.height : (window.innerHeight || 1);
        particleSvg.setAttribute('width', String(W));
        particleSvg.setAttribute('height', String(H));
        particleSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        var o = resolveTriggerOrigin(triggerEl, W, H);
        originX = o.x;
        originY = o.y;
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

      var o = resolveTriggerOrigin(triggerEl, W, H);
      originX = o.x;
      originY = o.y;

      var splashList = createSplashParticles(originX, W);
      var streamDrops = createStreamDroplets();
      var initFrame = buildFrameGeometry(W, H, originX, originY, 0.001, 0, splashList, streamDrops);
      host.style.clipPath = initFrame.clipCss;
      host.style.webkitClipPath = initFrame.clipCss;
      dropPathEl.setAttribute('d', initFrame.dropD);
      sheenPathEl.setAttribute('d', initFrame.sheenD);

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
    state.syncScroll = snap.syncScroll;
    state.cancelWait = snap.cancelWait;

    return true;
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

    var forceShadow = options.engine === 'shadow';
    if (!forceShadow && supportsViewTransitionReveal()) {
      return runViewTransition(options, applyTheme, toLight, duration, triggerEl);
    }
    return runShadowFallback(options, applyTheme, toLight, duration, triggerEl);
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
      if (supportsViewTransitionReveal()) return;
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
    prefetch: prefetchRawShadowCss,
    getActiveEngine: function () { return activeState ? activeState.engine : null; }
  };
})(typeof window !== 'undefined' ? window : this);
