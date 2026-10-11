// 共享组件：id / class / 事件处理器与线上 index.html 完全一致（JS 依赖它们），只重写外观结构。
// 各设计的 layoutX() 负责把组件摆成不同的版式。
import { ICON } from './icons.mjs';

const t = (zh, en) => `<span class="zh">${zh}</span><span class="lang-en">${en}</span>`;
const RECALC = 'triggerAutoCalc(currentActiveField); calculate();';

// ---------- 顶栏 ----------
const menuDropdown = (align = 'left') => `
<div class="dropdown-container">
  <button id="authorBtn" class="nav-btn" type="button" onclick="toggleAuthorMenu()">${ICON.menu}<span class="nav-btn-text">${t('菜单', 'Menu')}</span></button>
  <div id="authorMenu" class="dropdown-menu ${align}">
    <a href="https://github.com/VanemKrAu/Ace-Racer-Calc" target="_blank" class="dropdown-option">${ICON.repo}${t('项目地址', 'GitHub Repo')}</a>
    <a href="https://i0.hdslb.com/bfs/openplatform/07d46fa9619f7ae4fa275da96d3c34d78e552624.png" target="_blank" class="dropdown-option">${ICON.heart}${t('支持作者', 'Support Author')}</a>
    <div class="dropdown-option" onclick="resetTutorial()">${ICON.reset}${t('恢复教程提示', 'Restore tutorial prompt')}</div>
  </div>
</div>`;

const themeDropdown = (align = 'right') => `
<div class="dropdown-container">
  <button id="themeBtn" class="nav-btn" type="button" onclick="toggleThemeMenu()">
    <span id="themeIcon" hidden>💻</span><span class="theme-ico">${ICON.sun}${ICON.moon}${ICON.system}</span><span class="nav-btn-text">${t('主题', 'Theme')}</span>
  </button>
  <div id="themeMenu" class="dropdown-menu ${align}">
    <div class="dropdown-option" onclick="selectTheme('light')">${ICON.sun}${t('浅色模式', 'Light Mode')}</div>
    <div class="dropdown-option" onclick="selectTheme('dark')">${ICON.moon}${t('深色模式', 'Dark Mode')}</div>
    <div class="dropdown-option" onclick="selectTheme('system')">${ICON.system}${t('跟随系统', 'System Default')}</div>
  </div>
</div>`;

const langButton = () => `
<div class="lang-toggle-wrapper" data-html2canvas-ignore="true">
  <button id="langToggleBtn" class="nav-btn lang-btn" type="button" aria-label="中文 / English" onclick="toggleLanguage()">${ICON.globe}<span id="langBtnText">中文 / English</span></button>
</div>`;

// ---------- 标题 / 教程 / 注释 ----------
const header = () => `
<div class="header">
  <img class="brand-mark" src="https://i0.hdslb.com/bfs/openplatform/98b8c12bc7177aa56b9b3c75b3a5b1cda3fad086.jpg" alt="" width="44" height="44" crossorigin="anonymous">
  <div class="brand-text">
    <h1>${t('王牌竞速芯片计算器', 'Ace Racer Chip Calculator')}</h1>
    <p>${t('由 <a href="https://v.douyin.com/AEe8wPEHZp0/" target="_blank" rel="noopener">Vanem</a> 设定交互逻辑、提供计算公式，AI辅助开发', 'Logic &amp; Formulas by <a href="https://v.douyin.com/AEe8wPEHZp0/" target="_blank" rel="noopener">Vanem</a>, AI Assisted')}</p>
  </div>
</div>`;

const tutorial = (notesInner) => `
<div id="tutorialWrapper" data-html2canvas-ignore="true">
  <details class="tutorial-details">
    <summary>
      <div class="tut-head">${ICON.info}<span class="tut-title">${t('使用前必看 & 注意事项', 'Must-Watch & Notes')}</span>
        <span id="updateBadge">${t('有更新 · 展开查看', 'Updated · expand to view')}</span></div>
      <div class="tut-actions">
        <span class="dropdown-icon">${ICON.chevron}</span>
        <button id="closeTutorialBtn" type="button" aria-label="不再显示" onclick="event.preventDefault(); event.stopPropagation(); closeTutorial();">${ICON.close}</button>
      </div>
    </summary>
    <div class="tut-body">
      <a id="tutorialBtnInner" class="tut-video" href="https://www.bilibili.com/video/BV14XEc6hEcz" target="_blank">${ICON.play}${t('前往观看：网站使用教程', 'Watch: Website Tutorial')}</a>
      <div class="tut-notes-title">${t('注意事项：', 'Notes:')}</div>
      <ul id="notesContent">${notesInner}</ul>
    </div>
  </details>
</div>`;

const footnote = () => `
<div class="footer-note calc-note">
  <span class="zh">* 注：根据游戏底层逻辑，起步基础充能不受任何环境干扰；<br>先机仅受反制影响，不受充能效率影响；氮气充能、辅助充能、赋能充能与专精充能受反制和充能效率双重影响。</span>
  <span class="lang-en">* Note: Base start charge ignores environments;<br>Xianji is affected only by Counter; Nitro, Assist, Empower, &amp; Spec charges affected by Counter &amp; Efficiency.</span>
</div>`;

// ---------- 车辆 ----------
const carPreview = () => `
<div id="carPreview">
  <div class="card car-hero">
    <div class="car-stage">
      <div id="carImgWrap"><img id="carImage" src="" alt="" loading="lazy"></div>
      <div id="carPreviewPlaceholder">${t('请选择一辆赛车', 'Select a car')}</div>
    </div>
    <div class="car-meta">
      <div id="carPreviewName" style="display:none;"></div>
      <div id="carPreviewTags" style="display:none;"></div>
      <div id="carPreviewInfo" style="display:none;"></div>
      <div id="carPreviewChips" style="display:none;"></div>
      <div id="carPreviewAutoMsg" style="display:none;"></div>
    </div>
  </div>
</div>`;

const carSelect = () => `
<div class="card car-select">
  <div class="card-title">${t('选择赛车', 'Select Car')}</div>
  <div class="car-search-box">${ICON.search}
    <input type="text" id="carSearch" class="form-control" placeholder="Search car name..." oninput="filterCarList()" autocomplete="off">
  </div>
  <div class="car-filters">
    <div class="dropdown-container">
      <button id="filterPosBtn" class="nav-btn select-btn" type="button" onclick="toggleFilterMenu('pos')"><span id="filterPosLabel">${t('全部定位', 'All Positions')}</span>${ICON.chevron}</button>
      <div id="filterPosMenu" class="dropdown-menu left"></div>
    </div>
    <div class="dropdown-container">
      <button id="filterSpecBtn" class="nav-btn select-btn" type="button" onclick="toggleFilterMenu('spec')"><span id="filterSpecLabel">${t('全部专精', 'All Specs')}</span>${ICON.chevron}</button>
      <div id="filterSpecMenu" class="dropdown-menu left"></div>
    </div>
  </div>
  <div class="dropdown-container car-list-box">
    <button id="carListBtn" class="nav-btn select-btn car-list-btn" type="button" onclick="toggleCarDropdown()"><span id="carListLabel">${t('选择车辆', 'Select a car')}</span>${ICON.chevron}</button>
    <div id="carDropdown" class="dropdown-menu left"></div>
  </div>
  <div id="carSelectInfo" class="car-info-bar" style="display:none;"></div>
</div>`;

// ---------- 通用输入 ----------
const field = ({ id, label, value, unit, step, min, max, oninput = RECALC, cls = '', labelCls = '', labelId = '' }) => `
<div class="form-group ${cls}">
  <label class="form-label ${labelCls}" for="${id}"${labelId ? ` id="${labelId}"` : ''}>${label}</label>
  <div class="input-wrapper">
    <input type="number" id="${id}" class="form-control" value="${value}"${min !== undefined ? ` min="${min}"` : ''}${max !== undefined ? ` max="${max}"` : ''}${step !== undefined ? ` step="${step}"` : ''} inputmode="decimal" oninput="${oninput}">
    <span class="input-unit">${unit}</span>
  </div>
</div>`;
const PCT = '%';
const SEC = t('秒', 's');
const TIMES = t('次', ' times');
const PCS = t('个', ' nitro(s)');
// ---------- 基础属性 ----------
const coreCard = () => `
<div id="cardCoreParams" class="card">
  <div class="card-title">${t('全局核心基准充能参数', 'Global Core Charge Parameters')}</div>
  <div class="row-grid">
    ${field({ id: 'ultThreshold', label: t('大招释放能量阈值', 'Ult Energy Threshold'), value: 100, unit: PCT, step: 1, min: 1, max: 100, cls: 'is-key' })}
    ${field({ id: 'startCharge', label: t('起步基础充能', 'Start Base Charge'), value: 36, unit: PCT, step: 0.1 })}
  </div>
  ${field({ id: 'baseNitro', label: t('单次氮气基础充能基准值 (1×6标称全额威力)', 'Single Nitro Base Charge (1x6 standard)'), value: 36, unit: PCT, step: 0.1 })}
</div>`;

const NITROS = [
  ['1x5', '1 × 5 氮气', '1x5 Nitro', '5.0', true], ['1x6', '1 × 6 氮气', '1x6 Nitro', '6.0'],
  ['2x2', '2 × 2 氮气', '2x2 Nitro', '2.0'], ['2x3', '2 × 3 氮气', '2x3 Nitro', '2.0'],
  ['2x25', '2 × 2.5 氮气', '2x2.5 Nitro', '2.5'], ['3x2', '3 × 2 氮气', '3x2 Nitro', '2.0'],
];
const nitroItem = ([k, zh, en, v, checked]) => `
<div class="nitro-item${checked ? ' selected' : ''}">
  <div class="nitro-left">
    <input type="radio" id="r_${k}" name="nitroRadio" value="${k}"${checked ? ' checked' : ''} onchange="handleNitroRadioChange()">
    <label for="r_${k}">${t(zh, en)}</label>
  </div>
  <div class="nitro-right-wrapper">
    <input type="number" id="time_${k}" class="nitro-right-input" value="${v}" step="0.01" inputmode="decimal" oninput="syncNitroTimes('${k}')">
    <span class="nitro-right-unit">${SEC}</span>
  </div>
</div>`;

const nitroCard = () => `
<div id="cardNitro" class="card">
  <div class="card-title">${t('氮气规格及单发时长同步', 'Nitro Specs & Duration Sync')}</div>
  <div class="card-hint">
    <b>${t('更改任意一项氮气时长，其余规格自动等比同步换算：', 'Change any duration, others sync automatically:')}</b>
    <span>${t('注：车辆详情中显示的默认氮时为1×6氮气，只需修改1×6氮时即可', 'Note: Default duration in details is usually 1x6 nitro. Just modify 1x6.')}</span>
  </div>
  <div class="nitro-grid">${NITROS.map(nitroItem).join('')}</div>
  <div id="specGrid">
    <div id="specLeft">
      <label class="form-label" for="baseUltDuration">${t('100%能量大招时长', '100% Energy Ult Duration')}</label>
      <div id="actualUltTimeSpan"></div>
      <div class="input-wrapper">
        <input type="number" id="baseUltDuration" class="form-control" value="5.0" step="0.1" inputmode="decimal" oninput="${RECALC}">
        <span class="input-unit">${SEC}</span>
      </div>
    </div>
    <div id="specRight">
      <div class="spec-box">
        <label id="specLabel" class="check-line"><input type="checkbox" id="isSpec" checked onchange="${RECALC}"> ${t('专精地图 (基础10%折算)', 'Specialty Map (10% base)')}</label>
      </div>
    </div>
  </div>
</div>`;

const counterCard = () => `
<div class="card counter-card">
  <div class="card-title">${t('对手反制干扰设定', 'Opponent Counter Settings')}</div>
  <div class="slider-wrapper">
    <div class="slider-header"><span>${t('全局实战反制比例 (影响双轨)：', 'Global Counter Ratio (Dual-track):')}</span><span id="counterValue" class="slider-value">18%</span></div>
    <input type="range" id="counterRange" class="slider-control" min="0" max="18" value="18" step="0.5" oninput="updateCounterSlider()" aria-label="反制比例">
  </div>
  <div class="slider-wrapper">
    <div class="slider-header"><span>${t('充能效率降低 (受敌方干扰)：', 'Efficiency Reduction (Enemy Interfere):')}</span><span id="debuffValue" class="slider-value">0%</span></div>
    <input type="range" id="debuffRange" class="slider-control" min="0" max="100" value="0" step="1" oninput="updateDebuffSlider()" aria-label="充能效率降低">
  </div>
</div>`;

const effCard = () => `
<div class="card eff-card-mobile">
  <div class="card-title">${t('车辆技能附加充能效率', 'Vehicle Skill Bonus Efficiency')}</div>
  ${field({ id: 'extraEfficiency', label: t('部分车辆特性的额外充能效率提升', 'Extra charge efficiency from vehicle traits'), value: 0, unit: PCT, step: 1, min: 0, cls: 'is-key flush' })}
</div>`;
// ---------- 赋能 ----------
const empowerItem = (key, title, desc, sub = '') => {
  const head = `<div class="title">${title}</div><div class="desc">${desc}</div>`;
  const info = sub
    ? `<div class="empower-info"><label for="chk_${key}">${head}</label>${sub}</div>`
    : `<label class="empower-info" for="chk_${key}">${head}</label>`;
  return `
<div class="empower-item" id="item_${key}">
  <div class="empower-flex">
    <div class="empower-checkbox-wrapper"><input type="checkbox" class="empower-checkbox" id="chk_${key}" value="${key}" onchange="handleEmpowerChange(this)"></div>
    ${info}
  </div>
</div>`;
};
const subRow = (label, id, value, oninput, suffix) => `
<div class="sub-row"><span class="sub-label">${label}</span>
  <input type="number" id="${id}" class="sub-input" value="${value}" min="0" max="5" inputmode="numeric" oninput="${oninput}"><span class="sub-suffix">${suffix}</span></div>`;

const empowerCard = () => `
<div class="card empower-card">
  <div class="card-title">${t('七大赋能系统矩阵', '7 Empowerment Matrices')}<span class="limit-badge">${t('主/次各最多选1个', 'Max 1 per Main/Sub')}</span></div>
  <div class="empower-group-title is-main">${t('主要赋能矩阵', 'Main Empowerment')}</div>
  <div class="empower-list">
    ${empowerItem('fusu', t('复苏之泉 (仅循环生效)', 'Recovery Spring (Loop only)'), `${t('开大后5秒内每秒提供自充能', 'Self-charge per sec for 5s after Ult')} <strong>+2.5%</strong>。`)}
    ${empowerItem('yichu', t('拒绝溢出 (全局激活倍率)', 'Reject Overflow (Global Multiplier)'), `${t('激活全局充能效率', 'Activate global charge efficiency')} <strong>+5% (1.05倍)</strong>。`)}
  </div>
  <div class="empower-group-title is-sub">${t('次要赋能矩阵', 'Sub Empowerment')}</div>
  <div class="empower-list secondary-list">
    ${empowerItem('jiezou', t('节奏赋能 (需手动设定触发次数)', 'Rhythm (Manual trigger)'),
      `${t('每4秒内使用3次涡轮/大招等动作给', '3 actions (turbo/ult) within 4s grants')} <strong>+4%</strong> ${t('能量。', 'energy.')}`,
      `<div class="empower-sub-options" id="jiezou_options" style="display: none;">
        ${subRow(t('首发一大前 预估触发次数:', 'Triggers before 1st Ult:'), 'jiezou_sub_first', 0, RECALC, TIMES)}
        ${subRow(t('大招循环内 预估触发次数:', 'Triggers during loop:'), 'jiezou_sub_loop', 1, 'calculate();', TIMES)}
      </div>`)}
    ${empowerItem('huishou', t('能源回收 (仅循环生效)', 'Energy Recovery (Loop only)'), `${t('每次使用大招后立即获得', 'Immediately grants')} <strong>+10%</strong> ${t('能量。', 'energy.')}`)}
    ${empowerItem('weilai', t('未来视界 (动态降维机制)', 'Future Vision (Dynamic threshold)'), t('大招能量达到90%时可以使用大招（阈值强制最高锁为90%）。', 'Ult usable at 90% (Threshold locked to 90%).'))}
    ${empowerItem('queyi', t('缺一不可 (同时计入首发与后续循环)', 'Indispensable (Applies to both 1st Ult & Loop)'),
      t('根据首发释放氮气时长与大招持续期间，均提供高额自充。', 'Provides high self-charge during both the 1st Ult nitro duration and the subsequent Ult loop.'),
      `<div class="empower-sub-options" id="queyi_options" style="display: none;">
        <label class="sub-checkbox-label"><input type="checkbox" id="queyi_sub_self" checked onchange="calculate()"><span>${t('我方是完美阵容 (+0.8%/s)', 'Ally Perfect Lineup (+0.8%/s)')}</span></label>
        <label class="sub-checkbox-label"><input type="checkbox" id="queyi_sub_enemy" onchange="calculate()"><span>${t('敌方非完美阵容 (+1.2%/s)', 'Enemy Imperfect Lineup (+1.2%/s)')}</span></label>
      </div>`)}
    ${empowerItem('huaxin', t('花信风 (间歇性给能，需手动排期)', 'Floral Wind (Intermittent, manual)'),
      t('开局+7%，之后每10秒+7%。大招期间若未踩中10秒节点则收益为0。', '+7% at start, +7% every 10s. 0 yield if missed during Ult.'),
      `<div class="empower-sub-options" id="huaxin_options" style="display: none;">
        ${subRow(t('首发一大前 触发次数:', 'Triggers before 1st Ult:'), 'huaxin_sub_first', 1, RECALC, t(' 次 (默认1次开局)', ' times (default 1)'))}
        ${subRow(t('大招循环内 触发次数:', 'Triggers during loop:'), 'huaxin_sub_loop', 0, 'calculate();', t(' 次 (求稳填0)', ' times (0 for safety)'))}
      </div>`)}
  </div>
  <div class="empower-limit-tip" id="empowerTip" style="display: none;">${t('赋能限制：主要赋能和次要赋能各最多只能激活 1 个。', 'Limit: Max 1 Main and 1 Sub Empowerment.')}</div>
</div>`;
// ---------- 扩展自充能 / 自定义触发 ----------
const EXTRA_TOGGLE = `toggleExtraUI(); ${RECALC}`;
const scopeChecks = (firstId, loopId) => `
<div class="scope-row">
  <label class="check-line small"><input type="checkbox" id="${firstId}" checked onchange="${RECALC}"> ${t('对首发有效', 'Applies to 1st Ult')}</label>
  <label class="check-line small"><input type="checkbox" id="${loopId}" checked onchange="${RECALC}"> ${t('对循环有效', 'Applies to Loop')}</label>
</div>`;

const extraCard = () => `
<div class="card extra-card">
  <div class="card-title">${t('扩展自充能附加模块', 'Extended Self-Charge Modules')}</div>
  <div id="extraNitroSection" class="extra-section tone-a">
    <label class="extra-toggle"><input type="checkbox" id="hasExtraNitro" onchange="${EXTRA_TOGGLE}"><span class="extra-toggle-text">${t('氮气自充能 (受反制与充能效率双重影响)', 'Nitro Self-Charge (Affected by Counter & Eff)')}</span></label>
    <div id="extraNitroContainer" class="extra-body" style="display: none;">
      ${field({ id: 'valExtraNitro', label: t('每次释放氮气附加百分比', 'Bonus % per nitro'), value: 0, unit: PCT, step: 0.1, min: 0 })}
      ${scopeChecks('chkExtraNitroFirst', 'chkExtraNitroLoop')}
    </div>
  </div>
  <div id="extraUltSection" class="extra-section tone-b">
    <label class="extra-toggle"><input type="checkbox" id="hasExtraUlt" onchange="${EXTRA_TOGGLE}"><span class="extra-toggle-text">${t('起步额外充能 / 大招自充能 (受反制与充能效率双重影响)', 'Start Bonus / Ult Self-Charge (Affected by Counter & Eff)')}</span></label>
    <div id="extraUltContainer" class="extra-body" style="display: none;">
      <div class="row-grid">
        ${field({ id: 'valExtraUltFirst', label: t('起步额外充能', 'Start Bonus Charge'), value: 0, unit: PCT, step: 0.1, min: 0, cls: 'flush' })}
        ${field({ id: 'valExtraUltLoop', label: t('大招自充能', 'Ult Self-Charge'), value: 0, unit: PCT, step: 0.1, min: 0, cls: 'flush' })}
      </div>
    </div>
  </div>
  <div id="extraPerSecSection" class="extra-section tone-c">
    <label class="extra-toggle"><input type="checkbox" id="hasExtraPerSec" onchange="${EXTRA_TOGGLE}"><span class="extra-toggle-text">${t('每秒自充能 (受反制与充能效率双重影响)', 'Self-Charge per Second (Affected by Counter & Eff)')}</span></label>
    <div id="extraPerSecContainer" class="extra-body" style="display: none;">
      ${field({ id: 'valExtraPerSec', label: t('每秒持续附加百分比 (向下取整计算)', 'Bonus % per sec (Rounded down)'), value: 0, unit: PCT, step: 0.1, min: 0 })}
      ${scopeChecks('chkExtraPerSecFirst', 'chkExtraPerSecLoop')}
    </div>
  </div>
</div>`;

const customCard = () => `
<div id="extraCustomSection" class="card">
  <div class="card-title">${t('自定义触发自充能', 'Custom Trigger Self-Charge')}</div>
  ${field({ id: 'valCustomTrig', label: t('每次触发附加百分比 (受反制与充能效率双重影响)', 'Bonus % per trigger (Affected by Counter & Eff)'), value: 0, unit: PCT, step: 0.1, min: 0 })}
  <div class="row-grid">
    ${field({ id: 'customTrigFirstCount', label: t('首发一大触发次数', '1st Ult Triggers'), value: 0, unit: TIMES, step: 1, min: 0, cls: 'flush' })}
    ${field({ id: 'customTrigLoopCount', label: t('循环内触发次数', 'Loop Triggers'), value: 0, unit: TIMES, step: 1, min: 0, oninput: 'calculate();', cls: 'flush' })}
  </div>
</div>`;

// ---------- 首发 / 循环 输入 ----------
const chipCard = () => `
<div class="card chip-card">
  <div class="card-title">${t('智能芯片联动面板', 'Smart Chip Linkage')}<span class="limit-badge">${t('上限：先机30% | 汇能50%', 'Limit: Xianji 30% | Huineng 50%')}</span></div>
  ${field({ id: 'inputFirstNitroCount', label: t('释放一大所需氮气个数', 'Nitros needed for 1st Ult'), value: 1, unit: PCS, step: 1, min: 0 })}
  <div class="mode-bar">
    <div id="autoCalcInfo" class="mode-info"></div>
    <button type="button" class="mode-btn" onclick="resetAutoCalc()">${t('重置联动', 'Reset Linkage')}</button>
  </div>
  <div class="row-grid">
    ${field({ id: 'inputXianji', label: t('先机', 'Ult Xianji'), labelId: 'labelXianji', value: 0, unit: PCT, step: 0.1, min: 0, max: 30, oninput: "onFieldInput('xianji')", cls: 'flush' })}
    ${field({ id: 'inputHuineng', label: t('汇能', 'Ult Huineng'), labelId: 'labelHuineng', value: 0, unit: PCT, step: 0.1, min: 0, max: 50, oninput: "onFieldInput('huineng')", cls: 'flush' })}
  </div>
</div>`;

const nitroCountCard = () => `
<div class="card nitro-count-card">
  <div class="card-title">${t('大招期间氮气释放次数', 'Nitro releases during Ult')}</div>
  <div class="mode-bar">
    <div id="nitroCountModeInfo" class="mode-info"></div>
    <button type="button" class="mode-btn is-alt" onclick="resetAutoNitroCount()">${t('恢复自动计算', 'Restore Auto-calc')}</button>
  </div>
  ${field({ id: 'inputNitroCount', label: t('大招内释放氮气个数', 'Nitros per Ult'), value: 0, unit: PCS, step: 1, min: 0, oninput: 'onNitroCountInput()', cls: 'flush' })}
</div>`;

// ---------- 结果 ----------
const resultFirst = () => `
<div class="card result-card" id="resultCardFirst">
  <div class="result-title">${t('首发大招 (开局一大) 面板评估', 'First Ult (Opening) Evaluation')}</div>
  <div class="ds-gauge" data-for="first"></div>
  <div class="result-num ds-sr" id="resultValueFirst">--</div>
  <div class="result-desc" id="resultDetailFirst">${t('评估当前面板状态...', 'Evaluating current stats...')}</div>
  <div id="formulaDisplayFirst" class="formula-box">${t('运算引擎加载中...', 'Loading calculation engine...')}</div>
</div>`;

const resultLoop = () => `
<div class="card result-card result-card-loop" id="resultCardLoop">
  <div class="result-title">${t('后续大招无限循环 底线要求', 'Infinite Loop Baseline Requirement')}</div>
  <div class="result-req">${t('先机要求：0% (起步后先机芯片对循环彻底失效)', 'Xianji req: 0% (Ineffective in loop)')}</div>
  <div class="ds-gauge" data-for="loop"></div>
  <div class="result-num ds-sr" id="resultValueLoop">--</div>
  <div class="result-desc" id="resultDetailLoop">${t('等待测算循环状态...', 'Waiting to calc loop status...')}</div>
  <div id="formulaDisplayLoop" class="formula-box">${t('运算引擎加载中...', 'Loading calculation engine...')}</div>
</div>`;

const divider = (zh, en, extra = '') => `<div class="section-divider"${extra}><span>${t(zh, en)}</span></div>`;
// ---------- 分享 / 页脚 ----------
const shareBlock = () => `
<div class="share-block" data-html2canvas-ignore="true">
  ${divider('计算数据分享', 'Data Export & Share')}
  <div class="card share-card">
    <div class="share-btn-group">
      <button class="share-btn btn-text" type="button" onclick="exportConfigText()">${ICON.copy}<span>${t('复制纯文本', 'Copy Plain Text')}</span></button>
      <button class="share-btn btn-image" type="button" onclick="exportConfigImage()">${ICON.image}<span>${t('保存长截图', 'Save Long Screenshot')}</span></button>
      <button class="share-btn btn-link" type="button" onclick="exportConfigLink()">${ICON.link}<span>${t('分享配置链接', 'Share Link')}</span></button>
    </div>
  </div>
</div>`;

const footer = () => `
<footer class="site-footer" data-html2canvas-ignore="true">
  <div class="footer-note footer-legal">
    <p>${t('本项目完全本地运行，不进行任何联网行为，不收集任何隐私数据，请放心使用。', 'Runs fully locally, no network needed, no data collected.')}</p>
    <p>${t('由Vanem开发，个人公益制作，严禁倒卖，付费传播，以及任何形式的商用。更多内容请关注作者主页：', 'Dev by Vanem, non-profit. Resale/commercial use prohibited. Author:')}</p>
    <div class="social-row">
      <a href="https://m.bilibili.com/space/1179286584" target="_blank" class="social-tag">${ICON.tv}${t('B站主页', 'Bilibili')}</a>
      <a href="https://v.douyin.com/AEe8wPEHZp0/" target="_blank" class="social-tag">${ICON.note}${t('抖音主页', 'Douyin')}</a>
      <a href="https://v.kuaishou.com/JpRc0cK3" target="_blank" class="social-tag">${ICON.video}${t('快手主页', 'Kuaishou')}</a>
    </div>
  </div>
  <div class="card bug-card">
    <div class="card-title">${ICON.bug}${t('BUG反馈与建议', 'Bug Reports & Suggestions')}</div>
    <p class="card-text">${t('如果您在使用过程中发现任何计算逻辑错误、界面显示异常，或有新的功能建议，欢迎通过 GitHub Issues 提交反馈！', 'If you find logic errors, UI bugs, or have suggestions, submit a GitHub Issue!')}</p>
    <a href="https://github.com/VanemKrAu/Ace-Racer-Calc/issues" target="_blank" class="bug-btn">${ICON.github}<span>${t('前往 GitHub 提交 Issue', 'Submit Issue on GitHub')}</span>${ICON.arrow}</a>
  </div>
  <div class="card thanks-card">
    <div class="card-title">${t('特别鸣谢', 'Special Thanks')}</div>
    <p class="card-text">${t('上榜条件（三项满足任一即可）：<br>①在GitHub Issues中提交一次可复现的严重影响正常使用的技术性BUG（有详细操作过程），②提出一次被采纳的新功能建议，③累积打赏超过30元（请将打赏记录发送至我的邮箱 vanemmailbox@qq.com，否则无法统计）。', 'Listing conditions (meet any one):<br>① Submit a reproducible technical bug that seriously affects normal use in GitHub Issues (with detailed steps), ② Submit a new feature suggestion that is adopted, ③ Accumulate more than 30 RMB in donations (please send donation records to my email vanemmailbox@qq.com, otherwise it cannot be counted).')}</p>
    <div class="thanks-list"><span class="thanks-item">清秒</span><span class="thanks-item">残梦</span><span class="thanks-item">野马、YT</span><span class="thanks-item">柏拉图plato</span></div>
    <p class="card-text thanks-foot">${t('非常感谢以上车友在网站早期的开发中提供了功能灵感和宝贵的测试数据。<br>如果有更多关于功能的建议或者发现了遗漏的BUG，欢迎随时交流！', 'Thanks to players above for inspiration and test data.<br>Any suggestions or bug reports are welcome!')}</p>
  </div>
  <div class="bottom-image-wrapper">
    <div class="bottom-msg-text">${t('如果觉得这个工具做的还不错的话，可以通过微信赞赏码来支持我，您的赞赏就是我更新的最大动力，感谢', 'If you like this tool, please consider supporting me via GitHub Sponsors. Your sponsorship is my greatest motivation to keep updating! Thanks')}</div>
    <img id="imgDark" src="https://i0.hdslb.com/bfs/openplatform/07d46fa9619f7ae4fa275da96d3c34d78e552624.png" alt="微信赞赏码" crossorigin="anonymous">
    <img id="imgLight" src="https://i0.hdslb.com/bfs/openplatform/0a2da617afc377db4eb2cc9cc3a6fbef73d49013.png" alt="微信赞赏码" crossorigin="anonymous">
    <a id="gh-support-link" href="https://github.com/sponsors/VanemKrAu" target="_blank">${ICON.github}${ICON.heart}<span>Sponsor VanemKrAu on GitHub</span></a>
  </div>
</footer>`;

const toast = () => `<div id="copyToast" class="copy-toast">${t('操作成功！', 'Operation Successful!')}</div>`;

// 结果速览（新增的纯展示元素：镜像两张结果卡，点击滚动过去）
const dock = () => `
<nav class="ds-dock" data-html2canvas-ignore="true" aria-label="结果速览">
  <button type="button" class="ds-dock-item" data-gauge="first" data-target="calcAreaFirst" data-target-fallback="resultCardFirst" data-state="idle"><span class="ds-dock-k">${t('首发', '1st Ult')}</span><span class="ds-dock-v">--</span></button>
  <button type="button" class="ds-dock-item" data-gauge="loop" data-target="calcAreaLoop" data-target-fallback="resultCardLoop" data-state="idle"><span class="ds-dock-k">${t('循环', 'Loop')}</span><span class="ds-dock-v">--</span></button>
</nav>`;

// 预览专用：三版互相切换（正式版不传 versions，返回空串）
const switcher = (versions, current) => (!versions ? '' : `
<nav class="ds-switch" data-html2canvas-ignore="true"><span class="ds-switch-tag">UI 预览</span>${versions
  .map((v) => `<a href="${v.file}" target="_self"${v.id === current ? ' aria-current="page"' : ''}>${v.name}</a>`).join('')}</nav>`);

const C = { menuDropdown, themeDropdown, langButton, header, tutorial, footnote, carPreview, carSelect, coreCard, nitroCard, counterCard, effCard, empowerCard, extraCard, customCard, chipCard, nitroCountCard, resultFirst, resultLoop, divider, shareBlock, footer, toast, dock, switcher, t, ICON };
// ---------- 三套版式 ----------
const baseSections = () => `
<div class="desktop-layout" id="topLayout">
  <div class="desktop-col">${coreCard()}${nitroCard()}${counterCard()}${effCard()}</div>
  <div class="desktop-col">${empowerCard()}${extraCard()}${customCard()}</div>
</div>`;

// A 计时塔：左侧参数，右侧结果轨道常驻（sticky）
const layoutA = (o) => `
${switcher(o.versions, o.current)}
<div class="app-container">
  <div class="top-bar" data-html2canvas-ignore="true">
    <div class="top-right">${langButton()}${themeDropdown('right')}${menuDropdown('right')}</div>
  </div>
  <div id="captureArea">
    ${header()}
    ${tutorial(o.notesInner)}
    <div class="tt-grid">
      <main class="tt-main">
        <div class="desktop-layout tt-car"><div class="desktop-col">${carPreview()}</div><div class="desktop-col">${carSelect()}${footnote()}</div></div>
        ${divider('基础属性及赋能调整区', 'Base Stats & Empowerment Tweaks')}
        ${baseSections()}
        <div class="desktop-layout tt-calc">
          <div class="desktop-col">${divider('首发一大交互测算区', 'First Ult Calculation Area')}${chipCard()}</div>
          <div class="desktop-col">${divider('后续大招循环测算区', 'Subsequent Ult Loop Area')}${nitroCountCard()}</div>
        </div>
      </main>
      <aside class="tt-rail">${resultFirst()}${resultLoop()}</aside>
    </div>
  </div>
  ${shareBlock()}
  ${footer()}
</div>
${dock()}
${toast()}`;

// B 规格书：编号章节，左栏章节名、右栏内容；输入与结论并排
const sheetSec = (head, body, cls = '') => `<section class="sheet-sec ${cls}"><div class="sheet-head">${head}</div><div class="sheet-body">${body}</div></section>`;
const layoutB = (o) => `
${switcher(o.versions, o.current)}
<div class="app-container">
  <div class="top-bar" data-html2canvas-ignore="true">
    <div class="sheet-mast"><b>ACE RACER</b> CALC <span>aceracercalc.top</span></div>
    <div class="top-right">${langButton()}${themeDropdown('right')}${menuDropdown('right')}</div>
  </div>
  <div id="captureArea">
    ${header()}
    ${tutorial(o.notesInner)}
    ${footnote()}
    ${sheetSec(divider('赛车', 'Vehicle'), `<div class="desktop-layout"><div class="desktop-col">${carPreview()}</div><div class="desktop-col">${carSelect()}</div></div>`)}
    ${sheetSec(divider('基础属性及赋能调整区', 'Base Stats & Empowerment Tweaks'), baseSections())}
    ${sheetSec(divider('首发一大交互测算区', 'First Ult Calculation Area'), `<div class="desktop-layout sheet-calc"><div class="desktop-col">${chipCard()}</div><div class="desktop-col">${resultFirst()}</div></div>`)}
    ${sheetSec(divider('后续大招循环测算区', 'Subsequent Ult Loop Area'), `<div class="desktop-layout sheet-calc"><div class="desktop-col">${nitroCountCard()}</div><div class="desktop-col">${resultLoop()}</div></div>`)}
  </div>
  ${shareBlock()}
  ${footer()}
</div>
${toast()}`;

// C 车机：分组列表 + 左侧结果组件常驻，移动端底部结果胶囊
const layoutC = (o) => `
${switcher(o.versions, o.current)}
<div class="ds-ambient" aria-hidden="true" data-html2canvas-ignore="true"><canvas id="dsAmbientImg"></canvas><canvas id="dsAmbientImg2"></canvas></div>
<div class="app-container">
  <div class="top-bar" data-html2canvas-ignore="true">
    <div class="top-left">${menuDropdown('left')}</div>
    <div class="top-right">${langButton()}${themeDropdown('right')}</div>
  </div>
  <div id="captureArea">
    ${header()}
    ${tutorial(o.notesInner)}
    <div class="desktop-layout cp-hero"><div class="desktop-col">${carPreview()}</div><div class="desktop-col">${carSelect()}${footnote()}</div></div>
    <div class="cp-base">
      ${divider('基础属性及赋能调整区', 'Base Stats & Empowerment Tweaks')}
      ${baseSections()}
    </div>
    <div class="cp-calc">
      <section class="cp-group cp-group-first" id="calcAreaFirst">
        <div class="cp-group-head"><span class="cp-step">1</span>${divider('首发一大交互测算区', 'First Ult Calculation Area')}</div>
        <div class="cp-group-body">${chipCard()}${resultFirst()}</div>
      </section>
      <div class="cp-split" aria-hidden="true"><span class="cp-split-long">${t('首发一大 ⟷ 后续循环 · 两套独立测算', '1st Ult ⟷ Loop · separate calculations')}</span><span class="cp-split-short">${t('两套独立测算', 'SEPARATE')}</span></div>
      <section class="cp-group cp-group-loop" id="calcAreaLoop">
        <div class="cp-group-head"><span class="cp-step">2</span>${divider('后续大招循环测算区', 'Subsequent Ult Loop Area')}</div>
        <div class="cp-group-body">${nitroCountCard()}${resultLoop()}</div>
      </section>
    </div>
  </div>
  ${shareBlock()}
  ${footer()}
</div>
${dock()}
${toast()}`;

export function buildBody(id, opts) {
  const fn = { a: layoutA, b: layoutB, c: layoutC }[id];
  if (!fn) throw new Error('未知版本 ' + id);
  return fn(opts);
}
export { C };
