/* desk.js：桌面端（≥850px）选车卡里的「出厂数据」六格（手机端由 CSS 隐藏），以及计算说明脚注的位置。
   只读原站写出的数据，不改任何计算逻辑。 */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var L = function (zh, en) { return (typeof currentLang !== 'undefined' && currentLang === 'en') ? en : zh; };
  var info = $('carSelectInfo');
  if (!info || typeof CAR_DATABASE === 'undefined') return;

  var box = document.createElement('div');
  box.className = 'pv-specs'; box.hidden = true;
  info.parentNode.insertBefore(box, info.nextSibling);

  function fmt(v) { return String(Math.round(v * 10) / 10); }
  function tile(k, v, unit) {
    return '<div class="pv-spec' + (v == null ? ' is-none' : '') + '"><div class="pv-spec-k">' + k + '</div>'
      + '<div class="pv-spec-v">' + (v == null ? '—' : v + (unit ? '<small>' + unit + '</small>' : '')) + '</div></div>';
  }
  function render() {
    var car = null;
    if (info.style.display !== 'none' && typeof _selectedCarId === 'number' && _selectedCarId > 0) {
      for (var i = 0; i < CAR_DATABASE.length; i++) if (CAR_DATABASE[i].id === _selectedCarId) { car = CAR_DATABASE[i]; break; }
    }
    if (!car) {
      box.hidden = true; box.innerHTML = '';
      return;
    }
    var ace = car.ace_charge;
    // 与选车时的自动填充同一套换算（见 pickCar）：单次氮气 = ace_charge / 100，起步 = (ace_charge + init_ratio) / 100，封顶 100
    var html = '<div class="pv-specs-head">' + L('出厂数据', 'Stock stats') + '<span>' + L('选车时已自动填入下方参数', 'Auto-filled into the inputs below') + '</span></div>'
      + '<div class="pv-spec-grid">'
      + tile(L('大招阈值', 'Ult threshold'), car.ult_threshold ? fmt(car.ult_threshold) : null, '%')
      + tile(L('起步充能', 'Start charge'), ace ? fmt(Math.min(100, (ace + (car.init_ratio || 0)) / 100)) : null, '%')
      + tile(L('单次氮气充能', 'Nitro charge'), ace ? fmt(ace / 100) : null, '%')
      + tile(L('氮气时长 1×6', 'Nitro 1×6'), car.nitro_duration ? fmt(car.nitro_duration) : null, 's')
      + tile(L('大招时长', 'Ult duration'), car.ult_duration ? fmt(car.ult_duration) : null, 's')
      + tile(L('SP 自充能', 'SP charge'), car.sp_charge ? '+' + fmt(car.sp_charge) : (car.has_sp ? 'SP' : null), car.sp_charge ? '%' : '')
      + '</div>';
    box.innerHTML = html;
    box.hidden = false;
    if (typeof _motionOK === 'function' && _motionOK() && !(typeof isRestoringConfig !== 'undefined' && isRestoringConfig)) {
      var vals = box.querySelectorAll('.pv-spec-v');
      for (var vi = 0; vi < vals.length; vi++) vals[vi].classList.add('tm-tick');
    }
  }
  // 计算说明的小字：桌面放进选车卡底部当脚注，两张卡的下沿才能对齐；手机放回原位
  var MQ = window.matchMedia('(min-width: 850px)');
  var card = document.querySelector('.ds-c .car-select'), note = document.querySelector('.ds-c .calc-note');
  var home = note && note.parentNode, homeNext = note && note.nextSibling;
  function placeNote() {
    if (!card || !note || !home) return;
    if (MQ.matches) { if (note.parentNode !== card) card.appendChild(note); }
    else if (note.parentNode !== home) home.insertBefore(note, homeNext);
  }
  new MutationObserver(render).observe(info, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
  document.addEventListener('pv-lang', render);
  if (MQ.addEventListener) MQ.addEventListener('change', placeNote); else if (MQ.addListener) MQ.addListener(placeNote);
  placeNote(); render();
})();
