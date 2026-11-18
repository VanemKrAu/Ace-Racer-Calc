'use strict';
(function(){
  var actions = Object.freeze({
  'a1': function(event) { toggleAuthorMenu(); },
  'a2': function(event) { resetTutorial(); },
  'a3': function(event) { toggleLanguage(); },
  'a4': function(event) { toggleThemeMenu(); },
  'a5': function(event) { selectTheme('light'); },
  'a6': function(event) { selectTheme('dark'); },
  'a7': function(event) { selectTheme('system'); },
  'a8': function(event) { event.preventDefault(); event.stopPropagation(); closeTutorial();; },
  'a9': function(event) { filterCarList(); },
  'a10': function(event) { toggleFilterMenu('pos'); },
  'a11': function(event) { toggleFilterMenu('spec'); },
  'a12': function(event) { toggleCarDropdown(); },
  'a13': function(event) { triggerAutoCalc(currentActiveField); calculate();; },
  'a14': function(event) { handleNitroRadioChange(); },
  'a15': function(event) { syncNitroTimes('1x5'); },
  'a16': function(event) { syncNitroTimes('1x6'); },
  'a17': function(event) { syncNitroTimes('2x2'); },
  'a18': function(event) { syncNitroTimes('2x3'); },
  'a19': function(event) { syncNitroTimes('2x25'); },
  'a20': function(event) { syncNitroTimes('3x2'); },
  'a21': function(event) { triggerAutoCalc(currentActiveField); calculate();; },
  'a22': function(event) { updateCounterSlider(); },
  'a23': function(event) { updateDebuffSlider(); },
  'a24': function(event) { handleEmpowerChange(this); },
  'a25': function(event) { calculate();; },
  'a26': function(event) { calculate(); },
  'a27': function(event) { toggleExtraUI(); triggerAutoCalc(currentActiveField); calculate();; },
  'a28': function(event) { resetAutoCalc(); },
  'a29': function(event) { onFieldInput('xianji'); },
  'a30': function(event) { onFieldInput('huineng'); },
  'a31': function(event) { resetAutoNitroCount(); },
  'a32': function(event) { onNitroCountInput(); },
  'a33': function(event) { exportConfigText(); },
  'a34': function(event) { exportConfigImage(); },
  'a35': function(event) { exportConfigLink(); },
  'a36': function(event) { pickCar(-1);document.getElementById('carDropdown').classList.remove('show');; },
  'a37': function(event) { selectFilter('pos',''); },
  'a38': function(event) { selectFilter('pos', this.getAttribute('data-value')); },
  'a39': function(event) { selectFilter('spec',''); },
  'a40': function(event) { selectFilter('spec', this.getAttribute('data-value')); },
  'a41': function(event) { this.style.display='none'; },
  'a42': function(event) { pickCar(Number(this.getAttribute('data-id')));document.getElementById('carDropdown').classList.remove('show');; }
  });
  var staticBindings = [["#authorBtn", ["click", "a1"]], ["#authorMenu > div:nth-of-type(1)", ["click", "a2"]], ["#langToggleBtn", ["click", "a3"]], ["#themeBtn", ["click", "a4"]], ["#themeMenu > div:nth-of-type(1)", ["click", "a5"]], ["#themeMenu > div:nth-of-type(2)", ["click", "a6"]], ["#themeMenu > div:nth-of-type(3)", ["click", "a7"]], ["#closeTutorialBtn", ["click", "a8"]], ["#carSearch", ["input", "a9"]], ["#filterPosBtn", ["click", "a10"]], ["#filterSpecBtn", ["click", "a11"]], ["#carListBtn", ["click", "a12"]], ["#ultThreshold", ["input", "a13"]], ["#startCharge", ["input", "a13"]], ["#baseNitro", ["input", "a13"]], ["#r_1x5", ["change", "a14"]], ["#time_1x5", ["input", "a15"]], ["#r_1x6", ["change", "a14"]], ["#time_1x6", ["input", "a16"]], ["#r_2x2", ["change", "a14"]], ["#time_2x2", ["input", "a17"]], ["#r_2x3", ["change", "a14"]], ["#time_2x3", ["input", "a18"]], ["#r_2x25", ["change", "a14"]], ["#time_2x25", ["input", "a19"]], ["#r_3x2", ["change", "a14"]], ["#time_3x2", ["input", "a20"]], ["#baseUltDuration", ["input", "a13"]], ["#isSpec", ["change", "a21"]], ["#counterRange", ["input", "a22"]], ["#debuffRange", ["input", "a23"]], ["#extraEfficiency", ["input", "a13"]], ["#chk_fusu", ["change", "a24"]], ["#chk_yichu", ["change", "a24"]], ["#chk_jiezou", ["change", "a24"]], ["#jiezou_sub_first", ["input", "a13"]], ["#jiezou_sub_loop", ["input", "a25"]], ["#chk_huishou", ["change", "a24"]], ["#chk_weilai", ["change", "a24"]], ["#chk_queyi", ["change", "a24"]], ["#queyi_sub_self", ["change", "a26"]], ["#queyi_sub_enemy", ["change", "a26"]], ["#chk_huaxin", ["change", "a24"]], ["#huaxin_sub_first", ["input", "a13"]], ["#huaxin_sub_loop", ["input", "a25"]], ["#hasExtraNitro", ["change", "a27"]], ["#valExtraNitro", ["input", "a13"]], ["#chkExtraNitroFirst", ["change", "a21"]], ["#chkExtraNitroLoop", ["change", "a21"]], ["#hasExtraUlt", ["change", "a27"]], ["#valExtraUltFirst", ["input", "a13"]], ["#valExtraUltLoop", ["input", "a13"]], ["#hasExtraPerSec", ["change", "a27"]], ["#valExtraPerSec", ["input", "a13"]], ["#chkExtraPerSecFirst", ["change", "a21"]], ["#chkExtraPerSecLoop", ["change", "a21"]], ["#valCustomTrig", ["input", "a13"]], ["#customTrigFirstCount", ["input", "a13"]], ["#customTrigLoopCount", ["input", "a25"]], ["#inputFirstNitroCount", ["input", "a13"]], ["#calcAreaFirst > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(3) > button:nth-of-type(1)", ["click", "a28"]], ["#inputXianji", ["input", "a29"]], ["#inputHuineng", ["input", "a30"]], ["#calcAreaLoop > div:nth-of-type(2) > div:nth-of-type(1) > div:nth-of-type(2) > button:nth-of-type(1)", ["click", "a31"]], ["#inputNitroCount", ["input", "a32"]], ["html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > button:nth-of-type(1)", ["click", "a33"]], ["html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > button:nth-of-type(2)", ["click", "a34"]], ["html:nth-of-type(1) > body:nth-of-type(1) > div:nth-of-type(4) > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(1) > button:nth-of-type(3)", ["click", "a35"]]];
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
    var pair = kind === 'car' ? ["a36", "a42"] : kind === 'pos' ? ["a37", "a38"] : ["a39", "a40"];
    Array.prototype.forEach.call(container.children, function(node, index) {
      if (node.tagName === 'DIV' && node.classList.contains('dropdown-option')) bind(node, 'click', pair[index === 0 ? 0 : 1]);
    });
  };
})();
