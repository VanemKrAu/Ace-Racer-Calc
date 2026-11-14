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
    DEVICE_FP: 'arc_device_fp_v1',
    SETTINGS: 'arc_user_settings_v1',
    AUTO_DRAFT: 'arc_auto_draft_enabled',
    ANNOUNCEMENT_STATE: 'arc_announcement_state_v1'
  };

  // Cloudflare Turnstile 公开 Site Key（仅用于前端渲染托管人机校验框，非密钥）
  var TURNSTILE_SITE_KEY = '0x4AAAAAAF_MFEXcXJElnxKc';
  var TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

  // 赋能键名 -> 人类可读中文兜底映射表（优先从 window.TALENTS_DATA 实时读取）
  var EMP_FALLBACK_MAP = {
    yichu: '拒绝溢出',
    fusu: '复苏之泉',
    jiezou: '节奏赋能',
    queyi: '缺一不可',
    weilai: '未来视界',
    huaxin: '花信风',
    huishou: '能源回收',
    duanwei: '断位赋能',
    chaohe: '超核赋能'
  };

  function resolveEmpowerLabel(empKey) {
    var k = String(empKey || '').trim();
    if (!k) return '';
    var list = window.TALENTS_DATA;
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        var t = list[i];
        if (t && (t.key === k || String(t.id) === k)) {
          return t.name || t.nameEn || k;
        }
      }
    }
    return EMP_FALLBACK_MAP[k] || k;
  }

  function formatEmpsText(empArr) {
    if (!Array.isArray(empArr) || empArr.length === 0) return '';
    return empArr.map(resolveEmpowerLabel).filter(Boolean).join(' · ');
  }

  var DEVICE_LABEL_MAP = {
    loop: '循环装置',
    chg: '充能装置',
    schg: '超级充能装置',
    acc: '加速装置'
  };

  var CHIP_NAME_MAP = {
    hunter: '隐匿猎手之芯',
    catnap: '猫眠梦之芯'
  };

  function fmtPlanNum(v) {
    var n = Number(v);
    if (!Number.isFinite(n)) return '0';
    return String(Number(n.toFixed(2)));
  }

  function formatChipsList(p) {
    var out = [];
    if (Array.isArray(p.chips_on) && p.chips_on.length > 0) {
      p.chips_on.forEach(function (c) {
        if (!c) return;
        var id = typeof c === 'object' ? String(c.id || '') : String(c);
        if (!id) return;
        var def = typeof window._chipDef === 'function' ? window._chipDef(id) : null;
        var cname = (def && def.name && (def.name.zh || def.name.en)) || CHIP_NAME_MAP[id] || id;
        var optLabels = [];
        if (c && typeof c === 'object' && c.opts && typeof c.opts === 'object') {
          var optDefs = (def && typeof window._chipOptionDefs === 'function') ? window._chipOptionDefs(def) : [];
          Object.keys(c.opts).forEach(function (k) {
            var val = c.opts[k];
            if (val === undefined || val === null || val === '') return;
            var matchedText = '';
            for (var i = 0; i < optDefs.length; i++) {
              if (optDefs[i].id === k && Array.isArray(optDefs[i].choices)) {
                for (var j = 0; j < optDefs[i].choices.length; j++) {
                  if (String(optDefs[i].choices[j].v) === String(val)) {
                    matchedText = optDefs[i].choices[j].zh || optDefs[i].choices[j].en || String(val);
                    break;
                  }
                }
              }
            }
            if (!matchedText && k === 'loopMode') {
              matchedText = val === 'safe' ? '稳妥循环+0%' : (val === 'peak' ? '偶数/触发轮' : String(val));
            }
            optLabels.push(matchedText || (k + '=' + val));
          });
        }
        out.push(cname + (optLabels.length ? ' (' + optLabels.join(', ') + ')' : ''));
      });
    } else if (Array.isArray(p.chips) && p.chips.length > 0) {
      p.chips.forEach(function (c) {
        if (!c) return;
        var cname = c.name || CHIP_NAME_MAP[c.id] || c.id || c.type || '';
        if (cname) out.push(String(cname));
      });
    }
    return out;
  }

  function formatEmpsDetailed(p) {
    var empArr = Array.isArray(p.emps) ? p.emps : (Array.isArray(p.empowers) ? p.empowers : []);
    if (!empArr.length) return '';
    return empArr.map(function (empKey) {
      var k = String(empKey || '').trim();
      var base = resolveEmpowerLabel(k);
      if (!base) return '';
      if (k === 'jiezou') {
        var jf = Number(p.jiezou_first) || 0;
        var jl = Number(p.jiezou_loop) || 0;
        if (jf > 0 || jl > 0) return base + '(首' + fmtPlanNum(jf) + '/循' + fmtPlanNum(jl) + ')';
      } else if (k === 'queyi') {
        var qParts = [];
        if (p.queyi_self) qParts.push('己方');
        if (p.queyi_enemy) qParts.push('敌方');
        if (qParts.length) return base + '(' + qParts.join('+') + ')';
      } else if (k === 'huaxin') {
        var hf = Number(p.huaxin_first) || 0;
        var hl = Number(p.huaxin_loop) || 0;
        if (hf > 0 || hl > 0) return base + '(首' + fmtPlanNum(hf) + '/循' + fmtPlanNum(hl) + ')';
      }
      return base;
    }).filter(Boolean).join(' · ');
  }

  function resolveCarBaseline(car) {
    if (!car || typeof car !== 'object') return null;
    var ace = Number(car.ace_charge) || 0;
    var baseNitro = ace ? Math.round(ace / 100 * 10) / 10 : null;
    var initBonus = Number(car.init_ratio) || 0;
    var startCharge = ace ? Math.min(100, Math.round((ace + initBonus) / 100 * 10) / 10) : null;
    var ultThreshold = car.ult_threshold ? Number(car.ult_threshold) : 100;
    var baseUltDur = car.ult_duration !== undefined ? Number(car.ult_duration) || 0 : null;
    return {
      baseNitro: baseNitro,
      startCharge: startCharge,
      ultThreshold: ultThreshold,
      baseUltDur: baseUltDur
    };
  }

  function isTeamOnlyPlan(p) {
    var param = p || {};
    if (param.calc_mode === 'team') return true;
    if (param.calc_mode === 'solo') return false;
    var devKey = (param.device && DEVICE_LABEL_MAP[param.device] && param.device !== '0') ? param.device : '';
    if (devKey) return true;
    var th = Number(param.tuanhun !== undefined ? param.tuanhun : param.team_spirit) || 0;
    if (th > 0) return true;
    if ((devKey === 'chg' || devKey === 'schg') && ((Number(param.dev_sub_first) || 0) > 0 || (Number(param.dev_sub_loop) || 0) > 0)) return true;
    return false;
  }

  function resolvePlanMode(p) {
    return isTeamOnlyPlan(p) ? 'team' : 'solo';
  }

  function isPlanCompatibleWithMode(p, calcMode) {
    if (calcMode === 'solo') {
      return !isTeamOnlyPlan(p);
    }
    return true;
  }

  function extractAllPlanDetails(p, car) {
    var param = p || {};
    var xianji = param.xianji !== undefined ? (Number(param.xianji) || 0) : 0;
    var huineng = param.huineng !== undefined ? (Number(param.huineng) || 0) : 0;
    var rawTuanhun = param.tuanhun !== undefined ? param.tuanhun : param.team_spirit;
    var tuanhun = rawTuanhun !== undefined ? (Number(rawTuanhun) || 0) : 0;
    var devKey = DEVICE_LABEL_MAP[param.device] ? param.device : '';
    var counterRange = devKey ? 0 : (Number(param.counter_range) || 0);
    var debuffRange = devKey ? 0 : (Number(param.debuff_range) || 0);
    var isTeamPlan = isTeamOnlyPlan(param);

    var nitroRule = param.nitro_rule ? String(param.nitro_rule) : '';
    var nitroDur = param.nitro_dur !== undefined ? (Number(param.nitro_dur) || 0) : 0;
    var fnRaw = param.first_nitro_count !== undefined ? param.first_nitro_count : param.start_nitro_count;
    var firstNitroCount = fnRaw !== undefined ? Number(fnRaw) : 1;
    var lnRaw = param.loop_nitro_count !== undefined ? param.loop_nitro_count : param.cycle_nitro_count;
    var loopNitroCount = lnRaw !== undefined ? Number(lnRaw) : 0;
    var isManualNitro = Number(param.is_manual_nitro) === 1;

    var nitroInfo = nitroRule ? (nitroRule + (nitroDur ? ' · ' + fmtPlanNum(nitroDur) + 's' : '')) : '';
    if (nitroInfo && (isManualNitro || (Number.isFinite(firstNitroCount) && firstNitroCount !== 1))) {
      nitroInfo += ' (首' + (Number.isFinite(firstNitroCount) ? firstNitroCount : 1) +
        (isManualNitro ? '/循' + (Number.isFinite(loopNitroCount) ? loopNitroCount : 0) : '') + ')';
    }

    // 黄色高亮顶行（先机、汇能、第二模式下的团魂、反制：手机端强制同一行展示）
    var hlCells = [
      { lbl: '先机', val: fmtPlanNum(xianji) + '%', cls: 'is-acc' },
      { lbl: '汇能', val: fmtPlanNum(huineng) + '%', cls: 'is-acc' }
    ];
    if (tuanhun > 0 || param.calc_mode === 'team') {
      hlCells.push({ lbl: '团魂', val: fmtPlanNum(tuanhun) + '%', cls: 'is-acc' });
    }
    if (!devKey && counterRange > 0) {
      hlCells.push({ lbl: '反制', val: fmtPlanNum(counterRange) + '%', cls: 'is-acc' });
    }

    var specCells = [];
    if (nitroInfo) {
      specCells.push({ lbl: '氮气', val: nitroInfo, cls: '' });
    }
    if (devKey) {
      var devText = DEVICE_LABEL_MAP[devKey];
      var dsf = Number(param.dev_sub_first) || 0;
      var dsl = Number(param.dev_sub_loop) || 0;
      if ((devKey === 'chg' || devKey === 'schg') && (dsf > 0 || dsl > 0)) {
        devText += ' (首+' + fmtPlanNum(dsf) + '%/循+' + fmtPlanNum(dsl) + '%)';
      }
      specCells.push({ lbl: '装置', val: devText, cls: 'is-acc' });
    } else if (debuffRange > 0) {
      specCells.push({ lbl: '干扰', val: fmtPlanNum(debuffRange) + '%', cls: '' });
    }

    var extraRows = [];
    var chipsList = formatChipsList(param);
    if (chipsList.length > 0) {
      extraRows.push({ k: '芯片', v: chipsList.join(' + '), acc: true });
    }

    if (!devKey) {
      var empsDetailed = formatEmpsDetailed(param);
      if (empsDetailed) {
        extraRows.push({ k: '赋能', v: empsDetailed, acc: false });
      }
    }

    var traitParts = [];
    if (param.is_spec !== undefined && Number(param.is_spec) === 0) {
      traitParts.push('专精: 已关闭');
    }
    var extraEff = Number(param.extra_eff) || 0;
    if (extraEff !== 0) {
      traitParts.push('额外充能效率 ' + (extraEff > 0 ? '+' : '') + fmtPlanNum(extraEff) + '%');
    }
    if (traitParts.length > 0) {
      extraRows.push({ k: '特性', v: traitParts.join(' · '), acc: false });
    }

    var extParts = [];
    if (param.has_extra_nitro && Number(param.val_extra_nitro) > 0) {
      var enScope = [];
      if (param.chk_extra_nitro_first === undefined || param.chk_extra_nitro_first) enScope.push('首');
      if (param.chk_extra_nitro_loop === undefined || param.chk_extra_nitro_loop) enScope.push('循');
      extParts.push('氮气自充 +' + fmtPlanNum(param.val_extra_nitro) + '%' + (enScope.length === 1 ? '(' + enScope[0] + ')' : ''));
    }
    if (param.has_extra_ult && ((Number(param.val_extra_ult_first) || 0) > 0 || (Number(param.val_extra_ult_loop) || 0) > 0)) {
      extParts.push('大招自充 首+' + fmtPlanNum(param.val_extra_ult_first || 0) + '%/循+' + fmtPlanNum(param.val_extra_ult_loop || 0) + '%');
    }
    if (param.has_extra_per_sec && Number(param.val_extra_per_sec) > 0) {
      var epScope = [];
      if (param.chk_extra_per_sec_first === undefined || param.chk_extra_per_sec_first) epScope.push('首');
      if (param.chk_extra_per_sec_loop === undefined || param.chk_extra_per_sec_loop) epScope.push('循');
      extParts.push('每秒自充 +' + fmtPlanNum(param.val_extra_per_sec) + '%' + (epScope.length === 1 ? '(' + epScope[0] + ')' : ''));
    }
    var valCustomTrig = Number(param.val_custom_trig) || 0;
    if (valCustomTrig > 0) {
      extParts.push('自定义触发 +' + fmtPlanNum(valCustomTrig) + '%(首' + (Number(param.custom_trig_first) || 0) + '/循' + (Number(param.custom_trig_loop) || 0) + '次)');
    }
    if (extParts.length > 0) {
      extraRows.push({ k: '扩展', v: extParts.join(' · '), acc: false });
    }

    var tweakParts = [];
    var baseline = resolveCarBaseline(car);
    if (baseline) {
      if (baseline.ultThreshold !== null && param.ult_threshold !== undefined && Math.abs(Number(param.ult_threshold) - baseline.ultThreshold) > 0.05) {
        tweakParts.push('阈值 ' + fmtPlanNum(param.ult_threshold) + '%');
      }
      if (baseline.startCharge !== null && param.start_charge !== undefined && Math.abs(Number(param.start_charge) - baseline.startCharge) > 0.05) {
        tweakParts.push('起步 ' + fmtPlanNum(param.start_charge) + '%');
      }
      if (baseline.baseNitro !== null && param.base_nitro !== undefined && Math.abs(Number(param.base_nitro) - baseline.baseNitro) > 0.05) {
        tweakParts.push('单氮气 ' + fmtPlanNum(param.base_nitro) + '%');
      }
      if (baseline.baseUltDur !== null && param.base_ult_dur !== undefined && Math.abs(Number(param.base_ult_dur) - baseline.baseUltDur) > 0.05) {
        tweakParts.push('大招时长 ' + fmtPlanNum(param.base_ult_dur) + 's');
      }
    }
    if (tweakParts.length > 0) {
      extraRows.push({ k: '微调', v: tweakParts.join(' · '), acc: false });
    }

    var summaryParts = [
      '先机 ' + fmtPlanNum(xianji) + '%',
      '汇能 ' + fmtPlanNum(huineng) + '%'
    ];
    if (tuanhun > 0) summaryParts.push('团魂 ' + fmtPlanNum(tuanhun) + '%');
    if (nitroInfo) summaryParts.push('氮气 ' + nitroInfo);
    if (devKey) {
      var devSummary = DEVICE_LABEL_MAP[devKey];
      var sDsf = Number(param.dev_sub_first) || 0;
      var sDsl = Number(param.dev_sub_loop) || 0;
      if ((devKey === 'chg' || devKey === 'schg') && (sDsf > 0 || sDsl > 0)) {
        devSummary += '(+' + fmtPlanNum(sDsf) + '%/+' + fmtPlanNum(sDsl) + '%)';
      }
      summaryParts.push(devSummary);
    } else {
      if (counterRange > 0) summaryParts.push('反制 ' + fmtPlanNum(counterRange) + '%');
      if (debuffRange > 0) summaryParts.push('干扰 ' + fmtPlanNum(debuffRange) + '%');
    }
    if (chipsList.length > 0) summaryParts.push('芯片: ' + chipsList.join('+'));
    if (!devKey && extraRows.some(function (r) { return r.k === '赋能'; })) {
      summaryParts.push(extraRows.find(function (r) { return r.k === '赋能'; }).v);
    }
    if (traitParts.length > 0) summaryParts.push(traitParts.join(' · '));
    if (extParts.length > 0) summaryParts.push(extParts.join(' · '));
    if (tweakParts.length > 0) summaryParts.push('微调: ' + tweakParts.join('/'));

    return {
      hlCells: hlCells,
      specCells: specCells,
      extraRows: extraRows,
      isTeamPlan: isTeamPlan,
      summaryText: summaryParts.join(' · ')
    };
  }

  // 统一规范 SVG 线性图标集 (与全站 stroke="currentColor" stroke-width="1.8" 100% 对齐)
  var Icons = {
    chip: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></svg>',
    save: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>',
    undo: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>',
    megaphone: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
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
    check: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>',
    partner: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'
  };

  // 内存状态
  var state = {
    currentCarId: null,
    currentCar: null,
    activeTab: 'all',       // 'all' | 'mine' | 'pro'
    sortMode: 'hot',        // 'hot' | 'latest'
    filterMode: 'all',      // 'all' | 'solo' | 'team'
    fetchSeq: 0,            // 防止快速切车/切换排序时并发响应覆盖新列表
    savedPlans: [],         // 本地存储的方案列表
    proPlans: [],           // 后端过审的国服顶尖方案列表
    remotePlans: [],        // 远程从私有后端 API 拉取的社区方案列表（按页懒加载累加）
    remotePage: 1,
    remotePageSize: 8,
    remoteTotal: 0,
    allCarTotal: 0,
    remoteTotalPages: 1,
    remoteHasMore: false,
    isLoadingMore: false,
    _lazyObserver: null,
    votedMap: {},           // 已点赞方案 ID 持久化映射
    siteMeta: {             // 从后端实时拉取的站点与安全开关元数据
      maintenance_mode: false,
      maintenance_message: '',
      allow_submissions: true,
      allow_pro_applications: true,
      allow_voting: true,
      turnstile_required: true,
      announcement: null
    },
    _annSessionCounted: false,
    _annCheckedVersion: null,
    deviceFp: '',           // 稳定硬件设备指纹（32~64 位小写 hex）
    lastSnapshot: null,     // 用于一键撤销还原的表单快照
    activeAppliedPlanId: null, // 当前已套用的方案 ID (用于高亮正在生效)
    appliedSource: null,    // 记录最近一次套用的方案元信息 { id, title, isOther, buildSig }
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
    extractProfileLink: function (rawInput) {
      var cleaned = String(rawInput || '').replace(/[\x00-\x1F\x7F]/g, '').trim();
      if (!cleaned) return { ok: true, empty: true, url: '', platform: '', label: '', changed: false };
      var rawUrlRegex = /https?:\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[A-Za-z0-9._~:/?#[\]@!$&'()*+,;=%-]*)?/ig;
      var bareStartRegex = /^(?:(?:space|m|www)\.bilibili\.com\/|(?:b23\.tv|bili2233\.cn)\/|(?:v|www|m)\.douyin\.com\/|(?:www\.|m\.)?iesdouyin\.com\/|(?:v|www|live|m|c)\.kuaishou\.com\/)/i;
      var candidates = [];
      var matches = cleaned.match(rawUrlRegex);
      if (matches && matches.length > 0) {
        candidates = matches;
      } else if (bareStartRegex.test(cleaned)) {
        var bare = cleaned.split(/[\s\u3000-\u303F\uFF00-\uFFEF\u4E00-\u9FFF<>"'`\\]/)[0];
        if (bare) candidates.push('https://' + bare);
      }

      for (var i = 0; i < candidates.length; i++) {
        var rawCandidate = String(candidates[i]).replace(/[.,;!?)\]]+$/g, '');
        var u;
        try {
          u = new URL(rawCandidate);
        } catch (e) {
          continue;
        }
        if ((u.protocol !== 'http:' && u.protocol !== 'https:') || u.username || u.password || u.port) {
          continue;
        }
        var host = u.hostname.toLowerCase();
        var path = u.pathname || '/';
        var m;

        // B站
        if (host === 'space.bilibili.com') {
          m = path.match(/^\/(\d{1,20})(?:\/.*)?$/);
          if (m) {
            var u1 = 'https://space.bilibili.com/' + m[1];
            return { ok: true, empty: false, platform: 'bili', label: 'B站主页', url: u1, changed: u1 !== cleaned };
          }
        }
        if (host === 'm.bilibili.com' || host === 'www.bilibili.com') {
          m = path.match(/^\/space\/(\d{1,20})(?:\/.*)?$/);
          if (m) {
            var u2 = 'https://space.bilibili.com/' + m[1];
            return { ok: true, empty: false, platform: 'bili', label: 'B站主页', url: u2, changed: u2 !== cleaned };
          }
        }
        if (host === 'b23.tv' || host === 'bili2233.cn') {
          m = path.match(/^\/([A-Za-z0-9_-]{4,24})\/?$/);
          if (m) {
            var u3 = 'https://' + host + '/' + m[1];
            return { ok: true, empty: false, platform: 'bili', label: 'B站主页', url: u3, changed: u3 !== cleaned };
          }
        }

        // 抖音
        if (host === 'v.douyin.com') {
          m = path.match(/^\/([A-Za-z0-9_-]{4,32})(?:\/.*)?$/);
          if (m) {
            var u4 = 'https://v.douyin.com/' + m[1] + '/';
            return { ok: true, empty: false, platform: 'douyin', label: '抖音主页', url: u4, changed: u4 !== cleaned };
          }
        }
        if (host === 'www.douyin.com' || host === 'm.douyin.com') {
          m = path.match(/^\/user\/([A-Za-z0-9_-]{4,128})(?:\/.*)?$/);
          if (m) {
            var u5 = 'https://www.douyin.com/user/' + m[1];
            return { ok: true, empty: false, platform: 'douyin', label: '抖音主页', url: u5, changed: u5 !== cleaned };
          }
        }
        if (host === 'iesdouyin.com' || host === 'www.iesdouyin.com' || host === 'm.iesdouyin.com') {
          m = path.match(/^\/share\/user\/([A-Za-z0-9_-]{4,128})(?:\/.*)?$/);
          if (m) {
            var secUid = u.searchParams.get('sec_uid') || '';
            var u6 = /^[A-Za-z0-9_-]{8,128}$/.test(secUid)
              ? 'https://www.douyin.com/user/' + secUid
              : 'https://www.iesdouyin.com/share/user/' + m[1];
            return { ok: true, empty: false, platform: 'douyin', label: '抖音主页', url: u6, changed: u6 !== cleaned };
          }
        }

        // 快手
        if (host === 'v.kuaishou.com') {
          m = path.match(/^\/((?:f\/)?[A-Za-z0-9_-]{4,32})(?:\/.*)?$/);
          if (m) {
            var u7 = 'https://v.kuaishou.com/' + m[1];
            return { ok: true, empty: false, platform: 'kuaishou', label: '快手主页', url: u7, changed: u7 !== cleaned };
          }
        }
        if (host === 'www.kuaishou.com' || host === 'live.kuaishou.com' || host === 'm.kuaishou.com') {
          var mp = path.match(/^\/profile\/([A-Za-z0-9_-]{4,64})(?:\/.*)?$/);
          if (mp) {
            var u8 = 'https://www.kuaishou.com/profile/' + mp[1];
            return { ok: true, empty: false, platform: 'kuaishou', label: '快手主页', url: u8, changed: u8 !== cleaned };
          }
          var mu = path.match(/^\/u\/([A-Za-z0-9_-]{4,64})(?:\/.*)?$/);
          if (mu) {
            var u9 = 'https://www.kuaishou.com/u/' + mu[1];
            return { ok: true, empty: false, platform: 'kuaishou', label: '快手主页', url: u9, changed: u9 !== cleaned };
          }
        }
        if (host === 'c.kuaishou.com') {
          var mf = path.match(/^\/fw\/user\/([A-Za-z0-9_-]{4,64})(?:\/.*)?$/);
          if (mf) {
            var u10 = 'https://c.kuaishou.com/fw/user/' + mf[1];
            return { ok: true, empty: false, platform: 'kuaishou', label: '快手主页', url: u10, changed: u10 !== cleaned };
          }
        }
      }

      return { ok: false, empty: false, url: '', platform: '', label: '', changed: false };
    },
    sanitizeUrl: function (url) {
      var res = Utils.extractProfileLink(url);
      if (res && res.ok && !res.empty && res.url && res.url.length <= 200) {
        return res.url;
      }
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
    },
    _collectFpRaw: function () {
      var parts = [];
      try {
        parts.push(navigator.userAgent || '');
        parts.push(navigator.language || '');
        parts.push(Array.isArray(navigator.languages) ? navigator.languages.join(',') : '');
        parts.push(navigator.platform || '');
        parts.push(String(navigator.hardwareConcurrency || 0));
        parts.push(String(navigator.deviceMemory || 0));
        parts.push(String(navigator.maxTouchPoints || 0));
        if (window.screen) {
          parts.push([screen.width, screen.height, screen.colorDepth, screen.pixelDepth, window.devicePixelRatio || 1].join('x'));
        }
        try {
          parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
        } catch (_) {}
        try {
          var canvas = document.createElement('canvas');
          canvas.width = 220;
          canvas.height = 44;
          var ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px sans-serif';
            ctx.fillStyle = '#1e90e8';
            ctx.fillRect(6, 4, 80, 18);
            ctx.fillStyle = '#0f172a';
            ctx.fillText('ARC_FP_v1_' + (navigator.platform || ''), 8, 8);
            parts.push(canvas.toDataURL().slice(-120));
          }
        } catch (_) {}
        try {
          var glCanvas = document.createElement('canvas');
          var gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
          if (gl) {
            var dbg = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbg) {
              parts.push(String(gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) || ''));
              parts.push(String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ''));
            }
          }
        } catch (_) {}
      } catch (_) {}
      return parts.join('|');
    },
    _fnvHex32: function (str) {
      var seeds = [0x811c9dc5, 0x9e3779b9, 0x243f6a88, 0xb7e15162];
      var out = '';
      for (var s = 0; s < seeds.length; s++) {
        var h = seeds[s] >>> 0;
        for (var i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 0x01000193) >>> 0;
        }
        out += ('00000000' + h.toString(16)).slice(-8);
      }
      return out.toLowerCase();
    },
    getDeviceFingerprint: function () {
      if (state.deviceFp && /^[a-f0-9]{16,64}$/i.test(state.deviceFp)) {
        return state.deviceFp;
      }
      try {
        var cached = localStorage.getItem(STORAGE_KEYS.DEVICE_FP);
        if (cached && /^[a-f0-9]{16,64}$/i.test(cached)) {
          state.deviceFp = cached.toLowerCase();
          return state.deviceFp;
        }
      } catch (_) {}
      var raw = Utils._collectFpRaw();
      var fp = Utils._fnvHex32(raw);
      state.deviceFp = fp;
      try { localStorage.setItem(STORAGE_KEYS.DEVICE_FP, fp); } catch (_) {}
      return fp;
    },
    initFingerprintAsync: function () {
      var raw = Utils._collectFpRaw();
      if (window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined') {
        try {
          var buf = new TextEncoder().encode(raw);
          window.crypto.subtle.digest('SHA-256', buf).then(function (hashBuf) {
            var arr = Array.from(new Uint8Array(hashBuf));
            var hex = arr.map(function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
            if (/^[a-f0-9]{64}$/.test(hex)) {
              state.deviceFp = hex;
              try { localStorage.setItem(STORAGE_KEYS.DEVICE_FP, hex); } catch (_) {}
            }
          }).catch(function () {});
        } catch (_) {}
      }
      return Utils.getDeviceFingerprint();
    },
    getApiHeaders: function (includeJson) {
      var h = {
        'X-Client-ID': Utils.getClientId(),
        'X-Device-FP': Utils.getDeviceFingerprint()
      };
      if (includeJson) h['Content-Type'] = 'application/json';
      return h;
    },
    detectPlatform: function (url) {
      var res = Utils.extractProfileLink(url);
      if (res && res.ok && !res.empty) {
        if (res.platform === 'bili') return { label: 'B站主页', cls: 'is-bili' };
        if (res.platform === 'douyin') return { label: '抖音主页', cls: 'is-douyin' };
        if (res.platform === 'kuaishou') return { label: '快手主页', cls: 'is-ks' };
      }
      return { label: '作者主页', cls: '' };
    },
    parseJsonSafe: function (res) {
      return res.text().then(function (txt) {
        var parsed = null;
        if (txt) {
          try { parsed = JSON.parse(txt); } catch (_) { parsed = null; }
        }
        return { ok: res.ok, status: res.status, data: parsed, rawText: txt || '' };
      });
    },
    getDataUrlDecodedBytes: function (dUrl) {
      if (!dUrl || typeof dUrl !== 'string') return 0;
      var idx = dUrl.indexOf(',');
      var b64 = idx >= 0 ? dUrl.slice(idx + 1) : dUrl;
      return Math.floor(b64.length * 0.75);
    },
    computeLocalBuildSig: function (carId, p) {
      var paramObj = p || {};
      var num = function (v, d) {
        var n = Number(v);
        return Number.isFinite(n) ? Number(n.toFixed(4)) : d;
      };
      var emps = Array.isArray(paramObj.emps)
        ? paramObj.emps.slice()
        : (Array.isArray(paramObj.empowers) ? paramObj.empowers.slice() : []);
      emps = emps.map(function (x) { return String(x || '').trim(); }).filter(Boolean).sort();
      var chipsRaw = Array.isArray(paramObj.chips_on)
        ? paramObj.chips_on
        : (Array.isArray(paramObj.chips) ? paramObj.chips : []);
      var chips = chipsRaw.map(function (c) {
        if (!c || typeof c !== 'object') return String(c || '').trim();
        var o = c.opts && typeof c.opts === 'object' ? c.opts : {};
        var optStr = Object.keys(o).sort().map(function (k) { return k + '=' + String(o[k]); }).join(',');
        return String(c.id || c.name || c.type || '') + (optStr ? ':' + optStr : '');
      }).filter(Boolean).sort();
      var calcModeNorm = paramObj.calc_mode === 'team' ? 'team' : 'solo';
      var normDevice = calcModeNorm === 'solo' ? '' : String(paramObj.device || '').trim().toLowerCase();
      var hasChargeDev = normDevice === 'chg' || normDevice === 'schg';
      var canonical = [
        'car=' + String(carId || ''),
        'cm=' + calcModeNorm,
        'ut=' + num(paramObj.ult_threshold, 100),
        'sc=' + num(paramObj.start_charge, 0),
        'bn=' + num(paramObj.base_nitro, 0),
        'nr=' + String(paramObj.nitro_rule || '1x5'),
        'nd=' + num(paramObj.nitro_dur, 0),
        'bud=' + num(paramObj.base_ult_dur, 0),
        'spec=' + (paramObj.is_spec === 0 ? 0 : 1),
        'cr=' + num(paramObj.counter_range, 0),
        'dr=' + num(paramObj.debuff_range, 0),
        'xj=' + num(paramObj.xianji, 0),
        'hn=' + num(paramObj.huineng, 0),
        'mn=' + (paramObj.is_manual_nitro ? 1 : 0),
        'fn=' + num(paramObj.first_nitro_count !== undefined ? paramObj.first_nitro_count : paramObj.start_nitro_count, 1),
        'ln=' + num(paramObj.loop_nitro_count !== undefined ? paramObj.loop_nitro_count : paramObj.cycle_nitro_count, 0),
        'th=' + (calcModeNorm === 'solo' ? 0 : num(paramObj.tuanhun !== undefined ? paramObj.tuanhun : paramObj.team_spirit, 0)),
        'dev=' + normDevice,
        'dsf=' + (calcModeNorm === 'solo' || !hasChargeDev ? 0 : num(paramObj.dev_sub_first, 0)),
        'dsl=' + (calcModeNorm === 'solo' || !hasChargeDev ? 0 : num(paramObj.dev_sub_loop, 0)),
        'jf=' + num(paramObj.jiezou_first, 0),
        'jl=' + num(paramObj.jiezou_loop, 0),
        'qs=' + (paramObj.queyi_self ? 1 : 0),
        'qe=' + (paramObj.queyi_enemy ? 1 : 0),
        'hf=' + num(paramObj.huaxin_first, 0),
        'hl=' + num(paramObj.huaxin_loop, 0),
        'ef=' + num(paramObj.extra_eff, 0),
        'en=' + (paramObj.has_extra_nitro ? num(paramObj.val_extra_nitro, 0) : 0) + ':' + (paramObj.chk_extra_nitro_first ? 1 : 0) + ':' + (paramObj.chk_extra_nitro_loop ? 1 : 0),
        'eu=' + (paramObj.has_extra_ult ? 1 : 0) + ':' + num(paramObj.val_extra_ult_first, 0) + ':' + num(paramObj.val_extra_ult_loop, 0),
        'ep=' + (paramObj.has_extra_per_sec ? num(paramObj.val_extra_per_sec, 0) : 0) + ':' + (paramObj.chk_extra_per_sec_first ? 1 : 0) + ':' + (paramObj.chk_extra_per_sec_loop ? 1 : 0),
        'ct=' + num(paramObj.val_custom_trig, 0) + ':' + num(paramObj.custom_trig_first, 0) + ':' + num(paramObj.custom_trig_loop, 0),
        'emps=' + emps.join(','),
        'chips=' + chips.join(',')
      ].join('|');
      return Utils._fnvHex32(canonical);
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
      var checkedRadio = document.querySelector('input[name="nitroRadio"]:checked') || document.querySelector('input[name="nitro_radio"]:checked');
      var nr = checkedRadio ? checkedRadio.value : '1x5';
      var nd = ParamsIO.getVal('time_' + nr, 0);

      var emps = Array.from(document.querySelectorAll('.empower-checkbox:checked')).map(function (cb) {
        return cb.value;
      });

      var chipsOn = [];
      if (window._chipsOn && Array.isArray(window._chipsOn)) {
        chipsOn = window._chipsOn.map(function (c) {
          if (!c || typeof c !== 'object') return c;
          return {
            id: c.id,
            opts: c.opts ? Object.assign({}, c.opts) : {}
          };
        });
      }

      var curMode = (typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo');
      var isTeamMode = (curMode === 'team');
      var capturedDev = (isTeamMode && typeof window.getDevice === 'function') ? String(window.getDevice() || '') : '';
      var hasChargeDevice = isTeamMode && (capturedDev === 'chg' || capturedDev === 'schg');

      return {
        schema_version: 2,
        calc_mode: isTeamMode ? 'team' : 'solo',
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
        device: capturedDev,
        dev_sub_first: hasChargeDevice ? ParamsIO.getVal('dev_sub_first', 0) : 0,
        dev_sub_loop: hasChargeDevice ? ParamsIO.getVal('dev_sub_loop', 0) : 0,
        tuanhun: isTeamMode ? ParamsIO.getVal('inputTuanhun', 0) : 0,
        chips_on: chipsOn
      };
    },

    apply: function (p) {
      if (!p) return;

      var prevRestoring = window.isRestoringConfig;
      window.isRestoringConfig = true;
      try {
        var curCalcMode = (typeof window.getCalcMode === 'function')
          ? window.getCalcMode()
          : (document.body.getAttribute('data-calc-mode') || 'solo');
        var targetDevice = (curCalcMode === 'team' && p.device && p.device !== '0') ? String(p.device) : '';
        // 必须先还原增益装置状态以解除旧装置的禁用锁与历史快照，避免覆盖新方案的反制与赋能参数
        if (typeof window.setDevice === 'function') {
          window.setDevice(targetDevice, true);
        }
        ParamsIO.setVal('dev_sub_first', (targetDevice === 'chg' || targetDevice === 'schg') && p.dev_sub_first !== undefined ? p.dev_sub_first : 0);
        ParamsIO.setVal('dev_sub_loop', (targetDevice === 'chg' || targetDevice === 'schg') && p.dev_sub_loop !== undefined ? p.dev_sub_loop : 0);

        ParamsIO.setVal('ultThreshold', p.ult_threshold);
        ParamsIO.setVal('startCharge', p.start_charge);
        ParamsIO.setVal('baseNitro', p.base_nitro);
        ParamsIO.setVal('baseUltDuration', p.base_ult_dur);
        ParamsIO.setChk('isSpec', p.is_spec !== undefined ? p.is_spec : 1);
        var targetCounter = p.counter_range !== undefined ? p.counter_range : 0;
        var targetDebuff = p.debuff_range !== undefined ? p.debuff_range : 0;
        if (typeof window.setEnvSliders === 'function') {
          window.setEnvSliders(targetCounter, targetDebuff);
        } else {
          ParamsIO.setVal('counterRange', targetCounter);
          var cv = document.getElementById('counterValue');
          if (cv) cv.innerText = targetCounter + '%';
          ParamsIO.setVal('debuffRange', targetDebuff);
          var dv = document.getElementById('debuffValue');
          if (dv) dv.innerText = targetDebuff + '%';
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

        ParamsIO.setVal('jiezou_sub_first', p.jiezou_first !== undefined ? p.jiezou_first : 0);
        ParamsIO.setVal('jiezou_sub_loop', p.jiezou_loop !== undefined ? p.jiezou_loop : 0);
        ParamsIO.setChk('queyi_sub_self', p.queyi_self !== undefined ? p.queyi_self : 0);
        ParamsIO.setChk('queyi_sub_enemy', p.queyi_enemy !== undefined ? p.queyi_enemy : 0);
        ParamsIO.setVal('huaxin_sub_first', p.huaxin_first !== undefined ? p.huaxin_first : 0);
        ParamsIO.setVal('huaxin_sub_loop', p.huaxin_loop !== undefined ? p.huaxin_loop : 0);

        ParamsIO.setChk('hasExtraNitro', p.has_extra_nitro !== undefined ? p.has_extra_nitro : 0);
        ParamsIO.setVal('valExtraNitro', p.val_extra_nitro !== undefined ? p.val_extra_nitro : 0);
        ParamsIO.setChk('chkExtraNitroFirst', p.chk_extra_nitro_first !== undefined ? p.chk_extra_nitro_first : 1);
        ParamsIO.setChk('chkExtraNitroLoop', p.chk_extra_nitro_loop !== undefined ? p.chk_extra_nitro_loop : 1);

        ParamsIO.setChk('hasExtraUlt', p.has_extra_ult !== undefined ? p.has_extra_ult : 0);
        ParamsIO.setVal('valExtraUltFirst', p.val_extra_ult_first !== undefined ? p.val_extra_ult_first : 0);
        ParamsIO.setVal('valExtraUltLoop', p.val_extra_ult_loop !== undefined ? p.val_extra_ult_loop : 0);

        ParamsIO.setChk('hasExtraPerSec', p.has_extra_per_sec !== undefined ? p.has_extra_per_sec : 0);
        ParamsIO.setVal('valExtraPerSec', p.val_extra_per_sec !== undefined ? p.val_extra_per_sec : 0);
        ParamsIO.setChk('chkExtraPerSecFirst', p.chk_extra_per_sec_first !== undefined ? p.chk_extra_per_sec_first : 1);
        ParamsIO.setChk('chkExtraPerSecLoop', p.chk_extra_per_sec_loop !== undefined ? p.chk_extra_per_sec_loop : 1);

        ParamsIO.setVal('valCustomTrig', p.val_custom_trig !== undefined ? p.val_custom_trig : 0);
        ParamsIO.setVal('customTrigFirstCount', p.custom_trig_first !== undefined ? p.custom_trig_first : 0);
        ParamsIO.setVal('customTrigLoopCount', p.custom_trig_loop !== undefined ? p.custom_trig_loop : 0);

        if (typeof window.toggleExtraUI === 'function') window.toggleExtraUI();

        ParamsIO.setVal('extraEfficiency', p.extra_eff !== undefined ? p.extra_eff : 0);
        var firstNitro = p.first_nitro_count !== undefined ? p.first_nitro_count : p.start_nitro_count;
        ParamsIO.setVal('inputFirstNitroCount', firstNitro !== undefined ? firstNitro : 1);
        ParamsIO.setVal('inputXianji', p.xianji !== undefined ? p.xianji : 0);
        ParamsIO.setVal('inputHuineng', p.huineng !== undefined ? p.huineng : 0);
        var tuanhunVal = p.tuanhun !== undefined ? p.tuanhun : p.team_spirit;
        ParamsIO.setVal('inputTuanhun', tuanhunVal !== undefined ? tuanhunVal : 0);

        // 团魂获能模式下套用方案时锁住三项输入值，防止紧接着 calculate() 自动反算覆盖方案原数值
        if (curCalcMode === 'team' && window._tm && window._tm.lock) {
          window._tm.lock = { soul: true, xianji: true, huineng: true };
          window._tm.res = null;
          if (typeof window._tmRender === 'function') window._tmRender();
        }

        var loopNitro = p.loop_nitro_count !== undefined ? p.loop_nitro_count : p.cycle_nitro_count;
        if (p.is_manual_nitro !== undefined || loopNitro !== undefined) {
          window.isManualNitroCount = p.is_manual_nitro !== undefined ? !!p.is_manual_nitro : true;
          ParamsIO.setVal('inputNitroCount', loopNitro !== undefined ? loopNitro : 0);
        } else {
          window.isManualNitroCount = false;
        }
        if (typeof window.updateNitroCountUI === 'function') window.updateNitroCountUI();

        var chipsList = Array.isArray(p.chips_on) ? p.chips_on : (Array.isArray(p.chips) ? p.chips : []);
        var normChips = chipsList.map(function (c) {
          if (typeof c === 'string') return { id: c, opts: { loopMode: 'peak' } };
          if (c && typeof c === 'object') {
            return {
              id: c.id || c.type || c.name || '',
              opts: c.opts && typeof c.opts === 'object' ? Object.assign({}, c.opts) : {}
            };
          }
          return null;
        }).filter(function (c) { return c && c.id; });
        if (typeof window.chipRestore === 'function') {
          var serialized = normChips.length ? normChips.map(function (inst) {
            var o = Object.keys(inst.opts || {}).map(function (k) { return k + '=' + inst.opts[k]; }).join(',');
            return inst.id + (o ? '.' + o : '');
          }).join('-') : '0';
          window.chipRestore(serialized);
        } else if (typeof window.renderChips === 'function') {
          window._chipsOn = normChips;
          window.renderChips(true);
        }
      } finally {
        window.isRestoringConfig = prevRestoring;
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
    clear: function () {
      if (state.draftTimer) {
        clearTimeout(state.draftTimer);
        state.draftTimer = null;
      }
      try {
        localStorage.removeItem(STORAGE_KEYS.DRAFT);
      } catch (e) {}
    },
    scheduleSave: function () {
      if (!Draft.isEnabled() || state._isRestoringDraft || window.isRestoringConfig) return;
      if (state.draftTimer) clearTimeout(state.draftTimer);
      state.draftTimer = setTimeout(function () {
        Draft.save();
      }, 500); // 防抖缩短至 500ms，保证手速快的用户刷新前迅速落盘
    },
    save: function () {
      if (!Draft.isEnabled() || state._isRestoringDraft || window.isRestoringConfig) return;
      var curCarId = state.currentCarId || (window._selectedCar ? window._selectedCar.id : null);
      if (!curCarId || curCarId === -1) {
        Draft.clear();
        return;
      }
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
        var prevRestoring = window.isRestoringConfig;
        state._isRestoringDraft = true;
        window.isRestoringConfig = true;
        try {
          if (typeof window.setCalcMode === 'function' && draft.params.calc_mode && (draft.params.calc_mode === 'solo' || draft.params.calc_mode === 'team')) {
            window.setCalcMode(draft.params.calc_mode, true, true);
          }
          if (typeof window.pickCar === 'function') {
            window.pickCar(draft.car_id);
          }
          ParamsIO.apply(draft.params);
        } finally {
          window.isRestoringConfig = prevRestoring;
          state._isRestoringDraft = false;
        }
        if (typeof window.calculate === 'function') {
          window.calculate();
        }
        if (typeof window.__pvRefreshCollapse === 'function') {
          window.__pvRefreshCollapse(false);
        }
        CommunityPlans.toast('已自动恢复上次未保存的草稿');
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
      if (/^(.)\1{3,}\d*$/.test(t)) {
        return { valid: false, message: '【方案名称不合规】方案名称不能为纯连续重复字符 (如 aaaaa / aaaa1)，请输入有意义的方案名' };
      }
      if (/代练|代打|接单|出号|收号|加[vV微]|加[qQ扣]|微信|v信|威信|微信号|wx|vx|扣扣|qq群|企鹅群|私聊|有偿|包上分|上分车队|包赢|包国标|接单群|咸鱼|闲鱼|转转|拼多多|taobao|tb\.cn/i.test(t)) {
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

  // 不再硬编码假国服方案，所有国服顶尖方案一律来自后端真实审核池
  var DefaultProPlans = [];

  // 核心对外模块
  var CommunityPlans = {
    init: function () {
      state.savedPlans = Utils.getStorage(STORAGE_KEYS.PLANS, []);
      state.votedMap = Utils.getStorage(STORAGE_KEYS.VOTES, {}) || {};
      state.proPlans = [];
      Utils.initFingerprintAsync();

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

      // 页面初始化时主动拉取站点公告与运营配置（不依赖是否已选车），并静默核验本地待审方案真实状态
      CommunityPlans.fetchSiteConfig();
      CommunityPlans.syncPendingPlanStatuses({ force: true });

      if (!window.__cpStatusSyncBound) {
        window.__cpStatusSyncBound = true;
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) {
            CommunityPlans.syncPendingPlanStatuses();
          }
        });
        window.addEventListener('focus', function () {
          CommunityPlans.syncPendingPlanStatuses();
        });
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

    // 切换折叠状态 (与全站 v4.js __pvMorph 规范 100% 同步：记录目标态避免重复触发，仅在收起终态才隐藏节点)
    toggleCollapse: function (forceState, instant) {
      var container = document.getElementById('communityPlansContainer');
      if (!container) return;
      var card = container.querySelector('.cp-plans-card') || container;
      var curShut = card.__pvA ? Boolean(card.__pvWant) : card.classList.contains('pv-collapsed');
      var shouldShut = (typeof forceState === 'boolean') ? forceState : !curShut;
      if (curShut === shouldShut && card.classList.contains('pv-shut') === shouldShut && !instant) {
        return;
      }
      card.__pvWant = shouldShut;
      card.classList.toggle('pv-shut', shouldShut);
      if (container !== card) container.classList.toggle('pv-shut', shouldShut);

      if (instant || typeof window.__pvMorph !== 'function') {
        if (card.__pvA) { card.__pvA.cancel(); card.__pvA = null; }
        if (card.__pvK) { card.__pvK.forEach(function (k) { k.cancel(); }); card.__pvK = null; }
        card.style.overflow = '';
        container.classList.toggle('pv-collapsed', shouldShut);
        card.classList.toggle('pv-collapsed', shouldShut);
        if (!shouldShut) {
          CommunityPlans._syncControlsBar(undefined, false);
        }
        return;
      }

      var kids = [].filter.call(card.children, function (k) {
        return !k.classList.contains('cp-card-title');
      });

      if (shouldShut) {
        window.__pvMorph(card, false, ['height'], kids, function () {
          card.classList.add('pv-collapsed');
          var h = card.getBoundingClientRect().height;
          card.classList.remove('pv-collapsed');
          return { height: h };
        }, function () {
          card.classList.add('pv-collapsed');
          if (container !== card) container.classList.add('pv-collapsed');
        });
      } else {
        window.__pvMorph(card, true, ['height'], kids, function () {
          card.classList.remove('pv-collapsed');
          if (container !== card) container.classList.remove('pv-collapsed');
          CommunityPlans._syncControlsBar(undefined, false);
          return { height: card.getBoundingClientRect().height };
        }, null);
      }
    },

    scheduleDraftSave: function () {
      Draft.scheduleSave();
    },

    // 赛车变更联动
    onCarChanged: function (carOrId) {
      var prevCarId = state.currentCarId;
      if (!carOrId) {
        state.currentCarId = null;
        state.currentCar = null;
        state.remotePlans = [];
        state.remotePage = 1;
        state.remoteTotal = 0;
        state.allCarTotal = 0;
        state.remoteTotalPages = 1;
        state.remoteHasMore = false;
        state.isLoadingMore = false;
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
      if (prevCarId !== state.currentCarId) {
        state.remotePlans = [];
        state.remotePage = 1;
        state.remoteTotal = 0;
        state.allCarTotal = 0;
        state.remoteTotalPages = 1;
        state.remoteHasMore = false;
        state.isLoadingMore = false;
      }
      if (prevCarId !== state.currentCarId && !state._isRestoringDraft && !window.isRestoringConfig) {
        state.lastSnapshot = null;
        state.hasUndoAvailable = false;
        state.activeAppliedPlanId = null;
        state.appliedSource = null;
        var undoBtn = document.getElementById('cpBtnUndo');
        if (undoBtn) undoBtn.style.display = 'none';
      }
      if (state.currentCarId && state.currentCarId !== -1) {
        CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false });
        CommunityPlans.syncPendingPlanStatuses();
        // 切车后立即覆盖更新新车的洁净草稿，避免旧车改动残留并在未满防抖期刷新时复现
        if (!state._isRestoringDraft && !window.isRestoringConfig) {
          Draft.save();
        }
      } else if (!state._isRestoringDraft && !window.isRestoringConfig) {
        Draft.clear();
      }
      CommunityPlans.renderPlans();
    },

    _normalizeRemoteItem: function (rp) {
      var localUpdated = false;
      var votesUpdated = false;
      var matchedLocal = state.savedPlans.find(function (lp) {
        return lp.remote_id && lp.remote_id === rp.id;
      });
      if (matchedLocal) {
        if (matchedLocal.remote_status !== 'approved') {
          matchedLocal.remote_status = 'approved';
          localUpdated = true;
        }
        if (rp.is_pro && !matchedLocal.isPro) {
          matchedLocal.isPro = true;
          localUpdated = true;
        }
        if (rp.is_partner && !matchedLocal.isPartner) {
          matchedLocal.isPartner = true;
          localUpdated = true;
        }
        if (typeof rp.votes === 'number' && matchedLocal.votes !== rp.votes) {
          matchedLocal.votes = rp.votes;
          localUpdated = true;
        }
      }
      if (typeof rp.viewer_has_voted === 'boolean') {
        rp.isVoted = rp.viewer_has_voted;
        if (rp.viewer_has_voted) {
          if (!state.votedMap[rp.id]) {
            state.votedMap[rp.id] = 1;
            votesUpdated = true;
          }
        } else if (state.votedMap[rp.id]) {
          delete state.votedMap[rp.id];
          votesUpdated = true;
        }
      } else {
        rp.isVoted = Boolean(state.votedMap[rp.id]);
      }
      rp.viewer_is_author = Boolean(rp.viewer_is_author || matchedLocal);
      return { item: rp, localUpdated: localUpdated, votesUpdated: votesUpdated };
    },

    _updateLazyFooterDom: function () {
      var footer = document.getElementById('cpLazySentinel');
      if (!footer) return;
      var statusEl = footer.querySelector('.cp-lazy-status');
      var btnEl = footer.querySelector('.cp-lazy-btn');
      if (statusEl && state.isLoadingMore) {
        statusEl.textContent = '正在懒加载更多方案 (' + state.remotePlans.length + ' / ' + Math.max(state.remoteTotal, state.remotePlans.length) + ')...';
      }
      if (btnEl) {
        btnEl.disabled = state.isLoadingMore;
        btnEl.textContent = state.isLoadingMore ? '加载中...' : '加载更多';
      }
    },

    bindLazyScroll: function () {
      if (state._lazyObserver) {
        try { state._lazyObserver.disconnect(); } catch (_) {}
        state._lazyObserver = null;
      }
      var vp = document.getElementById('cpScrollViewport');
      var sentinel = document.getElementById('cpLazySentinel');
      if (!vp) return;

      var maybeLoadMore = function () {
        if (!state.remoteHasMore || state.isLoadingMore || state.isFetchingRemote) return;
        CommunityPlans.loadMoreRemotePlans();
      };

      vp.addEventListener('scroll', function () {
        if (!state.remoteHasMore || state.isLoadingMore || state.isFetchingRemote) return;
        if (vp.scrollTop + vp.clientHeight >= vp.scrollHeight - 90) {
          maybeLoadMore();
        }
      }, { passive: true });

      if (sentinel && state.remoteHasMore && typeof IntersectionObserver === 'function') {
        try {
          state._lazyObserver = new IntersectionObserver(function (entries) {
            for (var i = 0; i < entries.length; i += 1) {
              if (entries[i].isIntersecting) {
                maybeLoadMore();
                break;
              }
            }
          }, { root: vp, rootMargin: '90px 0px', threshold: 0.01 });
          state._lazyObserver.observe(sentinel);
        } catch (_) {}
      }
    },

    loadMoreRemotePlans: function () {
      if (!state.currentCarId || state.currentCarId === -1) return;
      if (!state.remoteHasMore || state.isLoadingMore || state.isFetchingRemote) return;
      CommunityPlans.fetchRemotePlans(state.currentCarId, {
        page: (state.remotePage || 1) + 1,
        append: true,
        preserveScroll: true
      });
    },

    // 异步从私有后端 Serverless 拉取社区已审核方案（支持分批懒加载）
    fetchRemotePlans: function (carId, opts) {
      if (!carId || carId === -1) return;
      var options = opts || {};
      var targetPage = Math.max(1, parseInt(options.page, 10) || 1);
      var append = Boolean(options.append);
      var preserveScroll = Boolean(options.preserveScroll || append);
      var reqSeq;

      if (append) {
        if (state.isLoadingMore || !state.remoteHasMore) return;
        reqSeq = state.fetchSeq;
        state.isLoadingMore = true;
        CommunityPlans._updateLazyFooterDom();
      } else {
        state.fetchSeq = (state.fetchSeq || 0) + 1;
        reqSeq = state.fetchSeq;
        state.isFetchingRemote = true;
        state.isLoadingMore = false;
      }

      var sortParam = state.sortMode || 'hot';
      var calcModeParam = state.filterMode || 'all';
      var pageSize = state.remotePageSize || 8;
      var url = '/api/plans?car_id=' + encodeURIComponent(carId) +
        '&sort_by=' + encodeURIComponent(sortParam) +
        '&calc_mode=' + encodeURIComponent(calcModeParam) +
        '&page=' + encodeURIComponent(targetPage) +
        '&limit=' + encodeURIComponent(pageSize);

      fetch(url, {
        method: 'GET',
        headers: Utils.getApiHeaders(false)
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!resObj.ok || !resObj.data) throw new Error('HTTP ' + resObj.status);
          var json = resObj.data;
          if (reqSeq !== state.fetchSeq || String(carId) !== String(state.currentCarId)) return;
          if (json && json.site_meta && typeof json.site_meta === 'object') {
            state.siteMeta = Object.assign({}, state.siteMeta, json.site_meta);
            CommunityPlans.maybeHandleAnnouncement(false);
          }
          if (json && json.success && json.data && Array.isArray(json.data.items)) {
            var anyLocalUpdated = false;
            var anyVotesUpdated = false;
            var normalized = json.data.items.map(function (rp) {
              var out = CommunityPlans._normalizeRemoteItem(rp);
              if (out.localUpdated) anyLocalUpdated = true;
              if (out.votesUpdated) anyVotesUpdated = true;
              return out.item;
            });

            if (append) {
              var existingMap = {};
              state.remotePlans.forEach(function (ep) { existingMap[ep.id] = true; });
              normalized.forEach(function (np) {
                if (!existingMap[np.id]) {
                  state.remotePlans.push(np);
                  existingMap[np.id] = true;
                }
              });
            } else {
              state.remotePlans = normalized;
            }

            state.remotePage = Number(json.data.page) || targetPage;
            state.remoteTotal = Math.max(state.remotePlans.length, Number(json.data.total) || 0);
            if (calcModeParam === 'all') {
              state.allCarTotal = Math.max(state.allCarTotal, state.remoteTotal);
            }
            state.remoteTotalPages = Math.max(1, Number(json.data.total_pages) || Math.ceil(state.remoteTotal / pageSize) || 1);
            state.remoteHasMore = typeof json.data.has_more === 'boolean'
              ? json.data.has_more
              : (state.remotePage * pageSize < state.remoteTotal);

            if (anyLocalUpdated) {
              Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
            }
            if (anyVotesUpdated) {
              Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
            }
            if (append) state.isLoadingMore = false;
            else state.isFetchingRemote = false;
            CommunityPlans.renderPlans({ preserveScroll: preserveScroll });
          }
        })
        .catch(function (err) {
          if (reqSeq !== state.fetchSeq) return;
          if (append) state.isLoadingMore = false;
          else state.isFetchingRemote = false;
          // 离线或服务暂时未连通时静默降级，继续展示本地与已缓存方案
          console.log('[CommunityPlans] 社区方案拉取降级:', err.message);
          CommunityPlans.renderPlans({ preserveScroll: preserveScroll });
        })
        .finally(function () {
          if (reqSeq === state.fetchSeq) {
            if (append) state.isLoadingMore = false;
            else state.isFetchingRemote = false;
          }
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
        '    <span id="cpCurrentCarBadge" class="cp-car-badge"><span class="zh">未选赛车</span><span class="lang-en">No Car Selected</span></span>',
        '  </div>',
        '  <div class="cp-actions-bar" onclick="event.stopPropagation()">',
        '    <button type="button" id="cpBtnUndo" class="nav-btn cp-btn cp-btn-undo" style="display:none;" onclick="CommunityPlans.undoApply()">',
        '      ' + Icons.undo + '<span class="zh">撤销套用</span><span class="lang-en">Undo</span>',
        '    </button>',
        '    <button type="button" class="nav-btn cp-btn cp-btn-save" onclick="CommunityPlans.openSaveModal()">',
        '      ' + Icons.save + '<span class="zh">保存当前配装</span><span class="lang-en">Save Setup</span>',
        '    </button>',
        '  </div>',
        '  <button type="button" class="nav-btn select-btn cp-icon-btn cp-fold-btn" onclick="event.stopPropagation(); CommunityPlans.toggleCollapse()" title="折叠/展开方案库">',
        '    <span class="cp-fold-indicator" aria-hidden="true">' + Icons.chevron + '</span>',
        '  </button>',
        '</div>',
        '<div id="cpFixedHeader" class="cp-fixed-header">',
        '  <div id="cpBannerSlot" style="display:none;"></div>',
        '  <div id="cpControlsBarSlot" class="cp-controls-bar" style="display:none;">',
        '    <div class="cp-ctrl-group">',
        '      <span class="cp-controls-hint">模式筛选</span>',
        '      <div id="cpFilterSeg" class="cp-seg-track" role="radiogroup" aria-label="方案模式筛选">',
        '        <span class="cp-seg-thumb" aria-hidden="true"></span>',
        '        <button type="button" class="cp-seg-btn is-on" data-val="all" onclick="CommunityPlans.setFilterMode(\'all\')">全部</button>',
        '        <button type="button" class="cp-seg-btn" data-val="solo" onclick="CommunityPlans.setFilterMode(\'solo\')">先机汇能</button>',
        '        <button type="button" class="cp-seg-btn" data-val="team" onclick="CommunityPlans.setFilterMode(\'team\')">团魂获能</button>',
        '      </div>',
        '    </div>',
        '    <div class="cp-ctrl-group">',
        '      <span class="cp-controls-hint">排序</span>',
        '      <div id="cpSortSeg" class="cp-seg-track" role="radiogroup" aria-label="方案排序">',
        '        <span class="cp-seg-thumb" aria-hidden="true"></span>',
        '        <button type="button" class="cp-seg-btn is-on" data-val="hot" onclick="CommunityPlans.setSortMode(\'hot\')">最热</button>',
        '        <button type="button" class="cp-seg-btn" data-val="latest" onclick="CommunityPlans.setSortMode(\'latest\')">最新</button>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</div>',
        '<div id="cpSectionsStream" class="cp-sections-stream"></div>'
      ].join('');

      if (!window.__cpResizeSegBound) {
        window.__cpResizeSegBound = true;
        window.addEventListener('resize', function () {
          CommunityPlans._syncControlsBar(undefined, false);
        });
      }
    },

    _syncSegThumb: function (trackId, activeVal, animate) {
      var track = document.getElementById(trackId);
      if (!track) return;
      var thumb = track.querySelector('.cp-seg-thumb');
      var btns = track.querySelectorAll('.cp-seg-btn');
      var activeBtn = null;
      for (var i = 0; i < btns.length; i += 1) {
        var isMatch = btns[i].getAttribute('data-val') === activeVal;
        btns[i].classList.toggle('is-on', isMatch);
        btns[i].setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        if (isMatch) activeBtn = btns[i];
      }
      if (!thumb || !activeBtn || track.offsetWidth === 0 || activeBtn.offsetWidth === 0) return;

      var wasReady = thumb.classList.contains('is-ready');
      var useAnim = Boolean(animate && wasReady);
      if (!useAnim) {
        thumb.classList.add('no-anim');
      } else {
        thumb.classList.remove('no-anim');
      }

      thumb.style.width = activeBtn.offsetWidth + 'px';
      thumb.style.height = activeBtn.offsetHeight + 'px';
      thumb.style.transform = 'translate3d(' + activeBtn.offsetLeft + 'px, ' + activeBtn.offsetTop + 'px, 0)';
      thumb.classList.add('is-ready');

      if (!useAnim) {
        void thumb.offsetWidth;
        requestAnimationFrame(function () {
          thumb.classList.remove('no-anim');
        });
      }
    },

    _syncControlsBar: function (showControls, animate) {
      var bar = document.getElementById('cpControlsBarSlot');
      if (!bar) return;
      if (typeof showControls === 'boolean') {
        var wasVisible = bar.style.display !== 'none';
        bar.style.display = showControls ? '' : 'none';
        if (!showControls) return;
        if (!wasVisible) animate = false;
      } else if (bar.style.display === 'none') {
        return;
      }
      CommunityPlans._syncSegThumb('cpFilterSeg', state.filterMode || 'all', animate);
      CommunityPlans._syncSegThumb('cpSortSeg', state.sortMode || 'hot', animate);
    },

    // 切换列表排序（最热 / 最新）
    setSortMode: function (mode) {
      var nextMode = mode === 'latest' ? 'latest' : 'hot';
      if (state.sortMode === nextMode) return;
      state.sortMode = nextMode;
      CommunityPlans._syncControlsBar(true, true);
      state.remotePlans = [];
      state.remotePage = 1;
      state.remoteTotal = 0;
      state.remoteTotalPages = 1;
      state.remoteHasMore = false;
      state.isLoadingMore = false;
      if (state.currentCarId && state.currentCarId !== -1) {
        CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false });
      }
      CommunityPlans.renderPlans();
    },

    // 切换模式筛选（全部 / 先机汇能 / 团魂获能）
    setFilterMode: function (mode) {
      var nextMode = (mode === 'solo' || mode === 'team') ? mode : 'all';
      if (state.filterMode === nextMode) return;
      state.filterMode = nextMode;
      CommunityPlans._syncControlsBar(true, true);
      state.remotePlans = [];
      state.remotePage = 1;
      state.remoteTotal = 0;
      state.remoteTotalPages = 1;
      state.remoteHasMore = false;
      state.isLoadingMore = false;
      if (state.currentCarId && state.currentCarId !== -1) {
        CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false });
      }
      CommunityPlans.renderPlans();
    },

    // 渲染方案卡片列表 (固定高度滚动窗口 + 懒加载追加)
    renderPlans: function (opts) {
      var renderOpts = opts || {};
      var prevViewport = document.getElementById('cpScrollViewport');
      var savedScrollTop = (renderOpts.preserveScroll && prevViewport) ? prevViewport.scrollTop : 0;

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

      // 2. 未选赛车状态 -> 隐藏控制栏并自动折叠
      if (!state.currentCarId || state.currentCarId === -1) {
        var bannerSlotEmpty = document.getElementById('cpBannerSlot');
        if (bannerSlotEmpty) {
          bannerSlotEmpty.style.display = 'none';
          bannerSlotEmpty.innerHTML = '';
        }
        CommunityPlans._syncControlsBar(false, false);
        if (badge) {
          badge.innerHTML = '<span class="zh">未选赛车 · 点击展开</span><span class="lang-en">No Car Selected</span>';
        }
        stream.innerHTML = [
          '<div class="cp-empty-box">',
          '  ' + Icons.emptyCar,
          '  <div class="cp-empty-title"><span class="zh">请先在上方选择一辆赛车</span><span class="lang-en">Select a Car Above</span></div>',
          '  <div class="cp-empty-desc"><span class="zh">选好赛车后，这里将直接为您垂直呈现本地方案、国服精选与社区推荐</span><span class="lang-en">Select a car to view setups</span></div>',
          '</div>'
        ].join('');
        CommunityPlans.toggleCollapse(true, !container.__cpRenderedOnce);
        container.__cpRenderedOnce = true;
        return;
      }

      // 3. 收集各分类数据（严格分级：1. 友站分享 -> 2. 国服顶尖 -> 3. 玩家上传 -> 4. 本机未云端收录方案）
      var curIdStr = String(state.currentCarId);
      var remotePartnerList = state.remotePlans.filter(function (p) {
        return String(p.car_id) === curIdStr && Boolean(p.is_partner || p.isPartner);
      });
      var baseProList = state.proPlans.filter(function (p) {
        return String(p.car_id) === curIdStr;
      });
      var remoteProList = state.remotePlans.filter(function (p) {
        if (String(p.car_id) !== curIdStr) return false;
        if (p.is_partner || p.isPartner) return false;
        if (!p.is_pro && !p.isPro) return false;
        if (baseProList.some(function (bp) { return bp.id === p.id || bp.title === p.title; })) return false;
        return true;
      });
      var partnerList = remotePartnerList;
      var proList = baseProList.concat(remoteProList);
      var remoteList = state.remotePlans.filter(function (p) {
        if (String(p.car_id) !== curIdStr) return false;
        if (p.is_partner || p.isPartner) return false;
        if (p.is_pro || p.isPro) return false;
        if (proList.some(function (pr) { return pr.id === p.id; })) return false;
        return true;
      });
      var isShownInRemote = function (lp) {
        if (!lp || !lp.remote_id) return false;
        return state.remotePlans.some(function (rp) {
          return String(rp.car_id) === curIdStr && rp.id === lp.remote_id;
        });
      };
      var localList = state.savedPlans.filter(function (p) {
        return String(p.car_id) === curIdStr && !isShownInRemote(p);
      });

      var loadedRemoteCount = partnerList.length + remoteProList.length + remoteList.length;
      var totalPlans = Math.max(loadedRemoteCount, state.remoteTotal || 0) + baseProList.length + localList.length;
      if (state.filterMode === 'all') {
        state.allCarTotal = Math.max(state.allCarTotal, totalPlans);
      }

      // 4. 更新标题栏徽标与折叠状态联动 (仅在「全部」模式下确认为 0 方案时才自动折叠；筛选其他模式时始终保留控制栏不折叠)
      var isCarTrulyEmpty = (totalPlans === 0 && !state.isFetchingRemote && state.filterMode === 'all' && state.allCarTotal === 0);
      if (isCarTrulyEmpty) {
        var bannerSlotNone = document.getElementById('cpBannerSlot');
        if (bannerSlotNone) {
          bannerSlotNone.style.display = 'none';
          bannerSlotNone.innerHTML = '';
        }
        CommunityPlans._syncControlsBar(false, false);
        if (badge) {
          badge.innerHTML = '<span class="zh">' + Utils.escapeHtml(carName) + ' · 暂无方案 (点击展开)</span><span class="lang-en">No Setups (Click to expand)</span>';
        }
        stream.innerHTML = [
          '<div class="cp-empty-box">',
          '  ' + Icons.emptyBox,
          '  <div class="cp-empty-title"><span class="zh">该赛车暂无任何芯片配装</span><span class="lang-en">No Setups Found</span></div>',
          '  <div class="cp-empty-desc"><span class="zh">在上方配好先机、汇能与芯片参数后，点击右上角【保存当前配装】即可收藏您的专属方案！</span><span class="lang-en">Tune your chips and click Save Setup to create one!</span></div>',
          '  <button type="button" class="nav-btn cp-btn cp-btn-save" onclick="CommunityPlans.openSaveModal()">' + Icons.save + '<span class="zh">立即保存当前配装</span><span class="lang-en">Save Setup Now</span></button>',
          '</div>'
        ].join('');
        CommunityPlans.toggleCollapse(true, !container.__cpRenderedOnce);
        container.__cpRenderedOnce = true;
        return;
      }

      // 有方案、正在加载或正在筛选模式时更新标题徽标
      if (badge) {
        var knownTotal = Math.max(totalPlans, state.allCarTotal || 0);
        badge.innerHTML = state.isFetchingRemote && totalPlans === 0
          ? '<span class="zh">' + Utils.escapeHtml(carName) + ' · 加载中...</span><span class="lang-en">Loading...</span>'
          : '<span class="zh">' + Utils.escapeHtml(carName) + ' (' + knownTotal + ' 方案)</span><span class="lang-en">' + Utils.escapeHtml(carName) + '</span>';
      }

      // 5. 模式筛选与智能置底排序（当前模式可用的方案排前，不可用灰态方案沉底；桶内按最热/最新降序）
      var filterByPlanMode = function (list) {
        if (state.filterMode === 'all') return list;
        return list.filter(function (item) {
          return resolvePlanMode(item.params) === state.filterMode;
        });
      };
      var sortByCompatAndMetric = function (list) {
        return list.slice().sort(function (a, b) {
          var compatA = isPlanCompatibleWithMode(a.params, currentMode) ? 1 : 0;
          var compatB = isPlanCompatibleWithMode(b.params, currentMode) ? 1 : 0;
          if (compatA !== compatB) return compatB - compatA;
          if (state.sortMode === 'latest') {
            return (Number(b.created_at) || 0) - (Number(a.created_at) || 0);
          }
          return (Number(b.votes) || 0) - (Number(a.votes) || 0);
        });
      };

      partnerList = sortByCompatAndMetric(filterByPlanMode(partnerList));
      proList = sortByCompatAndMetric(filterByPlanMode(proList));
      remoteList = sortByCompatAndMetric(filterByPlanMode(remoteList));
      localList = sortByCompatAndMetric(filterByPlanMode(localList));
      var filteredTotal = partnerList.length + proList.length + remoteList.length + localList.length;

      // 6. 更新顶部持久化横幅与常驻模式/排序控制条 + 内部固定高度可滚动列表视口
      var bannerHtml = '';
      var viewportHtml = [];
      var annNorm = CommunityPlans.normalizeAnnouncementMeta(state.siteMeta && state.siteMeta.announcement);
      var annCls = annNorm.level === 'warning' ? 'is-warn' : (annNorm.level === 'success' ? 'is-success' : '');
      if (state.siteMeta && state.siteMeta.maintenance_mode) {
        var maintText = state.siteMeta.maintenance_message || '社区服务正在维护中，您仍可正常使用本地保存方案';
        bannerHtml = '<div class="cp-site-banner is-warn">' + Icons.megaphone + '<span>' + Utils.escapeHtml(maintText) + '</span></div>';
      } else if (annNorm.enabled && annNorm.text && annNorm.display_mode !== 'popup_only') {
        var bannerTitle = annNorm.title ? ('【' + annNorm.title + '】') : '';
        var previewText = bannerTitle + annNorm.text.replace(/\s+/g, ' ');
        bannerHtml =
          '<button type="button" class="cp-site-banner is-clickable ' + annCls + '" onclick="CommunityPlans.openAnnouncementModal(null, { fromAuto: false })" title="点击展开完整公告详情">' +
            Icons.megaphone +
            '<span class="cp-site-banner-text">' + Utils.escapeHtml(previewText) + '</span>' +
            '<span class="cp-site-banner-more">查看详情</span>' +
          '</button>';
      }

      var bannerSlot = document.getElementById('cpBannerSlot');
      if (bannerSlot) {
        if (bannerSlot.__lastHtml !== bannerHtml) {
          bannerSlot.innerHTML = bannerHtml;
          bannerSlot.__lastHtml = bannerHtml;
        }
        bannerSlot.style.display = bannerHtml ? '' : 'none';
      }

      if (state.isFetchingRemote && filteredTotal === 0) {
        viewportHtml.push([
          '<div class="cp-empty-box">',
          '  <div class="cp-empty-title">正在加载社区方案...</div>',
          '  <div class="cp-empty-desc">仅按需拉取当前车型第 1 页方案，请稍候</div>',
          '</div>'
        ].join(''));
      } else if (filteredTotal === 0) {
        var filterLabel = state.filterMode === 'solo' ? '先机汇能' : (state.filterMode === 'team' ? '团魂获能' : '全部');
        viewportHtml.push([
          '<div class="cp-empty-box cp-filter-empty">',
          '  ' + Icons.emptyBox,
          '  <div class="cp-empty-title">当前「' + filterLabel + '」模式下暂无方案</div>',
          '  <div class="cp-empty-desc">您可通过上方筛选栏切换其他模式，或点击下方按钮查看全部方案</div>',
          '  <button type="button" class="nav-btn cp-btn cp-btn-save" onclick="CommunityPlans.setFilterMode(\'all\')">显示全部方案</button>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 1】：友站分享 (合作友站实测推荐方案，有则首位展示)
      // ==========================================
      if (partnerList.length > 0) {
        viewportHtml.push([
          '<div class="cp-section cp-section-partner">',
          '  <div class="cp-sec-header">',
          '    <div class="cp-sec-icon-box">' + Icons.partner + '</div>',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
          '        <span class="cp-sec-title"><span class="zh">友站分享</span><span class="lang-en">Partner Setups</span></span>',
          '        <span class="cp-sec-count">' + partnerList.length + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">合作友站提供的实战芯片搭配参考，可点击作者主页前往查看原站与更多分享</span><span class="lang-en">Partner site curated setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          partnerList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'partner', currentMode); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 2】：国服顶尖 (官方推荐与自证认证)
      // ==========================================
      if (proList.length > 0) {
        viewportHtml.push([
          '<div class="cp-section cp-section-pro">',
          '  <div class="cp-sec-header">',
          '    <img src="data/icon/pro_helmet_m.png" class="cp-sec-pro-icon" alt="" loading="lazy">',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
          '        <span class="cp-sec-title"><span class="zh">国服顶尖</span><span class="lang-en">Pro Master Setups</span></span>',
          '        <span class="cp-sec-count">' + proList.length + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">官方实战大数据与国服榜首车神认证配装</span><span class="lang-en">National top driver certified setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          proList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'pro', currentMode); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 3】：玩家上传 (车友社区推荐)
      // ==========================================
      if (remoteList.length > 0) {
        viewportHtml.push([
          '<div class="cp-section cp-section-community">',
          '  <div class="cp-sec-header">',
          '    <div class="cp-sec-icon-box">' + Icons.hot + '</div>',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
          '        <span class="cp-sec-title"><span class="zh">玩家上传</span><span class="lang-en">Community Setups</span></span>',
          '        <span class="cp-sec-count">' + remoteList.length + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">来自全网车友实战分享的方案，经安全初筛认证</span><span class="lang-en">Community contributed setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          remoteList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'community', currentMode); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // ==========================================
      // 【分类 4】：我的专属配装 (本机自存/待审追踪)
      // ==========================================
      if (localList.length > 0) {
        viewportHtml.push([
          '<div class="cp-section cp-section-mine">',
          '  <div class="cp-sec-header">',
          '    <div class="cp-sec-icon-box">' + Icons.user + '</div>',
          '    <div class="cp-sec-info">',
          '      <div class="cp-sec-title-row">',
          '        <span class="cp-sec-title"><span class="zh">我的专属配装</span><span class="lang-en">My Saved Setups</span></span>',
          '        <span class="cp-sec-count">' + localList.length + '</span>',
          '      </div>',
          '      <div class="cp-sec-desc"><span class="zh">保存在本机的专属调校方案与云端同步状态追踪</span><span class="lang-en">Your locally saved tuning setups</span></div>',
          '    </div>',
          '  </div>',
          '  <div class="cp-sec-list">',
          localList.map(function (item) { return CommunityPlans.renderPlanItem(item, 'local', currentMode); }).join(''),
          '  </div>',
          '</div>'
        ].join(''));
      }

      // 底部懒加载哨兵与已加载进度条
      if (state.remotePlans.length > 0 || state.remoteHasMore) {
        var totalRemote = Math.max(state.remotePlans.length, state.remoteTotal || 0);
        var lazyText = state.remoteHasMore
          ? ('已加载 ' + state.remotePlans.length + ' / ' + totalRemote + ' 条社区方案 · 向下滚动自动加载')
          : ('已全部加载当前筛选下的 ' + totalRemote + ' 条社区方案');
        var lazyBtnHtml = state.remoteHasMore
          ? '<button type="button" class="cp-lazy-btn" onclick="CommunityPlans.loadMoreRemotePlans()"' + (state.isLoadingMore ? ' disabled' : '') + '>' + (state.isLoadingMore ? '加载中...' : '加载更多') + '</button>'
          : '';
        viewportHtml.push(
          '<div id="cpLazySentinel" class="cp-lazy-footer">' +
            '<span class="cp-lazy-status">' + Utils.escapeHtml(lazyText) + '</span>' +
            lazyBtnHtml +
          '</div>'
        );
      }

      stream.innerHTML = '<div id="cpScrollViewport" class="cp-scroll-viewport">' + viewportHtml.join('') + '</div>';
      if (renderOpts.preserveScroll && savedScrollTop > 0) {
        var nextViewport = document.getElementById('cpScrollViewport');
        if (nextViewport) nextViewport.scrollTop = savedScrollTop;
      }
      CommunityPlans.bindLazyScroll();
      CommunityPlans.toggleCollapse(false, !container.__cpRenderedOnce);
      CommunityPlans._syncControlsBar(true, true);
      container.__cpRenderedOnce = true;
    },

    // 渲染结构化三层方案卡片（全端统一清晰排版，杜绝内部嵌套小方框堆砌）
    renderPlanItem: function (item, type, calcMode) {
      var p = item.params || {};
      var currentCalcMode = calcMode || ((typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo'));
      var details = extractAllPlanDetails(p, state.currentCar);
      var isModeDisabled = !isPlanCompatibleWithMode(p, currentCalcMode);
      var safePlanId = Utils.safeId(item.id);
      var safeRemoteId = Utils.safeId(item.remote_id);
      var safePlayerId = Utils.safeId(item.player_id);
      var isVoted = Boolean(item.isVoted || state.votedMap[item.id] || (item.remote_id && state.votedMap[item.remote_id]));
      var isApplied = (state.activeAppliedPlanId === item.id);
      var isPartnerPlan = Boolean(item.isPartner || item.is_partner || type === 'partner');
      var isProPlan = !isPartnerPlan && Boolean(item.isPro || item.is_pro || type === 'pro');
      var isLocalPlan = (type === 'local');
      var isAuthorSelf = Boolean(item.viewer_is_author || (isLocalPlan && safeRemoteId));

      // 渲染主页链接胶囊（带平台标识与外链图标，严禁中途断行）
      var linksHtml = '';
      if (Array.isArray(item.links) && item.links.length > 0) {
        var validLinks = [];
        item.links.forEach(function (l) {
          var safeUrl = Utils.sanitizeUrl(l);
          if (safeUrl) {
            var pf = Utils.detectPlatform(safeUrl);
            validLinks.push(
              '<a href="' + Utils.escapeHtml(safeUrl) + '" target="_blank" rel="noopener noreferrer" class="cp-author-link-btn ' + pf.cls + '" title="打开 ' + Utils.escapeHtml(pf.label) + '：' + Utils.escapeHtml(safeUrl) + '">' +
              Icons.link + '<span>' + Utils.escapeHtml(pf.label) + '</span></a>'
            );
          }
        });
        if (validLinks.length > 0) {
          linksHtml = '<div class="cp-author-links">' + validLinks.join('') + '</div>';
        }
      }

      var badgeText = isPartnerPlan
        ? '<span class="cp-card-badge cp-badge-partner">' + Icons.partner + ' 友站分享</span>'
        : (isProPlan
          ? '<span class="cp-card-badge cp-badge-pro">' + Icons.crown + ' 国服顶尖</span>'
          : (isLocalPlan ? '<span class="cp-card-badge cp-badge-local">本地方案</span>' : '<span class="cp-card-badge cp-badge-community">玩家上传</span>'));

      var modeBadge = details.isTeamPlan
        ? '<span class="cp-card-badge cp-badge-mode-team' + (isModeDisabled ? ' is-disabled' : '') + '">团魂模式</span>'
        : '';

      var auditStatusBadge = '';
      var rejectBannerHtml = '';
      if (isLocalPlan) {
        if (item.remote_status === 'rejected') {
          auditStatusBadge = '<span class="cp-card-badge cp-badge-rejected" onclick="CommunityPlans.showRejectModal(\'' + safePlanId + '\', event)" title="点击查看审核驳回说明">审核未通过</span>';
          var briefReason = String(item.reject_reason || item.review_notes || '未能通过审核，点击查看具体原因').trim();
          rejectBannerHtml =
            '<div class="cp-card-reject-banner" onclick="CommunityPlans.showRejectModal(\'' + safePlanId + '\', event)" title="点击查看完整审核反馈说明">' +
            '  <span class="cp-reject-banner-lbl">审核未通过</span>' +
            '  <span class="cp-reject-banner-text">' + Utils.escapeHtml(briefReason) + '</span>' +
            '  <span class="cp-reject-banner-more">详情</span>' +
            '</div>';
        } else if (item.remote_status === 'cleaned') {
          auditStatusBadge = '<span class="cp-card-badge cp-badge-cleaned" title="该方案已从云端移除或下架，本地备份仍可正常使用">云端已移除</span>';
        } else if (safeRemoteId) {
          if (item.remote_status === 'approved') {
            auditStatusBadge = '<span class="cp-card-badge cp-badge-approved">已收录</span>';
          } else {
            auditStatusBadge = '<span class="cp-card-badge cp-badge-pending" onclick="CommunityPlans.checkPlanStatus(\'' + safePlanId + '\', \'' + safeRemoteId + '\', event)" title="点击刷新审核状态">审核中</span>';
          }
        }
      }

      // 构建黄色高亮同行区（先机、汇能、团魂(模式2)、反制：手机端稳排同一行）
      var hlCellsHtml = details.hlCells.map(function (c) {
        return '<div class="cp-spec-hl-cell"><span class="cp-spec-lbl">' + Utils.escapeHtml(c.lbl) + '</span><span class="cp-spec-val is-acc" title="' + Utils.escapeHtml(c.val) + '">' + Utils.escapeHtml(c.val) + '</span></div>';
      }).join('');
      var hlRowHtml = details.hlCells.length > 0
        ? '<div class="cp-specs-hl-row" style="--hl-cols:' + details.hlCells.length + '">' + hlCellsHtml + '</div>'
        : '';

      // 构建其余矩阵单元格（氮气与发数、增益装置、干扰降效）
      var specCells = details.specCells.map(function (c) {
        var wideCls = String(c.val || '').length > 9 ? ' is-wide' : '';
        return '<div class="cp-spec-cell' + wideCls + '"><span class="cp-spec-lbl">' + Utils.escapeHtml(c.lbl) + '</span><span class="cp-spec-val ' + (c.cls || '') + '" title="' + Utils.escapeHtml(c.val) + '">' + Utils.escapeHtml(c.val) + '</span></div>';
      });
      var specGridHtml = specCells.length > 0
        ? '<div class="cp-specs-grid">' + specCells.join('') + '</div>'
        : '';

      var extraLines = details.extraRows.map(function (r) {
        return '<div class="cp-spec-extra-row"><span class="cp-spec-extra-k">' + Utils.escapeHtml(r.k) + '</span><span class="cp-spec-extra-v' + (r.acc ? ' is-acc' : '') + '">' + Utils.escapeHtml(r.v) + '</span></div>';
      });

      var specsExtraHtml = extraLines.length > 0
        ? '<div class="cp-specs-extra">' + extraLines.join('') + '</div>'
        : '';

      var noteText = item.notes ? String(item.notes).trim() : '';
      var noteHtml = noteText
        ? '<div class="cp-card-note-box"><span class="cp-note-label">备注</span><span class="cp-note-text">' + Utils.escapeHtml(noteText) + '</span></div>'
        : '';

      var voteBtnCls = 'nav-btn cp-vote-btn' + (isVoted ? ' is-voted' : '') + (isAuthorSelf ? ' is-author' : '');
      var voteBtnTitle = isAuthorSelf
        ? '不能给自己的方案点赞'
        : (isVoted ? '已点赞，再次点击取消赞' : '点赞支持该方案');

      var applyBtnLabelZh = isModeDisabled ? '需切换团魂模式' : (isApplied ? '已套用' : '一键套用');
      var applyBtnLabelEn = isModeDisabled ? 'Team Mode Only' : (isApplied ? 'Applied' : 'Apply');
      var applyBtnAttrs = isModeDisabled
        ? ' disabled aria-disabled="true" title="该方案含团魂或增益装置，请先切换至「团魂获能」模式"'
        : ' onclick="CommunityPlans.applyPlanById(\'' + safePlanId + '\')"';

      var partnerAuthorBadge = isPartnerPlan
        ? '<a class="cp-author-partner-badge" href="https://aceracer.top/" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" title="点击前往合作友站 https://aceracer.top/">' + Icons.partner + '<span>友站</span></a>'
        : '';

      return [
        '<article class="cp-card-item ' + (isPartnerPlan ? 'is-partner ' : '') + (isProPlan ? 'is-pro' : '') + ' ' + (isApplied ? 'is-applied' : '') + ' ' + (isModeDisabled ? 'is-mode-disabled' : '') + '">',
        '  <div class="cp-card-head">',
        '    <div class="cp-card-header-line">',
        '      <h4 class="cp-card-title">' + Utils.escapeHtml(item.title) + '</h4>',
        '      <div class="cp-card-badges">',
        badgeText,
        modeBadge,
        auditStatusBadge,
        (isApplied ? '<span class="cp-card-badge cp-badge-active">' + Icons.check + ' 生效中</span>' : ''),
        '      </div>',
        '    </div>',
        '    <div class="cp-card-meta">',
        '      <span class="cp-author-name">' + Utils.escapeHtml(item.author || '热心车友') + '</span>',
        partnerAuthorBadge,
        (safePlayerId ? '      <button type="button" class="cp-player-id" onclick="CommunityPlans.copyPlayerId(\'' + safePlayerId + '\', event)" title="点击复制游戏ID"><span>ID ' + Utils.escapeHtml(safePlayerId) + '</span><span class="cp-copy-icon">' + Icons.copy + '</span></button>' : ''),
        '      <span class="cp-meta-time">' + Utils.formatTime(item.created_at) + '</span>',
        '    </div>',
        linksHtml,
        '  </div>',
        '  <div class="cp-specs-panel">',
        hlRowHtml,
        specGridHtml,
        specsExtraHtml,
        noteHtml,
        rejectBannerHtml,
        '  </div>',
        '  <div class="cp-card-foot">',
        '    <div class="cp-foot-left">',
        ((!isLocalPlan || safeRemoteId)
          ? ('      <button type="button" class="' + voteBtnCls + '" onclick="CommunityPlans.toggleVote(\'' + safePlanId + '\')" title="' + voteBtnTitle + '"' + (isAuthorSelf ? ' aria-disabled="true"' : '') + '>' +
             Icons.thumb(isVoted) + '<span>' + (Number(item.votes) || 0) + '</span></button>')
          : ''),
        (isLocalPlan
          ? '      <button type="button" class="nav-btn select-btn cp-del-btn" title="删除该方案" onclick="CommunityPlans.deletePlan(\'' + safePlanId + '\')">' + Icons.trash + '</button>'
          : ''),
        '    </div>',
        '    <button type="button" class="nav-btn cp-apply-btn ' + (isApplied && !isModeDisabled ? 'is-applied' : '') + (isModeDisabled ? ' is-disabled' : '') + '"' + applyBtnAttrs + '>',
        '      ' + (isModeDisabled ? '' : (isApplied ? Icons.check : Icons.apply)) + '<span class="zh">' + applyBtnLabelZh + '</span><span class="lang-en">' + applyBtnLabelEn + '</span>',
        '    </button>',
        '  </div>',
        '</article>'
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
      var tsRequired = state.siteMeta ? state.siteMeta.turnstile_required !== false : true;
      if (isSync) {
        if (tsRequired) {
          CommunityPlans.renderTurnstileWidget();
        } else {
          var tsBox = document.getElementById('cpTurnstileBox');
          if (tsBox) tsBox.style.display = 'none';
        }
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
      if (input) {
        input.value = '';
        input.click();
      }
    },

    handleProofFile: function (type, input) {
      if (!input.files || !input.files[0]) return;
      var file = input.files[0];
      if (!file.type.match(/^image\//)) {
        CommunityPlans.toast('请上传有效的图片文件 (JPG/PNG/WEBP)');
        input.value = '';
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        CommunityPlans.toast('单张截图大小不能超过 2 MB，请压缩或裁剪后重新上传');
        input.value = '';
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
          var getDecodedBytes = function (dUrl) {
            var idx = dUrl.indexOf(',');
            var b64 = idx >= 0 ? dUrl.slice(idx + 1) : dUrl;
            return Math.floor(b64.length * 0.75);
          };
          if (getDecodedBytes(compressed) > 1500000) {
            compressed = canvas.toDataURL('image/jpeg', 0.65);
          }
          if (getDecodedBytes(compressed) > 2 * 1024 * 1024) {
            CommunityPlans.toast('图片压缩后仍超过 2 MB，请换一张分辨率更低的截图');
            input.value = '';
            return;
          }
          var proofKey = type === 'profile' ? 'profileImg' : 'rankingImg';
          CommunityPlans.proofState[proofKey] = compressed;

          var card = document.getElementById('cpProofCard_' + type);
          if (card) {
            card.style.borderColor = '';
            card.classList.add('has-file');
            card.innerHTML = [
              '<div class="cp-proof-thumb-box">',
              '  <img src="' + compressed + '" class="cp-proof-thumb" alt="预览">',
              '  <button type="button" class="cp-proof-btn-reupload" onclick="event.stopPropagation(); CommunityPlans.triggerProofUpload(\'' + type + '\')">重新选择</button>',
              '</div>'
            ].join('');
          }
        };
        img.onerror = function () {
          CommunityPlans.toast('图片解码失败，请确认文件未损坏或更换格式 (JPG/PNG)');
          input.value = '';
        };
        img.src = dataUrl;
      };
      reader.onerror = function () {
        CommunityPlans.toast('读取截图文件失败，请重新选择');
        input.value = '';
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
      var modeLabel = params.calc_mode === 'team' ? '团魂获能模式' : '先机汇能模式';
      var summary = '[' + modeLabel + '] ' + extractAllPlanDetails(params, state.currentCar).summaryText;

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
      var allowSubmissions = !state.siteMeta || (state.siteMeta.allow_submissions !== false && !state.siteMeta.maintenance_mode);
      var allowPro = !state.siteMeta || state.siteMeta.allow_pro_applications !== false;
      var tsRequired = !state.siteMeta || state.siteMeta.turnstile_required !== false;

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
        '        <label class="form-label" for="cpInputTitle">方案名称 <span style="color:var(--fail,#e53935);">*</span> (必填，15字以内)</label>',
        '        <span id="cpTitleCounter" class="cp-input-count">0/15</span>',
        '      </div>',
        '      <div class="input-wrapper">',
        '        <input type="text" id="cpInputTitle" class="form-control cp-modal-input" placeholder="例如：大招连发稳健装" maxlength="15" autocomplete="off" oninput="CommunityPlans.onTitleInput(this)">',
        '      </div>',
        '    </div>',
        '    <div class="form-group cp-form-group">',
        '      <div class="cp-label-row">',
        '        <label class="form-label" for="cpInputNotes">方案备注 (选填，可写跑图思路、细节提醒)</label>',
        '        <span id="cpNotesCounter" class="cp-input-count">0/300</span>',
        '      </div>',
        '      <div class="input-wrapper">',
        '        <textarea id="cpInputNotes" class="form-control cp-modal-input cp-modal-textarea" rows="3" placeholder="例如：弯道提前踩减速带触发、双氮气起手注意节气（留空不显示）" maxlength="300" oninput="CommunityPlans.onNotesInput(this)"></textarea>',
        '      </div>',
        '    </div>',
        '    <!-- 开关 1: 是否上传方案至全网社区库 (规范 Switch，默认关闭) -->',
        '    <div class="cp-setting-switch-row' + (allowSubmissions ? '' : ' is-disabled') + '">',
        '      <div class="cp-setting-switch-info">',
        '        <span class="cp-setting-switch-title">上传芯片方案至全网社区库</span>',
        '        <span class="cp-setting-switch-desc">' + (allowSubmissions ? '默认关闭（仅保存在本机浏览器中）；开启后经安全初筛共享至全网方案库' : '全站社区投稿当前已暂停，您仍可将方案保存在本地浏览器中') + '</span>',
        '      </div>',
        '      <input type="checkbox" id="cpChkSyncCommunity" class="ui-switch"' + (allowSubmissions ? '' : ' disabled') + ' onchange="CommunityPlans.onToggleSyncCommunity(this.checked)">',
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
        '        <label class="form-label">个人主页链接 (选填，最多 3 个，仅限 B站 / 抖音 / 快手，支持粘贴分享文案自动提取)</label>',
        '        <div class="cp-links-input-list">',
        '          <div class="cp-link-input-wrap" id="cpLinkWrap1"><div class="cp-link-input-row"><span class="cp-link-idx">1</span><input type="text" id="cpInputLink1" class="form-control cp-modal-input" placeholder="粘贴 B站主页链接或分享口令 (space.bilibili.com / b23.tv)" autocomplete="off" oninput="CommunityPlans.onLinkInput(this, 1)" onpaste="setTimeout(function(){var el=document.getElementById(\'cpInputLink1\');if(el)CommunityPlans.onLinkInput(el,1,true);},0)" onblur="CommunityPlans.onLinkInput(this, 1, true)"></div><div class="cp-link-parse-msg" id="cpLinkMsg1"></div></div>',
        '          <div class="cp-link-input-wrap" id="cpLinkWrap2"><div class="cp-link-input-row"><span class="cp-link-idx">2</span><input type="text" id="cpInputLink2" class="form-control cp-modal-input" placeholder="粘贴 抖音主页链接或分享文案 (自动去除中文与乱码)" autocomplete="off" oninput="CommunityPlans.onLinkInput(this, 2)" onpaste="setTimeout(function(){var el=document.getElementById(\'cpInputLink2\');if(el)CommunityPlans.onLinkInput(el,2,true);},0)" onblur="CommunityPlans.onLinkInput(this, 2, true)"></div><div class="cp-link-parse-msg" id="cpLinkMsg2"></div></div>',
        '          <div class="cp-link-input-wrap" id="cpLinkWrap3"><div class="cp-link-input-row"><span class="cp-link-idx">3</span><input type="text" id="cpInputLink3" class="form-control cp-modal-input" placeholder="粘贴 快手主页链接或分享文案 (支持长/短链接)" autocomplete="off" oninput="CommunityPlans.onLinkInput(this, 3)" onpaste="setTimeout(function(){var el=document.getElementById(\'cpInputLink3\');if(el)CommunityPlans.onLinkInput(el,3,true);},0)" onblur="CommunityPlans.onLinkInput(this, 3, true)"></div><div class="cp-link-parse-msg" id="cpLinkMsg3"></div></div>',
        '        </div>',
        '      </div>',
        '      <!-- 开关 2: 申请入选国服顶尖方案池 (规范 Switch，默认关闭) -->',
        '      <div class="cp-setting-switch-row cp-pro-apply-row" style="' + (allowPro ? '' : 'display:none;') + '">',
        '        <div class="cp-setting-switch-info">',
        '          <div class="cp-pro-apply-badge-line">',
        '            <img src="data/icon/pro_helmet_m.png" class="cp-sec-pro-icon" alt="" style="width:20px;height:20px;">',
        '            <span class="cp-setting-switch-title">申请入选「国服顶尖方案池」</span>',
        '          </div>',
        '          <span class="cp-setting-switch-desc">开放车友自证通道；需审核双截图凭证，审核通过后置入国服推荐列表</span>',
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
        '            <li>个人主页截图必须包含您的游戏昵称与数字 ID，以核验方案归属权。</li>',
        '            <li>单张截图大小不能超过 <strong>2 MB</strong>（支持 JPG / PNG / WEBP）。</li>',
        '          </ul>',
        '        </div>',
        '        <div class="cp-proof-grid">',
        '          <!-- 截图入口 1: 本车国服最强荣誉截图 -->',
        '          <div class="cp-proof-card" id="cpProofCard_ranking" onclick="CommunityPlans.triggerProofUpload(\'ranking\')">',
        '            <span class="cp-proof-card-badge">必传凭证 1</span>',
        '            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:24px;height:24px;color:var(--acc);margin-bottom:4px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
        '            <span style="font-weight:700;font-size:12.5px;color:var(--ink);">本车国服最强荣誉截图</span>',
        '            <span class="cp-proof-card-desc">需含钻石大国标（全国前十）· 单张≤2MB</span>',
        '          </div>',
        '          <!-- 截图入口 2: 个人主页截图 -->',
        '          <div class="cp-proof-card" id="cpProofCard_profile" onclick="CommunityPlans.triggerProofUpload(\'profile\')">',
        '            <span class="cp-proof-card-badge">必传凭证 2</span>',
        '            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="width:24px;height:24px;color:var(--acc);margin-bottom:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        '            <span style="font-weight:700;font-size:12.5px;color:var(--ink);">游戏个人主页截图</span>',
        '            <span class="cp-proof-card-desc">需含游戏昵称与数字ID · 单张≤2MB</span>',
        '          </div>',
        '        </div>',
        '        <input type="file" id="cpFile_ranking" class="cp-proof-file-input" accept="image/*" onchange="CommunityPlans.handleProofFile(\'ranking\', this)">',
        '        <input type="file" id="cpFile_profile" class="cp-proof-file-input" accept="image/*" onchange="CommunityPlans.handleProofFile(\'profile\', this)">',
        '      </div>',
        '      <!-- 提交前安全验证 (Cloudflare Turnstile，点亮对勾后方可提交) -->',
        '      <div class="cp-turnstile-box" id="cpTurnstileBox" style="' + (tsRequired ? '' : 'display:none;') + '">',
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

    onNotesInput: function (el) {
      var countEl = document.getElementById('cpNotesCounter');
      if (!countEl) return;
      var len = Utils.charCount(el.value);
      if (len > 300) {
        el.value = Utils.truncateChars(el.value, 300);
        len = 300;
      }
      countEl.textContent = len + '/300';
      if (len >= 300) countEl.classList.add('is-limit');
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

    onLinkInput: function (el, idx, notifyOnExtract) {
      if (!el) return { ok: true, url: '' };
      var wrap = document.getElementById('cpLinkWrap' + idx);
      var msgEl = document.getElementById('cpLinkMsg' + idx);
      var raw = String(el.value || '');
      if (!raw.trim()) {
        if (wrap) wrap.classList.remove('is-valid', 'is-error');
        if (msgEl) msgEl.textContent = '';
        return { ok: true, url: '' };
      }

      var parsed = Utils.extractProfileLink(raw);
      if (parsed.ok && !parsed.empty && parsed.url) {
        if (parsed.changed) {
          el.value = parsed.url;
        }
        if (wrap) {
          wrap.classList.remove('is-error');
          wrap.classList.add('is-valid');
        }
        if (msgEl) {
          msgEl.textContent = parsed.changed
            ? '✓ 已自动提取纯净「' + parsed.label + '」（已去除多余文字与追踪尾巴）'
            : '✓ 已识别「' + parsed.label + '」';
        }
        if (notifyOnExtract && parsed.changed) {
          CommunityPlans.toast('已自动提取纯净' + parsed.label);
        }
        return { ok: true, url: parsed.url };
      }

      // 用户仍在手动输入前缀尚未输完时，只在失焦/粘贴/提交或明显完整 URL 不合白名单时标红提示
      var looksComplete = notifyOnExtract || /https?:\/\/[^\s]{6,}\.[a-z]{2,}/i.test(raw);
      if (looksComplete) {
        if (wrap) {
          wrap.classList.remove('is-valid');
          wrap.classList.add('is-error');
        }
        if (msgEl) {
          msgEl.textContent = '仅支持 B站 / 抖音 / 快手 个人主页或官方短链接，已屏蔽其他网址';
        }
        return { ok: false, url: '' };
      } else {
        if (wrap) wrap.classList.remove('is-valid', 'is-error');
        if (msgEl) msgEl.textContent = '';
        return { ok: false, url: '', typing: true };
      }
    },

    confirmSave: function () {
      var titleInput = document.getElementById('cpInputTitle');
      var notesInput = document.getElementById('cpInputNotes');
      var authorInput = document.getElementById('cpInputAuthor');
      var chkAnon = document.getElementById('cpChkAnon');
      if (!titleInput) return;

      var title = titleInput.value.trim();
      var notes = notesInput ? Utils.truncateChars(notesInput.value.trim(), 300) : '';
      var params = ParamsIO.capture();

      var check = PlanValidator.validate(params, title);
      if (!check.valid) {
        CommunityPlans.toast(check.message);
        titleInput.focus();
        return;
      }

      var currentSig = Utils.computeLocalBuildSig(state.currentCarId, params);

      // 堵死套用他人方案后直接保存或改名提交：与刚套用且属于他人的方案完全一致时拦截
      if (
        state.appliedSource &&
        state.appliedSource.isOther &&
        (state.appliedSource.appliedDomSig === currentSig || state.appliedSource.sourceBuildSig === currentSig)
      ) {
        CommunityPlans.toast('当前配装直接来自「' + state.appliedSource.title + '」且未作任何参数改动，请先自行调整参数后再保存或提交');
        return;
      }

      // 与在线国服/社区池里他人已过审方案配装签名完全一致时同样拦截
      var dupRemote = state.remotePlans.find(function (rp) {
        if (String(rp.car_id) !== String(state.currentCarId)) return false;
        if (rp.viewer_is_author) return false;
        var matchedOwn = state.savedPlans.some(function (lp) { return lp.remote_id && lp.remote_id === rp.id; });
        if (matchedOwn) return false;
        return Utils.computeLocalBuildSig(rp.car_id, rp.params) === currentSig;
      });
      if (dupRemote) {
        CommunityPlans.toast('当前配装参数与社区已有方案「' + dupRemote.title + '」完全一致，请先自行调整参数后再保存或提交');
        return;
      }

      var isAnon = chkAnon ? chkAnon.checked : false;
      var author = isAnon ? '热心车友' : (authorInput ? authorInput.value.trim() : '');

      var links = [];
      if (!isAnon) {
        for (var li = 1; li <= 3; li++) {
          var lEl = document.getElementById('cpInputLink' + li);
          if (lEl && lEl.value && lEl.value.trim()) {
            var lRes = CommunityPlans.onLinkInput(lEl, li, true);
            if (!lRes.ok || !lRes.url) {
              CommunityPlans.toast('第 ' + li + ' 个主页链接无效：仅支持 B站 / 抖音 / 快手 官方个人主页或短链接');
              lEl.focus();
              return;
            }
            if (links.indexOf(lRes.url) === -1 && links.length < 3) {
              links.push(lRes.url);
            }
          }
        }
      }

      var chkSync = document.getElementById('cpChkSyncCommunity');
      var isSync = chkSync ? chkSync.checked : false;

      var chkApplyPro = document.getElementById('cpChkApplyPro');
      var isApplyPro = isSync && chkApplyPro ? chkApplyPro.checked : false;

      if (isSync && state.siteMeta && state.siteMeta.maintenance_mode) {
        CommunityPlans.toast(state.siteMeta.maintenance_message || '当前维护中暂不接收社区投稿');
        return;
      }

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

      var tsRequired = !state.siteMeta || state.siteMeta.turnstile_required !== false;
      // 同步至社区方案库时，若启用了 Turnstile 则提交前必须先点击完成校验
      if (isSync) {
        if (CommunityPlans.turnstileState.isSubmitting) return;
        if (tsRequired && !CommunityPlans.turnstileState.token) {
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
        notes: notes,
        author: author || '热心车友',
        links: links,
        params: params,
        build_sig: currentSig,
        votes: 0,
        isVoted: false,
        viewer_is_author: true,
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

      if (isApplyPro) {
        var rankBytes = Utils.getDataUrlDecodedBytes(CommunityPlans.proofState.rankingImg);
        var profBytes = Utils.getDataUrlDecodedBytes(CommunityPlans.proofState.profileImg);
        if (rankBytes > 2 * 1024 * 1024 || profBytes > 2 * 1024 * 1024 || (rankBytes + profBytes) > 3.1 * 1024 * 1024) {
          CommunityPlans.toast('两张审核截图总体积过大（单张≤2MB，合计建议≤3MB），请换用压缩后的截图再试');
          return;
        }
      }

      var saveBtn = document.getElementById('cpBtnConfirmSave');
      CommunityPlans.turnstileState.isSubmitting = true;
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = Icons.save + ' 提交验证中...';
      }

      var fullParams = Object.assign({}, params, {
        start_nitro_count: params.first_nitro_count,
        cycle_nitro_count: params.loop_nitro_count,
        team_spirit: params.tuanhun,
        chips: params.chips_on,
        empowers: params.emps
      });

      var payload = {
        car_id: state.currentCarId,
        car_name: state.currentCar ? state.currentCar.name : '',
        title: title,
        notes: notes,
        author: author,
        is_anonymous: isAnon,
        apply_pro: isApplyPro,
        pro_proof: proProofData,
        links: links,
        turnstile_token: CommunityPlans.turnstileState.token || '',
        params: fullParams
      };

      var payloadJson = JSON.stringify(payload);
      if (payloadJson.length > 4.2 * 1024 * 1024) {
        CommunityPlans.turnstileState.isSubmitting = false;
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = Icons.save + ' 确认保存';
        }
        CommunityPlans.toast('提交内容与截图载荷过大，请压缩截图分辨率后重试');
        return;
      }

      var reqHeaders = Utils.getApiHeaders(true);
      if (CommunityPlans.turnstileState.token) {
        reqHeaders['X-Turnstile-Token'] = CommunityPlans.turnstileState.token;
      }

      fetch('/api/plans', {
        method: 'POST',
        headers: reqHeaders,
        body: payloadJson
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          CommunityPlans.turnstileState.isSubmitting = false;
          if (!resObj.ok || !resObj.data || resObj.data.success === false) {
            if (saveBtn) {
              saveBtn.disabled = false;
              saveBtn.innerHTML = Icons.save + ' 确认保存';
            }
            var errMsg = (resObj.data && resObj.data.message) ? resObj.data.message : '';
            if (!errMsg) {
              if (resObj.status === 413) errMsg = '提交数据过大 (HTTP 413)，请更换更小的截图后重试';
              else if (resObj.status >= 500) errMsg = '社区服务暂时繁忙或维护中 (HTTP ' + resObj.status + ')，请稍后重试';
              else errMsg = '提交未通过 (HTTP ' + resObj.status + ')';
            }
            CommunityPlans.toast(errMsg);
            if (tsRequired) {
              CommunityPlans.resetTurnstileWidget();
            }
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
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = Icons.save + ' 确认保存';
          }
          CommunityPlans.toast('网络连接异常，暂未能提交至社区服务器；您可重试或关闭上传开关仅存本机');
        });
    },

    // 后台静默批量同步本地所有「审核中」方案的真实云端裁决状态（解决驳回/通过/清理后前端滞留「审核中」问题）
    syncPendingPlanStatuses: function (opts) {
      var force = Boolean(opts && opts.force);
      var pendingPlans = state.savedPlans.filter(function (p) {
        if (!p || !p.remote_id) return false;
        return p.remote_status !== 'approved' && p.remote_status !== 'rejected' && p.remote_status !== 'cleaned';
      });
      if (pendingPlans.length === 0) return;

      var now = Date.now();
      if (state._isSyncingStatuses) return;
      if (!force && state._lastStatusSyncAt && (now - state._lastStatusSyncAt) < 4000) return;

      // 优先检查当前所选车型的待审方案，最多一次批量核验 20 条
      var curIdStr = state.currentCarId ? String(state.currentCarId) : '';
      pendingPlans.sort(function (a, b) {
        var aCur = (curIdStr && String(a.car_id) === curIdStr) ? 1 : 0;
        var bCur = (curIdStr && String(b.car_id) === curIdStr) ? 1 : 0;
        return bCur - aCur || ((Number(b.created_at) || 0) - (Number(a.created_at) || 0));
      });
      var batch = pendingPlans.slice(0, 20);
      var ids = batch.map(function (p) { return p.remote_id; });

      state._isSyncingStatuses = true;
      state._lastStatusSyncAt = now;

      fetch('/api/plans?check_statuses=' + encodeURIComponent(ids.join(',')), {
        method: 'GET',
        cache: 'no-store',
        headers: Utils.getApiHeaders(false)
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!resObj.ok || !resObj.data || !resObj.data.success || !resObj.data.data || !resObj.data.data.items) {
            return;
          }
          var map = resObj.data.data.items;
          var anyChanged = false;
          var anyNewlyApprovedForCurCar = false;
          var rejectedTitles = [];

          batch.forEach(function (lp) {
            var info = map[lp.remote_id];
            if (!info) return;
            if (info.found === false || info.status === 'cleaned') {
              lp.remote_status = 'cleaned';
              delete lp.remote_id;
              anyChanged = true;
              return;
            }
            if (info.status && info.status !== lp.remote_status) {
              lp.remote_status = info.status;
              anyChanged = true;
              if (info.status === 'rejected') {
                lp.reject_reason = info.reject_reason || info.review_notes || '未能通过审核，请查看详情';
                lp.review_notes = info.review_notes || lp.reject_reason;
                rejectedTitles.push(lp.title || '未命名方案');
              }
            } else if (info.status === 'rejected' && (info.reject_reason || info.review_notes)) {
              var nextReason = info.reject_reason || info.review_notes;
              if (lp.reject_reason !== nextReason) {
                lp.reject_reason = nextReason;
                lp.review_notes = info.review_notes || nextReason;
                anyChanged = true;
              }
            }
            if (info.status === 'approved') {
              if (info.is_pro && !lp.isPro) { lp.isPro = true; anyChanged = true; }
              if (info.is_partner && !lp.isPartner) { lp.isPartner = true; anyChanged = true; }
              if (curIdStr && String(lp.car_id) === curIdStr) {
                anyNewlyApprovedForCurCar = true;
              }
            }
          });

          if (anyChanged) {
            Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
            CommunityPlans.renderPlans({ preserveScroll: true });
            if (rejectedTitles.length > 0) {
              CommunityPlans.toast('方案「' + rejectedTitles[0] + '」审核未通过，已显示驳回说明');
            } else if (anyNewlyApprovedForCurCar && state.currentCarId) {
              CommunityPlans.fetchRemotePlans(state.currentCarId, { page: 1, append: false, preserveScroll: true });
            }
          }
        })
        .catch(function () {})
        .finally(function () {
          state._isSyncingStatuses = false;
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
      fetch('/api/plans?check_status=' + encodeURIComponent(remoteId), {
        method: 'GET',
        cache: 'no-store',
        headers: Utils.getApiHeaders(false)
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (resObj.status === 404) {
            var missingPlan = state.savedPlans.find(function (p) { return p.id === localId; });
            if (missingPlan) {
              missingPlan.remote_status = 'cleaned';
              delete missingPlan.remote_id;
              Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
              CommunityPlans.renderPlans({ preserveScroll: true });
            }
            CommunityPlans.toast('该方案在云端已不存在或已被清理，已更新本地状态');
            return;
          }
          if (!resObj.ok || !resObj.data || !resObj.data.success || !resObj.data.data) {
            throw new Error((resObj.data && resObj.data.message) || ('HTTP ' + resObj.status));
          }
          var d = resObj.data.data;
          var localPlan = state.savedPlans.find(function (p) { return p.id === localId; });
          if (localPlan) {
            localPlan.remote_status = d.status;
            localPlan.reject_reason = d.reject_reason || d.review_notes;
            localPlan.review_notes = d.review_notes;
            if (d.status === 'approved' && d.is_pro) {
              localPlan.isPro = true;
            }
            if (d.status === 'approved' && d.is_partner) {
              localPlan.isPartner = true;
            }
            Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);
            CommunityPlans.renderPlans();
          }

          if (d.status === 'approved') {
            CommunityPlans.toast('恭喜！方案已通过审核' + (d.is_partner ? '，并授予「友站分享」专属勋标！' : (d.is_pro ? '，并荣获「国服顶尖」勋标！' : '，已全网上线！')));
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
        '      <div class="cp-reject-tip">提示：该方案已安全保存在您的本地浏览器中，不受任何影响。您可以根据上述说明修改配装或重新截取符合标准的大国标截图后再次上传。</div>',
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

    // 规范化站点公告元数据结构（兼容历史纯字符串与新版完整弹窗配置）
    normalizeAnnouncementMeta: function (raw) {
      if (typeof raw === 'string') {
        var s = raw.trim();
        return {
          enabled: Boolean(s),
          level: 'info',
          title: '全站重要公告',
          text: s,
          display_mode: 'popup_and_bar',
          trigger_rule: 'every_n_visits',
          visit_interval: 20,
          show_on_first: true,
          cooldown_hours: 24,
          allow_dismiss: true,
          cta_text: '',
          cta_url: '',
          version: 1
        };
      }
      if (!raw || typeof raw !== 'object') {
        return {
          enabled: false,
          level: 'info',
          title: '',
          text: '',
          display_mode: 'popup_and_bar',
          trigger_rule: 'every_n_visits',
          visit_interval: 20,
          show_on_first: true,
          cooldown_hours: 24,
          allow_dismiss: true,
          cta_text: '',
          cta_url: '',
          version: 1
        };
      }
      var cleanUrl = String(raw.cta_url || '').trim();
      if (cleanUrl && !/^https?:\/\/[^\s"'<>`]+$/i.test(cleanUrl)) {
        cleanUrl = '';
      }
      var text = String(raw.text || '').trim();
      return {
        enabled: raw.enabled !== false && Boolean(text),
        level: ['info', 'warning', 'success'].indexOf(raw.level) >= 0 ? raw.level : 'info',
        title: String(raw.title || '全站重要公告').trim() || '全站重要公告',
        text: text,
        display_mode: ['popup_and_bar', 'popup_only', 'bar_only'].indexOf(raw.display_mode) >= 0 ? raw.display_mode : 'popup_and_bar',
        trigger_rule: ['every_n_visits', 'once_per_version', 'cooldown_hours', 'every_visit'].indexOf(raw.trigger_rule) >= 0 ? raw.trigger_rule : 'every_n_visits',
        visit_interval: Math.min(Math.max(parseInt(raw.visit_interval, 10) || 20, 1), 999),
        show_on_first: raw.show_on_first !== false,
        cooldown_hours: Math.min(Math.max(parseInt(raw.cooldown_hours, 10) || 24, 1), 720),
        allow_dismiss: raw.allow_dismiss !== false,
        cta_text: String(raw.cta_text || '').trim(),
        cta_url: cleanUrl,
        version: Number(raw.version) || 1
      };
    },

    // 页面打开时独立拉取站点公告与开关配置
    fetchSiteConfig: function () {
      fetch('/api/plans?meta=site_config', {
        method: 'GET',
        headers: Utils.getApiHeaders(false)
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!resObj.ok || !resObj.data) throw new Error('HTTP ' + resObj.status);
          var json = resObj.data;
          if (json && json.site_meta && typeof json.site_meta === 'object') {
            state.siteMeta = Object.assign({}, state.siteMeta, json.site_meta);
            var saveModal = document.getElementById('cpSaveModal');
            var chkSync = document.getElementById('cpChkSyncCommunity');
            var tsBox = document.getElementById('cpTurnstileBox');
            if (saveModal && chkSync && chkSync.checked && tsBox) {
              var nextTsReq = state.siteMeta.turnstile_required !== false;
              tsBox.style.display = nextTsReq ? '' : 'none';
              if (nextTsReq && CommunityPlans.turnstileState.widgetId === null) {
                CommunityPlans.renderTurnstileWidget();
              } else if (!nextTsReq) {
                CommunityPlans.turnstileState.token = '';
              }
            }
            CommunityPlans.maybeHandleAnnouncement(true);
            if (state.currentCarId) {
              CommunityPlans.renderPlans({ preserveScroll: true });
            }
          }
        })
        .catch(function () {});
    },

    // 根据后台配置的触发时机（每打开 N 次 / 首次 / 冷却小时 / 每次）判定是否自动弹出全站公告
    maybeHandleAnnouncement: function (allowCountVisit) {
      var ann = CommunityPlans.normalizeAnnouncementMeta(state.siteMeta && state.siteMeta.announcement);
      if (!ann.enabled || !ann.text) return;
      if (ann.display_mode === 'bar_only') return;
      // 如果同一会话里已经针对相同版本评估过，避免切车重复计次弹窗
      if (state._annCheckedVersion === ann.version && state._annSessionCounted) return;
      // 避免打断车友正在填写保存表单
      if (document.getElementById('cpSaveModal') || document.getElementById('cpAnnouncementModal')) return;

      var stored = Utils.getStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, null);
      if (!stored || typeof stored !== 'object' || Number(stored.version) !== ann.version) {
        stored = {
          version: ann.version,
          visits: 0,
          lastShownAt: 0,
          dismissedVersion: 0
        };
      }

      if (allowCountVisit || !state._annSessionCounted) {
        stored.visits = (Number(stored.visits) || 0) + 1;
        state._annSessionCounted = true;
      }
      state._annCheckedVersion = ann.version;

      if (ann.allow_dismiss && Number(stored.dismissedVersion) === ann.version) {
        Utils.setStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, stored);
        return;
      }

      var shouldShow = false;
      var visits = Math.max(1, Number(stored.visits) || 1);
      var lastAt = Number(stored.lastShownAt) || 0;

      if (ann.trigger_rule === 'every_visit') {
        shouldShow = true;
      } else if (ann.trigger_rule === 'once_per_version') {
        shouldShow = !lastAt;
      } else if (ann.trigger_rule === 'cooldown_hours') {
        var cooldownMs = ann.cooldown_hours * 3600 * 1000;
        shouldShow = !lastAt || (Date.now() - lastAt >= cooldownMs);
      } else {
        // 默认 every_n_visits：每打开网站 N 次展示 1 次
        var interval = ann.visit_interval;
        if (ann.show_on_first) {
          shouldShow = (visits === 1) || ((visits - 1) % interval === 0);
        } else {
          shouldShow = (visits % interval === 0);
        }
      }

      if (shouldShow) {
        stored.lastShownAt = Date.now();
        Utils.setStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, stored);
        CommunityPlans.openAnnouncementModal(ann, { fromAuto: true, visits: visits });
      } else {
        Utils.setStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, stored);
      }
    },

    // 打开全站公告弹窗（自动触发或点击横幅主动查看）
    openAnnouncementModal: function (rawAnn, opts) {
      var ann = CommunityPlans.normalizeAnnouncementMeta(rawAnn || (state.siteMeta && state.siteMeta.announcement));
      if (!ann.enabled || !ann.text) return;
      CommunityPlans.closeAnnouncementModal(true);

      var stored = Utils.getStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, {}) || {};
      var isDismissed = ann.allow_dismiss && Number(stored.dismissedVersion) === ann.version;
      var badgeLabel = ann.level === 'warning' ? '重要提醒' : (ann.level === 'success' ? '更新公告' : '全站公告');
      var levelCls = ann.level === 'warning' ? 'is-warn' : (ann.level === 'success' ? 'is-success' : 'is-info');

      var modal = document.createElement('div');
      modal.id = 'cpAnnouncementModal';
      modal.className = 'cp-modal-overlay is-open';
      modal.onclick = function (e) {
        if (e.target === modal) CommunityPlans.closeAnnouncementModal();
      };
      modal.addEventListener('wheel', function (e) {
        if (e.target === modal) e.preventDefault();
      }, { passive: false });
      modal.addEventListener('touchmove', function (e) {
        if (e.target === modal) e.preventDefault();
      }, { passive: false });

      document.body.classList.add('cp-modal-locked');
      CommunityPlans._annEscKeyHandler = function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
          CommunityPlans.closeAnnouncementModal();
        }
      };
      document.addEventListener('keydown', CommunityPlans._annEscKeyHandler);

      var ctaHtml = (ann.cta_text && ann.cta_url)
        ? '<a class="nav-btn cp-btn cp-ann-cta-btn" href="' + Utils.escapeHtml(ann.cta_url) + '" target="_blank" rel="noopener noreferrer">' + Icons.link + '<span>' + Utils.escapeHtml(ann.cta_text) + '</span></a>'
        : '';

      var dismissHtml = ann.allow_dismiss
        ? '<label class="cp-ann-dismiss-label"><input type="checkbox" id="cpAnnDismissCheck"' + (isDismissed ? ' checked' : '') + '><span>本次公告不再自动弹出</span></label>'
        : '<span class="cp-ann-force-hint">重要通知 · 关闭后到达周期仍将提醒</span>';

      modal.innerHTML = [
        '<div class="card cp-modal-dialog cp-ann-dialog ' + levelCls + '" onclick="event.stopPropagation()" data-ann-version="' + Utils.escapeHtml(String(ann.version)) + '" data-allow-dismiss="' + (ann.allow_dismiss ? '1' : '0') + '">',
        '  <div class="cp-modal-head">',
        '    <div class="cp-ann-head-left">',
        '      <span class="cp-ann-level-pill ' + levelCls + '">' + Icons.megaphone + '<span>' + badgeLabel + '</span></span>',
        '      <h4 class="cp-modal-title">' + Utils.escapeHtml(ann.title) + '</h4>',
        '    </div>',
        '    <button type="button" class="nav-btn select-btn cp-modal-close" aria-label="关闭公告" onclick="CommunityPlans.closeAnnouncementModal()">',
        '      ' + Icons.close,
        '    </button>',
        '  </div>',
        '  <div class="cp-modal-body">',
        '    <div class="cp-ann-body-card">' + Utils.escapeHtml(ann.text) + '</div>',
        '  </div>',
        '  <div class="cp-modal-footer cp-ann-footer">',
        '    <div class="cp-ann-footer-left">' + dismissHtml + '</div>',
        '    <div class="cp-ann-footer-actions">',
        '      ' + ctaHtml,
        '      <button type="button" class="nav-btn cp-btn cp-btn-save" onclick="CommunityPlans.closeAnnouncementModal()">' + Icons.check + ' 我知道了</button>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join('');

      document.body.appendChild(modal);
    },

    closeAnnouncementModal: function (skipPersist) {
      var modal = document.getElementById('cpAnnouncementModal');
      if (modal) {
        if (!skipPersist) {
          var dialog = modal.querySelector('.cp-ann-dialog');
          var chk = document.getElementById('cpAnnDismissCheck');
          if (dialog && chk && dialog.getAttribute('data-allow-dismiss') === '1') {
            var ver = Number(dialog.getAttribute('data-ann-version')) || 1;
            var stored = Utils.getStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, null);
            if (!stored || typeof stored !== 'object') {
              stored = { version: ver, visits: 1, lastShownAt: Date.now(), dismissedVersion: 0 };
            }
            stored.dismissedVersion = chk.checked ? ver : 0;
            Utils.setStorage(STORAGE_KEYS.ANNOUNCEMENT_STATE, stored);
          }
        }
        modal.remove();
      }
      document.body.classList.remove('cp-modal-locked');
      if (CommunityPlans._annEscKeyHandler) {
        document.removeEventListener('keydown', CommunityPlans._annEscKeyHandler);
        CommunityPlans._annEscKeyHandler = null;
      }
    },

    // 一键套用并记录当前高亮状态与防抄袭指纹来源
    applyPlanById: function (planId) {
      var localFound = state.savedPlans.find(function (p) { return p.id === planId; });
      var remoteFound = state.proPlans.find(function (p) { return p.id === planId; }) ||
                        state.remotePlans.find(function (p) { return p.id === planId; });
      var plan = localFound || remoteFound;
      if (!plan || !plan.params) {
        CommunityPlans.toast('找不到该方案数据');
        return;
      }
      var curCalcMode = (typeof window.getCalcMode === 'function')
        ? window.getCalcMode()
        : (document.body.getAttribute('data-calc-mode') || 'solo');
      if (!isPlanCompatibleWithMode(plan.params, curCalcMode)) {
        CommunityPlans.toast('该方案含团魂或增益装置，请先在顶部切换至「团魂获能」模式', 'warn');
        return;
      }

      state.lastSnapshot = ParamsIO.capture();
      state.hasUndoAvailable = true;
      state.activeAppliedPlanId = planId;
      var isOwnLocal = Boolean(localFound);
      var isOwnRemote = Boolean(remoteFound && (remoteFound.viewer_is_author || state.savedPlans.some(function (lp) { return lp.remote_id === remoteFound.id; })));

      var undoBtn = document.getElementById('cpBtnUndo');
      if (undoBtn) undoBtn.style.display = 'inline-flex';

      ParamsIO.apply(plan.params);
      var appliedCapture = ParamsIO.capture();
      state.appliedSource = {
        id: plan.id,
        title: plan.title || '他人方案',
        isOther: !isOwnLocal && !isOwnRemote,
        sourceBuildSig: Utils.computeLocalBuildSig(plan.car_id || state.currentCarId, plan.params),
        appliedDomSig: Utils.computeLocalBuildSig(state.currentCarId, appliedCapture)
      };
      CommunityPlans.renderPlans({ preserveScroll: true });
      Draft.scheduleSave();

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

      if (typeof window.setCalcMode === 'function' && state.lastSnapshot.calc_mode &&
          (state.lastSnapshot.calc_mode === 'solo' || state.lastSnapshot.calc_mode === 'team')) {
        var curM = (typeof window.getCalcMode === 'function')
          ? window.getCalcMode()
          : (document.body.getAttribute('data-calc-mode') || 'solo');
        if (curM !== state.lastSnapshot.calc_mode) {
          window.setCalcMode(state.lastSnapshot.calc_mode, true, true);
        }
      }
      ParamsIO.apply(state.lastSnapshot);
      state.lastSnapshot = null;
      state.hasUndoAvailable = false;
      state.activeAppliedPlanId = null;
      state.appliedSource = null;

      var undoBtn = document.getElementById('cpBtnUndo');
      if (undoBtn) undoBtn.style.display = 'none';

      CommunityPlans.renderPlans({ preserveScroll: true });
      Draft.scheduleSave();
      CommunityPlans.toast('已还原之前的配装状态');
    },

    // 删除本地方案
    deletePlan: function (planId) {
      var idx = state.savedPlans.findIndex(function (p) { return p.id === planId; });
      if (idx === -1) return;

      var target = state.savedPlans[idx];
      var name = target.title;
      var confirmText = target.remote_id
        ? ('确定要从本机列表移除方案「' + name + '」吗？（仅删除本机保存记录，已提交云端的数据不受影响）')
        : ('确定要删除本地保存的方案「' + name + '」吗？');
      if (!confirm(confirmText)) return;

      state.savedPlans.splice(idx, 1);
      Utils.setStorage(STORAGE_KEYS.PLANS, state.savedPlans);

      if (state.activeAppliedPlanId === planId) {
        state.activeAppliedPlanId = null;
      }

      CommunityPlans.renderPlans({ preserveScroll: true });
      CommunityPlans.toast('已删除方案「' + name + '」');
    },

    // 点赞 / 再次点击取消点赞 (绑定设备指纹持久化记忆 + 禁止作者自赞)
    toggleVote: function (planId) {
      var localPlan = state.savedPlans.find(function (p) { return p.id === planId; });
      var remotePlan = state.proPlans.find(function (p) { return p.id === planId; }) ||
                       state.remotePlans.find(function (p) { return p.id === planId; });
      var plan = localPlan || remotePlan;
      if (!plan) return;

      var isOwnLocalWithRemote = Boolean(localPlan && localPlan.remote_id);
      if (plan.viewer_is_author || isOwnLocalWithRemote) {
        CommunityPlans.toast('不能给自己的方案点赞');
        return;
      }

      if (localPlan && !localPlan.remote_id) {
        CommunityPlans.toast('本地方案仅您自己可见，上传社区后可接收点赞');
        return;
      }

      if (state.siteMeta && state.siteMeta.allow_voting === false) {
        CommunityPlans.toast('当前站点暂未开放点赞功能');
        return;
      }

      var targetRemoteId = plan.remote_id || plan.id;
      var prevVoted = Boolean(plan.isVoted || state.votedMap[plan.id] || state.votedMap[targetRemoteId]);
      var prevVotes = Math.max(0, Number(plan.votes) || 0);
      var nextAction = prevVoted ? 'unvote' : 'vote';
      var nextVoted = !prevVoted;
      var optimisticVotes = nextVoted ? prevVotes + 1 : Math.max(0, prevVotes - 1);

      plan.isVoted = nextVoted;
      plan.votes = optimisticVotes;
      if (nextVoted) {
        state.votedMap[plan.id] = 1;
        state.votedMap[targetRemoteId] = 1;
      } else {
        delete state.votedMap[plan.id];
        delete state.votedMap[targetRemoteId];
      }
      Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
      CommunityPlans.renderPlans({ preserveScroll: true });

      fetch('/api/vote', {
        method: 'POST',
        headers: Utils.getApiHeaders(true),
        body: JSON.stringify({ plan_id: targetRemoteId, action: nextAction })
      })
        .then(Utils.parseJsonSafe)
        .then(function (resObj) {
          if (!resObj.ok) {
            // 后端拒绝（例如自赞 403、限流 429 或未找到对应指纹点赞记录）：精确回滚
            plan.isVoted = prevVoted;
            plan.votes = prevVotes;
            if (prevVoted) {
              state.votedMap[plan.id] = 1;
              state.votedMap[targetRemoteId] = 1;
            } else {
              delete state.votedMap[plan.id];
              delete state.votedMap[targetRemoteId];
            }
            Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
            CommunityPlans.renderPlans({ preserveScroll: true });
            CommunityPlans.toast((resObj.data && resObj.data.message) || '操作失败，请稍后重试');
            return;
          }
          var d = resObj.data && resObj.data.data ? resObj.data.data : {};
          if (typeof d.voted === 'boolean') {
            plan.isVoted = d.voted;
            if (d.voted) {
              state.votedMap[plan.id] = 1;
              state.votedMap[targetRemoteId] = 1;
            } else {
              delete state.votedMap[plan.id];
              delete state.votedMap[targetRemoteId];
            }
            Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
          }
          if (typeof d.votes === 'number') {
            plan.votes = d.votes;
          }
          CommunityPlans.renderPlans({ preserveScroll: true });
          CommunityPlans.toast(plan.isVoted ? '点赞成功 +1' : '已取消点赞');
        })
        .catch(function () {
          plan.isVoted = prevVoted;
          plan.votes = prevVotes;
          if (prevVoted) {
            state.votedMap[plan.id] = 1;
            state.votedMap[targetRemoteId] = 1;
          } else {
            delete state.votedMap[plan.id];
            delete state.votedMap[targetRemoteId];
          }
          Utils.setStorage(STORAGE_KEYS.VOTES, state.votedMap);
          CommunityPlans.renderPlans({ preserveScroll: true });
          CommunityPlans.toast('网络波动，操作已回滚，请重试');
        });
    },

    // 统一 Toast 提示 (优先委托全局 showToast，确保定时器清理、图标装饰与最高层 z-index 一致)
    toast: function (msg) {
      if (typeof window.showToast === 'function') {
        window.showToast(msg);
        return;
      }
      var toastEl = document.getElementById('copyToast');
      if (toastEl) {
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        if (toastEl.__hideTimer) clearTimeout(toastEl.__hideTimer);
        if (toastEl.__timer) clearTimeout(toastEl.__timer);
        toastEl.__hideTimer = setTimeout(function () {
          toastEl.classList.remove('show');
        }, 2500);
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
