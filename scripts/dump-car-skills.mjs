#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// 车辆技能证据包 —— 给 agent 读的，不是给人看的速览。
//
// 为什么需要它：脚本只能做字面提取。面板上「大招充能 10%」紧挨着一行灰色小字
// 「(超越/被超越)」，机器读得出 10%，读不出那个条件，于是把条件触发的充能
// 当成「每次放大招必给」——算出来的循环产出直接虚高。要判对归属，只能把原文
// 摊开、连灰色限定词一起看。
//
// 用法：
//   node scripts/dump-car-skills.mjs 12079            # 单车
//   node scripts/dump-car-skills.mjs 12079 12104      # 多车
//   node scripts/dump-car-skills.mjs --added          # ADDED_AT 里登记过的车
//   node scripts/dump-car-skills.mjs --unaudited      # 还没有裁决记录的车
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const VEHICLES_DIR = path.join(ROOT, 'data', '26-07-15_29734784_android', 'full', 'vehicles');
const DB_FILE = path.join(ROOT, 'car-database.js');
const OVERRIDES_FILE = path.join(ROOT, 'data', 'car-overrides.json');

// ── 读现有数据库 ─────────────────────────────────────────────────────────────
function loadDatabase() {
  const src = fs.readFileSync(DB_FILE, 'utf-8').replace('const CAR_DATABASE', 'var CAR_DATABASE');
  return new Function(src + '; return CAR_DATABASE;')();
}
function loadVehicle(id) {
  const f = path.join(VEHICLES_DIR, id + '.json');
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf-8')).item;
}
function loadAddedAt() {
  const src = fs.readFileSync(path.join(__dirname, 'extract-cars.js'), 'utf-8');
  const block = src.match(/const ADDED_AT = \{([\s\S]*?)\n\};/);
  const out = {};
  if (!block) return out;
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\s*(\d+):\s*(\d+),\s*(?:\/\/\s*(.*))?$/);
    if (m) out[m[1]] = m[3] || '';
  }
  return out;
}
function loadRuledIds() {
  try {
    const j = JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf-8'));
    return Object.keys(j.cars || {}).filter(k => /^\d+$/.test(k));
  } catch { return []; }
}

// ── 富文本清洗：去掉颜色标记，但括号里的限定词必须留下 ────────────────────────
const stripRich = (s) => String(s ?? '')
  .replace(/#tips\[([^\]]*)\]/g, '$1')
  .replace(/#[0-9a-fA-F]{6,8}/g, '')
  .replace(/\\n/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// 面板里带「参数 NNNN」这种名字的条目，实际是紧跟在上一条后面的条件说明
const isConditionRow = (name) => /^参数\s*\d+$/.test(String(name || '').trim());

// ── 条件触发词：出现这些词，说明那份充能不是「每次放大招必给」 ────────────────
const CONDITION_WORDS = [
  ['超越', '要被超越/超越别人'], ['漂移', '要处于漂移'], ['涡轮', '要用涡轮'],
  ['每隔', '按时间间隔'], ['每\\s*\\d+\\s*秒', '按时间间隔'], ['每\\s*\\d+\\s*次', '按次数累计'],
  ['受到', '要挨到特定效果'], ['击中', '要打到人'], ['被干扰', '要靠对手'],
  ['第\\s*\\d+\\s*名', '要看名次'], ['落后', '要看名次'], ['领先', '要看名次'],
  ['未成功', '要看判定结果'], ['随机', '随机性'], ['合体', '要看合体'],
  ['开局\\s*\\d+\\s*秒后', '要等时间'],
];

function findConditionHits(text) {
  const hits = [];
  for (const [re, why] of CONDITION_WORDS) {
    if (new RegExp(re).test(text)) hits.push({ word: re.replace(/\\s\*/g, '').replace(/\\d\+/g, 'N'), why });
  }
  return hits;
}

// ── 渲染单车 ─────────────────────────────────────────────────────────────────
function renderCar(id, db) {
  const item = loadVehicle(id);
  const line = '─'.repeat(72);
  console.log('\n' + '═'.repeat(72));
  console.log(`  ${item ? item.name : '(数据文件里没有这辆车) ' + id}   ·   ID ${id}`);
  console.log('═'.repeat(72));
  if (!item) { console.log('  找不到 data/.../vehicles/' + id + '.json'); return; }

  const last = item.levels[item.levels.length - 1];
  const lr = last.rich_text || {};
  const first = item.levels[0].rich_text || {};

  // 底子
  const chip = (item.report?.sections || [])
    .flatMap(s => s.items || [])
    .find(i => /扩展芯片类型/.test(i.label || ''))?.value;
  console.log('\n【底子】');
  console.log(`  ${item.quality || '?'} · ${item.positionLabel || '?'} · 专精 ${item.specialization || '?'}` + (chip ? `      芯片槽 ${chip}` : ''));
  const baseCharge = item.levels[0]?.stats?.charge?.ace_charge;
  if (baseCharge != null) console.log(`  基础双充 ace_charge = ${baseCharge}（万分比，前端取 /100 = ${(baseCharge / 100).toFixed(0)}%）`);

  // 面板
  console.log('\n【面板技能数值 skillPanelGroups】← 灰色小字就是条件限定，最容易漏读');
  const groups = item.skillPanelGroups || {};
  for (const g of Object.keys(groups)) {
    const rows = groups[g] || [];
    if (!rows.length) continue;
    console.log(`  ${g}`);
    for (const r of rows) {
      const nm = stripRich(r.name_rich?.raw || '');
      const val = stripRich(r.value_text || r.value_rich?.raw || '');
      if (isConditionRow(nm)) console.log(`      ✱ ${val}          ← 灰色小字，上一条的条件`);
      else console.log(`    「${nm}」  ${val}`);
    }
  }

  // 大招
  const ult = item.skills?.ultimate;
  if (ult) {
    console.log(`\n【大招 · ${ult.name || '?'} (${ult.type || '?'})】`);
    console.log('  一句话效果  levels[0].rich_text.ace_time_effect');
    console.log(`      ｜ ${stripRich(first.ace_time_effect) || '(空)'}`);
    const uniq = [...new Set(item.levels.map(l => stripRich(l.rich_text?.ace_time_effect)).filter(Boolean))];
    if (uniq.length > 1) {
      console.log('  各级不同的效果文本：');
      uniq.forEach(t => console.log(`      ｜ ${t}`));
    }
    const insts = ult.instructions || [];
    if (insts.length) {
      console.log('  指令表 skills.ultimate.instructions');
      let hidden = 0;
      for (const it of insts) {
        // duration >= 999 是引擎里的哨兵值（没有真实时长），列出来只会误导
        if (typeof it.duration === 'number' && it.duration >= 999) { hidden++; continue; }
        console.log(`      ${it.id}  ${it.inst_name || it.name || ''}  duration=${it.duration ?? '?'}s  cost_ratio=${it.cost_ratio ?? '?'}`);
      }
      if (hidden) console.log(`      （另有 ${hidden} 个无真实时长的引擎节点，已略去）`);
    }
    const vt = (ult.value_texts || []).filter(v => ['min_charge', 'skill_type', 'cam_type'].includes(v.key));
    if (vt.length) {
      console.log('  面板 value_texts');
      vt.forEach(v => console.log(`      ${v.label} = ${stripRich(v.value)}`));
    }
    if (ult.init_ratio != null) console.log(`  init_ratio = ${ult.init_ratio}`);
  }

  // 被动 / SP
  if (lr.special_passive_skill_desc) {
    console.log(`\n【被动 · ${stripRich(lr.special_passive_skill_title) || '?'}】`);
    console.log(`      ｜ ${stripRich(lr.special_passive_skill_desc)}`);
  }
  const pe = first.passive_skill_effect || [];
  const pv = first.passive_skill_effect_value || [];
  if (pe.filter(Boolean).length) {
    console.log('  passive_skill_effect');
    pe.forEach((t, i) => { if (t) console.log(`      ｜ ${stripRich(t)} = ${stripRich(pv[i] || '')}`); });
  }
  const sp = item.skills?.sp;
  if (sp) {
    console.log(`\n【SP 技能 · ${sp.name || '?'} (${sp.type || '?'})】`);
    let spChargeHint = false;
    for (const it of sp.instructions || []) {
      const nm = it.inst_name || it.name || '';
      if (/充能/.test(nm)) spChargeHint = true;
      if (typeof it.duration === 'number' && it.duration >= 999) continue;
      console.log(`      ${it.id}  ${nm}  duration=${it.duration ?? '?'}s`);
    }
    if (spChargeHint) console.log('      ✱ 指令里出现「充能」字样 —— 这下要核对 sp_charge 该不该有值');
  }
  const passives = Array.isArray(item.skills?.passive) ? item.skills.passive : [];
  if (passives.length) {
    console.log('\n【其它被动技能对象】' + passives.map(x => x.name).filter(Boolean).join('、'));
  }

  // 特性 / 简介
  const descBits = [];
  if (item.summary) descBits.push(['summary', item.summary]);
  if (item.description) descBits.push(['description', item.description]);
  if (lr.ace_time_charge_condition) descBits.push(['ace_time_charge_condition', lr.ace_time_charge_condition]);
  if (descBits.length) {
    console.log('\n【特性 / 简介】');
    descBits.forEach(([k, v]) => console.log(`  ${k}\n      ｜ ${stripRich(v)}`));
  }

  // 当前库里的值
  const car = db.find(c => c.id === Number(id));
  console.log('\n' + line);
  if (!car) { console.log('【当前数据库】里没有这辆车'); return; }
  console.log('【当前数据库里的值】');
  const show = ['ace_charge', 'init_ratio', 'ult_duration', 'ult_chain', 'ult_threshold', 'cost_ratio',
                'nitro_charge', 'nitro_duration', 'ult_charge_first', 'ult_charge_loop',
                'per_sec_charge', 'sp_charge', 'custom_charge'];
  for (const k of show) {
    if (k === 'custom_charge_every') continue;
    console.log(`  ${k.padEnd(18)} ${car[k] === undefined || car[k] === null ? 'null' : car[k]}`);
  }
  console.log(`  custom_charge_every  ${car.custom_charge_every == null ? 'null（= 每次触发均生效）' : car.custom_charge_every + '（每 ' + car.custom_charge_every + ' 次记 1 次）'}`);

  // ── 归属自检 ─────────────────────────────────────────────────────────────
  console.log('\n【归属自检】');
  const warns = [];

  const condSource = [
    stripRich(first.ace_time_effect),
    stripRich(lr.special_passive_skill_desc),
    stripRich(lr.ace_time_charge_condition),
    Object.keys(groups).flatMap(g => (groups[g] || []).map(r => stripRich(r.value_text || r.value_rich?.raw || ''))).join(' '),
    stripRich(item.description),
  ].join(' ');
  const condHits = findConditionHits(condSource);

  if (car.ult_charge_loop && condHits.length) {
    warns.push(`ult_charge_loop 有值（${car.ult_charge_loop}%），但原文里出现条件触发词：`
      + condHits.map(h => `${h.word}（${h.why}）`).join('、')
      + `\n      → 如果这份充能要靠这些条件才给，就不该放在 ult_charge_loop（循环模型会按每次放大招都给算），`
      + `\n        应改为 custom_charge，并在 evidence 里写清触发条件。`);
  }
  if (car.ult_charge_loop && /敌方/.test(condSource)) {
    warns.push(`ult_charge_loop 有值，但原文提到「敌方」—— 依赖敌方站位的充能应置 null 或归 custom_charge。`);
  }
  if (car.nitro_charge && /损失|扣除|消耗/.test(condSource + stripRich(lr.special_passive_skill_desc))) {
    warns.push(`nitro_charge 有值（${car.nitro_charge}%），但原文里出现「损失/扣除/消耗」—— 确认它不是「氮气损失充能」（那是负收益，不该填进来）。`);
  }
  if (car.custom_charge && !car.custom_charge_every && /每\s*\d+\s*次/.test(condSource)) {
    warns.push(`原文有「每 N 次…」的写法，但 custom_charge_every 没填 —— 若确实是「每 N 次触发一次」，补上这个字段；否则前端绿框会把它说成「每次触发均生效」。`);
  }
  if (car.ult_charge_loop == null && car.custom_charge == null && !car.ult_charge_first && !car.per_sec_charge) {
    warns.push(`这辆车目前没有任何充能类字段有值 —— 请确认原文里确实没有，而不是提取漏了。`);
  }
  if (car.ult_duration == null && /加速时长/.test(Object.keys(groups).flatMap(g => (groups[g] || []).map(r => stripRich(r.name_rich?.raw || ''))).join(' '))) {
    warns.push(`面板里写着「加速时长」但 ult_duration 是 null —— 核对是否漏填。`);
  }

  if (warns.length) warns.forEach(w => console.log('  ⚠ ' + w));
  else console.log('  ✓ 没发现明显矛盾');

  console.log('\n  下一步：把结论写进 data/car-overrides.json 的 cars["' + id + '"]，');
  console.log('           fields 填值、evidence 写清依据（引哪句原文、为什么这么归）。');
  console.log('           ▶ 完整流程见 .agents/skills/ace-racer-update/SKILL.md');
}

// ── 入口 ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (!args.length) {
  console.log('用法：node scripts/dump-car-skills.mjs <车ID...>');
  console.log('      node scripts/dump-car-skills.mjs --added       # ADDED_AT 登记过的车');
  console.log('      node scripts/dump-car-skills.mjs --unaudited   # 还没有裁决记录的车');
  process.exit(0);
}

const db = loadDatabase();
let ids;

if (args[0] === '--added') {
  ids = Object.keys(loadAddedAt());
} else if (args[0] === '--unaudited') {
  const ruled = new Set(loadRuledIds());
  ids = Object.keys(loadAddedAt()).filter(id => !ruled.has(id));
} else {
  ids = args.filter(a => /^\d+$/.test(a));
}

if (!ids.length) { console.log('没有匹配到车辆。'); process.exit(0); }
if (args[0].startsWith('--')) console.log(`\n共 ${ids.length} 辆：${ids.join(', ')}`);
for (const id of ids) renderCar(id, db);
console.log('');
