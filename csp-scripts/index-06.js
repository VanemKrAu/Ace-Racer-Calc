
/* 真机诊断开关：用 URL 参数给 <body> 挂上对应的 class（CSS 在 <head> 末尾消费它们）。
   目的只有一个 —— 在真实手机上逐个排除，定位到底是哪一层在拖慢套壳内核（Via / 夸克这类）。
   ?diag=1 会额外显示一个帧率浮层，方便直接读出数字。不带参数时这段代码不做任何事。 */
(function () {
  var q = '&' + String(location.search || '').replace(/^\?/, '');
  function on(n) { return q.indexOf('&' + n + '=1') >= 0; }
  var cls = [];
  if (on('noglow') || on('bare')) cls.push('diag-noglow');
  if (on('nodock') || on('bare')) cls.push('diag-nodock');
  if (on('noamb') || on('bare')) cls.push('diag-noamb');
  if (on('bare')) cls.push('diag-bare');
  if (on('perf') || on('bare')) cls.push('performance-mode');
  // 菜单里那个「动画效果」开关（localStorage 持久化）：默认开；关掉就等于无动画性能模式。
  // 之前那套「按帧率自动判断卡顿」的逻辑已经删掉了 —— 读数在真机上不可靠，老误报。
  try { if (localStorage.getItem('animFx') === 'off') cls.push('performance-mode'); } catch (e) {}
  if (cls.length && document.body) document.body.className += ' ' + cls.join(' ');

  if (!on('diag')) return;
  function boot() {
    var el = document.createElement('div');
    el.id = 'pvDiag';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;left:6px;top:6px;z-index:2147483647;background:rgba(0,0,0,.8);'
      + 'color:#5f5;font:700 12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;padding:6px 9px;'
      + 'border-radius:8px;pointer-events:none;white-space:pre;text-shadow:0 1px 2px #000';
    document.body.appendChild(el);
    var f = 0, t0 = performance.now(), cur = 0, lo = 0, touched = false;
    (function tick(now) {
      f++;
      if (now - t0 >= 500) {
        cur = Math.round(f * 1000 / (now - t0)); f = 0; t0 = now;
        if (touched && (lo === 0 || cur < lo)) lo = cur;   // 只记交互期间的谷值
      }
      var mods = document.body.className.split(' ').filter(function (c) { return /^(performance-mode|diag-)/.test(c); });
      el.textContent = 'FPS ' + cur + (lo ? '   最低 ' + lo : '')
        + '\n主题 ' + (document.body.classList.contains('light-mode') ? '浅色' : '深色')
        + '   动画 ' + (document.body.classList.contains('performance-mode') ? '关' : '开')
        + '\n模式 ' + (mods.join('+').replace(/diag-/g, '') || '正常');
      requestAnimationFrame(tick);
    })(performance.now());
    ['scroll', 'touchstart', 'touchmove', 'pointerdown'].forEach(function (ev) {
      document.addEventListener(ev, function () { touched = true; }, { passive: true, capture: true });
    });
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
