const fs = require('fs');
const path = require('path');
const pinyin = require('pinyin');

const vehiclesDir = path.join(__dirname, '..', 'data', '26-07-15_29734784_android', 'full', 'vehicles');
const outputFile = path.join(__dirname, '..', 'car-database.js');
const rawDataDir = 'E:/AceRacer/AceRacing-Workbench/data/26-07-15_29734784_android';

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

    if (ult?.instructions) {
      const accelInst = ult.instructions.find(i => i.inst_type === 2);
      if (accelInst?.duration && accelInst.duration < 100) {
        ultDuration = accelInst.duration;
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

    // Build combined text for enemy-dependency check
    const allText = [
      v.richText?.feature_desc?.raw || '',
      v.richText?.ace_time_effect || '',
      v.richText?.special_passive_skill_desc?.raw || '',
    ].join(' ');
    const isEnemyDependent = allText.includes('敌方');

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

          // 氮气额外充能
          if (n.includes('氮气') && n.includes('充能')) {
            nitroCharge = num;
          }
          // 大招自充/自身充能 (self, not ally/enemy, not per-sec)
          if ((n.includes('大招') || n.includes('自身')) && n.includes('充能') && !n.includes('友方') && !n.includes('敌方') && !n.includes('范围') && !n.includes('降低') && !n.includes('损失') && !n.includes('扣能') && !n.includes('上限') && !n.includes('每秒')) {
            if (!isEnemyDependent) ultChargeLoop = num;
          }
          // 起步额外充能
          if (n.includes('额外起步充能')) {
            ultChargeFirst = num;
          }
          // 每秒自充
          if (n.includes('每秒') && n.includes('充能') && !n.includes('友方') && !n.includes('敌方')) {
            perSecCharge = num;
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
          if (n.includes('充能') && !n.includes('友方') && !n.includes('冷却') && !n.includes('集气') && !n.includes('自动') && !n.includes('压缩')) {
            spCharge = num;
          }
        }
      }
      // Passive panel
      if (spg.passive) {
        for (const g of spg.passive) {
          const n = g.name_rich?.raw || '';
          const val = g.value_text || '';
          const numM = val.match(/(\d+(?:\.\d+)?)/);
          const num = numM ? parseFloat(numM[1]) : null;
          if (num === null) continue;
          if (n.includes('氮气') && n.includes('充能')) {
            nitroCharge = num;
          }
          if ((n.includes('大招') || n.includes('自身')) && n.includes('充能') && !n.includes('友方') && !n.includes('敌方') && !n.includes('范围') && !n.includes('每秒')) {
            if (!isEnemyDependent) ultChargeLoop = num;
          }
          if (n.includes('每秒') && n.includes('充能')) {
            perSecCharge = num;
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
      var reNitro = /使用氮气[\w\W]*?获得(\d+(?:\.\d+)?)\s*%/;
      var textBlocks = [
        v.richText?.special_passive_skill_desc?.raw || '',
        v.richText?.feature_desc?.raw || '',
        v.richText?.sp_skill_desc?.raw || '',
        v.richText?.ace_time_effect || '',
      ];
      for (var ti = 0; ti < textBlocks.length; ti++) {
        var nM = textBlocks[ti].match(reNitro);
        if (nM) { nitroCharge = parseFloat(nM[1]); break; }
      }
    }

    // Ult charge loop from text: "自充能X%" or "大招自充X%"
    if (!ultChargeLoop && !isEnemyDependent) {
      var reLoop = /自充能(\d+(?:\.\d+)?)\s*%/;
      var textBlocks2 = [
        v.richText?.special_passive_skill_desc?.raw || '',
        v.richText?.feature_desc?.raw || '',
        v.richText?.sp_skill_desc?.raw || '',
        v.richText?.ace_time_effect || '',
      ];
      for (var ti2 = 0; ti2 < textBlocks2.length; ti2++) {
        var uM = textBlocks2[ti2].match(reLoop);
        if (uM) { ultChargeLoop = parseFloat(uM[1]); break; }
      }
    }

    // SP charge from SP text: "获得XXX集气量和X%大招能量" (only from sp_skill_desc)
    if (!spCharge) {
      const spText = v.richText?.sp_skill_desc?.raw || '';
      // Skip conditional charges (每/每次 = each time)
      if (!spText.includes('每次')) {
        const spM = spText.match(/获得(\d+)集气量[和同]*(\d+(?:\.\d+)?)\s*%/);
        if (spM) spCharge = parseFloat(spM[2]);
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
    });
  } catch (e) {
    console.error(`Error processing ${file}: ${e.message}`);
  }
}

cars.sort((a, b) => b.id - a.id);

const jsContent = `// Auto-generated car database - DO NOT EDIT MANUALLY
const CAR_DATABASE = ${JSON.stringify(cars, null, 2)};
`;

fs.writeFileSync(outputFile, jsContent, 'utf-8');
console.log(`Extracted ${cars.length} cars to ${outputFile}`);
