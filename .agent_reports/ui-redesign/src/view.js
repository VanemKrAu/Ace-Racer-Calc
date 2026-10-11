/* view.js：纯展示层适配器。只「读」原站 JS 写出的结果 DOM，把它渲染成新的可视化；
   不改任何计算与交互逻辑。 */
(function () {
  var L = function (zh, en) { return (typeof currentLang !== 'undefined' && currentLang === 'en') ? en : zh; };
  var $ = function (id) { return document.getElementById(id); };
  var EMOJI_HEAD = /^[\s✅❌⚠✨️]+/;

  // ---------- 解析结果 ----------
  function parse(which) {
    var card = $(which === 'first' ? 'resultCardFirst' : 'resultCardLoop');
    var num = $(which === 'first' ? 'resultValueFirst' : 'resultValueLoop');
    var formula = $(which === 'first' ? 'formulaDisplayFirst' : 'formulaDisplayLoop');
    var raw = (num.textContent || '').trim();
    if (!raw || raw === '--') return { card: card, idle: true };
    var ft = formula.textContent || '';
    var tm = which === 'first' ? ft.match(/(?:及格线目标：|Passing Target: )\s*([\d.]+)%/) : ft.match(/(?:大招阀门|Ult Valve)\(([\d.]+)%\)/);
    var totals = ft.match(/=\s*([\d.]+)%/g);
    var total = totals ? parseFloat(totals[totals.length - 1].replace(/[^\d.]/g, '')) : NaN;
    var label = raw.replace(EMOJI_HEAD, '').replace(/\s*\(.*$/, '').trim();
    return {
      card: card, idle: false, pass: !card.classList.contains('error-state'),
      target: tm ? parseFloat(tm[1]) : NaN, total: total, label: label,
      collapsed: /容纳氮气数为0|0 nitros fit/.test(raw)
    };
  }

  // ---------- 渲染仪表 ----------
  var RING_C = 2 * Math.PI * 42;
  function gaugeSkeleton(g) {
    g.innerHTML =
      '<div class="ds-gauge-top"><span class="ds-status" data-r="status"></span><span class="ds-target" data-r="target"></span></div>' +
      '<div class="ds-gauge-main">' +
        __pvRingSvg() +   // V4：270° 转速表（v4.js）
        '<div class="ds-readout"><span class="ds-value" data-r="value" aria-live="polite">--</span><span class="ds-delta" data-r="delta"></span></div>' +
      '</div>' +
      '<div class="ds-bar"><div class="ds-bar-fill" data-r="fill"></div><div class="ds-bar-mark"></div></div>';
  }
  function fmt(n) {
    if (!isFinite(n)) return '--';
    var s = n.toFixed(3).split('.');
    return s[0] + '<small>.' + s[1] + '%</small>';
  }
  function renderGauge(which) {
    var g = document.querySelector('.ds-gauge[data-for="' + which + '"]');
    if (!g) return null;
    if (!g.firstChild) gaugeSkeleton(g);
    var r = parse(which);
    var q = function (k) { return g.querySelector('[data-r="' + k + '"]'); };
    g.dataset.state = r.idle ? 'idle' : (r.pass ? 'pass' : 'fail');
    if (r.idle) {
      q('status').textContent = L('等待测算', 'Waiting');
      q('value').innerHTML = '--'; q('delta').textContent = ''; q('target').textContent = '';
      q('fill').style.width = '0%'; __pvRing(g, NaN, NaN);
      return r;
    }
    q('status').textContent = r.label;
    q('value').innerHTML = r.collapsed ? '0<small>&nbsp;' + L('个氮气', 'nitros') + '</small>' : fmt(r.total);
    q('target').textContent = isFinite(r.target) ? L('阈值 ', 'Target ') + r.target + '%' : '';
    if (isFinite(r.total) && isFinite(r.target)) {
      var d = Math.round((r.total - r.target) * 1000) / 1000;
      q('delta').textContent = d >= 0 ? L('余量 +', 'Margin +') + d.toFixed(3) + '%' : L('缺口 ', 'Gap ') + d.toFixed(3) + '%';
      var ratio = r.target > 0 ? r.total / r.target : 0;
      q('fill').style.width = Math.max(0, Math.min(100, ratio / 1.6 * 100)).toFixed(2) + '%';
      __pvRing(g, r.total, r.target);
    }
    return r;
  }

  // 结果说明里的 emoji 前缀去掉（只动首个文本节点，文字内容不变）
  function stripLeadEmoji(el) {
    if (!el) return;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n = w.nextNode();
    while (n && !n.nodeValue.trim()) n = w.nextNode();
    if (n && EMOJI_HEAD.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(EMOJI_HEAD, '');
  }

  // ---------- 结果速览 dock ----------
  function renderDock(res) {
    var items = document.querySelectorAll('.ds-dock-item');
    for (var i = 0; i < items.length; i++) {
      // 用专门的 data-gauge 判定这是「首发」还是「循环」。
      // 别再拿 data-target 判断：那个属性是给「跳转」用的（后来从 resultCard* 改成了 calcArea*），
      // 改过一次就把这里的对应关系带错了 —— 两项都落到 loop，导致 dock 的「首发」显示循环的数字。
      // 兜底同时认新旧两种 target 值，双保险。
      var tgt = items[i].dataset.target;
      var key = items[i].dataset.gauge || ((tgt === 'resultCardFirst' || tgt === 'calcAreaFirst') ? 'first' : 'loop');
      var r = key === 'first' ? res.first : res.loop;
      if (!r) continue;
      items[i].dataset.state = r.idle ? 'idle' : (r.pass ? 'pass' : 'fail');
      items[i].querySelector('.ds-dock-v').textContent = r.idle || !isFinite(r.total) ? '--' : r.total.toFixed(1) + '%';
    }
  }
  // dock 只是「跳到结果卡」的快捷入口，不是 tab —— 高亮只做「刚点了哪一项」的临时反馈，
  // 不能留在那儿当成选中态。两种情况清掉：①离开结果区、dock 重新出现时 ②3s 兜底。
  var dockActiveTimer = null;
  function clearDockActive() {
    clearTimeout(dockActiveTimer);
    var all = document.querySelectorAll('.ds-dock-item');
    for (var i = 0; i < all.length; i++) {
      all[i].classList.remove('is-active');
      all[i].removeAttribute('aria-current');
    }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.ds-dock-item');
    if (!b) return;
    var all = document.querySelectorAll('.ds-dock-item');
    for (var i = 0; i < all.length; i++) {
      var on = all[i] === b;
      all[i].classList.toggle('is-active', on);
      if (on) all[i].setAttribute('aria-current', 'true'); else all[i].removeAttribute('aria-current');
    }
    clearTimeout(dockActiveTimer);
    dockActiveTimer = setTimeout(clearDockActive, 3000);
    // 跳转目标优先取「整个测算区」的容器（带标题与输入卡那一整块），
    // 取不到再退回单张结果卡片 —— 之前直接跳到卡片，会把标题与输入区甩到屏幕外。
    var el = $(b.dataset.target) || (b.dataset.targetFallback ? $(b.dataset.targetFallback) : null);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ---------- 车图容错：绝不因为一次加载失败就把车图永久隐藏 ----------
  // 原站在 <img id="carImage"> 上写了 onerror="this.style.display='none'"：
  // 首次访问时只要那张占位车图（icon_mhyck_m.png）请求失败一次（CDN 抖动 / 403 / 网络瞬断），
  // 车辆显示区就永久空白、必须刷新才能恢复。这里改成三级兜底：
  //   占位图失败 → 原样重试一次 → 仍失败退回站内本地副本（data/icon/），全程不隐藏。
  (function () {
    var img = $('carImage');
    if (!img) return;
    var ph = (_ICONS || {})['icon_mhyck_m.png'] || 'data/icon/icon_mhyck_m.png';
    var phLocal = 'data/icon/icon_mhyck_m.png';
    var tries = 0;
    img.addEventListener('error', function () {
      var cur = img.getAttribute('src') || '';
      // 占位图在页面上是 CDN 哈希 URL，不含 icon_mhyck_m 字样，所以要用完整 URL 比对 + 本地路径正则
      var isPlaceholder = (cur === ph) || (cur.indexOf(phLocal) >= 0) || /icon_mhyck_m/.test(cur);
      // 车辆图自身加载失败由业务逻辑兜底（它会换成占位图），这里只管占位图失败的情况，别抢
      if (!isPlaceholder) return;
      tries++;
      if (tries === 1) {
        img.removeAttribute('src');
        setTimeout(function () { img.src = ph; }, 150);
      } else if (tries === 2) {
        img.src = phLocal;
      }
    });
  })();
  if (window.IntersectionObserver) {
    var seen = {};
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      var inside = !!(seen.resultCardFirst || seen.resultCardLoop);
      document.body.classList.toggle('ds-results-visible', inside);
      if (!inside) clearDockActive();   // 离开结果区 → dock 重新出现，顺手清掉临时高亮
    }, { threshold: 0.25 });
    ['resultCardFirst', 'resultCardLoop'].forEach(function (id) { if ($(id)) io.observe($(id)); });
  }

  var onScroll = function () { document.body.classList.toggle('ds-scrolled', (window.scrollY || 0) > 260); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- 滑块填充 / 主题 / 车辆品质 ----------
  function syncSliders() {
    var rs = document.querySelectorAll('input[type="range"]');
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i], min = +r.min || 0, max = +r.max || 100;
      r.style.setProperty('--fill', ((+r.value - min) / (max - min) * 100).toFixed(2) + '%');
    }
  }
  document.addEventListener('input', function (e) { if (e.target.type === 'range') syncSliders(); });

  function setData(k, v) { if (document.body.dataset[k] !== v) document.body.dataset[k] = v; }
  function syncTheme() {
    var t = ($('themeIcon') || {}).textContent || '';
    setData('themeMode', t.indexOf('☀') >= 0 ? 'light' : t.indexOf('🌙') >= 0 ? 'dark' : 'system');
    // 页面本身默认就是深色（原站 initTheme 无存档时会写死 dark），但滚动条、原生控件这些
    // UA 部件仍会跟着系统走 —— 这里把 color-scheme 钉在 <html> 上，让它们跟随页面主题。
    var light = document.body.classList.contains('light-mode');
    var cs = light ? 'light' : 'dark';
    if (document.documentElement.style.colorScheme !== cs) document.documentElement.style.colorScheme = cs;
    // 手机地址栏 / 安装成 PWA 后的状态栏底色（theme-color）。
    // 原站在 <head> 里写了两条按「系统偏好」切换的 meta，但本站有三档主题且默认深色 ——
    // 系统与站内主题不一致时，地址栏颜色会和页面对不上。这里改成跟随站内实际主题：
    // 只保留一条 meta、去掉 media 条件，主题一变就同步改写它。
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    if (metas.length) {
      var meta = metas[0];
      for (var i = 1; i < metas.length; i++) metas[i].parentNode.removeChild(metas[i]);
      if (meta.hasAttribute('media')) meta.removeAttribute('media');
      var color = light ? '#f2f2f6' : '#000000';
      if (meta.getAttribute('content') !== color) meta.setAttribute('content', color);
    }
  }
  var Q = { '普通': 'common', '稀有': 'rare', '史诗': 'epic', '传说': 'legend' };
  function syncQuality() {
    var c = (typeof _selectedCar !== 'undefined' && _selectedCar) ? _selectedCar : null;
    setData('quality', c ? (Q[c.quality] || 'none') : 'none');
  }

  // ---------- 环境光背景：跟随当前车图，换车时两层交叉淡入淡出 ----------
  // 背景的「流动感」= 取当前车图做大半径模糊后渐显；A/B 两层轮换，旧车淡出与新车淡入同时进行。
  //
  // 性能：原来是 <img> + CSS filter: blur(34px) saturate()，再 scale(2.6) 铺满屏幕。CSS 模糊是「每一帧」由合成器
  // 重新计算的，放大 2.6 倍 × 手机 3 倍像素密度后模糊半径约 260 个物理像素 —— 滑动时每帧都要算一遍，
  // 手机上就是「一卡一卡、直接跳到下一屏」。实测去掉这一层，滑动帧间隔从 ~70ms 回到 16.7ms。
  // 现在改成：换车时只在一块 200px 宽的小 canvas 上模糊一次（等效半径按比例换算，看起来完全一样），
  // 之后屏幕上只是把这张已经糊好的小图放大显示 —— 合成器每帧只做一次贴图，几乎零开销。
  var ambLayers = null, ambOn = 0, ambToken = 0;
  var AMB_W = 200;                               // 模糊图工作宽度；CSS 仍按 1120px 显示
  function ambKey(url) { return url + '|' + (document.body.classList.contains('light-mode') ? 'l' : 'd'); }
  function paintAmb(cv, img, key) {
    var nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) return false;
    var W = AMB_W, H = Math.max(1, Math.round(W * nh / nw));
    if (cv.width !== W) cv.width = W;
    if (cv.height !== H) cv.height = H;
    var ctx = cv.getContext('2d');
    if (!ctx) return false;
    ctx.clearRect(0, 0, W, H);
    var sat = document.body.classList.contains('light-mode') ? 2.2 : 1.7;
    var ok = false;
    if ('filter' in ctx) {
      try {
        ctx.filter = 'blur(' + (34 * W / 1120).toFixed(2) + 'px) saturate(' + sat + ')';   // ≈ 原 1120px 宽上的 blur(34px)
        ctx.drawImage(img, 0, 0, W, H);
        ctx.filter = 'none';
        ok = true;
      } catch (e) { ok = false; }
    }
    if (!ok) {
      // 不支持 canvas filter 的内核（老版 Safari 等）：先缩到 20px 宽再放大，同样得到柔和的色块
      ctx.clearRect(0, 0, W, H);
      var t = document.createElement('canvas');
      t.width = 20; t.height = Math.max(1, Math.round(20 * H / W));
      t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
      ctx.imageSmoothingEnabled = true;
      try { ctx.imageSmoothingQuality = 'high'; } catch (e) {}
      ctx.drawImage(t, 0, 0, W, H);
    }
    cv.dataset.key = key;
    return true;
  }
  function syncAmbient() {
    if (!ambLayers) {
      var l0 = $('dsAmbientImg'), l1 = $('dsAmbientImg2');
      if (!l0 || !l0.getContext) return;
      ambLayers = l1 ? [l0, l1] : [l0];
    }
    var car = $('carImage');
    if (!car) return;
    var has = !!(typeof _selectedCar !== 'undefined' && _selectedCar && car.src && car.style.display !== 'none');
    if (!has) {                        // 未上线车辆 / 未选车：两层都淡出，背景回到中性灰
      ambToken++;
      for (var i = 0; i < ambLayers.length; i++) ambLayers[i].classList.remove('is-on');
      document.body.classList.remove('ds-has-car');
      return;
    }
    document.body.classList.add('ds-has-car');
    var url = car.src, key = ambKey(url);
    var cur = ambLayers[ambOn];
    if (cur.classList.contains('is-on') && cur.dataset.key === key) return;   // 没换车、没换主题
    var next = ambLayers.length < 2 ? cur : ambLayers[1 - ambOn];
    if (next.dataset.pending === key) return;                                // 同一张图已经在加载
    var token = ++ambToken;
    next.dataset.pending = key;
    // 单独用一个 Image 加载（不依赖页面上那张 loading=lazy 的车图：用户在页面下方换车时它可能还没加载）
    var im = new Image(), done = false;
    var go = function () {
      if (done) return;
      done = true;
      next.dataset.pending = '';
      if (token !== ambToken) return;  // 期间又换过车，交给后来那次
      if (!paintAmb(next, im, key)) return;
      if (next === cur) { cur.classList.add('is-on'); return; }
      next.classList.add('is-on');
      cur.classList.remove('is-on');
      ambOn = 1 - ambOn;
    };
    im.onload = go;
    im.onerror = function () { done = true; next.dataset.pending = ''; };
    im.src = url;
    if (im.complete && im.naturalWidth > 0) go();
  }

  // ---------- 液态玻璃折射（仅 Chromium：只有它支持 backdrop-filter: url(#svg)） ----------
  // 按胶囊实际尺寸生成位移贴图：边缘一圈（bezel）按「凸透镜」把采样点往外推，中心不动 → 边缘处背景被弯折。
  var isChromium = (function () {
    var d = navigator.userAgentData;
    if (d && d.brands) return d.brands.some(function (b) { return /Chromium|Google Chrome|Microsoft Edge/.test(b.brand); });
    return /Chrome\/\d/.test(navigator.userAgent) && !/Edg?iOS|CriOS|FxiOS|Firefox/.test(navigator.userAgent);
  })();
  var glassKey = '';
  function buildGlass() {
    var dock = document.querySelector('.ds-c .ds-dock');
    if (!dock || !isChromium) return;
    var w = Math.round(dock.offsetWidth), h = Math.round(dock.offsetHeight);
    if (!w || !h || glassKey === w + 'x' + h) return;
    glassKey = w + 'x' + h;
    var r = h / 2, bezel = Math.min(18, r * .9), c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d'), img = ctx.createImageData(w, h), px = img.data;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      // 到胶囊边缘的有符号距离与外法线
      var cx = Math.min(Math.max(x + .5, r), w - r), cy = h / 2;
      var dx = x + .5 - cx, dy = y + .5 - cy, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var inset = r - len, k = 0;
      if (inset >= 0 && inset < bezel) { var tt = 1 - inset / bezel; k = tt * tt * (3 - 2 * tt); }
      var i = (y * w + x) * 4;
      px[i] = 128 + Math.round(dx / len * k * 127);
      px[i + 1] = 128 + Math.round(dy / len * k * 127);
      px[i + 2] = 128; px[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    var svg = $('dsLgSvg');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = 'dsLgSvg'; svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      document.body.appendChild(svg);
    }
    svg.innerHTML = '<filter id="ds-lg-filter" x="0" y="0" width="' + w + '" height="' + h + '" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
      '<feImage href="' + c.toDataURL() + '" x="0" y="0" width="' + w + '" height="' + h + '" result="map"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="map" scale="-22" xChannelSelector="R" yChannelSelector="G"/></filter>';
    document.body.classList.add('ds-lg-refract');
  }
  if (window.ResizeObserver && document.querySelector('.ds-c .ds-dock')) {
    new ResizeObserver(function () { requestAnimationFrame(buildGlass); }).observe(document.querySelector('.ds-c .ds-dock'));
  }
  // 拖动窗口 / DevTools 分隔条时，backdrop-filter: url(#svg) 每帧都要重新光栅化位移贴图，
  // 是这页最贵的一步（DevTools 打开时更明显）。拖动期间先退回通用的磨砂玻璃层，停下来再重建折射层。
  var refractPaused = false, resizeTimer = null;
  window.addEventListener('resize', function () {
    if (!isChromium) return;
    if (document.body.classList.contains('ds-lg-refract')) {
      document.body.classList.remove('ds-lg-refract');
      refractPaused = true;
    }
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!refractPaused) return;
      refractPaused = false;
      glassKey = '';                       // 强制重建：尺寸没变也必须把折射层贴回去
      requestAnimationFrame(buildGlass);
    }, 220);
  }, { passive: true });

  // ---------- 汇总刷新 ----------
  var queued = false;
  function sync() {
    queued = false;
    var res = { first: renderGauge('first'), loop: renderGauge('loop') };
    stripLeadEmoji($('resultDetailFirst')); stripLeadEmoji($('resultDetailLoop'));
    renderDock(res); syncSliders(); syncTheme(); syncQuality(); syncAmbient();
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(sync); } }

  var mo = new MutationObserver(schedule);
  ['resultValueFirst', 'resultValueLoop', 'formulaDisplayFirst', 'formulaDisplayLoop', 'themeIcon', 'carPreviewName', 'langBtnText'].forEach(function (id) {
    if ($(id)) mo.observe($(id), { childList: true, characterData: true, subtree: true });
  });
  mo.observe($('resultCardFirst'), { attributes: true, attributeFilter: ['class'] });
  mo.observe($('resultCardLoop'), { attributes: true, attributeFilter: ['class'] });
  // 换车信号：选真车时 carPreviewName 的文本会变，能顺带触发；但「未上线车辆」只切 style、
  // 换占位图，一个文本都不动 —— 不额外盯这几个属性，品质色和环境光就切不回去。
  if ($('carPreviewName')) mo.observe($('carPreviewName'), { attributes: true, attributeFilter: ['style'] });
  if ($('carPreviewPlaceholder')) mo.observe($('carPreviewPlaceholder'), { attributes: true, attributeFilter: ['style'] });
  if ($('carImage')) mo.observe($('carImage'), { attributes: true, attributeFilter: ['src'] });

  // ---------- 预览演示数据（与 scripts/render-screenshots.py 的截图状态一致） ----------
  // 只在没有分享参数时注入；真实上线版不会有这段。
  var params = new URLSearchParams(location.search);
  if (params.has('shot')) document.body.classList.add('ds-shot');
  if (!params.has('s') && !params.has('cfg') && !params.has('blank') && typeof CAR_DATABASE !== 'undefined') {
    var demo = null;
    for (var i = 0; i < CAR_DATABASE.length; i++) if (CAR_DATABASE[i].name === '布加迪 Bolide') { demo = CAR_DATABASE[i]; break; }
    if (demo) {
      pickCar(demo.id);
      var set = function (id, v) { var el = $(id); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
      var cr = $('counterRange'); cr.value = '0'; updateCounterSlider();
      set('inputXianji', 20.5); set('inputHuineng', 50); set('inputFirstNitroCount', 1);
      var hs = $('chk_huishou'); if (!hs.checked) { hs.checked = true; hs.dispatchEvent(new Event('change', { bubbles: true })); }
      calculate();
    }
  }
  sync();
})();
