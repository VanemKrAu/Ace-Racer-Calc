const fs = require('fs');
const path = require('path');

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

    // Parse 起步额外充能 from text: "开局时获得X%大招能量"
    if (!ultChargeFirst) {
      var startSources = [
        v.richText?.ace_time_effect || '',
        v.richText?.special_passive_skill_desc?.raw || '',
        v.richText?.feature_desc?.raw || '',
      ];
      // Check each source separately to avoid cross-sentence matches
      for (var si = 0; si < startSources.length; si++) {
        var src = startSources[si];
        if (!src) continue;
        // Split by sentences and check each
        var sentences = src.split(/[。\n]/);
        for (var sj = 0; sj < sentences.length; sj++) {
          var sent = sentences[sj];
          if (!sent.includes('获得') || !sent.includes('%')) continue;
          // Filter: check if "每" appears between "开局/起步" and "获得"
          var startIdx = -1;
          if (sent.includes('开局')) startIdx = sent.indexOf('开局');
          else if (sent.includes('起步')) startIdx = sent.indexOf('起步');
          else if (sent.includes('比赛开始')) startIdx = sent.indexOf('比赛开始');
          var obtainIdx = sent.indexOf('获得', startIdx);
          var between = startIdx >= 0 && obtainIdx > startIdx ? sent.substring(startIdx, obtainIdx) : '';
          if (between.includes('每') || sent.includes('友方') || sent.includes('敌方') || sent.includes('队友') || sent.includes('全体')) continue;
          // Also check if the text after "获得" contains "每" (recurring charge)
          var afterObtain = obtainIdx > 0 ? sent.substring(obtainIdx) : '';
          if (afterObtain.includes('每')) continue;
          // Check if this sentence is about start/beginning
          if (sent.includes('开局') || sent.includes('起步') || sent.includes('比赛开始')) {
            var m = sent.match(/获得[^，]*?(\d+(?:\.\d+)?)\s*%/);
            if (m) {
              var val = parseFloat(m[1]);
              if (val >= 1 && val <= 200) {
                ultChargeFirst = val;
                break;
              }
            }
          }
        }
        if (ultChargeFirst) break;
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
    if (!nitroCharge) {
      // Use a character class that includes everything
      var reNitro = /使用氮气[\w\W]*?获得(\d+(?:\.\d+)?)\s*%/;
      var nM = allDescText.match(reNitro);
      if (nM) nitroCharge = parseFloat(nM[1]);
    }

    // Ult charge loop from text: "自充能X%" or "大招自充X%"
    if (!ultChargeLoop && !isEnemyDependent) {
      const uM = allDescText.match(/自充能(\d+(?:\.\d+)?)\s*%/);
      if (uM) ultChargeLoop = parseFloat(uM[1]);
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
