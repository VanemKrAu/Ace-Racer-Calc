/**
 * LiquidThemeReveal - 液体主题切换动效模块（无音效、纯原生 JS + SVG clipPath + Shadow DOM 快照隔离）
 *
 * 原理（方案 A：真实新主题底层 + Shadow DOM 旧主题快照层 + 反向 evenodd SVG 镂空裁剪）：
 * 1. 点击触发时，将旧主题当前视口完整快照（含 Canvas 像素、表单状态、内部滚动偏移、fixed/sticky 布局）
 *    克隆至挂在全屏固定浮层上的 Shadow DOM 内，避免 ID 冲突并隔离焦点与辅助阅读树；
 * 2. 立即把真实页面无过渡切换为新主题并同步刷新环境光/分区光 Canvas；
 * 3. 单一 requestAnimationFrame 循环逐帧更新 SVG <clipPath>（clip-rule="evenodd"）的唯一路径 d：
 *    - 阶段 1：细长液柱从触发按钮下方涌出，随重力加速延伸下落，带有多频摆动、张力粗细变化与分离液滴；
 *    - 阶段 2：液柱触底激发局部冲击涟漪，向两侧抛射多颗带重力轨迹的飞溅小液滴；
 *    - 阶段 3：液体在底部积聚形成多谐波起伏液面，平滑上涨并与液柱自然融合，最终漫过整个视口完成切换。
 * 4. 整套主液体轮廓采用严格单连通闭合曲线，分离液滴与飞溅水滴仅在液面之上且液柱之外绘制，
 *    彻底避免 evenodd 自交反穿；动画结束、中断、切后台或重复点击时立刻清理所有节点、帧与监听。
 */
(function (root) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var DEFAULT_DURATION = 1300;
  var HIT_PHASE = 0.27; // 约 350ms 液柱触底，随后约 950ms 飞溅 + 起浪上涨覆盖全屏

  var activeState = null;
  var cachedCssText = null;
  var cachedSheetSig = '';
  var rawShadowCssCache = null;
  var rawShadowCssPromise = null;

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
   * 词法级替换 CSS 选择器中的文档根选择器：
   * - `:root` / `html` -> `.lt-snap-html`
   * - `body` -> `.lt-snap-body`
   * 跳过 `[...]` 属性选择器与引号内部，避免误伤 `[data-html2canvas-ignore]` 或 `.some-body`。
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

  function serializeRules(ruleList) {
    var css = '';
    for (var i = 0; i < ruleList.length; i++) {
      var rule = ruleList[i];
      // CSSStyleRule = 1
      if (rule.type === 1) {
        var sel = rewriteSelector(rule.selectorText);
        var bodyText = rule.style ? rule.style.cssText : '';
        if (sel && bodyText) {
          css += sel + ' { ' + bodyText + ' }\n';
        }
      } else if (rule.cssRules && rule.type === 4) {
        // CSSMediaRule = 4
        css += '@media ' + rule.conditionText + ' {\n' + serializeRules(rule.cssRules) + '}\n';
      } else if (rule.cssRules && rule.type === 12) {
        // CSSSupportsRule = 12
        css += '@supports ' + rule.conditionText + ' {\n' + serializeRules(rule.cssRules) + '}\n';
      } else if (rule.type === 7 || rule.type === 5) {
        // CSSKeyframesRule = 7, CSSFontFaceRule = 5
        css += rule.cssText + '\n';
      } else if (rule.cssText && rule.type !== 3) {
        css += rule.cssText + '\n';
      }
    }
    return css;
  }

  var SHADOW_HOST_OVERRIDE_CSS = '\n'
    + ':host { display: block; width: 100%; height: 100%; pointer-events: none; user-select: none; }\n'
    + '.lt-snap-html { position: fixed; inset: 0; overflow: hidden; margin: 0; padding: 0; scrollbar-width: none; }\n'
    + '.lt-snap-html::-webkit-scrollbar { display: none; }\n'
    + '.lt-snap-html > .lt-snap-body { position: relative; width: 100%; min-height: 100%; margin: 0; isolation: isolate; background: transparent !important; background-color: transparent !important; }\n';

  function scanBalancedBlock(src, startIdx) {
    // startIdx 指向 '{'，返回配对 '}' 之后的索引
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
        // 读到 '{' 或 ';'
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

      // 普通规则选择器：读到 '{'
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

    var origin = window.location.origin;
    var links = document.querySelectorAll('link[rel="stylesheet"][href]');
    var sameOriginUrls = [];
    for (var i = 0; i < links.length; i++) {
      try {
        var u = new URL(links[i].href, window.location.href);
        if (u.origin === origin && (u.protocol === 'http:' || u.protocol === 'https:')) {
          sameOriginUrls.push(u.href);
        }
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
        rawShadowCssCache = combined + SHADOW_HOST_OVERRIDE_CSS;
      }
      return rawShadowCssCache;
    }).catch(function () {
      return null;
    });
    return rawShadowCssPromise;
  }

  function getRewrittenShadowCss() {
    if (rawShadowCssCache !== null) {
      return rawShadowCssCache;
    }
    var sheets = document.styleSheets || [];
    var sigParts = [];
    for (var i = 0; i < sheets.length; i++) {
      sigParts.push((sheets[i].href || 'inline') + ':' + (sheets[i].disabled ? '0' : '1'));
    }
    var sig = sigParts.join('|');
    if (cachedCssText !== null && cachedSheetSig === sig) {
      return cachedCssText;
    }

    var buf = '';
    for (var j = 0; j < sheets.length; j++) {
      var s = sheets[j];
      if (s.disabled) continue;
      try {
        var rules = s.cssRules;
        if (rules && rules.length) {
          buf += serializeRules(rules) + '\n';
        }
      } catch (_) {
        // 跨域外链字体表等无法读 cssRules，字体本身在文档级已加载，跳过即可
      }
    }

    cachedCssText = buf + SHADOW_HOST_OVERRIDE_CSS;
    cachedSheetSig = sig;
    return cachedCssText;
  }

  function syncClonedControlsAndScroll(origRoot, cloneRoot) {
    // 1. 表单实时状态（cloneNode 不会复制用户输入值或动态 checked/open）
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

    // 2. Canvas 像素复制（环境光 #dsAmbientImg / #dsAmbientImg2、分区光 #dsZoneGlow 等）
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

    // 3. 记录非零内部滚动位置（如芯片选择框、车库下拉菜单、社区弹窗滚动区）
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

  function createOldThemeSnapshotOverlay(clipId) {
    var body = document.body;
    var docEl = document.documentElement;
    var scrollX = window.pageXOffset || docEl.scrollLeft || 0;
    var scrollY = window.pageYOffset || docEl.scrollTop || 0;
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
    // 同步文档中的外部字体表 <link>（已由浏览器缓存），保证 Shadow DOM 内自定义字体字距 100% 一致
    var links = document.querySelectorAll('link[rel="stylesheet"][href^="http"]');
    for (var lk = 0; lk < links.length; lk++) {
      var lNode = document.createElement('link');
      lNode.rel = 'stylesheet';
      lNode.href = links[lk].href;
      shadow.appendChild(lNode);
    }
    var styleEl = document.createElement('style');
    styleEl.textContent = getRewrittenShadowCss();
    shadow.appendChild(styleEl);

    var snapHtml = document.createElement('div');
    snapHtml.className = 'lt-snap-html';
    snapHtml.style.backgroundColor = oldBg;
    snapHtml.style.colorScheme = docEl.style.colorScheme || (body.classList.contains('light-mode') ? 'light' : 'dark');

    var snapBody = document.createElement('div');
    snapBody.className = 'lt-snap-body ' + (body.className || '');
    snapBody.style.cssText = body.style.cssText || '';
    snapBody.style.background = 'transparent';
    snapBody.style.backgroundColor = 'transparent';

    // 复制 body 的 data-* 属性（如 data-theme-mode, data-quality, data-calc-mode 等）
    if (body.attributes) {
      for (var a = 0; a < body.attributes.length; a++) {
        var attr = body.attributes[a];
        if (attr.name.indexOf('data-') === 0) {
          snapBody.setAttribute(attr.name, attr.value);
        }
      }
    }

    // 只克隆视觉 DOM 子树（跳过脚本、noscript、诊断面板、以及自身）
    var tempOrigWrap = document.createElement('div');
    var scrollRecords = [];
    var children = body.childNodes;
    var origList = [];
    var cloneList = [];
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (child.nodeType !== 1) continue;
      var tag = child.tagName;
      if (tag === 'SCRIPT' || tag === 'NOSCRIPT' || tag === 'IFRAME') continue;
      if (child.id === 'pvDiag' || child.id === '__ltOverlay' || child.id === '__ltSvg') continue;
      var cloned = child.cloneNode(true);
      // 剥离克隆子孙里的 script/iframe 防止意外节点
      var bad = cloned.querySelectorAll ? cloned.querySelectorAll('script, iframe') : [];
      for (var b = bad.length - 1; b >= 0; b--) {
        if (bad[b].parentNode) bad[b].parentNode.removeChild(bad[b]);
      }
      origList.push(child);
      cloneList.push(cloned);
      snapBody.appendChild(cloned);
    }
    void tempOrigWrap;

    for (var j = 0; j < origList.length; j++) {
      var recs = syncClonedControlsAndScroll(origList[j], cloneList[j]);
      for (var r = 0; r < recs.length; r++) scrollRecords.push(recs[r]);
      // 检查根节点本身的 scrollTop
      if (origList[j].scrollTop > 0 || origList[j].scrollLeft > 0) {
        scrollRecords.push({ el: cloneList[j], top: origList[j].scrollTop, left: origList[j].scrollLeft });
      }
    }

    snapHtml.appendChild(snapBody);
    shadow.appendChild(snapHtml);
    document.documentElement.appendChild(host);

    // 挂载后还原视口滚动及内部滚动偏移
    snapHtml.scrollTop = scrollY;
    snapHtml.scrollLeft = scrollX;
    for (var s = 0; s < scrollRecords.length; s++) {
      scrollRecords[s].el.scrollTop = scrollRecords[s].top;
      scrollRecords[s].el.scrollLeft = scrollRecords[s].left;
    }

    return {
      host: host,
      snapHtml: snapHtml
    };
  }

  function createSplashParticles(originX, W) {
    var count = W < 520 ? 8 : 11;
    var list = [];
    for (var i = 0; i < count; i++) {
      var side = i % 2 === 0 ? -1 : 1;
      var rank = Math.floor(i / 2);
      // 确定性分布：角度错开，保证不互相重叠
      var spreadRatio = (rank + 0.45) / Math.ceil(count / 2);
      var angleDeg = 22 + spreadRatio * 48 + ((i * 17) % 9) - 4;
      var rad = (angleDeg * Math.PI) / 180;
      var speed = (W < 520 ? 220 : 290) + spreadRatio * (W < 520 ? 260 : 380) + ((i * 37) % 60);
      list.push({
        vx: side * Math.cos(rad) * speed,
        vy: -Math.sin(rad) * speed,
        r: 2.6 + ((i * 19) % 4) * 0.95,
        delay: (i % 3) * 0.012,
        x0: originX + side * (4 + rank * 3.5)
      });
    }
    return list;
  }

  function createStreamDroplets() {
    return [
      { startP: 0.06, side: -1, offsetAmp: 12, speedMul: 0.92, r: 3.8 },
      { startP: 0.12, side: 1, offsetAmp: 14, speedMul: 0.86, r: 4.4 },
      { startP: 0.18, side: -1, offsetAmp: 10, speedMul: 0.98, r: 3.1 }
    ];
  }

  /**
   * 构造液滴闭合路径（椭圆/水滴）
   */
  function appendDropletPath(parts, cx, cy, rx, ry) {
    parts.push(
      'M', (cx - rx).toFixed(1), cy.toFixed(1),
      'A', rx.toFixed(1), ry.toFixed(1), '0 1 0', (cx + rx).toFixed(1), cy.toFixed(1),
      'A', rx.toFixed(1), ry.toFixed(1), '0 1 0', (cx - rx).toFixed(1), cy.toFixed(1),
      'Z'
    );
  }

  /**
   * 计算某时刻液柱中心线 x(y) 与半宽 hw(y)
   */
  function evalStreamColumn(y, originX, originY, tipY, elapsedSec, maxSpan) {
    var span = Math.max(1, tipY - originY);
    var u = clamp((y - originY) / span, 0, 1);
    // 顶部锚定（u=0 时摆动为 0），中下段自然摇摆
    var env = Math.sin(u * Math.PI * 0.88);
    var swayAmp = clamp(maxSpan * 0.022, 6, 15);
    var sway = (
      Math.sin((y - originY) * 0.021 - elapsedSec * 12.5) * 0.68
      + Math.sin((y - originY) * 0.043 - elapsedSec * 19.0) * 0.32
    ) * swayAmp * env;

    // 粗细变化：顶部流出口宽 -> 中段拉细 -> 底部/头部略膨大
    var topWidth = 10.5;
    var waist = 4.2 + Math.sin(u * Math.PI * 3.0 - elapsedSec * 9.0) * 0.7;
    var tipBulge = u > 0.78 ? smoothstep(0.78, 1.0, u) * 5.2 : 0;
    var topFlare = u < 0.16 ? (1 - smoothstep(0, 0.16, u)) * (topWidth - 4.4) : 0;
    var hw = Math.max(2.8, waist + topFlare + tipBulge);

    return { cx: originX + sway, hw: hw };
  }

  /**
   * 计算底部起伏波浪高度 waveY(x)
   */
  function evalWaveY(x, baseY, W, H, originX, p, elapsedSec) {
    var riseP = clamp((p - HIT_PHASE) / (1 - HIT_PHASE), 0, 1);
    var ampScale = smoothstep(0.0, 0.18, riseP) * (1 - smoothstep(0.82, 0.99, riseP));
    var baseAmp = clamp(W * 0.016, 10, 22) * ampScale;

    var w1 = Math.sin(x * 0.0085 + elapsedSec * 5.2) * (baseAmp * 0.56);
    var w2 = Math.sin(x * 0.0185 - elapsedSec * 7.6 + 1.1) * (baseAmp * 0.30);
    var w3 = Math.cos(x * 0.0042 + elapsedSec * 3.1) * (baseAmp * 0.28);

    // 触底局部冲击涟漪（从 originX 向两侧传播并阻尼消散）
    var impactP = clamp((p - HIT_PHASE) / 0.42, 0, 1);
    var ripple = 0;
    if (impactP > 0 && impactP < 1) {
      var dist = Math.abs(x - originX);
      var front = impactP * Math.max(W * 0.95, 520);
      var band = Math.exp(-Math.pow((dist - front * 0.62) / (95 + impactP * 90), 2));
      var decay = (1 - impactP) * (1 - impactP);
      ripple = Math.cos((dist - front) * 0.055) * (clamp(H * 0.028, 14, 26) * decay * band);
      // 落点中心短暂下凹再弹起
      var crater = Math.exp(-Math.pow(dist / 58, 2)) * Math.sin(impactP * Math.PI * 3.0) * (14 * decay);
      ripple += crater;
    }

    return baseY - (w1 + w2 + w3) - ripple;
  }

  /**
   * 生成单连通的 clip-rule="evenodd" 裁剪路径 + 轻量边沿高光路径
   */
  function buildFramePaths(W, H, originX, originY, p, elapsedSec, splashList, streamDrops) {
    // 1. 反向遮罩外框：顺时针覆盖全屏
    var clipParts = ['M 0 0 L', W.toFixed(1), '0 L', W.toFixed(1), H.toFixed(1), 'L 0', H.toFixed(1), 'Z'];
    var sheenParts = [];

    var tipY;
    var streamBottomY;
    var isPooled = p >= HIT_PHASE;

    if (!isPooled) {
      // 阶段 1：纯液柱向下延伸
      var fallT = clamp(p / HIT_PHASE, 0, 1);
      var fallEase = fallT * fallT * (0.25 + 0.75 * fallT); // 加速下坠感
      tipY = originY + 8 + (H - originY - 6) * fallEase;

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

      clipParts.push('M', leftPts[0][0].toFixed(1), leftPts[0][1].toFixed(1));
      sheenParts.push('M', leftPts[0][0].toFixed(1), leftPts[0][1].toFixed(1));
      for (var li = 1; li < leftPts.length; li++) {
        var lp = leftPts[li];
        clipParts.push('L', lp[0].toFixed(1), lp[1].toFixed(1));
        sheenParts.push('L', lp[0].toFixed(1), lp[1].toFixed(1));
      }
      // 液柱底部半圆水滴头收口
      var rxTip = Math.max(4, tipInfo.hw);
      clipParts.push(
        'Q', (tipInfo.cx - rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        tipInfo.cx.toFixed(1), (tipY + rxTip * 0.85).toFixed(1),
        'Q', (tipInfo.cx + rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        rightPts[rightPts.length - 1][0].toFixed(1), rightPts[rightPts.length - 1][1].toFixed(1)
      );
      sheenParts.push(
        'Q', (tipInfo.cx - rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        tipInfo.cx.toFixed(1), (tipY + rxTip * 0.85).toFixed(1),
        'Q', (tipInfo.cx + rxTip * 0.9).toFixed(1), (tipY + rxTip * 0.75).toFixed(1),
        rightPts[rightPts.length - 1][0].toFixed(1), rightPts[rightPts.length - 1][1].toFixed(1)
      );
      for (var ri = rightPts.length - 2; ri >= 0; ri--) {
        var rp = rightPts[ri];
        clipParts.push('L', rp[0].toFixed(1), rp[1].toFixed(1));
        sheenParts.push('L', rp[0].toFixed(1), rp[1].toFixed(1));
      }
      // 顶口半圆闭合
      clipParts.push('A', '10 7 0 0 0', leftPts[0][0].toFixed(1), leftPts[0][1].toFixed(1), 'Z');

      // 分离液滴（阶段 1 下坠期间）
      for (var di = 0; di < streamDrops.length; di++) {
        var sd = streamDrops[di];
        if (p < sd.startP) continue;
        var dt = clamp((p - sd.startP) / (HIT_PHASE - sd.startP + 0.08), 0, 1);
        var dy = originY + 26 + (H - originY) * (dt * dt * sd.speedMul);
        if (dy >= tipY - 6 || dy >= H - 4) continue;
        var colAtDy = evalStreamColumn(dy, originX, originY, tipY, elapsedSec, H - originY);
        var dx = colAtDy.cx + sd.side * (colAtDy.hw + sd.r + 4 + Math.sin(dt * Math.PI) * sd.offsetAmp);
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

    // 阶段 2 & 3：触底后底部波浪液面上升并与液柱合流为单一连续多边形
    var riseP = clamp((p - HIT_PHASE) / (1 - HIT_PHASE), 0, 1);
    // 严格连续平滑的 S 型流体上涨曲线（避免任何分段跳变），平滑漫过顶部 (-56 确保波谷也完全超过 0)
    var riseEase = riseP * riseP * (3 - 2 * riseP);
    var baseY = lerp(H - 2, -56, riseEase);
    var floorY = H + 80;

    // 采样整条底部波浪线 [0, W]
    var waveSamples = 56;
    var wavePts = new Array(waveSamples + 1);
    for (var wi = 0; wi <= waveSamples; wi++) {
      var wx = (wi / waveSamples) * W;
      var wy = evalWaveY(wx, baseY, W, H, originX, p, elapsedSec);
      wavePts[wi] = [wx, wy];
    }

    // 判断液柱是否仍与按钮相连（液面尚未接近按钮下沿，且仍在供液阶段）
    var centerWaveY = evalWaveY(originX, baseY, W, H, originX, p, elapsedSec);
    var streamFade = 1 - smoothstep(0.58, 0.78, riseP);
    var hasStream = centerWaveY > originY + 26 && streamFade > 0.08;

    if (hasStream) {
      streamBottomY = centerWaveY;
      var sSteps = 20;
      var neckH = Math.min(26, Math.max(8, (centerWaveY - originY) * 0.25));
      var neckSpread = (16 + Math.sin(riseP * Math.PI) * 14) * streamFade;
      var colTop = evalStreamColumn(originY, originX, originY, streamBottomY, elapsedSec, H - originY);
      var sLeft = [];
      var sRight = [];
      for (var si = 0; si <= sSteps; si++) {
        var sf = si / sSteps;
        var sy = lerp(originY, Math.max(originY + 2, centerWaveY - neckH), sf);
        var sc = evalStreamColumn(sy, originX, originY, streamBottomY, elapsedSec, H - originY);
        var halfW = Math.max(1.8, sc.hw * (0.45 + 0.55 * streamFade));
        sLeft.push([clamp(sc.cx - halfW, 8, W - 16), sy]);
        sRight.push([clamp(sc.cx + halfW, 16, W - 8), sy]);
      }
      var lastL = sLeft[sLeft.length - 1];
      var lastR = sRight[sRight.length - 1];
      var leftJoinX = clamp(lastL[0] - neckSpread, 2, lastL[0] - 2);
      var rightJoinX = clamp(lastR[0] + neckSpread, lastR[0] + 2, W - 2);
      var leftJoinY = evalWaveY(leftJoinX, baseY, W, H, originX, p, elapsedSec);
      var rightJoinY = evalWaveY(rightJoinX, baseY, W, H, originX, p, elapsedSec);

      // 构造严格单连通简单多边形（绝对无自交）：
      // 顶口左 -> 液柱左壁 -> 弯月面左弧 -> 液面左半段到 x=0 -> 底边 (0,floorY)->(W,floorY) -> 液面右半段 -> 弯月面右弧 -> 液柱右壁 -> 顶口右 -> 闭合
      clipParts.push('M', sLeft[0][0].toFixed(1), sLeft[0][1].toFixed(1));
      for (var sl = 1; sl < sLeft.length; sl++) {
        clipParts.push('L', sLeft[sl][0].toFixed(1), sLeft[sl][1].toFixed(1));
      }
      clipParts.push(
        'Q', lastL[0].toFixed(1), leftJoinY.toFixed(1),
        leftJoinX.toFixed(1), leftJoinY.toFixed(1)
      );
      for (var wl = waveSamples; wl >= 0; wl--) {
        if (wavePts[wl][0] < leftJoinX - 1) {
          clipParts.push('L', wavePts[wl][0].toFixed(1), wavePts[wl][1].toFixed(1));
        }
      }
      // 顺着视口底边绕到右下角，再沿右侧波浪回到 rightJoinX
      clipParts.push('L 0', floorY.toFixed(1), 'L', W.toFixed(1), floorY.toFixed(1));
      for (var wr = waveSamples; wr >= 0; wr--) {
        if (wavePts[wr][0] > rightJoinX + 1) {
          clipParts.push('L', wavePts[wr][0].toFixed(1), wavePts[wr][1].toFixed(1));
        }
      }
      clipParts.push(
        'L', rightJoinX.toFixed(1), rightJoinY.toFixed(1),
        'Q', lastR[0].toFixed(1), rightJoinY.toFixed(1),
        lastR[0].toFixed(1), lastR[1].toFixed(1)
      );
      for (var sr = sRight.length - 2; sr >= 0; sr--) {
        clipParts.push('L', sRight[sr][0].toFixed(1), sRight[sr][1].toFixed(1));
      }
      var topHalf = Math.max(4, colTop.hw * (0.5 + 0.5 * streamFade));
      clipParts.push('A', topHalf.toFixed(1), '6 0 0 0', sLeft[0][0].toFixed(1), sLeft[0][1].toFixed(1), 'Z');

      // 装饰高光边线（只画液面与液柱轮廓边）
      sheenParts.push('M', wavePts[0][0].toFixed(1), wavePts[0][1].toFixed(1));
      for (var swl = 1; swl <= waveSamples; swl++) {
        if (wavePts[swl][0] < leftJoinX - 1) {
          sheenParts.push('L', wavePts[swl][0].toFixed(1), wavePts[swl][1].toFixed(1));
        }
      }
      sheenParts.push('L', leftJoinX.toFixed(1), leftJoinY.toFixed(1), 'Q', lastL[0].toFixed(1), leftJoinY.toFixed(1), lastL[0].toFixed(1), lastL[1].toFixed(1));
      for (var sl2 = sLeft.length - 2; sl2 >= 0; sl2--) {
        sheenParts.push('L', sLeft[sl2][0].toFixed(1), sLeft[sl2][1].toFixed(1));
      }
      sheenParts.push('M', sRight[0][0].toFixed(1), sRight[0][1].toFixed(1));
      for (var sr2 = 1; sr2 < sRight.length; sr2++) {
        sheenParts.push('L', sRight[sr2][0].toFixed(1), sRight[sr2][1].toFixed(1));
      }
      sheenParts.push('Q', lastR[0].toFixed(1), rightJoinY.toFixed(1), rightJoinX.toFixed(1), rightJoinY.toFixed(1));
      for (var swr = 0; swr <= waveSamples; swr++) {
        if (wavePts[swr][0] > rightJoinX + 1) {
          sheenParts.push('L', wavePts[swr][0].toFixed(1), wavePts[swr][1].toFixed(1));
        }
      }
    } else {
      // 纯波浪上涨铺满视口（已脱离/淹没按钮下方液柱）
      clipParts.push('M', wavePts[0][0].toFixed(1), wavePts[0][1].toFixed(1));
      sheenParts.push('M', wavePts[0][0].toFixed(1), wavePts[0][1].toFixed(1));
      for (var wi2 = 1; wi2 <= waveSamples; wi2++) {
        clipParts.push('L', wavePts[wi2][0].toFixed(1), wavePts[wi2][1].toFixed(1));
        sheenParts.push('L', wavePts[wi2][0].toFixed(1), wavePts[wi2][1].toFixed(1));
      }
      clipParts.push('L', W.toFixed(1), floorY.toFixed(1), 'L 0', floorY.toFixed(1), 'Z');
    }

    // 触底瞬间向外扩散的局部椭圆涟漪高光环（仅绘制在装饰层，不影响裁剪）
    var ringP = clamp((p - HIT_PHASE) / 0.36, 0, 1);
    if (ringP > 0 && ringP < 1) {
      var ringRx = 18 + ringP * Math.min(W * 0.34, 240);
      var ringRy = 4 + ringP * 14;
      var ringCy = Math.min(H - 5, centerWaveY + 4);
      sheenParts.push(
        'M', (originX - ringRx).toFixed(1), ringCy.toFixed(1),
        'A', ringRx.toFixed(1), ringRy.toFixed(1), '0 1 0', (originX + ringRx).toFixed(1), ringCy.toFixed(1),
        'A', ringRx.toFixed(1), ringRy.toFixed(1), '0 1 0', (originX - ringRx).toFixed(1), ringCy.toFixed(1)
      );
    }

    // 阶段 2 触底飞溅小液滴（只在严格位于液面波浪之上且不碰液柱时才绘制，确保无 evenodd 自交）
    var splashTime = (p - HIT_PHASE) * 1.15;
    if (splashTime > 0 && splashTime < 0.72) {
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
        if (sy + sp.r * 1.3 >= localWaveY - 3) continue; // 已落回/被液面吞没，不再单独画
        if (hasStream && sy > originY) {
          var colCheck = evalStreamColumn(sy, originX, originY, streamBottomY, elapsedSec, H - originY);
          if (Math.abs(sx - colCheck.cx) <= colCheck.hw + sp.r + 3) continue;
        }
        var shrink = 1 - smoothstep(0.42, 0.7, tau);
        var rx = sp.r * shrink;
        var ry = sp.r * 1.25 * shrink;
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

    // 若当前正在播上一轮动画，立即中断并把状态清干净，再顺畅切向新主题
    if (activeState) {
      cleanupActive('onInterrupt');
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
        originY = clamp(rect.bottom - 3, 8, Math.max(40, H * 0.45));
      }
    }

    var uid = String(Date.now()) + '_' + Math.floor(Math.random() * 10000);
    var clipId = '__ltClip_' + uid;

    // 1. 构建主文档隐藏 SVG <clipPath>
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

    // 2. 趁页面还停留在旧主题，建立 Shadow DOM 隔离的旧主题快照层
    var snap = createOldThemeSnapshotOverlay(clipId);

    // 3. 检测即将切换为深还是浅，配置极细的液面边沿玻璃反光颜色
    var willBeLight = !(document.body && document.body.classList.contains('light-mode'));
    var sheenSvg = document.createElementNS(SVG_NS, 'svg');
    sheenSvg.setAttribute('aria-hidden', 'true');
    sheenSvg.setAttribute('width', String(W));
    sheenSvg.setAttribute('height', String(H));
    sheenSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    sheenSvg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483641;pointer-events:none;';
    var sheenPathEl = document.createElementNS(SVG_NS, 'path');
    sheenPathEl.setAttribute('fill', 'none');
    sheenPathEl.setAttribute('stroke-linecap', 'round');
    sheenPathEl.setAttribute('stroke-linejoin', 'round');
    sheenPathEl.setAttribute('stroke-width', '1.5');
    sheenPathEl.setAttribute('stroke', willBeLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.22)');
    sheenSvg.appendChild(sheenPathEl);
    document.documentElement.appendChild(sheenSvg);

    // 4. 零过渡瞬间将真实底层切换为新主题（包括 Canvas 重绘）
    document.documentElement.classList.add('lt-no-trans');
    try {
      applyTheme();
      // 强制样式立即落定，避免新主题卡片/环境光慢半拍渐变
      void document.body.offsetHeight;
    } finally {
      document.documentElement.classList.remove('lt-no-trans');
    }

    var splashList = createSplashParticles(originX, W);
    var streamDrops = createStreamDroplets();

    // 5. 写入初始第 0 帧路径（全覆盖旧主题）
    var initFrame = buildFramePaths(W, H, originX, originY, 0.001, 0, splashList, streamDrops);
    pathEl.setAttribute('d', initFrame.clipD);
    sheenPathEl.setAttribute('d', initFrame.sheenD);

    var state = {
      rafId: 0,
      overlay: snap.host,
      snapHtml: snap.snapHtml,
      svg: svg,
      sheenSvg: sheenSvg,
      onFinish: options.onFinish,
      onInterrupt: options.onInterrupt,
      onScroll: function () {
        if (!activeState) return;
        activeState.snapHtml.scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
        activeState.snapHtml.scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0;
      },
      onResize: function () {
        if (!activeState) return;
        W = document.documentElement.clientWidth || window.innerWidth || 1;
        H = window.innerHeight || 1;
        sheenSvg.setAttribute('width', String(W));
        sheenSvg.setAttribute('height', String(H));
        sheenSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        if (triggerEl && triggerEl.getBoundingClientRect) {
          var r = triggerEl.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            originX = clamp(r.left + r.width / 2, 20, W - 20);
            originY = clamp(r.bottom - 3, 8, Math.max(40, H * 0.45));
          }
        }
      },
      onVisibility: function () {
        if (document.hidden) {
          cleanupActive('onFinish');
        }
      }
    };
    activeState = state;

    window.addEventListener('scroll', state.onScroll, { passive: true });
    window.addEventListener('resize', state.onResize, { passive: true });
    document.addEventListener('visibilitychange', state.onVisibility);

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
    return true;
  }

  function cancel() {
    cleanupActive('onInterrupt');
  }

  function isRunning() {
    return !!activeState;
  }

  // 浏览器空闲时预解析同源 CSS 原文，彻底避免 CSSOM rule.style.cssText 丢失带 var() 的简写属性（如 font: ... var(--round)）
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
