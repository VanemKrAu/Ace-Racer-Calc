const fs = require('fs');
const path = require('path');
const pinyin = require('pinyin');

const vehiclesDir = path.join(__dirname, '..', 'data', '26-07-15_29734784_android', 'full', 'vehicles');
const outputFile = path.join(__dirname, '..', 'car-database.js');
const rawDataDir = 'E:/AceRacer/AceRacing-Workbench/data/26-09-18_29825663_android';

// 车辆添加时间登记表（新增车辆时在此登记，用于列表"新车在上"排序）
// 时间戳 = 该车加入网站的时间 (Date.now())
const ADDED_AT = {
  12050: 1790841739849, // 法拉利 SF90 XX Stradale
  12104: 1790841739849, // 炎龙驹
  12094: 1787240818462, // 罗刹
  12102: 1787240818462, // 货拉拉多拉
  10019: 1789736122761, // 丰田 86
  12089: 1789736122761, // 狻猊
};

// 游戏排期时间补丁表（秒级 Unix 时间戳，与 publication.releaseTimestamp 同单位）
// 只登记「游戏数据里 releaseTimestamp=0 但需要归位」的车
const RELEASE_PATCH = {
  12099: 1783008000, // 百变小鹦：数据中无排期时间，暂借 ID 邻居 12098 的排期（2026-07-02）
};

// 内建字段覆盖表（历史遗留存档）。
// ⚠ 不要再往这里加新条目 —— 新裁决一律写 data/car-overrides.json，那份表优先级更高、
//   每条能带依据、也不会跟脚本代码搅在一起。本表只作早期条目的留存。
// 背景：car-database.js 是每次重建生成的，手工改会在下次更新时被打回，所以任何
//       「提取值不对」的结论都必须落到一张表里才留得住。
const FIELD_OVERRIDE = {
  10019: { nitro_charge: null }, // 丰田 86：没有「每次释放氮气时的自充能」，提取到的 7 是错的；
                                 // 留着会让选车时自动勾选并填入「氮气自充能」。

  // ── 条件 / 行为触发类自充能：不是「每次放大招都给」，一律迁到 custom_charge ──────
  //   前端把它填进「自定义触发自充能 → 每次触发附加百分比」，
  //   触发次数留 0，由用户按自己的跑法手填；数值与原 ult_charge_loop 一致。
  10018: { ult_charge_loop: null, custom_charge: 15 }, // 比亚迪 汉：第 5 名及以后放大招时自充能 15%
  10030: { ult_charge_loop: null, custom_charge: 4 },  // 阿斯顿马丁 Vanquish：每次进入漂移自充能 4%
  10045: { ult_charge_loop: null, custom_charge: 5 },  // 英菲尼迪 Prototype：每次用涡轮 2.5%（紫涡轮翻倍 = 5%）
  10046: { ult_charge_loop: null, custom_charge: 4 },  // 柯尼塞格 Jesko：每 7 秒自充能 4%
  10047: { ult_charge_loop: null, custom_charge: 15 }, // 闪灵：每次受到封禁效果时自充能 15%
  10049: { ult_charge_loop: null, custom_charge: 5 },  // 火箭狐：每次使用涡轮获得 5% 大招能量
  10050: { ult_charge_loop: null, custom_charge: 90 }, // 柯尼塞格 Regera：闪现中超越车辆时自充能 90%
  10053: { ult_charge_loop: null, custom_charge: 1 },  // 五菱宏光 MINI EV：每次使用涡轮自充能 1%
  10066: { ult_charge_loop: null, custom_charge: 22 }, // 圣骑士：圣印-充能「第 1 次使用大招时解锁获得 22%」——一次性，
                                                      //   首发填 1 次、循环填 0 次，不该按每次大招都给
  10067: { ult_charge_loop: null, custom_charge: 37 }, // 玛莎拉蒂 Alfieri：大招期间超 300km/h 立即自充能 37%
  10085: { ult_charge_loop: null, custom_charge: 10 }, // 记录官：每次超越其他车辆时自充能 10%
  10095: { ult_charge_loop: null, custom_charge: 15 }, // 极狐阿尔法S 全新HI版：第 5 名及以后放大招时自充能 15%
  12039: { ult_charge_loop: null, custom_charge: 4 },  // 蛋仔出击：每隔 5 秒随机增益里有「获得 4% 大招能量」
  12048: { ult_charge_loop: null, custom_charge: 40 }, // 兰博基尼 Aventador J：大招期间未成功合体则大招结束自充能 40%
  12079: { ult_charge_loop: null, custom_charge: 10 }, // 兰博基尼 Revuelto：大招期间超越/被超越时获得 10%
  // 故意没迁的两辆：
  //   10011 蔚来 EP9「每次大招结束时自充能 20%」—— 每次放大招必触发，留在 ult_charge_loop 才对；
  //   12067 奥迪 RS 3「大招自动充能 13%」—— 面板值，但技能描述里那 13% 是给队友的状态效果，待确认，暂不动。

  // 柯尼塞格 One:1：技能「主动大招结束后自动释放一次无消耗的大招」——一管能量实得两段大招。
  //   面板里的「加速时长 6 秒」只是单段值，实战口径要按两段算 12 秒；
  //   ult_chain 供前端在自动填充提示里标明「大招连发」。
  //   （布加迪 LVN 也有「大招连发」标签，但那来自「漂移 4 次进黑夜领域」，不适用翻倍。）
  12068: { ult_duration: 12, ult_chain: true },
};

// 辅助充能覆盖表（给队友的大招能量，供前端「辅助」模式自动填入，以及「团魂」模式的队友辅助车下拉）。
// 字段：assist_charge 单次给的百分比（满管记 100）；assist_kind 给法：
//   once = 大招开始时给一次 · per_sec = 大招期间每秒给 · per_nitro = 大招状态下自己每用一次氮气给一次 · full = 直接补满一管
// assist_hits：一次大招默认给几次（不写时前端按给法推：once / per_nitro / full = 1，per_sec = 大招秒数）
// assist_note / assist_note_en：自动填入时给用户看的补充说明（条件触发、附带效果等）
// 大部分辅助车直接从大招面板「友方充能」读出来（见 extractAssist），这里只登记读不到或需要补说明的。
const ASSIST_OVERRIDE = {
  // 面板里没有「友方充能」行，但大招确实给队友能量：
  12036: { assist_charge: 7.5, assist_kind: 'once', assist_hits: 4,   // 游龙惊鸿：「游龙大招充能 7.5%」
    assist_note: '游龙在赛道中存在 10 秒，每 3 秒给一次（CD 3 秒），一次大招最多 4 次',
    assist_note_en: 'The dragon lasts 10s and charges every 3s (CD 3s): up to 4 hits per ult' },
  12067: { assist_charge: 13, assist_kind: 'once', assist_hits: 2,    // 奥迪 RS 3：「大招自动充能 13%」是给队友的状态效果
    assist_note: '队友进入 7 秒鬼斧神工状态，状态开始和结束时各得 13%（期间大招 50% 能量即可使用）',
    assist_note_en: 'Allies enter a 7s state and get 13% when it starts and again when it ends (ult usable at 50% meanwhile)' },
  12008: { assist_charge: 7.5, assist_kind: 'once', assist_hits: 1,   // 幻蝶：大招只给充能效率翻倍
    assist_note: '大招本身不直接给能量（飞行结束让队友 4 秒内充能效率翻倍）；这里取的是被动「每 3 秒为队友充能 7.5%」',
    assist_note_en: 'The ult itself gives no energy (it doubles allies\' efficiency for 4s); this is the passive "7.5% to allies every 3s"' },
  // 能读出数值，但给法有附加条件 / 附带效果：
  12072: { assist_note: '另有被动：开局暖车结束（第 10 秒）为队友提供 33%',
    assist_note_en: 'Passive: +33% to allies when the 10s warm-up ends' },
  10072: { assist_note: '队友若在加速期间点击大招，还会额外获得 35%',
    assist_note_en: 'Allies who tap ult during the boost get an extra 35%' },
  10063: { assist_note: '队友在 10 秒直线赋能内首次漂移时才获得',
    assist_note_en: 'Granted on the ally\'s first drift within the 10s state' },
  12003: { assist_note: '队友在 10 秒直线赋能内首次漂移时才获得',
    assist_note_en: 'Granted on the ally\'s first drift within the 10s state' },
  12084: { assist_note: '队友通过换电站时获得',
    assist_note_en: 'Granted when the ally drives through the swap station' },
  10020: { assist_note: '另外让队友立即获得一个时长 50% 的额外大招',
    assist_note_en: 'Also gives allies an extra ult at 50% duration' },
  10057: { assist_note: '旗舰支援状态下，自己每用一次氮气给队友一次（同时给 3000 集气）',
    assist_note_en: 'In Flagship Support, each of your nitros charges allies (plus 3000 nitro gauge)' },
  10089: { assist_note: '旗舰支援状态下，自己每用一次氮气给队友一次（同时给 3000 集气）',
    assist_note_en: 'In Flagship Support, each of your nitros charges allies (plus 3000 nitro gauge)' },
  12060: { assist_note: '友方累计 15 次涡轮、15 次氮气、15 次大招后，开大时额外再辅助一次',
    assist_note_en: 'After the team uses 15 turbos, nitros and ults, each ult assists once more' },
  12054: { assist_note: '收到辅助的队友下一次腾空时再得 15%',
    assist_note_en: 'Allies who received it get another 15% on their next jump' },
  10030: { assist_note: '队友收到后 6 秒内开大，第 6 秒能量回溯到收到时',
    assist_note_en: 'If the ally ults within 6s, their energy rewinds to the moment they received it' },
  10086: { assist_note: '另外强化队友下一次氮气：使用时额外充能 8%',
    assist_note_en: 'Also empowers the ally\'s next nitro: +8% when used' },
  10043: { assist_note: '另有被动：起步时全部队友获得 10% 大招能量',
    assist_note_en: 'Passive: all allies get 10% ult energy at the start' },
};

// 从大招面板读「友方充能」（只看辅助位）。值有三种写法：
//   「33%」= 大招开始时给一次；「5%每秒」= 大招期间每秒给；「充满一管」= 直接补满
// 旗舰支援类（平行巡洋舰 / 问界 M5）面板写的是单次值，但给法是「大招状态下自己每用一次氮气给一次」
function extractAssist(v) {
  if (!/辅助/.test(v.positionLabel || v.position || '')) return null;
  const rows = (v.skillPanelGroups && v.skillPanelGroups.ultimate) || [];
  const fd = (v.richText && v.richText.feature_desc && v.richText.feature_desc.raw) || '';
  for (const g of rows) {
    const n = (g.name_rich && g.name_rich.raw) || '';
    const val = g.value_text || '';
    if (!/友方充能/.test(n)) continue;              // 「一段友方充能」也算（摇尾萌萌虎）
    if (/充满/.test(val)) return { assist_charge: 100, assist_kind: 'full' };
    const m = val.match(/(\d+(?:\.\d+)?)/);
    if (!m) continue;
    const num = parseFloat(m[1]);
    if (!(num > 0 && num <= 100)) continue;
    const kind = /每秒/.test(n + ' ' + val) ? 'per_sec' : /每次使用氮气/.test(fd) ? 'per_nitro' : 'once';
    return { assist_charge: num, assist_kind: kind };
  }
  return null;
}

// ── 人工裁决表 data/car-overrides.json ────────────────────────────────────────
// 由 agent 读懂技能原文后填写，优先于脚本提取值，也优先于上面的 FIELD_OVERRIDE。
// 脚本只做字面提取，读不懂「(超越/被超越)」这类条件限定词，所以凡是需要看语义的
// 字段归属，结论都得住在这份表里。流程见 .agents/skills/ace-racer-update/SKILL.md。
const OVERRIDES_FILE = path.join(__dirname, '..', 'data', 'car-overrides.json');
const CAR_OVERRIDES = (() => {
  try {
    return JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf-8'));
  } catch (e) {
    console.warn('[warn] 读不到 data/car-overrides.json（' + e.message + '），本次生成将不使用人工裁决。');
    return { cars: {} };
  }
})();

// 摊平成 id → {字段: 值}，跳过 _README 之类的非车辆键
const OVERRIDE_FIELDS = {};
for (const key of Object.keys(CAR_OVERRIDES.cars || {})) {
  if (!/^\d+$/.test(key)) continue;
  const entry = CAR_OVERRIDES.cars[key];
  if (entry && entry.fields) OVERRIDE_FIELDS[key] = Object.assign({}, entry.fields);
}

// Load raw JSONL data for nitro durations
const rawVehicleLines = fs.existsSync(rawDataDir + '/vehicle_data.jsonl')
  ? fs.readFileSync(rawDataDir + '/vehicle_data.jsonl', 'utf-8').split('\n').filter(Boolean)
  : [];
const rawSkillLines = fs.existsSync(rawDataDir + '/vehicle_skill_v2_data.jsonl')
  ? fs.readFileSync(rawDataDir + '/vehicle_skill_v2_data.jsonl', 'utf-8').split('\n').filter(Boolean)
  : [];
const rawInstLines = fs.existsSync(rawDataDir + '/vehicle_skill_instruction_data.jsonl')
  ? fs.readFileSync(rawDataDir + '/vehicle_skill_instruction_data.jsonl', 'utf-8').split('\n').filter(Boolean)
  : [];
const rawSkillValueLines = fs.existsSync(rawDataDir + '/skill_value_details_data.jsonl')
  ? fs.readFileSync(rawDataDir + '/skill_value_details_data.jsonl', 'utf-8').split('\n').filter(Boolean)
  : [];

// 这几份 JSONL 只躺在开发机的 E: 盘上，换台机器就没了。
// 缺了它们，nitro_duration 等字段会整列失真 —— 必须在生成前喊出来，
// 免得一份缺数据的 car-database.js 被当成正常产物提交上去。
if (rawVehicleLines.length === 0 || rawInstLines.length === 0) {
  console.warn('');
  console.warn('⚠ 读不到 JSONL 原始数据包：' + rawDataDir);
  console.warn(`  vehicle_data.jsonl ${rawVehicleLines.length} 行，vehicle_skill_instruction_data.jsonl ${rawInstLines.length} 行`);
  console.warn('  本次生成里 nitro_duration 等依赖 JSONL 的字段会失真，产物不要提交。');
  console.warn('  请回到装有该数据包的开发机上重跑，或在 SKILL.md 里补充数据包位置。');
  console.warn('');
}

// Build lookup: skillId -> instruction IDs
const skillToInsts = {};
const skillsById = {};
for (const line of rawSkillLines) {
  const s = JSON.parse(line);
  skillsById[s.id] = s;
  if (s.insts) skillToInsts[s.id] = s.insts;
}

// Build lookup: instructionId -> instruction data
const instById = {};
for (const line of rawInstLines) {
  const i = JSON.parse(line);
  instById[i.id] = i;
}

// Load skill_value_details for 额外起步充能 parsing
const skillValueDetails = [];
for (const line of rawSkillValueLines) {
  const sv = JSON.parse(line);
  if (sv.skill_value_name && sv.skill_value_name.includes('额外起步充能')) {
    skillValueDetails.push(sv);
  }
}

// Build lookup: vehicleId -> n2o instruction duration (raw * 2)
const vehicleNitroDuration = {};
// Also build: vehicleId -> ult threshold (min_charge)
const vehicleUltThreshold = {};
for (const line of rawVehicleLines) {
  const v = JSON.parse(line);
  const n2oId = v.n2o_skill;
  if (!n2oId) continue;
  const instIds = skillToInsts[n2oId];
  if (!instIds) continue;
  for (const instId of instIds) {
    const inst = instById[instId];
    if (inst && typeof inst.duration === 'number' && inst.duration > 0 && inst.duration < 100) {
      vehicleNitroDuration[v.id] = inst.duration * 2;
      break;
    }
  }
  // Also get ult threshold from particular_skill
  const ps = v.particular_skill;
  if (ps) {
    const sk = skillsById[ps];
    if (sk && typeof sk.min_charge === 'number') {
      vehicleUltThreshold[v.id] = sk.min_charge;
    }
  }
}

const files = fs.readdirSync(vehiclesDir).filter(f => f.endsWith('.json'));
const cars = [];

for (const file of files) {
  try {
    const raw = fs.readFileSync(path.join(vehiclesDir, file), 'utf-8');
    const data = JSON.parse(raw);
    const v = data.item;
    if (!v || !v.name) continue;

    const carId = v.id || parseInt(file.replace('.json', ''));
    const baseTier = v.levels?.[0];

    // Get ultimate skill info
    const ult = v.skills?.ultimate;
    let ultDuration = null;
    let ultType = ult?.type || null;
    let costRatio = null;

    // Check level-based duration overrides (from rich_text passive_skill_effect)
    if (v.levels) {
      // Search from highest level to lowest (level 9 overrides level 0)
      for (var li = v.levels.length - 1; li >= 0; li--) {
        var lvl = v.levels[li];
        var rt = lvl?.rich_text;
        if (!rt || !Array.isArray(rt.passive_skill_effect)) continue;
        for (var pei = 0; pei < rt.passive_skill_effect.length; pei++) {
          var label = String(rt.passive_skill_effect[pei] || '');
          if (label.includes('持续时间') || label.includes('时长')) {
            var val = rt.passive_skill_effect_value?.[pei];
            if (val) {
              var numM = String(val).match(/(\d+(?:\.\d+)?)/);
              if (numM) { ultDuration = parseFloat(numM[1]); break; }
            }
          }
        }
        if (ultDuration) break;
      }
    }

    if (ult?.instructions) {
      // Find the accel duration: look for any instruction with a reasonable duration (1-30s)
      if (!ultDuration) {
        for (var instIdx = 0; instIdx < ult.instructions.length; instIdx++) {
          var inst = ult.instructions[instIdx];
          if (inst && typeof inst.duration === 'number' && inst.duration >= 1 && inst.duration <= 30) {
            ultDuration = inst.duration;
            break;
          }
        }
      }
      const costInst = ult.instructions.find(i => i.cost_ratio);
      if (costInst?.cost_ratio) {
        costRatio = costInst.cost_ratio;
      }
    }

    // Parse ult threshold from ace_time_effect text like "达到70%能量即可使用"
    let ultThreshold = null;
    const aceTimeEffect = v.richText?.ace_time_effect || '';
    const thresholdMatch = aceTimeEffect.match(/达到(\d+)%/);
    if (thresholdMatch) {
      ultThreshold = parseInt(thresholdMatch[1], 10);
    }
    // Fallback: parse min_charge from ultimate skill value_texts
    if (ultThreshold === null && ult?.value_texts) {
      const minChargeEntry = ult.value_texts.find(vt => vt.key === 'min_charge');
      if (minChargeEntry) {
        const mc = parseInt(minChargeEntry.value, 10);
        if (!isNaN(mc) && mc > 0 && mc <= 10000) {
          ultThreshold = Math.round(mc / 100);
        }
      }
    }

    // SP skill info
    const sp = v.skills?.sp;
    let spExists = !!sp;

    // Parse chip slots from report
    let chipSlots = null;
    if (v.report?.sections) {
      for (const section of v.report.sections) {
        if (section.title === '芯片模块' && section.items) {
          for (const item of section.items) {
            if (item.label === '扩展芯片类型' && item.value) {
              chipSlots = item.value;
              break;
            }
          }
        }
        if (chipSlots) break;
      }
    }

    // Extract charge values from panel groups
    let nitroCharge = null;    // 氮气自充能
    let ultChargeFirst = null; // 起步额外充能
    let ultChargeLoop = null;  // 释放大招时自充能
    let perSecCharge = null;   // 每秒自充能
    let spCharge = null;       // SP自充能
    let customCharge = null;      // 自定义触发自充能（条件触发，每次触发附加百分比）
    let customChargeEvery = null; // 触发间隔：每 N 次触发事件记 1 次（无间隔时为 null）

    // Build combined text for enemy-dependency check
    const allText = [
      v.richText?.feature_desc?.raw || '',
      v.richText?.ace_time_effect || '',
      v.richText?.special_passive_skill_desc?.raw || '',
    ].join(' ');

    // 敌方依赖判定（2026-10-05 收窄）
    // 原先是「全车文本里出现『敌方』就丢弃 ult_charge_loop」，太粗暴。狻猊的 feature_desc
    // 写的是「若照亮自身则立即获得100%大招能量 / 若照亮队友则… / 若照亮敌方则…」，
    // 「敌方」只出现在第三个分支，与自身的 100% 充能毫无关系，却把整车充能一起废了；
    // 狄安娜、大买特买号、魔王同样被误伤（实测这 4 辆的面板「大招充能」被整条丢掉）。
    // 现改为只看「含充能 / 大招能量」的那些句子 —— 那才是这份充能的归属现场。
    const chargeSentences = allText
      .split(/[。；\n]/)
      .filter(s => /充能|大招能量/.test(s))
      .join(' ');
    const isEnemyDependent = chargeSentences.includes('敌方');

    // ── 「自身充能」类字段的统一防线（2026-10-01 全量审查后加）────────────────
    // 背景：丰田 86 的面板行名是「氮气损失充能 = 7%」（损失量），而 nitro_charge 当时
    //       只有「名称含氮气+充能」两个条件、一个排除都没有，于是把「损失」当成了「自充能」。
    // 规则：
    //   · 排除「损失/消耗/扣除/降低/减少/削减」—— 这些是扣能量，不是获得充能
    //   · 排除「上限/范围」—— 描述的是阈值或作用范围，不是充能量
    //   · 「每秒」值一律归 per_sec_charge，不得填进单次充能字段（限定词可能写在行值里）
    //   · 量级校验：充能百分比不可能超过 100%（布加迪 Chiron 的 500% 就是这么混进来的）
    //   · 不排除「友方」—— 实测口径：友方效果通常包含自己那辆车（已确认）
    const BAD_CHARGE = /损失|消耗|扣除|降低|减少|削减|上限|范围/;
    const isPerSecTxt = (name, value) => /每秒/.test(name + ' ' + value);
    // 「每N次…」是条件触发（归 custom_charge），不能被当成「每次放大招都自充能」
    const isEveryNTrigger = (name, value) => /每\s*\d+(?:\.\d+)?\s*次/.test(name + ' ' + value);
    const selfChargeOk = (name, value, num) => !BAD_CHARGE.test(name + ' ' + value) && !(num > 100);

    const spg = v.skillPanelGroups;
    if (spg) {
      // Ultimate panel
      if (spg.ultimate) {
        for (const g of spg.ultimate) {
          const n = g.name_rich?.raw || '';
          const val = g.value_text || '';
          const numM = val.match(/(\d+(?:\.\d+)?)/);
          const num = numM ? parseFloat(numM[1]) : null;
          if (num === null) continue;

          // 每秒自充（优先判定，避免被下面两个字段抢走）
          // 注意：限定词可能写在行值里（如「闪耀状态大招充能 = 4%每秒」），所以名字与值都要看
          if (isPerSecTxt(n, val) && n.includes('充能') && !n.includes('友方') && !n.includes('敌方') && selfChargeOk(n, val, num)) {
            perSecCharge = num;
            continue;
          }
          // 氮气额外充能（自身、非损失、非每秒）
          if (n.includes('氮气') && n.includes('充能') && selfChargeOk(n, val, num) && !isPerSecTxt(n, val)) {
            nitroCharge = num;
          }
          // 大招自充/自身充能 (self, not ally/enemy, not per-sec, not every-N-trigger)
          if ((n.includes('大招') || n.includes('自身')) && n.includes('充能') && !n.includes('友方') && !n.includes('敌方') && !n.includes('每秒')
              && selfChargeOk(n, val, num) && !isPerSecTxt(n, val) && !isEveryNTrigger(n, val)) {
            if (!isEnemyDependent) ultChargeLoop = num;
          }
          // 起步额外充能
          if (n.includes('额外起步充能') && selfChargeOk(n, val, num)) {
            ultChargeFirst = num;
          }
        }
      }
      // SP panel
      if (spg.sp) {
        for (const g of spg.sp) {
          const n = g.name_rich?.raw || '';
          const val = g.value_text || '';
          const numM = val.match(/(\d+(?:\.\d+)?)/);
          const num = numM ? parseFloat(numM[1]) : null;
          if (num === null) continue;
          if (n.includes('充能') && !n.includes('友方') && !n.includes('冷却') && !n.includes('集气') && !n.includes('自动') && !n.includes('压缩')
              && selfChargeOk(n, val, num)) {
            // Verify it's direct charge, not efficiency boost
            var spDesc = v.richText?.sp_skill_desc?.raw || '';
            if (!spDesc.includes('效率')) spCharge = num;
          }
        }
      }
      // Passive panel（原先这里比 ultimate 面板少了好几项排除条件，现与之一致）
      if (spg.passive) {
        for (const g of spg.passive) {
          const n = g.name_rich?.raw || '';
          const val = g.value_text || '';
          const numM = val.match(/(\d+(?:\.\d+)?)/);
          const num = numM ? parseFloat(numM[1]) : null;
          if (num === null) continue;
          if (isPerSecTxt(n, val) && n.includes('充能') && !n.includes('友方') && !n.includes('敌方') && selfChargeOk(n, val, num)) {
            perSecCharge = num;
            continue;
          }
          if (n.includes('氮气') && n.includes('充能') && selfChargeOk(n, val, num) && !isPerSecTxt(n, val)) {
            nitroCharge = num;
          }
          if ((n.includes('大招') || n.includes('自身')) && n.includes('充能') && !n.includes('友方') && !n.includes('敌方')
              && selfChargeOk(n, val, num) && !isPerSecTxt(n, val) && !isEveryNTrigger(n, val)) {
            if (!isEnemyDependent) ultChargeLoop = num;
          }
        }
      }
    }

    // Parse 额外起步充能 using reference site's method
    // Source 1: skill_value_details_data.jsonl → "额外起步充能" entries
    // Source 2: ace_time_effect text → "开局获得X%大招能量" pattern
    if (!ultChargeFirst) {
      // Source 1: skill_value_details
      for (const sv of skillValueDetails) {
        if (sv.vehicle_id !== carId) continue;
        if (!sv.skill_value_name || !sv.skill_value_name.includes('额外起步充能')) continue;
        const rawVal = (sv.skill_value_text || '').trim();
        const pctM = rawVal.match(/^(\d+(?:\.\d+)?)\s*%$/);
        if (pctM) {
          ultChargeFirst = parseFloat(pctM[1]);
          break;
        }
      }
      // Source 2: ace_time_effect text (only if not found from skill_details)
      if (!ultChargeFirst) {
        const aceText = v.richText?.ace_time_effect || '';
        const refRegex = /开局(?:时)?获得\s*(\d+(?:\.\d+)?)\s*%\s*(?:大招能量|能量)/g;
        const refMatch = refRegex.exec(aceText);
        if (refMatch) {
          ultChargeFirst = parseFloat(refMatch[1]);
        }
      }
      // Source 3: special_passive_skill_desc for "起步时" patterns (e.g., MINI JCW)
      if (!ultChargeFirst) {
        const spdText = v.richText?.special_passive_skill_desc?.raw || '';
        var spdLines = spdText.split('\n');
        for (var spdi = 0; spdi < spdLines.length; spdi++) {
          var spdLine = spdLines[spdi];
          if (!spdLine.includes('起步') || !spdLine.includes('%') || spdLine.includes('队友') || spdLine.includes('全体') || spdLine.includes('km/h')) continue;
          var spdMatch = spdLine.match(/获得[^%]*?(\d+(?:\.\d+)?)\s*%/);
          if (spdMatch) {
            var val = parseFloat(spdMatch[1]);
            // Only accept reasonable ult charge values (1-200%)
            if (val >= 1 && val <= 200) {
              ultChargeFirst = val;
            }
            break;
          }
        }
      }
      // Source 4: level-based "开局时大招初始能量值" (highest level first)
      if (!ultChargeFirst && v.levels) {
        for (var lvlIdx = v.levels.length - 1; lvlIdx >= 0; lvlIdx--) {
          var rt2 = v.levels[lvlIdx]?.rich_text;
          if (!rt2 || !Array.isArray(rt2.passive_skill_effect)) continue;
          for (var pej = 0; pej < rt2.passive_skill_effect.length; pej++) {
            var lab2 = String(rt2.passive_skill_effect[pej] || '');
            if (lab2.includes('开局') && (lab2.includes('能量') || lab2.includes('充能'))) {
              var val2 = String(rt2.passive_skill_effect_value?.[pej] || '');
              var pct2 = val2.match(/(\d+(?:\.\d+)?)\s*%/);
              if (pct2) {
                var pv = parseFloat(pct2[1]);
                if (pv > 0) { ultChargeFirst = pv; break; }
              }
            }
          }
          if (ultChargeFirst) break;
        }
      }
    }

    // Also scan text descriptions for charge values
    const allDescText = [
      v.richText?.special_passive_skill_desc?.raw || '',
      v.richText?.feature_desc?.raw || '',
      v.richText?.sp_skill_desc?.raw || '',
      v.richText?.ace_time_effect || '',
    ].join(' ');

    // Nitro charge from text: patterns like "使用氮气时，额外获得X%大招能量"
    // Search each text block separately to avoid cross-text false matches
    if (!nitroCharge) {
      // 2026-10-01 修正：原正则 /使用氮气[\w\W]*?获得(\d+)%/ 会跨句贪婪匹配，
      //   把「使用氮气时损失15点耐久值，每次修复完成时获得30%」错挂成「氮气自充能 30%」。
      //   现在限制 30 字以内，且若这段里还夹着别的触发条件（修复完成/超越/漂移/…）就丢弃。
      var reNitro = /使用氮气[^。；;]{0,30}?获得(\d+(?:\.\d+)?)\s*%/;
      var OTHER_TRIGGER = /每次修复|修复完成|超越|漂移|命中|开局|受到|被干扰|撞击|碰撞|集气|损失|消耗/;
      var textBlocks = [
        v.richText?.special_passive_skill_desc?.raw || '',
        v.richText?.feature_desc?.raw || '',
        v.richText?.sp_skill_desc?.raw || '',
        v.richText?.ace_time_effect || '',
      ];
      for (var ti = 0; ti < textBlocks.length; ti++) {
        var nM = textBlocks[ti].match(reNitro);
        // 命中的片段里若夹着别的触发条件，或量级不合理（>100%），丢弃该次命中、继续找下一段
        if (nM && !OTHER_TRIGGER.test(nM[0]) && parseFloat(nM[1]) > 0 && parseFloat(nM[1]) <= 100) {
          nitroCharge = parseFloat(nM[1]); break;
        }
      }
    }

    // ── 条件触发自充能：「每N次…自充能X%」不是「每次释放大招都自充能」────────
    // 例：布加迪 LVN 大招「加速期间每 2 次进入漂移时自充能 6%」——
    //   6% 属于前端的「自定义触发自充能 (每次触发附加百分比)」，
    //   触发次数由用户按跑法手填；若当 ult_charge_loop 处理，等于每放一次大招白拿 6%。
    var chargeTextBlocks = [
      v.richText?.special_passive_skill_desc?.raw || '',
      v.richText?.feature_desc?.raw || '',
      v.richText?.sp_skill_desc?.raw || '',
      v.richText?.ace_time_effect || '',
    ];
    var RE_EVERY_TRIGGER = /每\s*(\d+(?:\.\d+)?)\s*次[^。；\n]{0,24}?自充能\s*(\d+(?:\.\d+)?)\s*%/;
    if (!customCharge) {
      for (var ti3 = 0; ti3 < chargeTextBlocks.length; ti3++) {
        var eM = chargeTextBlocks[ti3].match(RE_EVERY_TRIGGER);
        if (eM && parseFloat(eM[2]) > 0 && parseFloat(eM[2]) <= 100) {
          customCharge = parseFloat(eM[2]);
          customChargeEvery = parseFloat(eM[1]);
          break;
        }
      }
    }

    // Ult charge loop from text: "自充能X%" or "大招自充X%"
    if (!ultChargeLoop && !isEnemyDependent) {
      var reLoop = /自充能(\d+(?:\.\d+)?)\s*%/;
      for (var ti2 = 0; ti2 < chargeTextBlocks.length; ti2++) {
        var uM = chargeTextBlocks[ti2].match(reLoop);
        if (uM && parseFloat(uM[1]) > 0 && parseFloat(uM[1]) <= 100) {
          // Skip "每秒自充能" (per-second), that's a different field
          var before = chargeTextBlocks[ti2].slice(Math.max(0, uM.index - 4), uM.index);
          if (before.includes('每秒')) continue;
          // Skip「每N次…自充能X%」：条件触发，归 custom_charge，不是大招自充能
          var seg = chargeTextBlocks[ti2].slice(Math.max(0, uM.index - 24), uM.index + uM[0].length);
          if (/每\s*\d+(?:\.\d+)?\s*次/.test(seg)) continue;
          ultChargeLoop = parseFloat(uM[1]); break;
        }
      }
    }

    // SP charge from SP text: "获得XXX集气量和X%大招能量" (only from sp_skill_desc)
    if (!spCharge) {
      const spText = v.richText?.sp_skill_desc?.raw || '';
      // Skip conditional charges (每/每次 = each time)
      if (!spText.includes('每次')) {
        const spM = spText.match(/获得(\d+)集气量[和同]*(\d+(?:\.\d+)?)\s*%/);
        if (spM && parseFloat(spM[2]) > 0 && parseFloat(spM[2]) <= 100) spCharge = parseFloat(spM[2]);
      }
    }

    cars.push({
      id: carId,
      name: v.name,
      name_en: (() => {
        var n = v.name;
        // Brand translation map
        var brands = {
          '保时捷': 'Porsche', '兰博基尼': 'Lamborghini', '布加迪': 'Bugatti',
          '奥迪': 'Audi', '宝马': 'BMW', '迈凯伦': 'McLaren',
          '福特': 'Ford', '莲花': 'Lotus', '雪佛兰': 'Chevrolet',
          '柯尼塞格': 'Koenigsegg', '道奇': 'Dodge', '阿斯顿马丁': 'Aston Martin',
          '法拉利': 'Ferrari', '玛莎拉蒂': 'Maserati', '梅赛德斯-AMG': 'Mercedes-AMG',
          '梅赛德斯-奔驰': 'Mercedes-Benz', '比亚迪': 'BYD', '大众': 'Volkswagen',
          '本田': 'Honda', '宾利': 'Bentley', '日产': 'Nissan',
          '帕加尼': 'Pagani', '捷豹': 'Jaguar', '路虎': 'Land Rover',
          '路虎卫士': 'Land Rover Defender', '讴歌': 'Acura', '丰田': 'Toyota',
          '莱肯': 'Lykan', '一汽-大众': 'FAW-VW', '英菲尼迪': 'Infiniti',
          'MINI': 'MINI', 'AITO': 'AITO', 'MG6': 'MG6',
        };
        // Manual full-name overrides
        var overrides = {
          '百变小鹦': 'Colorful Parrot', '清规·浩然': 'Qinggui Haoran',
          '地狱火': 'Hellfire', '以太': 'Aether', '风神': 'Aeolus',
          '禅': 'Zen', '混沌': 'Chaos', '泰坦': 'Titan',
          '特异点': 'Singularity', '催化剂': 'Catalyst', '干扰者': 'Disruptor',
          '螺旋箭': 'Spiral Arrow', '燃烧太阳': 'Burning Sun',
          '刹那': 'Instant', '法拉第': 'Faraday', '神剑号': 'Excalibur',
          '战神': 'Ares', '风行者': 'Windwalker', '哈迪斯': 'Hades',
          '宙斯': 'Zeus', '波塞冬': 'Poseidon', '阿波罗': 'Apollo',
          '烛龙': 'Zhulong', '鹤羽': 'Crane Feather',
          '幻蝶': 'Phantom Butterfly', '赵云': 'Zhao Yun', '关羽': 'Guan Yu',
          '张飞': 'Zhang Fei', '逍遥': 'Xiaoyao', '超音速': 'Supersonic',
          '游龙惊鸿': 'Dragon Soar', '魔王': 'Demon King',
          '黑魔龙': 'Black Dragon', '绿箭骑士': 'Green Knight',
          '月宫圣使': 'Moon Envoy', '月宫舞灵': 'Moon Dancer',
          '玉麒麟': 'Jade Qilin', '星辰幻音': 'Stellar Echo',
          '醒觉之羽': 'Awakened Feather', '狂飙': 'Blazing Fury',
          '逐浪': 'Wave Rider', '隐刺': 'Hidden Thorn',
          '暗夜魅影': 'Night Phantom', '光天使': 'Light Angel',
          '幻海之汐': 'Mirage Tide', '寒霜冰魄': 'Frost Soul',
          '蛋仔出击': 'Eggling Strike', '团子': 'Dango',
          '果冻': 'Jelly', '凯蒂号': 'Kitty', '萌星凯蒂': 'Star Kitty',
          '饿龙传说': 'Hungry Dragon', '大买特买号': 'Shopmania',
          '泡泡旅行者': 'Bubble Traveler', '茶韵行者': 'Tea Wanderer',
          '招财福鼠': 'Fortune Mouse', '踏雪白驹': 'Snow Steed',
          '逐风青骥': 'Wind Steed', '竹叶青': 'Bamboo Viper',
          '黑曼巴': 'Black Mamba', '狄安娜': 'Diana',
          '星穹幻音': 'Stellar Phantom', '坚盾': 'Iron Shield',
          '复仇者': 'Avenger', '穿梭师': 'Voyager',
          '星际探路者': 'Star Pathfinder', '维纳斯': 'Venus',
          '记录官': 'Chronicler', '先驱者': 'Pioneer',
          '隐匿猎手': 'Hidden Hunter', '沙滩漫步者': 'Beach Walker',
          '侧翼刀锋': 'Side Blade', '承重钢轮': 'Steel Wheel',
          '开拓铁铲': 'Pioneer Shovel', '过载先锋': 'Overload Vanguard',
          '火箭狐': 'Rocket Fox', '闪灵': 'Phantom',
          '魔鬼鱼': 'Manta Ray', '平行巡洋舰': 'Parallel Cruiser',
          '猫眠梦': 'Catnap Dream', '杂耍者': 'Juggler',
          '圣骑士': 'Paladin', '机械咆哮虎': 'Mecha Tiger',
          '摇尾萌萌虎': 'Wagging Tiger', '空间漫游虎': 'Space Tiger',
          '速面': 'Swift Noodle', '真的好马': 'Good Steed',
          '王牌方程式': 'Ace Formula', '王牌方程式 EVO': 'Ace Formula EVO',
          '王牌速面': 'Ace Noodle', '仰望U8': 'Yangwang U8',
          '仰望U9': 'Yangwang U9',
        };
        if (overrides[n]) return overrides[n];
        // Try brand replacement
        for (var bk in brands) {
          if (n.indexOf(bk) === 0) {
            var rest = n.substring(bk.length).trim();
            return brands[bk] + (rest ? ' ' + rest : '');
          }
        }
        // Pinyin fallback for pure Chinese names
        try {
          var chars = n.split('');
          var result = [];
          var asciiBuf = '';
          for (var ci = 0; ci < chars.length; ci++) {
            var code = chars[ci].charCodeAt(0);
            if (code < 128) { asciiBuf += chars[ci]; }
            else {
              if (asciiBuf) { result.push(asciiBuf); asciiBuf = ''; }
              var py = pinyin.pinyin(chars[ci], { style: 0 });
              if (py && py[0]) result.push(py[0][0].charAt(0).toUpperCase() + py[0][0].slice(1));
              else result.push(chars[ci]);
            }
          }
          if (asciiBuf) result.push(asciiBuf);
          return result.join(' ');
        } catch(e) { return n; }
      })(),
      position: (v.positionLabel || '').replace('天平位（干扰）', '天平位').replace('天平位（竞速）', '天平位') || null,
      specialization: v.specialization || null,
      quality: v.quality || null,
      ace_charge: baseTier?.stats?.charge?.ace_charge || null,
      ult_duration: ultDuration,
      ult_type: ultType,
      cost_ratio: costRatio,
      has_sp: spExists,
      chip_slots: chipSlots,
      speed_limit: baseTier?.stats?.speed_limit || null,
      speedup_ratio: baseTier?.stats?.speedup_ratio || null,
      drift_coef: baseTier?.stats?.charge?.drift_charge_energy_coef || null,
      drift_min: baseTier?.stats?.charge?.drift_charge_energy_min || null,
      drift_max: baseTier?.stats?.charge?.drift_charge_energy_max || null,
      init_ratio: ult?.init_ratio || null,
      drift_extra_charge: baseTier?.stats?.charge?.drift_extra_charge || null,
      nitro_duration: vehicleNitroDuration[carId] || null,
      ult_threshold: ultThreshold,
      nitro_charge: nitroCharge,
      ult_charge_first: ultChargeFirst,
      ult_charge_loop: ultChargeLoop,
      per_sec_charge: perSecCharge,
      sp_charge: spCharge,
      // 条件触发自充能只在命中时才写进数据（保持其余车原有字段集，避免整库无谓 diff）
      ...(customCharge !== null ? { custom_charge: customCharge, custom_charge_every: customChargeEvery } : {}),
      // 辅助充能（给队友）：只在辅助位读到「友方充能」时写入
      ...(extractAssist(v) || {}),
      search_text: (() => {
        // For pinyin search: convert Chinese chars to pinyin, keep ASCII as-is
        var chars = v.name.split('');
        var pinyinParts = [];
        var asciiBuf = '';
        for (var ci = 0; ci < chars.length; ci++) {
          var code = chars[ci].charCodeAt(0);
          if (code < 128) {
            asciiBuf += chars[ci].toLowerCase();
          } else {
            if (asciiBuf) { pinyinParts.push(asciiBuf); asciiBuf = ''; }
            try {
              var py = pinyin.pinyin(chars[ci], { style: 0 });
              if (py && py[0]) pinyinParts.push(py[0][0].toLowerCase());
            } catch(e) { pinyinParts.push(chars[ci]); }
          }
        }
        if (asciiBuf) pinyinParts.push(asciiBuf);
        var result = pinyinParts.join('');
        // Generate pinyin initials (first letter of each Chinese char only)
        var initials = '';
        for (var ci = 0; ci < chars.length; ci++) {
          var code = chars[ci].charCodeAt(0);
          if (code >= 128) {
            try {
              var py = pinyin.pinyin(chars[ci], { style: 0 });
              if (py && py[0]) initials += py[0][0].charAt(0).toLowerCase();
            } catch(e) {}
          }
        }
        if (initials) result += ' ' + initials;
        // Add common Chinese aliases for better search
        var aliases = {
          '迈凯伦 Senna': '塞纳',
          '迈凯伦 P1': 'P1',
          '迈凯伦 720S': '720s',
          '迈凯伦 600LT': '600lt',
          '布加迪 Bolide': '飞火流星',
          '布加迪 Veyron': '威龙',
          '布加迪 Chiron': '凯龙',
          '布加迪 Divo': '迪沃',
          '布加迪 LVN': '拉瓦诺',
          '保时捷 911 GT2 RS': '保时捷911,gt2rs',
          '保时捷 911 Turbo S': '保时捷911',
          '保时捷 918 Spyder': '918',
          '保时捷 Macan S': 'macan',
          '保时捷 Panamera Turbo S': 'panamera',
          '保时捷 Taycan Turbo S': 'taycan',
          '保时捷 935': '935',
          '福特 Focus RS': '福克斯rs',
          '福特 Mustang': '野马',
          '福特 F150': '猛禽,f150',
          '福特 GT': '福特gt',
          '宝马 M4 Racing': 'm4',
          '宝马 M8 GTE': 'm8',
          '宝马 X5': 'x5',
          '宝马 i8': 'i8',
          '宝马 M4 CSL': 'm4',
          '兰博基尼 Aventador SVJ': '埃文塔多,svj,大牛',
          '兰博基尼 Huracán STO': '飓风,sto,小牛',
          '兰博基尼 Aventador J': '埃文塔多,小火车,火车头,火车',
          '兰博基尼 Veneno': '毒药',
          '兰博基尼 Revuelto': '雷维托,电牛,雷维尔托',
          '兰博基尼 Sesto Elemento': '第六元素',
          '法拉利 812 Competizione': '812',
          '法拉利 LaFerrari': '拉法',
          '阿斯顿马丁 Vanquish': '征服',
          '阿斯顿马丁 Valkyrie AMR Pro': '女武神',
          '阿斯顿马丁 DB11': 'db11',
          '梅赛德斯-AMG GT Black Series': 'amggt,洞奔,洞洞奔',
          '梅赛德斯-奔驰 Silver Arrow': '银箭',
          '梅赛德斯-AMG G 63': '大g',
          '梅赛德斯-AMG C 63 S Coupe': 'c63',
          '梅赛德斯-奔驰 Biome': 'biome,电奔',
          '雪佛兰 Camaro ZL1': '科迈罗,大黄蜂',
          '雪佛兰 Corvette ZR1': '科尔维特',
          '雪佛兰 Corvette C8': '科尔维特',
          '道奇 Charger SRT Hellcat': 'charger,地狱猫',
          '道奇 Challenger SRT 392': '挑战者',
          '道奇 Viper ACR': '蝰蛇',
          '日产 GT-R NISMO': 'gtr',
          '丰田 Corolla Sprinter Trueno GT Apex': 'ae86,卡罗拉',
          '本田 Civic Type R': 'type r,思域',
          '大众 Beetle': '甲壳虫',
          '大众 ID.R': 'idr',
          '一汽-大众 GOLF GTI': '高尔夫gti',
          '路虎卫士': '卫士',
          '路虎 Range Rover Evoque': '极光',
          '捷豹 F-TYPE SVR Convertible': 'ftype',
          '玛莎拉蒂 Levante': '莱万特',
          '玛莎拉蒂 Alfieri': '阿尔菲里',
          '帕加尼 Huayra': '风神',
          '柯尼塞格 Jesko': 'jesko,杰哥',
          '柯尼塞格 Regera': 'regera,瑞哥,五五开',
          '柯尼塞格 One:1': 'one1',
          '莲花 GT430': 'gt430',
          '莲花 Evija': 'evija,电莲,电莲花',
          '莲花 Evija X': 'evija',
          '莱肯 HyperSport': '莱肯',
          '奥迪 TT RS': 'ttrs',
          '奥迪 R8 Spyder V10': 'r8',
          '奥迪 RS7 Sportback': 'rs7',
          '奥迪 RS 6 Avant': 'rs6',
          '奥迪 RS 3': 'rs3',
          '宾利 Flying Spur Mulliner': '飞驰',
          '讴歌 NSX': 'nsx',
          '比亚迪 汉': '汉',
          '比亚迪 海豹': '海豹',
          '蔚来 EP9': 'ep9',
          '蔚来ET9': 'et9',
          '小鹏 P7': 'p7',
          '五菱宏光 MINI EV': 'mini ev,五菱mini',
          '坦克 300': '坦克300',
          '仰望U8': 'u8',
          '仰望U9': 'u9',
          '腾势N7': 'n7',
          '极氪007': '007',
          '影豹R·ABT联名版': '影豹r',
          '春风 450SR': '450sr',
          '乐道L60': 'l60',
          '方程豹 豹8': '豹8',
          'AITO 问界 M5 EV': '问界m5',
          '极狐阿尔法S 全新HI版': '极狐s',
          '极狐 GT': '极狐gt',
          '领克03 TCR': '领克03',
          'MG6 XPOWER TCR': 'mg6',
          'MINI JCW': 'mini',
          'MINI Buggy': 'mini',
          '英菲尼迪 Prototype': '肥皂,鼠标',
        };
        if (aliases[v.name]) result += ' ' + aliases[v.name];
        return result;
      })(),
      asset_dir: 'assets/' + v.name + '_' + carId,
      added_at: ADDED_AT[carId] || null,
      release_at: (function () {
        // 游戏排期时间（秒）→ 毫秒；无排期数据时用补丁表，再没有则为 null
        var ts = Number(v.publication && v.publication.releaseTimestamp) || 0;
        if (!ts) ts = Number(v.releaseTimestamp) || 0;
        if (!ts) ts = Number(RELEASE_PATCH[carId]) || 0;
        return ts > 0 ? ts * 1000 : null;
      })(),
    });
  } catch (e) {
    console.error(`Error processing ${file}: ${e.message}`);
  }
}

cars.sort((a, b) => b.id - a.id);

// 应用人工裁决：先套内建补丁表，再套 data/car-overrides.json（后者覆盖前者）
for (const c of cars) {
  const legacy = FIELD_OVERRIDE[c.id];
  if (legacy) Object.assign(c, legacy);
  const ruled = OVERRIDE_FIELDS[c.id];
  if (ruled) Object.assign(c, ruled);
}
// 应用辅助充能覆盖表（见 ASSIST_OVERRIDE 的说明）
for (const c of cars) {
  const ov = ASSIST_OVERRIDE[c.id];
  if (ov) Object.assign(c, ov);
}

const jsContent = `// Auto-generated car database - DO NOT EDIT MANUALLY
const CAR_DATABASE = ${JSON.stringify(cars, null, 2)};
`;

fs.writeFileSync(outputFile, jsContent, 'utf-8');
console.log(`Extracted ${cars.length} cars to ${outputFile}`);
console.log(`Applied ${Object.keys(OVERRIDE_FIELDS).length} human rulings from data/car-overrides.json`);

// ── 关卡：已登记入库的新车，必须有裁决记录 ──────────────────────────────────
// 脚本提取只能做字面活，新车的数据归属必须有人（agent）读过全文再拍板。
// 这条警告就是提醒「有车还没过目」，别让它悄悄混进数据库。
const addedIds = Object.keys(ADDED_AT);
const unaudited = addedIds.filter(id => !OVERRIDE_FIELDS[id]);
if (unaudited.length) {
  console.warn('');
  console.warn(`⚠ 有 ${unaudited.length} 辆已入库的新车还没有人工裁决记录：`);
  for (const id of unaudited) {
    const c = cars.find(x => String(x.id) === String(id));
    console.warn(`    ${id}  ${c ? c.name : '(数据库里找不到)'}`);
  }
  console.warn('    请先读技能原文再下结论，写进 data/car-overrides.json，流程见');
  console.warn('    .agents/skills/ace-racer-update/SKILL.md');
  console.warn('');
}
