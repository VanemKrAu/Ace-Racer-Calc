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
      var vIdle = q('value');
      _renderOdoValue(vIdle, '--');
      vIdle.classList.remove('tm-tick', 'tm-tick-b');
      q('delta').textContent = ''; q('target').textContent = '';
      q('fill').style.width = '0%'; __pvRing(g, NaN, NaN);
      return r;
    }
    q('status').textContent = r.label;
    var valEl = q('value');
    var nextValHtml = r.collapsed ? '0<small>&nbsp;' + L('个氮气', 'nitros') + '</small>' : fmt(r.total);
    _renderOdoValue(valEl, nextValHtml);
    valEl.classList.remove('tm-tick', 'tm-tick-b');
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
  // 结果说明开头的 emoji（✨ ✅ ⚠️ ❌）换成同一套线性图标：✨ ✅ → 对勾，⚠️ → 三角，❌ → 叉；
  // 图标颜色跟随结果卡的状态色（CSS 里 .pv-det-ico 读 --st）。原站每次重算都会整段重写，这里每次同步都会再换一遍。
  function stripLeadEmoji(el) {
    if (!el) return;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var n = w.nextNode();
    while (n && !n.nodeValue.trim()) n = w.nextNode();
    if (!n || !EMOJI_HEAD.test(n.nodeValue)) return;
    var lead = n.nodeValue.match(EMOJI_HEAD)[0];
    var kind = /[✨✅]/.test(lead) ? 'ok' : /❌/.test(lead) ? 'err' : /⚠/.test(lead) ? 'warn' : '';
    n.nodeValue = n.nodeValue.replace(EMOJI_HEAD, '');
    // emoji 单独包在一层 span 里时（如「全盘跑通」），它后面那个空格在下一个文本节点，也一并去掉，免得图标后多一格空
    if (!n.nodeValue) { var nx = w.nextNode(); if (nx && /^\s/.test(nx.nodeValue)) nx.nodeValue = nx.nodeValue.replace(/^\s+/, ''); }
    if (!kind || !window.__pvIcon || el.querySelector('.pv-det-ico')) return;
    var ic = document.createElement('span');
    ic.className = 'pv-det-ico';
    ic.innerHTML = window.__pvIcon(kind);
    n.parentNode.insertBefore(ic, n);
    window.__stripLeadEmoji = stripLeadEmoji;
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
      if (key !== 'first' && key !== 'loop') continue;   // 「供能」那格由 renderTeamPanels 负责
      var r = key === 'first' ? res.first : res.loop;
      if (!r) continue;
      var nextDockSt = r.idle ? 'idle' : (r.pass ? 'pass' : 'fail');
      var nextDockTxt = r.idle || !isFinite(r.total) ? '--' : r.total.toFixed(1) + '%';
      if (window._setDockItem) window._setDockItem(items[i], items[i].querySelector('.ds-dock-v'), nextDockTxt, nextDockSt); else { items[i].dataset.state = nextDockSt; items[i].querySelector('.ds-dock-v').textContent = nextDockTxt; }
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
    var seen = {}, holdUntil = 0, holdT = null;
    var applyResultsVisible = function () {
      var inside = !!(seen.resultCardFirst || seen.resultCardLoop || seen.resultCardChain || seen.resultCardSupport);
      document.body.classList.toggle('ds-results-visible', inside);
      if (!inside) clearDockActive();   // 离开结果区 → dock 重新出现，顺手清掉临时高亮
    };
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
      if (performance.now() < holdUntil) return;   // 正在切模式：先记下，开合做完再统一定
      applyResultsVisible();
    }, { threshold: 0.25 });
    ['resultCardFirst', 'resultCardLoop', 'resultCardChain', 'resultCardSupport'].forEach(function (id) { if ($(id)) io.observe($(id)); });
    // 切模式时调用：等页面上的高度过渡都做完（最多 1.5 秒），再按结果卡的最终位置决定胶囊显不显示
    var heightMoving = function () {
      if (!document.getAnimations) return false;
      return document.getAnimations().some(function (a) {
        if (a.playState !== 'running' || !a.effect || !a.effect.getKeyframes) return false;
        var k = a.effect.getKeyframes();
        return k.length && k[0].height != null;
      });
    };
    window.__dsHoldResults = function () {
      var t0 = performance.now();
      holdUntil = t0 + 1600;
      clearTimeout(holdT);
      (function wait() {
        holdT = setTimeout(function () {
          if (heightMoving() && performance.now() - t0 < 1500) return wait();
          requestAnimationFrame(function () { holdUntil = 0; applyResultsVisible(); });
        }, 100);
      })();
    };
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
    var light = document.body.classList.contains('light-mode');
    setData('themeMode', light ? 'light' : 'dark');
    // 页面本身默认就是深色，但滚动条、原生控件这些
    // UA 部件仍会跟着系统走 —— 这里把 color-scheme 钉在 <html> 上，让它们跟随页面主题。
    var cs = light ? 'light' : 'dark';
    if (document.documentElement.style.colorScheme !== cs) document.documentElement.style.colorScheme = cs;
    // 手机地址栏 / 安装成 PWA 后的状态栏底色（theme-color）：
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
  var ambLayers = null, ambOn = 0, ambToken = 0, ambImg = null;   // ambImg：最近一次成功加载的车图，回前台重画时复用
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
      ambImg = im;                     // 留住已解码的图，页面回到前台时可直接重画
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

  // ---------- 回到前台 / 从往返缓存恢复 / 画布上下文丢失 → 重画环境光 ----------
  // 为什么必须补这一步：浏览器（Android Chrome 与各家套壳 WebView 都算）会在页面转入后台时
  // 回收 canvas 的绘制内容来省内存，回到前台画布就是一片空白。而上面 syncAmbient() 的判据是
  // 「is-on 且 dataset.key 没变就直接返回」—— 画布虽然空了，这两个标记却还在，于是它认定
  // 「已经画好了」，背景车图就再也不出现（除非换车或切主题）。这里在恢复可见时把标记作废并重画。
  function revalidateAmbient() {
    if (!ambLayers) return;
    ambToken++;                                     // 作废进行中的加载，避免和这次重画抢
    for (var i = 0; i < ambLayers.length; i++) ambLayers[i].dataset.key = '';
    var car = $('carImage');
    if (car && car.src && ambImg && ambImg.naturalWidth) {
      var key = ambKey(car.src);
      for (var j = 0; j < ambLayers.length; j++) {
        var cv = ambLayers[j];
        if (cv.classList.contains('is-on')) {
          cv.width = 0;                            // 丢掉可能已被回收的后备存储，强制重建
          if (paintAmb(cv, ambImg, key)) return;   // 图还在手上，直接重画，不用重新请求
        }
      }
    }
    syncAmbient();                                 // 否则走正常路径（命中缓存时也很快）
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) revalidateAmbient(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) revalidateAmbient(); });
  window.addEventListener('resume', revalidateAmbient);   // Page Lifecycle：部分套壳内核只发这个
  [['dsAmbientImg'], ['dsAmbientImg2']].forEach(function (ids) {
    var cv = $(ids[0]);
    if (cv && cv.addEventListener) {
      // 2D 画布也可能被回收上下文；preventDefault 才能等到 contextrestored
      cv.addEventListener('contextlost', function (e) { e.preventDefault(); revalidateAmbient(); });
      cv.addEventListener('contextrestored', function () { revalidateAmbient(); });
    }
  });

  // ---------- 分区光：三团随滚动漂移的光，画在一块低分辨率画布上 ----------
  // 关键帧与原来 CSS 的 dsZoneA / B / C 逐项一致（连缩放那点「呼吸」都保留了），
  // 只是改由画布绘制。换实现的理由：原来是三个带 scale + will-change 的 fixed 伪元素，
  // 各成一个独立合成层，光栅化尺寸约 2700×2700 物理像素、三块合计接近 87MB 纹理，
  // 每帧都要重新合成一遍 —— 套壳内核（Via / 系统 WebView）下顿挫的根源就在这里
  // （真机实测：只关掉这三团光就恢复顺滑；而帧率读数一直 100+，说明卡在合成器而非主线程，
  //  「掉帧才降级」那类兜底根本看不见它）。
  // 现在三团光并成一层、内部按半分辨率绘制，纹理降到几百 KB，外观与原来一致。
  // 每项 = [滚动进度, translateX(vw), translateY(vh), scale, opacity]
  var ZG_KEYS = {
    A: [[0, -40, 70, 7, 0], [.38, -40, 70, 7, 0], [.52, -28, 10, 7.5, .5], [.64, -20, -30, 7, .35], [.76, -30, -90, 6, 0], [1, -30, -90, 6, 0]],
    B: [[0, 40, 80, 7, 0], [.56, 40, 80, 7, 0], [.70, 30, 5, 7.5, .45], [.84, 22, -35, 7, .3], [.96, 30, -90, 6, 0], [1, 30, -90, 6, 0]],
    C: [[0, 35, 70, 7, 0], [.10, 35, 70, 7, 0], [.24, 28, 0, 8, .42], [.38, -25, -20, 8, .36], [.48, -30, -90, 6, 0], [1, -30, -90, 6, 0]]
  };
  var ZG_SCALE = .5;                       // 画布内部像素 = CSS 像素 × 0.5（模糊光晕，放大后看不出）
  var zgCanvas = $('dsZoneGlow');
  var zgCtx = (zgCanvas && zgCanvas.getContext) ? zgCanvas.getContext('2d') : null;
  var zgQueued = false, zgRT = 0;

  function zgAt(keys, p) {                 // 按滚动进度做线性插值
    var i = 0;
    while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
    var a = keys[i], b = keys[i + 1], span = b[0] - a[0];
    var t = span > 0 ? (p - a[0]) / span : 0;
    if (t < 0) t = 0; else if (t > 1) t = 1;
    return { tx: a[1] + (b[1] - a[1]) * t, ty: a[2] + (b[2] - a[2]) * t,
             s: a[3] + (b[3] - a[3]) * t, o: a[4] + (b[4] - a[4]) * t };
  }
  function zgRgba(c, a) {                  // --acc 可能是 #hex，也可能是 rgb()/rgba()，两种都接住
    c = String(c || '').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
    m = /^rgba?\(([^)]+)\)/i.exec(c);
    if (m) { var q = m[1].split(','); return 'rgba(' + parseFloat(q[0]) + ',' + parseFloat(q[1]) + ',' + parseFloat(q[2]) + ',' + a + ')'; }
    return 'rgba(255,191,46,' + a + ')';
  }
  var zgAccCache = '', zgAccThemeKey = '', zgLastDrawKey = '', zgMaxScroll = 0;
  function zgSyncMaxScroll() {
    var doc = document.documentElement;
    zgMaxScroll = Math.max(0, (doc ? doc.scrollHeight : 0) - window.innerHeight);
  }
  function zgColors() {                    // 深色模式下循环光用中性白光，其余跟随品质色（与原样式一致）
    var light = document.body.classList.contains('light-mode');
    var tk = (document.body.dataset.quality || '') + '|' + (light ? 1 : 0);
    if (tk !== zgAccThemeKey || !zgAccCache) {
      zgAccThemeKey = tk;
      zgAccCache = getComputedStyle(document.body).getPropertyValue('--acc');
    }
    var acc = zgAccCache;
    return { A: { c: acc, a: .70 },
             B: light ? { c: acc, a: .70 } : { c: '#ffffff', a: .20 },
             C: { c: acc, a: .75 },
             tk: tk };
  }
  function zgDraw(force) {
    if (!zgCtx || !zgCanvas.width) return;
    if (document.body.classList.contains('performance-mode')) return;
    var W = zgCanvas.width, H = zgCanvas.height;
    var doc = document.documentElement;
    if (!zgMaxScroll) zgSyncMaxScroll();
    var max = zgMaxScroll;
    var raw = window.pageYOffset || doc.scrollTop || 0;
    var p = max > 40 ? Math.min(1, Math.max(0, raw / max)) : 0;
    var cols = zgColors();
    var drawKey = W + 'x' + H + '|' + Math.round(p * 500) + '|' + cols.tk;
    if (!force && drawKey === zgLastDrawKey) return;
    zgLastDrawKey = drawKey;
    zgCtx.clearRect(0, 0, W, H);
    var vw = window.innerWidth || 1, vh = window.innerHeight || 1, k = W / vw;
    var list = [['A', cols.A], ['B', cols.B], ['C', cols.C]];
    for (var i = 0; i < list.length; i++) {
      var z = zgAt(ZG_KEYS[list[i][0]], p), col = list[i][1];
      if (z.o <= .004) continue;
      var cx = (vw / 2 + z.tx / 100 * vw) * k;
      var cy = (vh / 2 + z.ty / 100 * vh) * k;
      var r = 60 * z.s * k;                // 原元素 120px 宽的一半 × 缩放
      if (r <= .5) continue;
      var g = zgCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, zgRgba(col.c, col.a * z.o));
      g.addColorStop(1, zgRgba(col.c, 0));
      zgCtx.fillStyle = g;
      zgCtx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
  }
  function zgSchedule() {
    if (zgQueued) return;
    if (document.body.classList.contains('performance-mode')) return;
    zgQueued = true;
    requestAnimationFrame(function () { zgQueued = false; zgDraw(); });
  }
  function zgResize() {
    if (!zgCanvas) return;
    var w = Math.max(1, Math.round((window.innerWidth || 1) * ZG_SCALE));
    var h = Math.max(1, Math.round((window.innerHeight || 1) * ZG_SCALE));
    if (zgCanvas.width !== w) zgCanvas.width = w;
    if (zgCanvas.height !== h) zgCanvas.height = h;
    zgSyncMaxScroll();
    zgDraw(true);
  }
  if (zgCtx) {
    zgResize();
    if (typeof ResizeObserver === 'function' && document.body) {
      new ResizeObserver(zgSyncMaxScroll).observe(document.body);
    }
    zgCanvas.classList.add('is-on');
    window.addEventListener('resize', function () { clearTimeout(zgRT); zgRT = setTimeout(zgResize, 180); }, { passive: true });
    zgSchedule();
  }

  // ---------- 液态玻璃折射（仅 Chromium：只有它支持 backdrop-filter: url(#svg)） ----------
  // 按胶囊实际尺寸生成位移贴图：边缘一圈（bezel）按「凸透镜」把采样点往外推，中心不动 → 边缘处背景被弯折。
  var isChromium = (function () {
    var d = navigator.userAgentData;
    if (d && d.brands) return d.brands.some(function (b) { return /Chromium|Google Chrome|Microsoft Edge/.test(b.brand); });
    return /Chrome\/\d/.test(navigator.userAgent) && !/Edg?iOS|CriOS|FxiOS|Firefox/.test(navigator.userAgent);
  })();
  // 胶囊位移贴图：边缘一圈（bezel）按「凸透镜」把采样点往外推，中心不动 → 边缘处背景被弯折。
  function capsuleMap(w, h) {
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
    return c;
  }
  // 贴图拆成两块：「左端帽 + 很长的中段」一张、「右端帽」一张。中段每一列都一样，
  // 所以胶囊变宽 / 变窄时只要把第一张裁短一点、右端帽挪个位置 —— 改几个属性，不用重画贴图。
  // （以前宽度一变就整张重画、换上一张新的 data: 图；新图解码出来之前那一两帧位移贴图是空的，
  //   整块背景会被推开十来个像素 —— dock 换格子、数值位数变化时看着就是闪一下）
  var glassH = 0, glassRc = 0, glassW = 0, glassFx = null, glassGen = 0, GLASS_LONG = 2048;
  function sizeGlass(w) {
    if (!glassFx || w === glassW) return;
    glassW = w;
    var x = Math.max(glassRc, w - glassRc);
    glassFx.f.setAttribute('width', w);
    glassFx.a.setAttribute('width', x);
    glassFx.b.setAttribute('x', x);
  }
  function makeGlass(h) {
    var rc = Math.floor(h / 2), w0 = 2 * rc + 1, full = capsuleMap(w0, h), gen = ++glassGen;
    var part = function (sx, sw, dw) {
      var c = document.createElement('canvas'), x = c.getContext('2d');
      c.width = sw + dw; c.height = h;
      x.imageSmoothingEnabled = false;
      x.drawImage(full, sx, 0, sw, h, 0, 0, sw, h);
      if (dw) x.drawImage(full, rc, 0, 1, h, sw, 0, dw, h);   // 中段：把正中那一列铺开
      return c.toDataURL();
    };
    var urls = [part(0, rc, GLASS_LONG), part(w0 - rc, rc, 0)];
    // 两张图先解码好再挂上滤镜：挂上去的那一帧就有图
    Promise.all(urls.map(function (u) {
      var im = new Image(); im.src = u;
      return im.decode ? im.decode().catch(function () {}) : Promise.resolve();
    })).then(function () {
      if (gen !== glassGen) return;
      var svg = $('dsLgSvg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.id = 'dsLgSvg'; svg.setAttribute('aria-hidden', 'true');
        svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
        document.body.appendChild(svg);
      }
      svg.innerHTML = '<filter id="ds-lg-filter" x="0" y="0" width="' + w0 + '" height="' + h + '" filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">' +
        '<feImage href="' + urls[0] + '" x="0" y="0" width="' + (w0 - rc) + '" height="' + h + '" preserveAspectRatio="xMinYMin slice" result="a"/>' +
        '<feImage href="' + urls[1] + '" x="' + (w0 - rc) + '" y="0" width="' + rc + '" height="' + h + '" preserveAspectRatio="none" result="b"/>' +
        '<feMerge result="map"><feMergeNode in="a"/><feMergeNode in="b"/></feMerge>' +
        '<feDisplacementMap in="SourceGraphic" in2="map" scale="-22" xChannelSelector="R" yChannelSelector="G"/></filter>';
      var f = svg.querySelector('filter'), im = f.querySelectorAll('feImage');
      glassFx = { f: f, a: im[0], b: im[1] }; glassRc = rc; glassW = 0;
      buildGlass();
    });
  }
  function buildGlass() {
    var dock = document.querySelector('.ds-c .ds-dock');
    if (!dock || !isChromium) return;
    var w = Math.round(dock.offsetWidth), h = Math.round(dock.offsetHeight);
    if (!w || !h) return;
    if (h !== glassH) { glassH = h; makeGlass(h); }      // 高度变了（几乎不会）才重画贴图
    if (!glassFx) return;
    sizeGlass(Math.min(w, GLASS_LONG));
    if (!refractPaused) document.body.classList.add('ds-lg-refract');
  }
  if (window.ResizeObserver && document.querySelector('.ds-c .ds-dock')) {
    // 同一帧里就把滤镜尺寸跟上（只改属性，很便宜）；胶囊宽度过渡时每一帧都对得上
    new ResizeObserver(function () { buildGlass(); }).observe(document.querySelector('.ds-c .ds-dock'));
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
      glassW = 0;                          // 尺寸没变也要把折射层贴回去
      requestAnimationFrame(buildGlass);
    }, 220);
  }, { passive: true });

  // ---------- 菜单里的「动画效果」开关 ----------
  // 完全由用户手动控制，不再做任何自动判断（原来那套按帧率自动降级的逻辑已删，
  // 它在真机上读数不可靠，老误报「检测到卡顿」）。关掉 = 给 body 加 performance-mode。
  // 状态写进 localStorage，下次打开保持。
  function paintAnimFx() {
    var el = $('animFxState');
    if (!el) return;
    var off = document.body.classList.contains('performance-mode');
    el.classList.toggle('on', !off);
    var opt = $('animFxOption');
    if (opt) opt.setAttribute('aria-checked', off ? 'false' : 'true');
  }
  window.paintAnimFx = paintAnimFx;
  window.toggleAnimFx = function () {
    var off = document.body.classList.toggle('performance-mode');
    try { localStorage.setItem('animFx', off ? 'off' : 'on'); } catch (e) {}
    paintAnimFx();
    // 先让开关滑过去（看得见切换结果），再收起菜单，好看清页面上的变化
    var m = $('authorMenu');
    clearTimeout(window.__pvFxClose);
    window.__pvFxClose = setTimeout(function () { if (m) m.classList.remove('show'); }, off ? 0 : 260);
    if (typeof showToast === 'function') {
      showToast(off ? L('已关闭动画效果', 'Animations off') : L('已开启动画效果', 'Animations on'));
    }
  };

  // 滚动时重画分区光（画布只有半分辨率，一次不到 1ms）。
  // 这里不再做任何「按帧率自动降级」的判断 —— 那类读数在真机上不可靠；
  // dock 的液态玻璃折射改为任何时候都完整保留，不再滚动期摘位移。
  // 用捕获阶段监听：选车面板里的列表是独立滚动容器，scroll 事件不冒泡，只有捕获才收得到。
  document.addEventListener('scroll', zgSchedule, { passive: true, capture: true });

  // ---------- 汇总刷新 ----------
  var queued = false;
  function sync() {
    queued = false;
    // 团魂获能 / 辅助供能那两张蓝卡的 270° 仪表，是业务脚本里 renderTeamPanels() → _tmGauge() 建出来的，
    // 而它挂在 calculate() 的后半段 —— 没选车又没动过任何数值时 calculate() 会提前 return（「保持等待测算」），
    // 于是空态下这两张卡只剩一个空的 .tm-ring-slot 占位，仪表盘整个不见。首发 / 循环那两张卡有 renderGauge
    // 的兜底（gaugeSkeleton），所以不受影响 —— 这里给蓝卡补一次同一层级的兜底：只管把骨架建出来，
    // 数值仍旧交给 _tmGauge() 后续更新。
    [].forEach.call(document.querySelectorAll('.tm-gauge'), function (g) {
      var slot = g.querySelector('.tm-ring-slot');
      if (!slot || !window.__pvRingSvg || !window.__pvRing) return;   // 骨架已建过 → 别插手，免得把算好的状态又按回空态
      slot.outerHTML = window.__pvRingSvg();
      window.__pvRing(g, NaN, NaN);
      var card = g.closest('.tm-result');
      if (card) card.classList.add('is-idle');   // 空态：状态胶囊跟着变灰，别留一个空的蓝色胶囊
    });
    var res = { first: renderGauge('first'), loop: renderGauge('loop') };
    stripLeadEmoji($('resultDetailFirst')); stripLeadEmoji($('resultDetailLoop'));
    renderDock(res); syncSliders(); syncTheme(); syncQuality(); syncAmbient(); zgSchedule();
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

  window.__pvSyncThemeNow = function () {
    syncTheme();
    var car = $('carImage');
    var has = !!(typeof _selectedCar !== 'undefined' && _selectedCar && car && car.src && car.style.display !== 'none');
    if (has && ambLayers && ambLayers.length && ambImg && ambImg.naturalWidth && ambImg.src === car.src) {
      var cur = ambLayers[ambOn];
      if (paintAmb(cur, ambImg, ambKey(car.src))) {
        cur.classList.add('is-on');
      } else {
        syncAmbient();
      }
    } else {
      syncAmbient();
    }
    zgDraw(true);
  };

  sync();
})();
