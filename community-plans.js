/**
 * 王牌竞速芯片计算器 · 社区与本地方案库系统
 * community-plans.js (v2.2 深度重构版)
 * 
 * 核心架构与设计规范：
 * 1. 【第 0 号最高复用准则】：能复用网站已有组件的一律 100% 直接复用，严禁自创莫名其妙的 UI
 *    - 主卡片直接使用宿主原生 `.card`，继承半透明玻璃底色、180°渐变与 `--surface-rim` 高光
 *    - 排序下拉彻底废弃原生 `<select>`，100% 采用全站 `.dropdown-container` / `.dropdown-menu`
 *    - 分段切换 100% 采用全站 `.chip-seg`
 *    - 内部方案卡片 100% 对齐全站 `.chip-tile` 毛玻璃悬浮微浮动体系
 * 2. 挂载位置：严格挂载于「选择赛车」卡片 (.desktop-layout.cp-hero) 正下方
 * 3. 国服最强标志：采用游戏内官方提取的高清黑面罩冰晶头盔 (data/icon/pro_helmet_m.png)
 * 4. 健壮性与物理阻断：PlanValidator 代码层零成本阻断垃圾信息；团魂不拦截且提示精准具体
 * 5. 零 emoji，全量规范线性 SVG (stroke="currentColor", class="ico")
 * 6. UI 多端适配：手机端 (≤640px)、平板端 (641px~1024px)、PC 端 (≥1025px) 自适应响应式
 */

(function (window, document) {
  'use strict';

  // 存储键名常量
  var STORAGE_KEYS = {
    PLANS: 'arc_saved_plans_v1',
    DRAFT: 'arc_draft_v1',
    VOTES: 'arc_voted_plans_v1',
    CLIENT_ID: 'arc_client_id_v1',
    SETTINGS: 'arc_user_settings_v1',
    AUTO_DRAFT: 'arc_auto_draft_enabled'
  };

  // Cloudflare Turnstile 公开 Site Key（仅用于前端渲染托管人机校验框，非密钥）
  var TURNSTILE_SITE_KEY = '0x4AAAAAAF_MFEXcXJElnxKc';
  var TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

  // 统一规范 SVG 线性图标集 (与全站 stroke="currentColor" stroke-width="1.8" 100% 对齐)
  var Icons = {
    chip: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
    save: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    undo: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    download: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    upload: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    hot: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    clock: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    grid: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>',
    user: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    crown: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    thumb: function (isFilled) {
      return '<svg class="ico" viewBox="0 0 24 24" fill="' + (isFilled ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>';
    },
    trash: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    apply: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    close: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    link: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
    emptyBox: '<svg class="ico cp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    emptyCar: '<svg class="ico cp-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C2.1 10.7 2 10.9 2 11v5c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>',
    chevron: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    copy: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    check: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>'
  };

  // 内存状态
  var state = {
    currentCarId: null,
    currentCar: null,
    activeTab: 'all',       // 'all' | 'mine' | 'pro'
    sortMode: 'hot',        // 'hot' | 'latest'
    savedPlans: [],         // 本地存储的方案列表
    proPlans: [],           // 预置/拉取的国服顶尖方案列表
    remotePlans: [],        // 远程从私有后端 API 拉取的社区方案列表
    votedMap: {},           // 已点赞方案 ID 持久化映射
    lastSnapshot: null,     // 用于一键撤销还原的表单快照
    activeAppliedPlanId: null, // 当前已套用的方案 ID (用于高亮正在生效)
    hasUndoAvailable: false,
    draftTimer: null,
    isFetchingRemote: false
  };

  // 工具函数
  var Utils = {
    now: function () {
      return Date.now();
    },
    uuid: function () {
      return 'loc_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    },
    getStorage: function (key, defVal) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : defVal;
      } catch (e) {
        console.warn('[CommunityPlans] 读取 localStorage 失败:', e);
        return defVal;
      }
    },
    setStorage: function (key, val) {
      try {
        localStorage.setItem(key, JSON.stringify(val));
        return true;
      } catch (e) {
        console.error('[CommunityPlans] 写入 localStorage 失败:', e);
        return false;
      }
    },
    charCount: function (str) {
      if (!str) return 0;
      return Array.from(str).length;
    },
    truncateChars: function (str, maxLen) {
      if (!str) return '';
      var arr = Array.from(str);
      if (arr.length <= maxLen) return str;
      return arr.slice(0, maxLen).join('');
    },
    formatTime: function (ts) {
      if (!ts) return '刚刚';
      var diff = Math.floor((Date.now() - ts) / 1000);
      if (diff < 60) return '刚刚';
      if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
      if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
      if (diff < 2592000) return Math.floor(diff / 86400) + ' 天前';
      return new Date(ts).toLocaleDateString();
    },
    escapeHtml: function (str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },
    sanitizeUrl: function (url) {
      if (!url) return '';
      var clean = String(url).trim();
      if (/^https?:\/\//i.test(clean) && clean.length <= 300) return clean;
      return '';
    },
    safeId: function (id) {
      if (!id) return '';
      return String(id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
    },
    getClientId: function () {
      try {
        var cid = localStorage.getItem(STORAGE_KEYS.CLIENT_ID);
        if (cid && /^[a-zA-Z0-9_-]{8,64}$/.test(cid)) return cid;
        cid = 'cid_' + Math.random().toString(36).substr(2, 10) + '_' + Date.now().toString(36);
        localStorage.setItem(STORAGE_KEYS.CLIENT_ID, cid);
        return cid;
      } catch (e) {
        return 'cid_anon_fallback';
      }
    }
  };

  // 参数读写与镜像引擎 (ParamsIO - 带 DOM 空指针防御与前后端双套字段兼容)
  var ParamsIO = {
    getVal: function (id, defVal) {
      var el = document.getElementById(id);
      if (!el) return defVal;
      var num = parseFloat(el.value);
      return Number.isFinite(num) ? num : defVal;
    },
    getInt: function (id, defVal) {
      var el = document.getElementById(id);
      if (!el) return defVal;
      var num = parseInt(el.value, 10);
      return Number.isFinite(num) ? num : defVal;
    },
    getChk: function (id) {
      var el = document.getElementById(id);
      return (el && el.checked) ? 1 : 0;
    },
    setVal: function (id, val) {
      if (val === undefined || val === null) return;
      var el = document.getElementById(id);
      if (el) el.value = val;
    },
    setChk: function (id, val) {
      if (val === undefined || val === null) return;
      var el = document.getElementById(id);
      if (el) el.checked = !!val;
    },
    capture: function () {
      var checkedRadio = document.querySelector('input[name="nitro_radio"]:checked');
      var nr = checkedRadio ? checkedRadio.value : '1x5';
      var nd = ParamsIO.getVal('time_' + nr, 0);

      var emps = Array.from(document.querySelectorAll('.empower-checkbox:checked')).map(function (cb) {
        return cb.value;
      });

      var chipsOn = (window._chipsOn && Array.isArray(window._chipsOn)) ? window._chipsOn.slice() : [];

      return {
        schema_version: 1,
        ult_threshold: ParamsIO.getVal('ultThreshold', 100),
        start_charge: ParamsIO.getVal('startCharge', 0),
        base_nitro: ParamsIO.getVal('baseNitro', 0),
        nitro_rule: nr,
        nitro_dur: nd,
        base_ult_dur: ParamsIO.getVal('baseUltDuration', 0),
        is_spec: ParamsIO.getChk('isSpec'),
        counter_range: ParamsIO.getVal('counterRange', 0),
        debuff_range: ParamsIO.getVal('debuffRange', 0),
        emps: emps,
        jiezou_first: ParamsIO.getVal('jiezou_sub_first', 0),
        jiezou_loop: ParamsIO.getVal('jiezou_sub_loop', 0),
        queyi_self: ParamsIO.getChk('queyi_sub_self'),
        queyi_enemy: ParamsIO.getChk('queyi_sub_enemy'),
        huaxin_first: ParamsIO.getVal('huaxin_sub_first', 0),
        huaxin_loop: ParamsIO.getVal('huaxin_sub_loop', 0),
        has_extra_nitro: ParamsIO.getChk('hasExtraNitro'),
        val_extra_nitro: ParamsIO.getVal('valExtraNitro', 0),
        chk_extra_nitro_first: ParamsIO.getChk('chkExtraNitroFirst'),
        chk_extra_nitro_loop: ParamsIO.getChk('chkExtraNitroLoop'),
        has_extra_ult: ParamsIO.getChk('hasExtraUlt'),
        val_extra_ult_first: ParamsIO.getVal('valExtraUltFirst', 0),
        val_extra_ult_loop: ParamsIO.getVal('valExtraUltLoop', 0),
        has_extra_per_sec: ParamsIO.getChk('hasExtraPerSec'),
        val_extra_per_sec: ParamsIO.getVal('valExtraPerSec', 0),
        chk_extra_per_sec_first: ParamsIO.getChk('chkExtraPerSecFirst'),
        chk_extra_per_sec_loop: ParamsIO.getChk('chkExtraPerSecLoop'),
        val_custom_trig: ParamsIO.getVal('valCustomTrig', 0),
        custom_trig_first: ParamsIO.getInt('customTrigFirstCount', 0),
        custom_trig_loop: ParamsIO.getInt('customTrigLoopCount', 0),
        extra_eff: ParamsIO.getVal('extraEfficiency', 0),
        first_nitro_count: ParamsIO.getInt('inputFirstNitroCount', 1),
        xianji: ParamsIO.getVal('inputXianji', 0),
        huineng: ParamsIO.getVal('inputHuineng', 0),
        is_manual_nitro: window.isManualNitroCount ? 1 : 0,
        loop_nitro_count: ParamsIO.getInt('inputNitroCount', 0),
        device: typeof window.getDevice === 'function' ? window.getDevice() : '0',
        dev_sub_first: ParamsIO.getVal('dev_sub_first', 0),
        dev_sub_loop: ParamsIO.getVal('dev_sub_loop', 0),
        tuanhun: ParamsIO.getVal('inputTuanhun', 0),
        chips_on: chipsOn
      };
    },

    apply: function (p) {
      if (!p) return;

      ParamsIO.setVal('ultThreshold', p.ult_threshold);
      ParamsIO.setVal('startCharge', p.start_charge);
      ParamsIO.setVal('baseNitro', p.base_nitro);
      ParamsIO.setVal('baseUltDuration', p.base_ult_dur);
      ParamsIO.setChk('isSpec', p.is_spec);
      if (p.counter_range !== undefined) {
        ParamsIO.setVal('counterRange', p.counter_range);
        var cv = document.getElementById('counterValue');
        if (cv) cv.innerText = p.counter_range + '%';
      }
      if (p.debuff_range !== undefined) {
        ParamsIO.setVal('debuffRange', p.debuff_range);
        var dv = document.getElementById('debuffValue');
        if (dv) dv.innerText = p.debuff_range + '%';
      }

      if (p.nitro_rule) {
        var r = document.getElementById('r_' + p.nitro_rule);
        if (r) {
          r.checked = true;
          if (typeof window.handleNitroRadioChange === 'function') window.handleNitroRadioChange(true);
        }
        var tInput = document.getElementById('time_' + p.nitro_rule);
        if (tInput && p.nitro_dur !== undefined) {
          tInput.value = p.nitro_dur;
          if (typeof window.syncNitroTimes === 'function') window.syncNitroTimes(p.nitro_rule);
        }
      }

      var cbs = document.querySelectorAll('.empower-checkbox');
      cbs.forEach(function (cb) { cb.checked = false; });
      var empList = Array.isArray(p.emps) ? p.emps : (Array.isArray(p.empowers) ? p.empowers : null);
      if (empList) {
        empList.forEach(function (eid) {
          var cb = document.getElementById('chk_' + eid);
          if (cb) {
            cb.checked = true;
            if (typeof window.handleEmpowerChange === 'function') window.handleEmpowerChange(cb);
          }
        });
      }

      ParamsIO.setVal('jiezou_sub_first', p.jiezou_first);
      ParamsIO.setVal('jiezou_sub_loop', p.jiezou_loop);
      ParamsIO.setChk('queyi_sub_self', p.queyi_self);
      ParamsIO.setChk('queyi_sub_enemy', p.queyi_enemy);
      ParamsIO.setVal('huaxin_sub_first', p.huaxin_first);
      ParamsIO.setVal('huaxin_sub_loop', p.huaxin_loop);

      if (p.has_extra_nitro !== undefined) {
        ParamsIO.setChk('hasExtraNitro', p.has_extra_nitro);
        ParamsIO.setVal('valExtraNitro', p.val_extra_nitro);
        ParamsIO.setChk('chkExtraNitroFirst', p.chk_extra_nitro_first);
        ParamsIO.setChk('chkExtraNitroLoop', p.chk_extra_nitro_loop);
      }

      if (p.has_extra_ult !== undefined) {
        ParamsIO.setChk('hasExtraUlt', p.has_extra_ult);
        ParamsIO.setVal('valExtraUltFirst', p.val_extra_ult_first);
        ParamsIO.setVal('valExtraUltLoop', p.val_extra_ult_loop);
      }

      if (p.has_extra_per_sec !== undefined) {
        ParamsIO.setChk('hasExtraPerSec', p.has_extra_per_sec);
        ParamsIO.setVal('valExtraPerSec', p.val_extra_per_sec);
        ParamsIO.setChk('chkExtraPerSecFirst', p.chk_extra_per_sec_first);
        ParamsIO.setChk('chkExtraPerSecLoop', p.chk_extra_per_sec_loop);
      }

      ParamsIO.setVal('valCustomTrig', p.val_custom_trig);
      ParamsIO.setVal('customTrigFirstCount', p.custom_trig_first);
      ParamsIO.setVal('customTrigLoopCount', p.custom_trig_loop);

      if (typeof window.toggleExtraUI === 'function') window.toggleExtraUI();

      ParamsIO.setVal('extraEfficiency', p.extra_eff);
      var firstNitro = p.first_nitro_count !== undefined ? p.first_nitro_count : p.start_nitro_count;
      ParamsIO.setVal('inputFirstNitroCount', firstNitro);
      ParamsIO.setVal('inputXianji', p.xianji);
      ParamsIO.setVal('inputHuineng', p.huineng);
      var tuanhunVal = p.tuanhun !== undefined ? p.tuanhun : p.team_spirit;
      ParamsIO.setVal('inputTuanhun', tuanhunVal);

      var loopNitro = p.loop_nitro_count !== undefined ? p.loop_nitro_count : p.cycle_nitro_count;
      if (p.is_manual_nitro !== undefined || loopNitro !== undefined) {
        window.isManualNitroCount = p.is_manual_nitro !== undefined ? !!p.is_manual_nitro : true;
        ParamsIO.setVal('inputNitroCount', loopNitro);
        if (typeof window.updateNitroCountUI === 'function') window.updateNitroCountUI();
      }

      var chipsList = Array.isArray(p.chips_on) ? p.chips_on : (Array.isArray(p.chips) ? p.chips : null);
      if (chipsList && typeof window.renderChips === 'function') {
        window._chipsOn = chipsList.slice();
        window.renderChips(true);
      }

      if (typeof window.calculate === 'function') {
        window.calculate();
      }
    }
  };

  // 自动草稿模块 (Auto Draft)
  var Draft = {
    isEnabled: function () {
      try {
        return localStorage.getItem(STORAGE_KEYS.AUTO_DRAFT) !== 'off';
      } catch (e) {
        return true;
      }
    },
    paintSwitch: function () {
      var opt = document.getElementById('autoDraftOption');
      var sw = document.getElementById('autoDraftState');
      var on = Draft.isEnabled();
      if (opt) opt.setAttribute('aria-checked', on ? 'true' : 'false');
      if (sw) sw.classList.toggle('on', on);
    },
    toggle: function () {
      var cur = Draft.isEnabled();
      var next = !cur;
      try {
        localStorage.setItem(STORAGE_KEYS.AUTO_DRAFT, next ? 'on' : 'off');
        if (!next) {
          localStorage.removeItem(STORAGE_KEYS.DRAFT);
        } else {
          // 重新开启时：若当前已选赛车，立即自动将当前页面状态保存为最新草稿！
          Draft.save();
        }
      } catch (e) {}
      Draft.paintSwitch();
      var m = document.getElementById('authorMenu');
      if (m) setTimeout(function () { m.classList.remove('show'); }, 260);
      var tip = next ? '已开启：刷新后自动恢复草稿' : '已关闭：刷新后不恢复草稿';
      if (typeof window.showToast === 'function') {
        window.showToast(tip);
      } else if (typeof CommunityPlans.toast === 'function') {
        CommunityPlans.toast(tip);
      }
    },
    init: function () {
      Draft.paintSwitch();
      // 关键修复：无条件全局绑定 input 和 change 监听器！
      // 这样即使用户在关闭状态下刷新，后续再在菜单中开启时，监听器依然时刻就绪
      document.addEventListener('input', Draft.scheduleSave, { passive: true });
      document.addEventListener('change', Draft.scheduleSave, { passive: true });

      var params = new URLSearchParams(window.location.search);
      if (!params.has('s') && !params.has('cfg')) {
        Draft.restore();
      }
    },
    scheduleSave: function () {
      if (!Draft.isEnabled()) return;
      if (state.draftTimer) clearTimeout(state.draftTimer);
      state.draftTimer = setTimeout(function () {
        Draft.save();
      }, 500); // 防抖缩短至 500ms，保证手速快的用户刷新前迅速落盘
    },
    save: function () {
      if (!Draft.isEnabled()) return;
      var curCarId = state.currentCarId || (window._selectedCar ? window._selectedCar.id : null);
      if (!curCarId || curCarId === -1) return;
      var draftData = {
        car_id: curCarId,
        params: ParamsIO.capture(),
        saved_at: Utils.now()
      };
      Utils.setStorage(STORAGE_KEYS.DRAFT, draftData);
    },
    restore: function () {
      if (!Draft.isEnabled()) return;
      var draft = Utils.getStorage(STORAGE_KEYS.DRAFT, null);
      if (draft && draft.car_id && draft.car_id !== -1 && draft.params) {
        if (typeof window.pickCar === 'function') {
          window.pickCar(draft.car_id);
        }
        setTimeout(function () {
          ParamsIO.apply(draft.params);
          CommunityPlans.toast('已自动恢复上次未保存的草稿');
        }, 150);
      }
    }
  };

  // 代码层硬性规则过滤与校验器 (PlanValidator)
  var PlanValidator = {
    validate: function (params, title) {
      if (!title || !title.trim()) {
        return { valid: false, message: '请输入方案名称' };
      }
      var t = title.trim();
      if (Utils.charCount(t) > 15) {
        return { valid: false, message: '方案名称不能超过 15 个字' };
      }
      if (/^(.)\1{3,}$/.test(t)) {
        return { valid: false, message: '【方案名称不合规】方案名称不能为纯连续重复字符 (如 aaaaa)，请输入有意义的方案名' };
      }
      if (/代练|出号|收号|加v|微信|wx|扣扣|qq群/i.test(t)) {
        return { valid: false, message: '【方案名称违规】方案名称检测到含有代练、出号、引流等违规词，已被代码层安全拦截' };
      }

      var p = params || {};

      var firstNitro = parseInt(p.first_nitro_count, 10) || 0;
      var loopNitro = parseInt(p.loop_nitro_count, 10) || 0;
      if (firstNitro < 0 || firstNitro > 5) {
        return { valid: false, message: '【首发氮气数异常】当前设定为 ' + firstNitro + ' 个氮气，超出对局合理上限 (最多 5 个)，请修改后再试' };
      }
      if (loopNitro < 0 || loopNitro > 8) {
        return { valid: false, message: '【循环氮气数异常】当前设定为 ' + loopNitro + ' 个氮气，超出对局合理上限 (最多 8 个)，请修改后再试' };
      }

      var xianji = parseFloat(p.xianji) || 0;
      var huineng = parseFloat(p.huineng) || 0;
      if (xianji < 0 || xianji > 30) {
        return { valid: false, message: '【先机数值异常】当前输入为 ' + xianji + '%，超出比赛物理允许范围 (0% ~ 30%)，请核对后修改' };
      }
      if (huineng < 0 || huineng > 60) {
        return { valid: false, message: '【汇能数值异常】当前输入为 ' + huineng + '%，超出赛车芯片槽位最大物理上限 (0% ~ 60%)，请核对后修改' };
      }

      if (p.has_extra_ult) {
        var ultFirst = parseFloat(p.val_extra_ult_first) || 0;
        var ultLoop = parseFloat(p.val_extra_ult_loop) || 0;
        if (ultFirst > 50 || ultLoop > 50) {
          return { valid: false, message: '额外大招充能数值异常 (单次上限50%)' };
        }
      }
      if (p.has_extra_per_sec) {
        var perSec = parseFloat(p.val_extra_per_sec) || 0;
        if (perSec > 10) {
          return { valid: false, message: '每秒自充数值异常 (单秒上限10%/s)' };
        }
      }
      if (p.val_custom_trig) {
        var trigFirst = parseInt(p.custom_trig_first, 10) || 0;
        var trigLoop = parseInt(p.custom_trig_loop, 10) || 0;
        if (trigFirst > 10 || trigLoop > 10) {
          return { valid: false, message: '自定义触发次数超出比赛合理范围 (上限10次)' };
        }
      }

      return { valid: true };
    }
  };

  // 预置官方/国服顶尖方案库 (Pro Plans)
  var DefaultProPlans = [
    {
      id: 'pro_devil_ray_01',
      car_id: 10044, // 魔鬼鱼
      car_name: '魔鬼鱼',
      title: '国服榜首·首发爆发流',
      author: '国服巅峰组',
      player_id: '29875931',
      links: ['https://space.bilibili.com/43438481'],
      isPro: true,
      votes: 186,
      created_at: 1718000000000,
      params: {
        xianji: 28,
        huineng: 35,
        tuanhun: 0,
        first_nitro_count: 1,
        loop_nitro_count: 1,
        emps: ['duanwei', 'chaohe'],
        nitro_rule: '1x5'
      }
    },
    {
      id: 'pro_porsche_gt2_01',
      car_id: 10000, // 保时捷 911 GT2 RS
      car_name: '保时捷 911 GT2 RS',
      title: '极限循环·无限大招配装',
      author: '王牌竞速赛事组',
      player_id: '10982341',
      links: ['https://space.bilibili.com/43438481'],
      isPro: true,
      votes: 242,
      created_at: 1718500000000,
      params: {
        xianji: 24,
        huineng: 40,
        tuanhun: 0,
        first_nitro_count: 1,
        loop_nitro_count: 1,
        emps: ['chaohe'],
        nitro_rule: '1x5'
      }
    },
    {
      id: 'pro_zen_01',
      car_id: 10026, // 禅
      car_name: '禅',
      title: '天梯国一·极速充能套',
      author: '车队顶级车神',
      player_id: '800826',
      links: ['https://space.bilibili.com/43438481'],
      isPro: true,
      votes: 315,
      created_at: 1719000000000,
      params: {
        xianji: 30,
        huineng: 45,
        tuanhun: 0,
        first_nitro_count: 1,
        loop_nitro_count: 1,
        emps: ['duanwei'],
        nitro_rule: '1x5'
      }
    }
  ];

  // 核心对外模块
  var CommunityPlans = {
    init: function () {
      state.savedPlans = Utils.getStorage(STORAGE_KEYS.PLANS, []);
      state.votedMap = Utils.getStorage(STORAGE_KEYS.VOTES, {}) || {};
      state.proPlans = DefaultProPlans.map(function (p) {
        return Object.assign({}, p, { isVoted: Boolean(state.votedMap[p.id]) });
      });

      // 渲染挂载容器与面板骨架
      CommunityPlans.renderContainer();
      // 初始化自动草稿
      Draft.init();

      // 监听第三个模式 (support 辅助供能模式) - 发生变更时联动
      var getMode = function () {
        return (typeof window.getCalcMode === 'function')
          ? window.getCalcMode()
          : (document.body.getAttribute('data-calc-mode') || 'solo');
      };
      CommunityPlans.onModeChanged(getMode());

      try {
        var modeObserver = new MutationObserver(function (mutations) {
          mutations.forEach(function (m) {
            if (m.type === 'attributes' && m.attributeName === 'data-calc-mode') {
              CommunityPlans.onModeChanged(getMode());
            }
          });
        });
        modeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-calc-mode'] });
      } catch (e) {}

      // 监听赛车选择
      if (window._selectedCar) {
        CommunityPlans.onCarChanged(window._selectedCar);
      } else {
        CommunityPlans.renderPlans();
      }
    },

    // 模式变更联动 (第三个模式 support 辅助供能模式物理隐藏方案库)
    onModeChanged: function (mode) {
      var container = document.getElementById('communityPlansContainer');
      if (!container) return;
      if (mode === 'support') {
        container.style.display = 'none';
      } else {
        container.style.display = '';
        CommunityPlans.renderPlans();
      }
    },

    // 复制车手游戏 ID
    copyPlayerId: function (id, e) {
      if (e) e.stopPropagation();
      if (!id) return;
      var strId = String(id);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(strId).then(function () {
          CommunityPlans.toast('国服车手游戏ID 「' + strId + '」 已成功复制');
        }).catch(function () {
          CommunityPlans.toast('车手游戏ID: ' + strId);
        });
      } else {
        CommunityPlans.toast('车手游戏ID: ' + strId);
      }
    },

    // 卡片标题栏点击触发折叠/展开
    onTitleClick: function (e) {
      if (e && e.target && e.target.closest('button, input, a, .dropdown-menu')) {
        return;
      }
      CommunityPlans.toggleCollapse();
    },

    // 切换折叠状态
    toggleCollapse: function (forceState) {
      var container = document.getElementById('communityPlansContainer');
      if (!container) return;
      var card = container.querySelector('.cp-plans-card') || container;
      var isCollapsed = card.classList.contains('pv-collapsed') || card.classList.contains('pv-shut');
      var shouldShut = (typeof forceState === 'boolean') ? forceState : !isCollapsed;

      if (typeof window.__pvMorph === 'function') {
        var kids = [].filter.call(card.children, function (k) {
          return !k.classList.contains('cp-card-title');
        });
        card.classList.toggle('pv-shut', shouldShut);
        container.classList.toggle('pv-shut', shouldShut);

        if (shouldShut) {
          window.__pvMorph(card, false, ['height'], kids, function () {
            card.classList.add('pv-collapsed');
            var h = card.getBoundingClientRect().height;
            card.classList.remove('pv-collapsed');
            return { height: h };
          }, function () {
            card.classList.add('pv-collapsed');
            container.classList.add('pv-collapsed');
          });
        } else {
          window.__pvMorph(card, true, ['height'], kids, function () {
            card.classList.remove('pv-collapsed');
            container.classList.remove('pv-collapsed');
            return { height: card.getBoundingClientRect().height };
          }, function () {
            card.classList.remove('pv-collapsed');
            container.classList.remove('pv-collapsed');
          });
        }
      } else {
        container.classList.toggle('pv-collapsed', shouldShut);
        container.classList.toggle('pv-shut', shouldShut);
        card.classList.toggle('pv-collapsed', shouldShut);
        card.classList.toggle('pv-shut', shouldShut);
      }
    },

    // 赛车变更联动
    onCarChanged: function (carOrId) {
      if (!carOrId) {
        state.currentCarId = null;
        state.currentCar = null;
        state.remotePlans = [];
      } else if (typeof carOrId === 'object') {
        state.currentCarId = carOrId.id;
        state.currentCar = carOrId;
      } else {
        state.currentCarId = carOrId;
        var db = (typeof CAR_DATABASE !== 'undefined') ? CAR_DATABASE : (window.CAR_DATABASE || []);
        if (Array.isArray(db)) {
          state.currentCar = db.find(function (c) { return c.id === carOrId; }) || null;
        }
      }
      CommunityPlans.renderPlans();
      if (state.currentCarId) {
        CommunityPlans.fetchRemotePlans(state.currentCarId);
        // 选车联动调度草稿自动保存
        Draft.scheduleSave();
      }
    },

    // 异步从私有后端 Serverless 拉取社区已审核方案
    fetchRemotePlans: function (carId) {
      if (!carId || carId === -1) return;
      state.isFetchingRemote = true;
      var sortParam = state.sortMode || 'hot';
      var url = '/api/plans?car_id=' + encodeURIComponent(carId) + '&sort_by=' + encodeURIComponent(sortParam);
      fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (json) {
          if (json && json.success && json.data && Array.isArray(json.data.items)) {
            var localUpdated = false;
            state.remotePlans = json.data.items.map(function (rp) {
              // 若远程已过审方案命中本地方案的 remote_id，自动同步本地方案的审核通过状态与国服勋标
              var matchedLocal = state.savedPlans.find(function (lp) {
                return lp.remote_id && lp.remote_id === rp.id;
              });
              if (matchedLocal && matchedLocal.remote_status !== 'approved') {
                matchedLocal.remote_status = 'approved';
                if (rp.is_pro) matchedLocal.isPro = true;
                localUpdated = true;
              }
              rp.isVoted = Boolean(state.votedMap[rp.id]);
              return rp;
            });
            if (localUpdated) {
              Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
            }
            CommunityPlans.renderPlans();
          }
        })
        .catch(function (err) {
          // 离线或服务暂时未连通时静默降级，继续展示本地与预置方案
          console.log('[CommunityPlans] 社区方案拉取降级:', err.message);
        })
        .finally(function () {
          state.isFetchingRemote = false;
        });
    },

    // 渲染挂载容器与面板骨架 (严格挂载于选择车辆卡片正下方)
    renderContainer: function () {
      var container = document.getElementById('communityPlansContainer');
      if (!container) {
        var heroLayout = document.querySelector('.desktop-layout.cp-hero');
        if (heroLayout && heroLayout.parentNode) {
          container = document.createElement('div');
          container.id = 'communityPlansContainer';
          heroLayout.parentNode.insertBefore(container, heroLayout.nextSibling);
        }
      }
      if (!container) return;

      // 100% 融入宿主 .card 体系，天然继承毛玻璃、半透明与边框高光，并支持 .pv-collapsible 折叠能力
      container.className = 'card cp-plans-card pv-collapsible';
      container.innerHTML = [
        '<div class="card-title cp-card-title" onclick="CommunityPlans.onTitleClick(event)" title="点击折叠/展开方案库">',
        '  <div class="cp-title-left">',
        '    <span class="cp-badge-icon" aria-hidden="true">' + Icons.chip + '</span>',
        '    <span class="cp-title-text"><span class="zh">芯片方案库</span><span class="lang-en">Chip Setups</span></span>',
        '    <span id="cpCurrentCarBadge" class="limit-badge cp-car-badge"><span class="zh">未选赛车</span><span class="lang-en">No Car Selected</span></span>',
        '  </div>',
        '  <div class="cp-actions-bar" onclick="event.stopPropagation()">',
        '    <button type="button" id="cpBtnUndo" class="nav-btn cp-btn cp-btn-undo" style="display:none;" onclick="CommunityPlans.undoApply()">',
        '      ' + Icons.undo + '<span class="zh">撤销套用</span><span class="lang-en">Undo</span>',
        '    </button>',
        '    <button type="button" class="nav-btn cp-btn cp-btn-save" onclick="CommunityPlans.openSaveModal()">',
        '      ' + Icons.save + '<span class="zh">保存当前配装</span><span class="lang-en">Save Setup</span>',
        '    </button>',
        '    <button type="button" class="nav-btn select-btn cp-icon-btn" onclick="CommunityPlans.exportJSON()" title="导出全量方案备份">',
        '      ' + Icons.download,
        '    </button>',
        '    <button type="button" class="nav-btn select-btn cp-icon-btn" onclick="CommunityPlans.triggerImport()" title="导入备份的方案文件">',
        '      ' + Icons.upload,
        '    </button>',
        '    <input type="file" id="cpFileInput" accept=".json" style="display:none;" onchange="CommunityPlans.handleFileImport(event)">',
        '    <button type="button" class="nav-btn select-btn cp-icon-btn cp-fold-btn" onclick="CommunityPlans.toggleCollapse()" title="折叠/展开方案库">',
        '      <span class="cp-fold-indicator" aria-hidden="true">' + Icons.chevron + '</span>',
        '    </button>',
        '  </div>',
        '</div>',
        '<div id="cpSectionsStream" class="cp-sections-stream"></div>'
      ].join('');
    },

    // 排序菜单交互 (完全遵循全站 .dropdown-container / .dropdown-menu 规范)
    toggleSortMenu: function (e) {
      if (e) e.stopPropagation();
      var menu = document.getElementById('cpSortMenu');
      if (!menu) return;
      if (menu.classList.contains('show') && !menu.classList.contains('is-closing')) {
        CommunityPlans.closeSortMenu();
      } else {
        if (menu.__closeTimer) { clearTimeout(menu.__closeTimer); menu.__closeTimer = null; }
        menu.classList.remove('is-closing');
        menu.classList.add('show');
      }
    },

    closeSortMenu: function () {
      var menu = document.getElementById('cpSortMenu');
      if (!menu || !menu.classList.contains('show') || menu.classList.contains('is-closing')) return;
      menu.classList.add('is-closing');
      if (menu.__closeTimer) clearTimeout(menu.__closeTimer);
      menu.__closeTimer = setTimeout(function () {
        menu.classList.remove('show');
        menu.classList.remove('is-closing');
        menu.__closeTimer = null;
      }, 150);
    },

    // 渲染方案卡片列表 (按分类流式竖排，优先展示本地方案，无方案自动折叠，第三个模式完全隐藏)
    renderPlans: function () {
      var badge = document.getElementById('cpCurrentCarBadge');
      var stream = document.getElementById('cpSectionsStream');
      var container = document.getElementById('communityPlansContainer');
      if (!stream || !container) return;

      // 1. 第三个模式 (support 辅助供能模式) 物理隐藏方案库
      var currentMode = (typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo');
      if (currentMode === 'support') {
        container.style.display = 'none';
        return;
      } else {
        container.style.display = '';
      }

      var carName = state.currentCar ? (state.currentCar.name || '未知') : '未选赛车';

      // 2. 未选赛车状态 -> 自动折叠
      if (!state.currentCarId || state.currentCarId === -1) {
        if (badge) {
          badge.innerHTML = '<span class="zh">未选赛车 · 点击展开</span><span class="lang-en">No Car Selected</span>';
        }
        CommunityPlans.toggleCollapse(true);
        stream.innerHTML = [
          '<div class="cp-empty-box">',
          '  ' + Icons.emptyCar,
          '  <div class="cp-empty-title"><span class="zh">请先在上方选择一辆赛车</span><span class="lang-en">Select a Car Above</span></div>',
          '  <div class="cp-empty-desc"><span class="zh">选好赛车后，这里将直接为您垂直呈现本地方案、国服精选与社区推荐</span><span class="lang-en">Select a car to view setups</span></div>',
          '</div>'
        ].join('');
        return;
      }

      // 3. 收集各分类数据（彻底去重，并将远程过审的 is_pro 方案归入国服精选）
      var curIdStr = String(state.currentCarId);
      // 分类 1: 我的本地方案 (优先展示)
      var localList = state.savedPlans.filter(function (p) {
        return String(p.car_id) === curIdStr;
      });
      var isSameAsLocal = function (rp) {
        return localList.some(function (l) {
          return l.id === rp.id || (l.remote_id && l.remote_id === rp.id);
        });
      };
      // 分类 2: 国服顶尖精选 (官方预置 + 远程过审的国服自证方案)
      var baseProList = state.proPlans.filter(function (p) {
        return String(p.car_id) === curIdStr;
      });
      var remoteProList = state.remotePlans.filter(function (p) {
        if (String(p.car_id) !== curIdStr) return false;
        if (!p.is_pro && !p.isPro) return false;
        if (isSameAsLocal(p)) return false;
        if (baseProList.some(function (bp) { return bp.id === p.id || bp.title === p.title; })) return false;
        return true;
      });
      var proList = baseProList.concat(remoteProList);
      // 分类 3: 车友社区推荐 (排除本地与 pro 方案去重)
      var remoteList = state.remotePlans.filter(function (p) {
        if (String(p.car_id) !== curIdStr) return false;
        if (p.is_pro || p.isPro) return false;
        if (isSameAsLocal(p)) return false;
        if (proList.some(function (pr) { return pr.id === p.id; })) return false;
        return true;
      });

      var totalPlans = localList.length + proList.length + remoteList.length;

      // 4. 更新标题栏徽标与折叠状态联动 (无方案时自动折叠卡片)
      if (totalPlans === 0) {
        if (badge) {
          badge.innerHTML = '<span class="zh">' + Utils.escapeHtml(carName) + ' · 暂无方案 (点击展开)</span><span class="lang-en">No Setups (Click to expand)</span>';
        }
        CommunityPlans.toggleCollapse(true);
        stream.innerHTML = [
          '<div class="cp-empty-box">',
          '  ' + Icons.emptyBox,
          '  <div class="cp-empty-title"><span class="zh">该赛车暂无任何芯片配装</span><span class="lang-en">No Setups Found</span></div>',
          '  <div class="cp-empty-desc"><span class="zh">在上方配好先机、汇能与芯片参数后，点击右上角【保存当前配装】即可收藏您的专属方案！</span><span class="lang-en">Tune your chips and click Save Setup to create one!</span></div>',
          '  <button type="button" class="nav-btn cp-btn cp-btn-save" onclick="CommunityPlans.openSaveModal()">' + Icons.save + '<span class="zh">立即保存当前配装</span><span class="lang-en">Save Setup Now</span></button>',
          '</div>'
        ].join('');
        return;
      }

      // 有方案时默认展开
      if (badge) {
        badge.innerHTML = '<span class="zh">' + Utils.escapeHtml(carName) + ' (' + totalPlans + ' 方案)</span><span class="lang-en">' + Utils.escapeHtml(carName) + '</span>';
      }
      CommunityPlans.toggleCollapse(false);

      // 5. 纵向流式渲染各个分类 (Section Stream - 参考 TouchGal 分类列表设计)
      var sectionsHtml = [];

      // ==========================================
      // 【分类 1】：我的专属配装 (优先显示自己的！)
      // ==========================================
      if (localList.length > 0) {
        sectionsHtml.push([
          '<div class="cp-section cp-section-mine">',
          '  <div class="cp-sec-header">',
          '    <div class="cp-sec-icon-box">' + Icons.user + '</div>',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
          '        <span class="cp-sec-title"><span class="zh">我的专属配装</span><span class="lang-en">My Saved Setups</span></span>',
          '        <span class="cp-sec-count">' + localList.length + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">保存在本机的专属调校方案 (优先展示)，支持一键套用与备份管理</span><span class="lang-en">Your locally saved tuning setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          localList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'local'); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 2】：国服顶尖精选 (官方推荐)
      // ==========================================
      if (proList.length > 0) {
        sectionsHtml.push([
          '<div class="cp-section cp-section-pro">',
          '  <div class="cp-sec-header">',
          '    <img src="data/icon/pro_helmet_m.png" class="cp-sec-pro-icon" alt="" loading="lazy">',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
          '        <span class="cp-sec-title"><span class="zh">国服顶尖精选 (官方推荐)</span><span class="lang-en">Pro Master Setups</span></span>',
          '        <span class="cp-sec-count">' + proList.length + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">官方实战大数据与国服榜首车神认证配装</span><span class="lang-en">National top driver certified setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          proList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'pro'); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 3】：车友社区推荐
      // ==========================================
      if (remoteList.length > 0) {
        sectionsHtml.push([
          '<div class="cp-section cp-section-community">',
          '  <div class="cp-sec-header">',
          '    <div class="cp-sec-icon-box">' + Icons.hot + '</div>',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
          '        <span class="cp-sec-title"><span class="zh">车友社区推荐</span><span class="lang-en">Community Setups</span></span>',
          '        <span class="cp-sec-count">' + remoteList.length + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">来自全网车友实战分享的方案，经安全初筛认证</span><span class="lang-en">Community contributed setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          remoteList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'community'); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      stream.innerHTML = sectionsHtml.join('');
    },

    // 渲染紧凑横向条式方案项
    renderPlanItem: function (item, type) {
      var p = item.params || {};
      var xianji = p.xianji !== undefined ? Number(p.xianji) || 0 : 0;
      var huineng = p.huineng !== undefined ? Number(p.huineng) || 0 : 0;
      var rawTuanhun = p.tuanhun !== undefined ? p.tuanhun : p.team_spirit;
      var tuanhun = rawTuanhun !== undefined ? Number(rawTuanhun) || 0 : 0;
      var empArr = Array.isArray(p.emps) ? p.emps : (Array.isArray(p.empowers) ? p.empowers : []);
      var empsText = empArr.length > 0 ? empArr.join('·') : '无赋能';
      var safePlanId = Utils.safeId(item.id);
      var safeRemoteId = Utils.safeId(item.remote_id);
      var safePlayerId = Utils.safeId(item.player_id);
      var isVoted = Boolean(item.isVoted || state.votedMap[item.id] || (item.remote_id && state.votedMap[item.remote_id]));
      var isApplied = (state.activeAppliedPlanId === item.id);
      var isProPlan = Boolean(item.isPro || item.is_pro || type === 'pro');
      var isLocalPlan = (type === 'local');

      // 渲染主页链接按钮 (支持最多 3 个链接)
      var linksHtml = '';
      if (Array.isArray(item.links) && item.links.length > 0) {
        linksHtml = '<span class="cp-author-links">';
        item.links.forEach(function (l, idx) {
          var safeUrl = Utils.sanitizeUrl(l);
          if (safeUrl) {
            linksHtml += '<a href="' + Utils.escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" class="cp-author-link-btn" title="作者主页 ' + (idx + 1) + '">' + Icons.link + '</a>';
          }
        });
        linksHtml += '</span>';
      }

      var badgeText = isProPlan
        ? '<span class="cp-card-badge cp-badge-pro">' + Icons.crown + ' 国服顶尖</span>'
        : (isLocalPlan ? '<span class="cp-card-badge cp-badge-local">我的本地</span>' : '<span class="cp-card-badge cp-badge-community">社区</span>');

      // 若为车友提交过全网审核的本地方案，增加审核状态指示徽章 (支持点击刷新或查看官方审核组驳回说明)
      var auditStatusBadge = '';
      if (isLocalPlan && safeRemoteId) {
        if (item.remote_status === 'rejected') {
          auditStatusBadge = '<span class="cp-card-badge cp-badge-rejected" onclick="CommunityPlans.showRejectModal(\'' + safePlanId + '\', event)" title="点击查看审核驳回说明">⚠️ 审核未通过 (点击看说明)</span>';
        } else if (item.remote_status === 'approved') {
          auditStatusBadge = '<span class="cp-card-badge cp-badge-approved">✓ 审核通过</span>';
        } else {
          auditStatusBadge = '<span class="cp-card-badge cp-badge-pending" onclick="CommunityPlans.checkPlanStatus(\'' + safePlanId + '\', \'' + safeRemoteId + '\', event)" title="点击刷新审核状态">⏳ 审核中 (点击刷新)</span>';
        }
      }

      // 检查特殊芯片和芯片孔型摘要
      var chipsSummary = '';
      if (Array.isArray(p.chips_on) && p.chips_on.length > 0) {
        chipsSummary = p.chips_on.map(function (c) {
          if (typeof window._chipDef === 'function') {
            var def = window._chipDef(c.id);
            if (def && def.name) return (def.name.zh || def.name.en || c.id);
          }
          return c.id;
        }).join(' + ');
      } else if (Array.isArray(p.chips) && p.chips.length > 0) {
        chipsSummary = p.chips.map(function (c) { return c.name || c.type; }).slice(0, 3).join('·');
      }

      var nitroInfo = '';
      if (p.nitro_rule) {
        nitroInfo = p.nitro_rule + (p.nitro_dur ? ' · ' + p.nitro_dur + 's' : '');
      }

      return [
        '<div class="cp-card-item ' + (isProPlan ? 'is-pro' : '') + ' ' + (isApplied ? 'is-applied' : '') + '">',
        '  <div class="cp-card-main">',
        '    <div class="cp-card-header-line">',
        '      <h4 class="cp-card-title">' + Utils.escapeHtml(item.title) + '</h4>',
        badgeText,
        auditStatusBadge,
        (isApplied ? '<span class="cp-card-badge cp-badge-active">' + Icons.check + ' 正在生效</span>' : ''),
        '    </div>',
        '    <div class="cp-card-meta">',
        '      <span class="cp-author-name">' + Utils.escapeHtml(item.author || '热心车友') + '</span>',
        (safePlayerId ? '      <span class="cp-player-id" onclick="CommunityPlans.copyPlayerId(\'' + safePlayerId + '\', event)" title="点击复制车手游戏ID"><span class="zh">游戏ID: </span>' + Utils.escapeHtml(safePlayerId) + '<span class="cp-copy-icon">' + Icons.copy + '</span></span>' : ''),
        linksHtml,
        '      <span class="cp-meta-dot">·</span>',
        '      <span class="cp-meta-time">' + Utils.formatTime(item.created_at) + '</span>',
        '    </div>',
        '  </div>',
        '  <div class="cp-card-mid">',
        '    <div class="cp-params-row">',
        '      <span class="cp-pill cp-pill-acc">先机 ' + xianji + '%</span>',
        '      <span class="cp-pill cp-pill-acc">汇能 ' + huineng + '%</span>',
        (tuanhun > 0 ? '      <span class="cp-pill cp-pill-acc">团魂 ' + tuanhun + '%</span>' : ''),
        (nitroInfo ? '      <span class="cp-pill cp-pill-sub">氮气 ' + Utils.escapeHtml(nitroInfo) + '</span>' : ''),
        '    </div>',
        '    <div class="cp-params-row cp-params-row-sub">',
        '      <span class="cp-pill cp-pill-sub">赋能: ' + Utils.escapeHtml(empsText) + '</span>',
        (chipsSummary ? '      <span class="cp-pill cp-pill-acc" style="color:var(--acc);">芯片: ' + Utils.escapeHtml(chipsSummary) + '</span>' : ''),
        '    </div>',
        '  </div>',
        '  <div class="cp-card-right-bar">',
        '    <button type="button" class="nav-btn cp-vote-btn ' + (isVoted ? 'is-voted' : '') + '" onclick="CommunityPlans.toggleVote(\'' + safePlanId + '\')" title="点赞支持该方案">',
        '      ' + Icons.thumb(isVoted),
        '      <span>' + (Number(item.votes) || 0) + '</span>',
        '    </button>',
        (isLocalPlan
          ? '<button type="button" class="nav-btn select-btn cp-del-btn" title="删除该方案" onclick="CommunityPlans.deletePlan(\'' + safePlanId + '\')">' + Icons.trash + '</button>'
          : ''),
        '    <button type="button" class="nav-btn cp-apply-btn" onclick="CommunityPlans.applyPlanById(\'' + safePlanId + '\')">',
        '      ' + Icons.apply + '<span class="zh">一键套用</span><span class="lang-en">Apply</span>',
        '    </button>',
        '  </div>',
        '</div>'
      ].join('');
    },

    // 凭证图片暂存
    proofState: {
      rankingImg: null,
      profileImg: null
    },

    // Cloudflare Turnstile 人机校验框状态
    turnstileState: {
      widgetId: null,
      token: '',
      scriptPromise: null,
      isSubmitting: false
    },

    _setTurnstileStatus: function (text, mode) {
      var el = document.getElementById('cpTurnstileStatus');
      if (!el) return;
      el.textContent = text;
      el.className = 'cp-turnstile-status' + (mode ? ' is-' + mode : '');
    },

    ensureTurnstileScript: function () {
      if (window.turnstile && typeof window.turnstile.render === 'function') {
        return Promise.resolve(window.turnstile);
      }
      if (CommunityPlans.turnstileState.scriptPromise) {
        return CommunityPlans.turnstileState.scriptPromise;
      }
      CommunityPlans.turnstileState.scriptPromise = new Promise(function (resolve, reject) {
        var script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_URL;
        script.async = true;
        script.defer = true;
        var timer = setTimeout(function () {
          CommunityPlans.turnstileState.scriptPromise = null;
          reject(new Error('人机验证组件加载超时'));
        }, 8000);
        script.onload = function () {
          clearTimeout(timer);
          if (window.turnstile && typeof window.turnstile.render === 'function') {
            resolve(window.turnstile);
          } else {
            CommunityPlans.turnstileState.scriptPromise = null;
            reject(new Error('人机验证组件初始化异常'));
          }
        };
        script.onerror = function () {
          clearTimeout(timer);
          CommunityPlans.turnstileState.scriptPromise = null;
          reject(new Error('人机验证组件加载失败'));
        };
        document.head.appendChild(script);
      });
      return CommunityPlans.turnstileState.scriptPromise;
    },

    renderTurnstileWidget: function () {
      var wrap = document.getElementById('cpTurnstileWidget');
      if (!wrap) return;
      CommunityPlans.turnstileState.token = '';
      var box = document.getElementById('cpTurnstileBox');
      if (box) box.classList.remove('is-error');
      CommunityPlans._setTurnstileStatus('正在加载验证框...', '');
      wrap.innerHTML = '';

      CommunityPlans.ensureTurnstileScript()
        .then(function (ts) {
          var currentWrap = document.getElementById('cpTurnstileWidget');
          if (!currentWrap) return;
          if (CommunityPlans.turnstileState.widgetId !== null) {
            try { ts.remove(CommunityPlans.turnstileState.widgetId); } catch (_) {}
            CommunityPlans.turnstileState.widgetId = null;
          }
          var isLight = document.body.classList.contains('light-mode');
          var compact = (window.innerWidth || 600) < 360;
          CommunityPlans._setTurnstileStatus('请点击下方框完成校验', '');
          CommunityPlans.turnstileState.widgetId = ts.render('#cpTurnstileWidget', {
            sitekey: TURNSTILE_SITE_KEY,
            theme: isLight ? 'light' : 'dark',
            language: 'zh-CN',
            size: compact ? 'compact' : 'normal',
            callback: function (token) {
              CommunityPlans.turnstileState.token = token || '';
              var b = document.getElementById('cpTurnstileBox');
              if (b) b.classList.remove('is-error');
              CommunityPlans._setTurnstileStatus('✓ 验证已通过，可以提交', 'ok');
            },
            'expired-callback': function () {
              CommunityPlans.turnstileState.token = '';
              CommunityPlans._setTurnstileStatus('验证已过期，请重新勾选', 'err');
            },
            'error-callback': function () {
              CommunityPlans.turnstileState.token = '';
              CommunityPlans._setTurnstileStatus('验证加载出错，请重试', 'err');
            }
          });
        })
        .catch(function () {
          var currentWrap = document.getElementById('cpTurnstileWidget');
          if (!currentWrap) return;
          CommunityPlans._setTurnstileStatus('组件加载失败', 'err');
          currentWrap.innerHTML = '<span style="font-size:12px;color:var(--ink-3);">安全验证组件暂不可用<button type="button" class="cp-turnstile-retry" onclick="CommunityPlans.renderTurnstileWidget()">点击重试</button></span>';
        });
    },

    resetTurnstileWidget: function () {
      CommunityPlans.turnstileState.token = '';
      if (window.turnstile && CommunityPlans.turnstileState.widgetId !== null) {
        try {
          window.turnstile.reset(CommunityPlans.turnstileState.widgetId);
          CommunityPlans._setTurnstileStatus('请重新点击下方框完成校验', '');
          return;
        } catch (_) {}
      }
      CommunityPlans.renderTurnstileWidget();
    },

    onToggleSyncCommunity: function (isSync) {
      var sec = document.getElementById('cpCommunitySection');
      if (sec) sec.style.display = isSync ? 'flex' : 'none';
      if (isSync) {
        CommunityPlans.renderTurnstileWidget();
      } else {
        CommunityPlans.turnstileState.token = '';
        if (window.turnstile && CommunityPlans.turnstileState.widgetId !== null) {
          try { window.turnstile.remove(CommunityPlans.turnstileState.widgetId); } catch (_) {}
          CommunityPlans.turnstileState.widgetId = null;
        }
        var chkApplyPro = document.getElementById('cpChkApplyPro');
        if (chkApplyPro) {
          chkApplyPro.checked = false;
          CommunityPlans.onToggleApplyPro(false);
        }
      }
    },

    onToggleApplyPro: function (isApply) {
      var sec = document.getElementById('cpProProofSection');
      if (sec) sec.style.display = isApply ? 'flex' : 'none';
    },

    triggerProofUpload: function (type) {
      var input = document.getElementById('cpFile_' + type);
      if (input) input.click();
    },

    handleProofFile: function (type, input) {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];
      if (!file.type.match(/^image\//)) {
        CommunityPlans.toast('请上传有效的图片文件 (JPG/PNG/WEBP)');
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var dataUrl = e.target.result;
        var img = new Image();
        img.onload = function () {
          var maxW = 1280, maxH = 1280;
          var w = img.width, h = img.height;
          if (w > maxW || h > maxH) {
            if (w / h > maxW / maxH) {
              h = Math.round(h * (maxW / w));
              w = maxW;
            } else {
              w = Math.round(w * (maxH / h));
              h = maxH;
            }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var compressed = canvas.toDataURL('image/jpeg', 0.82);
          CommunityPlans.proofState[type] = compressed;

          var card = document.getElementById('cpProofCard_' + type);
          if (card) {
            card.classList.add('has-file');
            card.innerHTML = [
              '<div class="cp-proof-thumb-box">',
              '  <img src="' + compressed + '" class="cp-proof-thumb" alt="预览">',
              '  <button type="button" class="cp-proof-btn-reupload" onclick="event.stopPropagation(); CommunityPlans.triggerProofUpload(\'' + type + '\')">重新选择</button>',
              '</div>'
            ].join('');
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    },

    // 关闭保存方案弹窗并彻底销毁凭证内存、Turnstile 实例与解锁背景滚动（杜绝图床滥用与滚动穿透）
    closeSaveModal: function () {
      if (window.turnstile && CommunityPlans.turnstileState.widgetId !== null) {
        try { window.turnstile.remove(CommunityPlans.turnstileState.widgetId); } catch (_) {}
      }
      CommunityPlans.turnstileState.widgetId = null;
      CommunityPlans.turnstileState.token = '';
      CommunityPlans.turnstileState.isSubmitting = false;

      var modal = document.getElementById('cpSaveModal');
      if (modal) modal.remove();
      document.body.classList.remove('cp-modal-locked');
      CommunityPlans.proofState.rankingImg = null;
      CommunityPlans.proofState.profileImg = null;
      if (CommunityPlans._escKeyHandler) {
        document.removeEventListener('keydown', CommunityPlans._escKeyHandler);
        CommunityPlans._escKeyHandler = null;
      }
    },

    // 打开保存方案弹窗 (Modal)
    openSaveModal: function () {
      if (!state.currentCarId) {
        CommunityPlans.toast('请先在上方选择一辆赛车');
        return;
      }
      CommunityPlans.closeSaveModal();

      var carName = state.currentCar ? state.currentCar.name : '当前赛车';
      var params = ParamsIO.capture();
      var summary = '先机 ' + params.xianji + '% · 汇能 ' + params.huineng + '% · ' + (params.emps.length ? params.emps.join('/') : '无赋能');

      var modal = document.createElement('div');
      modal.id = 'cpSaveModal';
      modal.className = 'cp-modal-overlay is-open';
      modal.onclick = function (e) {
        if (e.target === modal) CommunityPlans.closeSaveModal();
      };
      // 阻止遮罩空白处滚轮穿透到背后页面本体
      modal.addEventListener('wheel', function (e) {
        if (e.target === modal) e.preventDefault();
      }, { passive: false });
      modal.addEventListener('touchmove', function (e) {
        if (e.target === modal) e.preventDefault();
      }, { passive: false });

      // 锁定背景网页滚动
      document.body.classList.add('cp-modal-locked');

      // 绑定 ESC 关闭快捷键
      CommunityPlans._escKeyHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          CommunityPlans.closeSaveModal();
        }
      };
      document.addEventListener('keydown', CommunityPlans._escKeyHandler);
      modal.innerHTML = [
        '<div class="card cp-modal-dialog" onclick="event.stopPropagation()">',
        '  <div class="cp-modal-head">',
        '    <h4 class="cp-modal-title">保存芯片配装 (' + Utils.escapeHtml(carName) + ')</h4>',
        '    <button type="button" class="nav-btn select-btn cp-modal-close" onclick="CommunityPlans.closeSaveModal()">',
        '      ' + Icons.close,
        '    </button>',
        '  </div>',
        '  <div class="cp-modal-body">',
        '    <div class="cp-summary-bar">',
        '      <span class="zh">配装参数摘要: </span><span class="cp-summary-val">' + Utils.escapeHtml(summary) + '</span>',
        '    </div>',
        '    <div class="form-group cp-form-group">',
        '      <div class="cp-label-row">',
        '        <label class="form-label" for="cpInputTitle">方案名称 (15字以内)</label>',
        '        <span id="cpTitleCounter" class="cp-input-count">0/15</span>',
        '      </div>',
        '      <div class="input-wrapper">',
        '        <input type="text" id="cpInputTitle" class="form-control cp-modal-input" placeholder="例如：大招连发稳健装" maxlength="15" autocomplete="off" oninput="CommunityPlans.onTitleInput(this)">',
        '      </div>',
        '    </div>',
        '    <!-- 开关 1: 是否上传方案至全网社区库 (规范 Switch，默认关闭) -->',
        '    <div class="cp-setting-switch-row">',
        '      <div class="cp-setting-switch-info">',
        '        <span class="cp-setting-switch-title">上传芯片方案至全网社区库</span>',
        '        <span class="cp-setting-switch-desc">默认关闭（仅保存在本机浏览器中）；开启后经安全初筛共享至全网方案库</span>',
        '      </div>',
        '      <input type="checkbox" id="cpChkSyncCommunity" class="ui-switch" onchange="CommunityPlans.onToggleSyncCommunity(this.checked)">',
        '    </div>',
        '    <!-- 社区上传扩展设置区 (开启上方开关后动态展开) -->',
        '    <div class="cp-community-section" id="cpCommunitySection" style="display: none;">',
        '      <div class="form-group cp-form-group">',
        '        <div class="cp-label-row">',
        '          <label class="form-label" for="cpInputAuthor">作者署名 (选填，留空展示热心车友)</label>',
        '          <div class="cp-switch-label-wrap">',
        '            <input type="checkbox" id="cpChkAnon" class="ui-switch" onchange="CommunityPlans.onToggleAnon(this.checked)">',
        '            <span class="cp-switch-label-text">匿名上传</span>',
        '          </div>',
        '        </div>',
        '        <div class="input-wrapper">',
        '          <input type="text" id="cpInputAuthor" class="form-control cp-modal-input" placeholder="您的昵称 (选填)" maxlength="20" autocomplete="off">',
        '        </div>',
        '      </div>',
        '      <div class="form-group cp-form-group" id="cpLinksGroup">',
        '        <label class="form-label">个人主页链接 (选填，最多 3 个，支持 B站/抖音/快手等)</label>',
        '        <div class="cp-links-input-list">',
        '          <div class="cp-link-input-row"><span class="cp-link-idx">1</span><input type="url" id="cpInputLink1" class="form-control cp-modal-input" placeholder="https://space.bilibili.com/..." autocomplete="off"></div>',
        '          <div class="cp-link-input-row"><span class="cp-link-idx">2</span><input type="url" id="cpInputLink2" class="form-control cp-modal-input" placeholder="https://www.douyin.com/user/..." autocomplete="off"></div>',
        '          <div class="cp-link-input-row"><span class="cp-link-idx">3</span><input type="url" id="cpInputLink3" class="form-control cp-modal-input" placeholder="https://..." autocomplete="off"></div>',
        '        </div>',
        '      </div>',
        '      <!-- 开关 2: 申请入选国服顶尖方案池 (规范 Switch，默认关闭) -->',
        '      <div class="cp-setting-switch-row cp-pro-apply-row">',
        '        <div class="cp-setting-switch-info">',
        '          <div class="cp-pro-apply-badge-line">',
        '            <img src="data/icon/pro_helmet_m.png" class="cp-sec-pro-icon" alt="" style="width:20px;height:20px;">',
        '            <span class="cp-setting-switch-title">申请入选「国服顶尖方案池」</span>',
        '          </div>',
        '          <span class="cp-setting-switch-desc">官方推荐入口已下架，现开放车友自证通道；需审核双截图凭证</span>',
        '        </div>',
        '        <input type="checkbox" id="cpChkApplyPro" class="ui-switch" onchange="CommunityPlans.onToggleApplyPro(this.checked)">',
        '      </div>',
        '      <!-- 国服最强自证双截图凭证上传区 (开启国服顶尖申请后展开) -->',
        '      <div class="cp-pro-apply-box" id="cpProProofSection" style="display: none;">',
        '        <div class="cp-proof-alert-card">',
        '          <div class="cp-proof-alert-title">',
        '            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:16px;height:16px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
        '            <span>国服顶尖认证硬性审核准则</span>',
        '          </div>',
        '          <ul class="cp-proof-alert-list">',
        '            <li>必须提交与当前配置车辆 (<strong>' + Utils.escapeHtml(carName) + '</strong>) <strong>完全一致</strong>的国服最强荣誉称号/榜单截图。</li>',
        '            <li>必须带有官方<strong>钻石色大国标</strong>（全国前十车神认证）。</li>',
        '            <li>⚠️ <strong>硬性驳回提示</strong>：全国前100【紫色小国标】、全省前10【金色省标】、全市前100【银色市标】、区县【铜色标】均不满足要求，直接驳回（注意：市标虽呈现类似银色，但为全市排名，绝非全国前十钻石大国标，请仔细核对）。</li>',
        '            <li>个人主页截图必须包含您的游戏昵称与数字 ID，以核验方案归属权。</li>',
        '          </ul>',
        '        </div>',
        '        <div class="cp-proof-grid">',
        '          <!-- 截图入口 1: 本车国服最强荣誉截图 -->',
        '          <div class="cp-proof-card" id="cpProofCard_ranking" onclick="CommunityPlans.triggerProofUpload(\'ranking\')">',
        '            <span class="cp-proof-card-badge">必传凭证 1</span>',
        '            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:24px;height:24px;color:var(--acc);margin-bottom:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        '            <span style="font-weight:700;font-size:12.5px;color:var(--ink);">本车国服最强荣誉截图</span>',
        '            <span class="cp-proof-card-desc">需含钻石大国标（全国前十）</span>',
        '            <input type="file" id="cpFile_ranking" class="cp-proof-file-input" accept="image/*" onchange="CommunityPlans.handleProofFile(\'ranking\', this)">',
        '          </div>',
        '          <!-- 截图入口 2: 个人主页截图 -->',
        '          <div class="cp-proof-card" id="cpProofCard_profile" onclick="CommunityPlans.triggerProofUpload(\'profile\')">',
        '            <span class="cp-proof-card-badge">必传凭证 2</span>',
        '            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:24px;height:24px;color:var(--acc);margin-bottom:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        '            <span style="font-weight:700;font-size:12.5px;color:var(--ink);">游戏个人主页截图</span>',
        '            <span class="cp-proof-card-desc">需含游戏昵称与数字ID</span>',
        '            <input type="file" id="cpFile_profile" class="cp-proof-file-input" accept="image/*" onchange="CommunityPlans.handleProofFile(\'profile\', this)">',
        '          </div>',
        '        </div>',
        '      </div>',
        '      <!-- 提交前安全验证 (Cloudflare Turnstile，点亮对勾后方可提交) -->',
        '      <div class="cp-turnstile-box" id="cpTurnstileBox">',
        '        <div class="cp-turnstile-head">',
        '          <span class="cp-turnstile-title">提交前安全验证</span>',
        '          <span class="cp-turnstile-status" id="cpTurnstileStatus">等待加载验证框...</span>',
        '        </div>',
        '        <div class="cp-turnstile-widget-wrap" id="cpTurnstileWidget"></div>',
        '      </div>',
        '    </div>',
        '  </div>',
        '  <div class="cp-modal-footer">',
        '    <button type="button" class="nav-btn cp-btn" onclick="CommunityPlans.closeSaveModal()">取消</button>',
        '    <button type="button" id="cpBtnConfirmSave" class="nav-btn cp-btn cp-btn-save" onclick="CommunityPlans.confirmSave()">' + Icons.save + ' 确认保存</button>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);
      setTimeout(function () {
        var input = document.getElementById('cpInputTitle');
        if (input) input.focus();
      }, 50);
    },

    onTitleInput: function (el) {
      var countEl = document.getElementById('cpTitleCounter');
      if (!countEl) return;
      var len = Utils.charCount(el.value);
      if (len > 15) {
        el.value = Utils.truncateChars(el.value, 15);
        len = 15;
      }
      countEl.textContent = len + '/15';
      if (len >= 15) countEl.classList.add('is-limit');
      else countEl.classList.remove('is-limit');
    },

    onToggleAnon: function (isAnon) {
      var authorInput = document.getElementById('cpInputAuthor');
      var linksGroup = document.getElementById('cpLinksGroup');
      if (authorInput) {
        if (isAnon) {
          authorInput.value = '';
          authorInput.disabled = true;
          authorInput.placeholder = '已开启匿名 (将展示为热心车友)';
        } else {
          authorInput.disabled = false;
          authorInput.placeholder = '您的昵称 (选填)';
        }
      }
      if (linksGroup) {
        linksGroup.style.display = isAnon ? 'none' : 'block';
      }
    },

    confirmSave: function () {
      var titleInput = document.getElementById('cpInputTitle');
      var authorInput = document.getElementById('cpInputAuthor');
      var chkAnon = document.getElementById('cpChkAnon');
      if (!titleInput) return;

      var title = titleInput.value.trim();
      var params = ParamsIO.capture();

      var check = PlanValidator.validate(params, title);
      if (!check.valid) {
        CommunityPlans.toast(check.message);
        titleInput.focus();
        return;
      }

      var isAnon = chkAnon ? chkAnon.checked : false;
      var author = isAnon ? '热心车友' : (authorInput ? authorInput.value.trim() : '');

      var links = [];
      ['cpInputLink1', 'cpInputLink2', 'cpInputLink3'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.value) {
          var clean = Utils.sanitizeUrl(el.value);
          if (clean && links.length < 3) {
            links.push(clean);
          }
        }
      });

      var chkSync = document.getElementById('cpChkSyncCommunity');
      var isSync = chkSync ? chkSync.checked : false;

      var chkApplyPro = document.getElementById('cpChkApplyPro');
      var isApplyPro = isSync && chkApplyPro ? chkApplyPro.checked : false;

      // 申请国服顶尖方案池时的双截图强制阻断校验
      if (isApplyPro) {
        if (!CommunityPlans.proofState.rankingImg || !CommunityPlans.proofState.profileImg) {
          CommunityPlans.toast('申请国服顶尖必须提交两张审核凭证截图（国服最强钻石大国标截图 + 个人主页截图）');
          var rankingCard = document.getElementById('cpProofCard_ranking');
          var profileCard = document.getElementById('cpProofCard_profile');
          if (!CommunityPlans.proofState.rankingImg && rankingCard) {
            rankingCard.style.borderColor = 'var(--fail, #ff4757)';
          }
          if (!CommunityPlans.proofState.profileImg && profileCard) {
            profileCard.style.borderColor = 'var(--fail, #ff4757)';
          }
          return;
        }
      }

      // 同步至社区方案库时，提交前必须先点击完成 Turnstile 人机验证框（变绿勾后放行）
      if (isSync) {
        if (CommunityPlans.turnstileState.isSubmitting) return;
        if (!CommunityPlans.turnstileState.token) {
          CommunityPlans.toast('请先点击完成人机验证框（勾选通过后再提交）');
          var tsBox = document.getElementById('cpTurnstileBox');
          if (tsBox) {
            tsBox.classList.add('is-error');
            try { tsBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
          }
          CommunityPlans._setTurnstileStatus('提交前请先点击完成验证', 'err');
          return;
        }
      }

      var planItem = {
        id: Utils.uuid(),
        car_id: state.currentCarId,
        car_name: state.currentCar ? state.currentCar.name : '',
        title: Utils.truncateChars(title, 15),
        author: author || '热心车友',
        links: links,
        params: ParamsIO.capture(),
        votes: 0,
        isVoted: false,
        created_at: Utils.now()
      };

      // 不勾选上传社区时，零验证直接保存在本机浏览器
      if (!isSync) {
        state.savedPlans.unshift(planItem);
        Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
        CommunityPlans.closeSaveModal();
        CommunityPlans.renderPlans();
        CommunityPlans.toast('方案「' + title + '」已成功保存到本机');
        return;
      }

      // 提取凭证快照（仅供同步请求一次性使用）
      var proProofData = isApplyPro ? {
        ranking_img: CommunityPlans.proofState.rankingImg,
        profile_img: CommunityPlans.proofState.profileImg,
        car_id: state.currentCarId,
        car_name: state.currentCar ? state.currentCar.name : ''
      } : null;

      var saveBtn = document.getElementById('cpBtnConfirmSave');
      CommunityPlans.turnstileState.isSubmitting = true;
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = Icons.save + ' 提交验证中...';
      }

      var payload = {
        car_id: state.currentCarId,
        car_name: state.currentCar ? state.currentCar.name : '',
        title: title,
        author: author,
        is_anonymous: isAnon,
        apply_pro: isApplyPro,
        pro_proof: proProofData,
        links: links,
        turnstile_token: CommunityPlans.turnstileState.token,
        params: {
          ult_threshold: params.ult_threshold,
          start_charge: params.start_charge,
          base_nitro: params.base_nitro,
          nitro_rule: params.nitro_rule,
          nitro_dur: params.nitro_dur,
          xianji: params.xianji,
          huineng: params.huineng,
          start_nitro_count: params.first_nitro_count,
          first_nitro_count: params.first_nitro_count,
          cycle_nitro_count: params.loop_nitro_count,
          loop_nitro_count: params.loop_nitro_count,
          team_spirit: params.tuanhun, // 团魂无论填多少均不拦截
          tuanhun: params.tuanhun,
          chips: params.chips_on,
          chips_on: params.chips_on,
          empowers: params.emps,
          emps: params.emps
        }
      };

      fetch('/api/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': Utils.getClientId(),
          'X-Turnstile-Token': CommunityPlans.turnstileState.token
        },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          return res.json().then(function (d) { return { ok: res.ok, status: res.status, data: d }; });
        })
        .then(function (resObj) {
          CommunityPlans.turnstileState.isSubmitting = false;
          if (!resObj.ok) {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.innerHTML = Icons.save + ' 确认保存';
            }
            var errMsg = (resObj.data && resObj.data.message) ? resObj.data.message : '提交被阻断';
            CommunityPlans.toast(errMsg);
            // Turnstile 票据一次性消耗或失效时自动刷新验证框，保留已填表单与截图
            CommunityPlans.resetTurnstileWidget();
            return;
          }

          if (resObj.data && resObj.data.data && resObj.data.data.id) {
            planItem.remote_id = resObj.data.data.id;
            planItem.remote_status = resObj.data.data.status;
          }
          state.savedPlans.unshift(planItem);
          Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
          // 成功后再销毁弹窗与内存截图，绝不保留原图在本地
          CommunityPlans.closeSaveModal();
          CommunityPlans.renderPlans();
          var msg = isApplyPro
            ? '方案「' + title + '」已保存并提交国服自证审核！'
            : '方案「' + title + '」已保存并提交内容安全审核！';
          CommunityPlans.toast(msg);
          CommunityPlans.fetchRemotePlans(state.currentCarId);
        })
        .catch(function () {
          CommunityPlans.turnstileState.isSubmitting = false;
          state.savedPlans.unshift(planItem);
          Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
          CommunityPlans.closeSaveModal();
          CommunityPlans.renderPlans();
          CommunityPlans.toast('方案已保存到本机（社区同步接口暂未连通）');
        });
    },

    // 检查指定方案的审核进度与官方审核组裁决说明
    checkPlanStatus: function (localId, remoteId, e) {
      if (e) e.stopPropagation();
      if (!remoteId) {
        CommunityPlans.toast('该方案尚未同步至云端');
        return;
      }

      CommunityPlans.toast('正在查询方案审核状态...');
      fetch('/api/plans?check_status=' + encodeURIComponent(remoteId))
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (json) {
          if (!json || !json.success || !json.data) {
            throw new Error('未获取到有效状态');
          }
          var d = json.data;
          var localPlan = state.savedPlans.find(function (p) { return p.id === localId; });
          if (localPlan) {
            localPlan.remote_status = d.status;
            localPlan.reject_reason = d.reject_reason || d.review_notes;
            localPlan.review_notes = d.review_notes;
            if (d.status === 'approved' && d.is_pro) {
              localPlan.isPro = true;
            }
            Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
            CommunityPlans.renderPlans();
          }

          if (d.status === 'approved') {
            CommunityPlans.toast('恭喜！方案已通过审核' + (d.is_pro ? '，并荣获「国服顶尖」勋标！' : '，已全网上线！'));
          } else if (d.status === 'rejected') {
            CommunityPlans.showRejectModal(localId);
          } else {
            CommunityPlans.toast('方案正在排队审核中，请耐心等待官方审核员审阅。');
          }
        })
        .catch(function (err) {
          CommunityPlans.toast('查询审核状态失败：' + err.message);
        });
    },

    // 展示官方审核组给出的审核驳回说明模态框
    showRejectModal: function (localId, e) {
      if (e) e.stopPropagation();
      var plan = state.savedPlans.find(function (p) { return p.id === localId; });
      if (!plan) return;

      var reason = plan.reject_reason || plan.review_notes || '未能通过审核，请检查截图或内容合规性后重新尝试。';

      var modal = document.getElementById('cpRejectModal');
      if (!modal) {
        modal = document.createElement('div');
        modal.id = 'cpRejectModal';
        modal.className = 'cp-modal-overlay';
        modal.addEventListener('wheel', function (ev) {
          if (ev.target === modal) ev.preventDefault();
        }, { passive: false });
        modal.addEventListener('touchmove', function (ev) {
          if (ev.target === modal) ev.preventDefault();
        }, { passive: false });
        document.body.appendChild(modal);
      }

      document.body.classList.add('cp-modal-locked');
      if (CommunityPlans._rejectEscKeyHandler) {
        document.removeEventListener('keydown', CommunityPlans._rejectEscKeyHandler);
      }
      CommunityPlans._rejectEscKeyHandler = function (ev) {
        if (ev.key === 'Escape' || ev.keyCode === 27) {
          CommunityPlans.closeRejectModal();
        }
      };
      document.addEventListener('keydown', CommunityPlans._rejectEscKeyHandler);

      modal.innerHTML = [
        '<div class="card cp-modal-dialog" onclick="event.stopPropagation()">',
        '  <div class="cp-modal-head">',
        '    <h4 class="cp-modal-title">方案审核反馈说明</h4>',
        '    <button type="button" class="nav-btn select-btn cp-modal-close" onclick="CommunityPlans.closeRejectModal()">',
        '      ' + Icons.close,
        '    </button>',
        '  </div>',
        '  <div class="cp-modal-body">',
        '    <div class="cp-reject-feedback-box">',
        '      <div class="cp-reject-status-card">',
        '        <div class="cp-reject-status-label">',
        '          <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        '          <span>审核判定：未通过</span>',
        '        </div>',
        '        <span style="font-size:12px;color:var(--ink-2);">方案名称：' + Utils.escapeHtml(plan.title) + '</span>',
        '      </div>',
        '      <div style="font-weight:700;font-size:13px;color:var(--ink);margin-top:4px;">官方审核组反馈说明：</div>',
        '      <div class="cp-reject-reason-body">' + Utils.escapeHtml(reason) + '</div>',
        '      <div class="cp-reject-tip">💡 提示：该方案已安全保存在您的本地浏览器中，不受任何影响。您可以根据上述说明修改配装或重新截取符合标准的大国标截图后再次上传。</div>',
        '    </div>',
        '  </div>',
        '  <div class="cp-modal-foot">',
        '    <button type="button" class="nav-btn cp-btn" style="background:var(--acc);color:var(--acc-ink, #000);font-weight:700;" onclick="CommunityPlans.closeRejectModal()">我知道了</button>',
        '  </div>',
        '</div>'
      ].join('');

      modal.onclick = function (ev) {
        if (ev.target === modal) CommunityPlans.closeRejectModal();
      };
      modal.classList.add('active');
    },

    closeRejectModal: function () {
      var modal = document.getElementById('cpRejectModal');
      if (modal) {
        modal.classList.remove('active');
        document.body.classList.remove('cp-modal-locked');
      }
      if (CommunityPlans._rejectEscKeyHandler) {
        document.removeEventListener('keydown', CommunityPlans._rejectEscKeyHandler);
        CommunityPlans._rejectEscKeyHandler = null;
      }
    },

    // 一键套用并记录当前高亮状态
    applyPlanById: function (planId) {
      var plan = state.savedPlans.find(function (p) { return p.id === planId; }) ||
                 state.proPlans.find(function (p) { return p.id === planId; }) ||
                 state.remotePlans.find(function (p) { return p.id === planId; });
      if (!plan || !plan.params) {
        CommunityPlans.toast('找不到该方案数据');
        return;
      }

      state.lastSnapshot = ParamsIO.capture();
      state.hasUndoAvailable = true;
      state.activeAppliedPlanId = planId;

      var undoBtn = document.getElementById('cpBtnUndo');
      if (undoBtn) undoBtn.style.display = 'inline-flex';

      ParamsIO.apply(plan.params);
      CommunityPlans.renderPlans();

      var cardChips = document.getElementById('cardChips');
      if (cardChips) {
        cardChips.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      CommunityPlans.toast('已成功套用方案「' + plan.title + '」');
    },

    // 撤销还原
    undoApply: function () {
      if (!state.lastSnapshot) {
        CommunityPlans.toast('暂无可撤销的快照');
        return;
      }

      ParamsIO.apply(state.lastSnapshot);
      state.lastSnapshot = null;
      state.hasUndoAvailable = false;
      state.activeAppliedPlanId = null;

      var undoBtn = document.getElementById('cpBtnUndo');
      if (undoBtn) undoBtn.style.display = 'none';

      CommunityPlans.renderPlans();
      CommunityPlans.toast('已还原之前的配装状态');
    },

    // 删除本地方案
    deletePlan: function (planId) {
      var idx = state.savedPlans.findIndex(function (p) { return p.id === planId; });
      if (idx === -1) return;

      var name = state.savedPlans[idx].title;
      if (!confirm('确定要删除本地保存的方案「' + name + '」吗？')) return;

      state.savedPlans.splice(idx, 1);
      Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);

      if (state.activeAppliedPlanId === planId) {
        state.activeAppliedPlanId = null;
      }

      CommunityPlans.renderPlans();
      CommunityPlans.toast('已删除方案「' + name + '」');
    },

    // 点赞 (双因子防刷并持久化至 VOTES 存储)
    toggleVote: function (planId) {
      var plan = state.savedPlans.find(function (p) { return p.id === planId; }) ||
                 state.proPlans.find(function (p) { return p.id === planId; }) ||
                 state.remotePlans.find(function (p) { return p.id === planId; });
      if (!plan) return;

      var alreadyVoted = Boolean(plan.isVoted || state.votedMap[plan.id] || (plan.remote_id && state.votedMap[plan.remote_id]));
      if (alreadyVoted) {
        CommunityPlans.toast('您已经赞过该方案啦');
        return;
      }

      plan.isVoted = true;
      plan.votes = (Number(plan.votes) || 0) + 1;
      state.votedMap[plan.id] = 1;
      if (plan.remote_id) state.votedMap[plan.remote_id] = 1;
      Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);

      // 如果是本地方案，同步写入 storage
      if (state.savedPlans.some(function (p) { return p.id === planId; })) {
        Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
        CommunityPlans.renderPlans();
        CommunityPlans.toast('点赞成功 +1');
      } else {
        CommunityPlans.renderPlans();
        // 远程/社区方案向后端同步投票（携带匿名持久化 X-Client-ID）
        var targetRemoteId = plan.remote_id || planId;
        fetch('/api/vote', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-ID': Utils.getClientId()
          },
          body: JSON.stringify({ plan_id: targetRemoteId })
        })
          .then(function (res) {
            return res.json().then(function (d) { return { ok: res.ok, status: res.status, data: d }; });
          })
          .then(function (resObj) {
            if (!resObj.ok) {
              if (resObj.status === 403) {
                plan.votes = Math.max(0, (Number(plan.votes) || 1) - 1);
                CommunityPlans.renderPlans();
                CommunityPlans.toast((resObj.data && resObj.data.message) || '您在 24 小时内已经点过赞啦');
              }
            } else {
              if (resObj.data && resObj.data.data && typeof resObj.data.data.votes === 'number') {
                plan.votes = resObj.data.data.votes;
                CommunityPlans.renderPlans();
              }
              CommunityPlans.toast('点赞成功 +1');
            }
          })
          .catch(function () {
            CommunityPlans.toast('点赞成功 +1');
          });
      }
    },

    // 导出备份
    exportJSON: function () {
      if (!state.savedPlans || state.savedPlans.length === 0) {
        CommunityPlans.toast('当前暂无本地保存的方案可供导出');
        return;
      }
      var exportData = {
        app: 'Ace-Racer-Calc',
        version: '2.2',
        exported_at: Utils.now(),
        plans: state.savedPlans
      };
      var jsonStr = JSON.stringify(exportData, null, 2);
      var blob = new Blob([jsonStr], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'ace-racer-plans-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      CommunityPlans.toast('已导出 ' + state.savedPlans.length + ' 个本地方案');
    },

    // 触发导入
    triggerImport: function () {
      var fileInput = document.getElementById('cpFileInput');
      if (fileInput) fileInput.click();
    },

    // 处理导入文件（带严格白名单净化与安全校验，防恶意 JSON 注入/XSS）
    handleFileImport: function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        CommunityPlans.toast('导入失败：备份文件不能超过 2MB');
        e.target.value = '';
        return;
      }

      var reader = new FileReader();
      reader.onload = function (event) {
        try {
          var data = JSON.parse(event.target.result);
          var plans = Array.isArray(data) ? data : (data && Array.isArray(data.plans) ? data.plans : []);
          if (!Array.isArray(plans) || plans.length === 0) {
            CommunityPlans.toast('导入失败：未找到有效方案');
            return;
          }

          var count = 0;
          var maxImport = 100;
          for (var i = 0; i < plans.length && count < maxImport; i++) {
            var imported = plans[i];
            if (!imported || typeof imported !== 'object' || !imported.title || !imported.params || typeof imported.params !== 'object') {
              continue;
            }
            var cleanTitle = Utils.truncateChars(String(imported.title).trim(), 15);
            var vCheck = PlanValidator.validate(imported.params, cleanTitle);
            if (!vCheck.valid) continue;

            var cleanLinks = [];
            if (Array.isArray(imported.links)) {
              imported.links.forEach(function (l) {
                var u = Utils.sanitizeUrl(l);
                if (u && cleanLinks.length < 3) cleanLinks.push(u);
              });
            }

            var safePlan = {
              id: Utils.uuid(),
              car_id: Utils.safeId(imported.car_id),
              car_name: Utils.truncateChars(String(imported.car_name || ''), 24),
              title: cleanTitle,
              author: Utils.truncateChars(String(imported.author || '热心车友').trim(), 20) || '热心车友',
              links: cleanLinks,
              params: imported.params,
              votes: Math.max(0, parseInt(imported.votes, 10) || 0),
              isVoted: false,
              created_at: parseInt(imported.created_at, 10) || Utils.now()
            };
            if (!safePlan.car_id) continue;

            state.savedPlans.push(safePlan);
            count++;
          }

          Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
          CommunityPlans.renderPlans();
          CommunityPlans.toast('成功安全导入 ' + count + ' 个方案！');
        } catch (err) {
          CommunityPlans.toast('导入失败：文件解析错误');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },

    // 统一 Toast 提示 (优先复用全站原生 .copy-toast)
    toast: function (msg) {
      var toastEl = document.getElementById('copyToast');
      if (toastEl) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        if (toastEl.__timer) clearTimeout(toastEl.__timer);
        toastEl.__timer = setTimeout(function () {
          toastEl.classList.remove('show');
        }, 2200);
      } else {
        alert(msg);
      }
    }
  };

  // 挂载到全局
  window.CommunityPlans = CommunityPlans;
  window.toggleAutoDraft = Draft.toggle;
  window.paintAutoDraft = Draft.paintSwitch;

  // DOM 就绪时初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', CommunityPlans.init);
  } else {
    CommunityPlans.init();
  }

})(window, document);
