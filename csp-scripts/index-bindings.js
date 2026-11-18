// 首页静态可信节点的显式事件绑定；不扫描 DOM 动作属性，不使用 MutationObserver 授权。
(function () {
  'use strict';

  var DEV_IMG_FALLBACKS = [
    { sel: '#dev_item_loop .dev-ico', fallback: 'data/icon/racer_icon_buff_9.png' },
    { sel: '#dev_item_chg .dev-ico', fallback: 'data/icon/racer_icon_buff_4.png' },
    { sel: '#dev_item_schg .dev-ico', fallback: 'data/icon/racer_icon_buff_7.png' },
    { sel: '#dev_item_acc .dev-ico', fallback: 'data/icon/racer_icon_buff_2.png' }
  ];

  function applyDevImgFallback(img) {
    if (!img || img.tagName !== 'IMG' || img.dataset.cspFallbackApplied === '1') return;
    for (var i = 0; i < DEV_IMG_FALLBACKS.length; i++) {
      var item = DEV_IMG_FALLBACKS[i];
      if (typeof img.matches === 'function' && img.matches(item.sel)) {
        img.dataset.cspFallbackApplied = '1';
        img.src = item.fallback;
        return;
      }
    }
  }

  // 在 <head> 阶段即挂载捕获监听器，避免首屏图片在 DOMContentLoaded 前加载失败而漏掉 error 事件
  document.addEventListener('error', function (event) {
    applyDevImgFallback(event && event.target);
  }, true);

  function on(selector, type, handler, root) {
    var el = (root || document).querySelector(selector);
    if (el) el.addEventListener(type, handler);
  }

  function onAll(selector, type, handler, root) {
    var list = (root || document).querySelectorAll(selector);
    for (var i = 0; i < list.length; i++) {
      list[i].addEventListener(type, handler);
    }
  }

  function bindStaticControls() {
    // 兜底检查已在 DOMContentLoaded 前加载失败的增益装置图标
    for (var i = 0; i < DEV_IMG_FALLBACKS.length; i++) {
      var img = document.querySelector(DEV_IMG_FALLBACKS[i].sel);
      if (img && img.complete && img.naturalWidth === 0) {
        applyDevImgFallback(img);
      }
    }

    // 顶部栏与菜单
    on('#authorBtn', 'click', function () { toggleAuthorMenu(); });
    on('#authorMenu > div.dropdown-option:not(.pv-fx-opt)', 'click', function () { resetTutorial(); });
    on('#animFxOption', 'click', function () { toggleAnimFx(); });
    on('#autoDraftOption', 'click', function () { toggleAutoDraft(); });
    on('#langToggleBtn', 'click', function () { toggleLanguage(); });
    on('#themeBtn', 'click', function () { toggleTheme(); });
    on('#closeTutorialBtn', 'click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeTutorial();
    });

    // 计算模式切换
    on('#modeSwitch .mode-opt[data-mode="solo"]', 'click', function () { setCalcMode('solo'); });
    on('#modeSwitch .mode-opt[data-mode="team"]', 'click', function () { setCalcMode('team'); });
    on('#modeSwitch .mode-opt[data-mode="support"]', 'click', function () { setCalcMode('support'); });

    // 选车与筛选
    on('#carSearch', 'input', function () { filterCarList(); });
    on('#filterPosBtn', 'click', function () { toggleFilterMenu('pos'); });
    on('#filterSpecBtn', 'click', function () { toggleFilterMenu('spec'); });
    on('#carListBtn', 'click', function () { toggleCarDropdown(); });

    // 团魂与增益装置
    on('#inputTuanhun', 'input', function () { onSoulInput(); });
    onAll('#dev_chk_loop, #dev_chk_chg, #dev_chk_schg, #dev_chk_acc', 'change', function () {
      onDeviceToggle(this);
    });
    on('#mateListBtn', 'click', function () { toggleMateDropdown(); });
    on('#teamInBase', 'input', function () { onMateBaseInput(); });
    on('#supBase', 'input', function () { onSupBaseInput(); });
    on('#supCore', 'change', function () { calculate(); });
    on('#supMateSoul', 'input', function () { clampInput('supMateSoul'); calculate(); });

    // 触发重算 + 自动联动
    onAll(
      '#dev_sub_first, #teamInFirst, #ultThreshold, #startCharge, #baseNitro, #baseUltDuration, #extraEfficiency, #valExtraNitro, #valExtraUltFirst, #valExtraUltLoop, #valExtraPerSec, #valCustomTrig, #customTrigFirstCount, #jiezou_sub_first, #huaxin_sub_first',
      'input',
      function () {
        triggerAutoCalc(currentActiveField);
        calculate();
      }
    );
    onAll('#teamInCore, #isSpec, #chkExtraNitroFirst, #chkExtraNitroLoop, #chkExtraPerSecFirst, #chkExtraPerSecLoop', 'change', function () {
      triggerAutoCalc(currentActiveField);
      calculate();
    });

    // 仅触发重算
    onAll(
      '#dev_sub_loop, #teamInLoop, #supCount, #supMateEff, #jiezou_sub_loop, #huaxin_sub_loop, #customTrigLoopCount',
      'input',
      function () { calculate(); }
    );
    onAll('#queyi_sub_self, #queyi_sub_enemy', 'change', function () { calculate(); });

    // 氮气规格单选与时长同步
    onAll('input[name="nitroRadio"]', 'change', function () { handleNitroRadioChange(); });
    var nitroSpecs = ['1x5', '1x6', '2x2', '2x3', '2x25', '3x2'];
    nitroSpecs.forEach(function (spec) {
      on('#time_' + spec, 'input', function () { syncNitroTimes(spec); });
    });

    // 反制与干扰滑块
    on('#counterRange', 'input', function () { updateCounterSlider(); });
    on('#debuffRange', 'input', function () { updateDebuffSlider(); });

    // 赋能面板
    on('#empowerSeg .empower-seg-opt[data-tab="core"]', 'click', function () { switchEmpowerTab('core'); });
    on('#empowerSeg .empower-seg-opt[data-tab="sub"]', 'click', function () { switchEmpowerTab('sub'); });
    on('#empowerClearBtn', 'click', function () { clearAllEmpowers(); });
    onAll('.empower-checkbox', 'change', function () { handleEmpowerChange(this); });

    // 扩展自充能开关
    onAll('#hasExtraNitro, #hasExtraUlt, #hasExtraPerSec', 'change', function () {
      toggleExtraUI();
      triggerAutoCalc(currentActiveField);
      calculate();
    });

    // 智能芯片联动与氮气个数
    on('#inputFirstNitroCount', 'input', function () {
      clampInput('inputFirstNitroCount');
      triggerAutoCalc(currentActiveField);
      calculate();
    });
    on('.tm-chip-moved .tm-link', 'click', function () {
      var t = document.getElementById('cardTeamSrc');
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    on('#calcAreaFirst .mode-bar .mode-btn', 'click', function () { resetAutoCalc(); });
    on('#inputXianji', 'input', function () { onFieldInput('xianji'); });
    on('#inputHuineng', 'input', function () { onFieldInput('huineng'); });
    on('#calcAreaLoop .mode-bar .mode-btn.is-alt', 'click', function () { resetAutoNitroCount(); });
    on('#inputNitroCount', 'input', function () { onNitroCountInput(); });

    // 导出与分享
    on('.share-btn.btn-text', 'click', function () { exportConfigText(this); });
    on('.share-btn.btn-image', 'click', function () { exportConfigImage(); });
    on('.share-btn.btn-link', 'click', function () { exportConfigLink(this); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindStaticControls, { once: true });
  } else {
    bindStaticControls();
  }
})();
