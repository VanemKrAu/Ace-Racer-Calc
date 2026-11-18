'use strict';
(function(){
  var actions = Object.freeze({
  'a1': function(event) { resetAutoCalc(); },
  'a2': function(event) { resetAutoNitroCount(); },
  'a3': function(event) { toggleAuthorMenu(); },
  'a4': function(event) { resetTutorial(); },
  'a5': function(event) { toggleThemeMenu(); },
  'a6': function(event) { selectTheme('light'); },
  'a7': function(event) { selectTheme('dark'); },
  'a8': function(event) { selectTheme('system'); },
  'a9': function(event) { event.preventDefault(); event.stopPropagation(); closeTutorial();; },
  'a10': function(event) { pickCar(-1);document.getElementById('carDropdown').classList.remove('show');; },
  'a11': function(event) { selectFilter('pos',''); },
  'a12': function(event) { selectFilter('pos', this.getAttribute('data-value')); },
  'a13': function(event) { selectFilter('spec',''); },
  'a14': function(event) { selectFilter('spec', this.getAttribute('data-value')); },
  'a15': function(event) { this.style.display='none'; },
  'a16': function(event) { filterCarList(); },
  'a17': function(event) { toggleFilterMenu('pos'); },
  'a18': function(event) { toggleFilterMenu('spec'); },
  'a19': function(event) { toggleCarDropdown(); },
  'a20': function(event) { triggerAutoCalc(currentActiveField); calculate();; },
  'a21': function(event) { handleNitroRadioChange(); },
  'a22': function(event) { syncNitroTimes('1x5'); },
  'a23': function(event) { syncNitroTimes('1x6'); },
  'a24': function(event) { syncNitroTimes('2x2'); },
  'a25': function(event) { syncNitroTimes('2x3'); },
  'a26': function(event) { syncNitroTimes('2x25'); },
  'a27': function(event) { syncNitroTimes('3x2'); },
  'a28': function(event) { triggerAutoCalc(currentActiveField); calculate();; },
  'a29': function(event) { updateCounterSlider(); },
  'a30': function(event) { updateDebuffSlider(); },
  'a31': function(event) { handleEmpowerChange(this); },
  'a32': function(event) { calculate();; },
  'a33': function(event) { calculate(); },
  'a34': function(event) { toggleExtraUI(); triggerAutoCalc(currentActiveField); calculate();; },
  'a35': function(event) { onFieldInput('xianji'); },
  'a36': function(event) { onFieldInput('huineng'); },
  'a37': function(event) { onNitroCountInput(); },
  'a38': function(event) { exportConfigText(); },
  'a39': function(event) { exportConfigImage(); },
  'a40': function(event) { exportConfigLink(); },
  'a41': function(event) { toggleLanguage(); },
  'a42': function(event) { pickCar(Number(this.getAttribute('data-id')));document.getElementById('carDropdown').classList.remove('show');; }
  });
  var staticBindings = [["#authorBtn", ["click", "a3"]], ["#authorMenu > div:nth-of-type(1)", ["click", "a4"]], ["#themeBtn", ["click", "a5"]], ["#themeMenu > div:nth-of-type(1)", ["click", "a6"]], ["#themeMenu > div:nth-of-type(2)", ["click", "a7"]], ["#themeMenu > div:nth-of-type(3)", ["click", "a8"]], ["#closeTutorialBtn", ["click", "a9"]], ["#carImage", ["error", "a15"]], ["#carSearch", ["input", "a16"]], ["#filterPosBtn", ["click", "a17"]], ["#filterSpecBtn", ["click", "a18"]], ["#carListBtn", ["click", "a19"]], ["#ultThreshold", ["input", "a20"]], ["#startCharge", ["input", "a20"]], ["#baseNitro", ["input", "a20"]], ["#r_1x5", ["change", "a21"]], ["#time_1x5", ["input", "a22"]], ["#r_1x6", ["change", "a21"]], ["#time_1x6", ["input", "a23"]], ["#r_2x2", ["change", "a21"]], ["#time_2x2", ["input", "a24"]], ["#r_2x3", ["change", "a21"]], ["#time_2x3", ["input", "a25"]], ["#r_2x25", ["change", "a21"]], ["#time_2x25", ["input", "a26"]], ["#r_3x2", ["change", "a21"]], ["#time_3x2", ["input", "a27"]], ["#baseUltDuration", ["input", "a20"]], ["#isSpec", ["change", "a28"]], ["#counterRange", ["input", "a29"]], ["#debuffRange", ["input", "a30"]], ["#extraEfficiency", ["input", "a20"]], ["#chk_fusu", ["change", "a31"]], ["#chk_yichu", ["change", "a31"]], ["#chk_jiezou", ["change", "a31"]], ["#jiezou_sub_first", ["input", "a20"]], ["#jiezou_sub_loop", ["input", "a32"]], ["#chk_huishou", ["change", "a31"]], ["#chk_weilai", ["change", "a31"]], ["#chk_queyi", ["change", "a31"]], ["#queyi_sub_self", ["change", "a33"]], ["#queyi_sub_enemy", ["change", "a33"]], ["#chk_huaxin", ["change", "a31"]], ["#huaxin_sub_first", ["input", "a20"]], ["#huaxin_sub_loop", ["input", "a32"]], ["#hasExtraNitro", ["change", "a34"]], ["#valExtraNitro", ["input", "a20"]], ["#chkExtraNitroFirst", ["change", "a28"]], ["#chkExtraNitroLoop", ["change", "a28"]], ["#hasExtraUlt", ["change", "a34"]], ["#valExtraUltFirst", ["input", "a20"]], ["#valExtraUltLoop", ["input", "a20"]], ["#hasExtraPerSec", ["change", "a34"]], ["#valExtraPerSec", ["input", "a20"]], ["#chkExtraPerSecFirst", ["change", "a28"]], ["#chkExtraPerSecLoop", ["change", "a28"]], ["#valCustomTrig", ["input", "a20"]], ["#customTrigFirstCount", ["input", "a20"]], ["#customTrigLoopCount", ["input", "a32"]], ["#inputFirstNitroCount", ["input", "a20"]], ["#captureArea > div:nth-of-type(8) > div:nth-of-type(1) > div:nth-of-type(2) > div:nth-of-type(4) > button:nth-of-type(1)", ["click", "a1"]], ["#inputXianji", ["input", "a35"]], ["#inputHuineng", ["input", "a36"]], ["#captureArea > div:nth-of-type(8) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(2) > button:nth-of-type(1)", ["click", "a2"]], ["#inputNitroCount", ["input", "a37"]], ["html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(4) > div:nth-of-type(1) > button:nth-of-type(1)", ["click", "a38"]], ["html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(4) > div:nth-of-type(1) > button:nth-of-type(2)", ["click", "a39"]], ["html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(3) > div:nth-of-type(4) > div:nth-of-type(1) > button:nth-of-type(3)", ["click", "a40"]], ["#langToggleBtn", ["click", "a41"]]];
  function bind(node, type, action) {
    if (node && Object.prototype.hasOwnProperty.call(actions, action)) node.addEventListener(type, actions[action]);
  }
  document.addEventListener('DOMContentLoaded', function() {
    staticBindings.forEach(function(entry) {
      var node = document.querySelector(entry[0]);
      entry.slice(1).forEach(function(binding) { bind(node, binding[0], binding[1]); });
    });
    var close = document.getElementById('closeTutorialBtn');
    if (close) {
      close.addEventListener('mouseover', function() { this.style.opacity = '1'; });
      close.addEventListener('mouseout', function() { this.style.opacity = '0.7'; });
    }
  });
  window.__legacyBindGenerated = function(container, kind) {
    var car = document.getElementById('carDropdown');
    var pos = document.getElementById('filterPosMenu');
    var spec = document.getElementById('filterSpecMenu');
    if (!((kind === 'car' && container === car) || (kind === 'pos' && container === pos) || (kind === 'spec' && container === spec))) return;
    var pair = kind === 'car' ? ["a10", "a42"] : kind === 'pos' ? ["a11", "a12"] : ["a13", "a14"];
    Array.prototype.forEach.call(container.children, function(node, index) {
      if (node.tagName === 'DIV' && node.classList.contains('dropdown-option')) bind(node, 'click', pair[index === 0 ? 0 : 1]);
    });
  };
})();
