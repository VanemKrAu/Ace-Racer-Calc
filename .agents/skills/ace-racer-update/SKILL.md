---
name: ace-racer-update
description: "更新 Ace-Racer-Calc 项目的数据和 CDN。当用户说「更新网站」「加新车」「更新车辆数据」或需要运行 update workflow 时使用。"
allowed-tools: Read, Bash, Glob, Grep, Write, Edit
user-invocable: true
---

# Ace-Racer-Calc Update Workflow

项目路径: 仓库根目录 (clone 后进入项目目录)

## 数据提取与解析 (scripts/extract-cars.js 核心逻辑)

### 数据来源

| 来源 | 路径 | 用途 |
|------|------|------|
| 车辆 JSON | `data/.../full/vehicles/{id}.json` | 主数据源，每辆车一个文件 |
| JSONL 原始数据 (可选) | `E:/AceRacer/AceRacing-Workbench/data/.../` | 补充技能时长/阈值等（仅本地开发环境） |
| 百度 pinyin 包 | 已安装于项目本地 | 中文→拼音，用于搜索 |

### 字段解析规则

```
vehicle JSON → data.item
  ├── id           → 文件名去掉 .json
  ├── name         → v.name
  ├── position     → v.positionLabel (天平位同时合并非干扰/竞速)
  ├── specialization → v.specialization
  ├── ace_charge   → v.levels[0].stats.charge.ace_charge (万分比)
  │                  → 前端 baseNitro = ace_charge/100
  ├── init_ratio   → v.skills.ultimate.init_ratio (万分比, 22 辆车有值)
  │                  → 前端 startCharge = (ace_charge + init_ratio)/100, 上限 100%
  │                  ★ 没有 init_ratio 的车 → startCharge 仍 = ace_charge/100
  │                  ★ 示例: 保时捷 911 Turbo S (ace=1, init=10000) → start=100%
  ├── ult_duration → v.skills.ultimate.instructions 中 inst_type===2 的 duration
  ├── ult_type     → v.skills.ultimate.type
  ├── ult_threshold→ 从 v.richText.ace_time_effect 用 /达到(\d+)%/ 提取
  │                  → 失败时从 ultimate.value_texts 取 min_charge/100
  ├── cost_ratio   → ultimate.instructions 中 cost_ratio 字段
  ├── has_sp       → v.skills.sp 是否存在
  ├── chip_slots   → v.report.sections 中 "扩展芯片类型" 的值 (如 "○○△◇◇V")
  ├── speed_limit  → v.levels[0].stats.speed_limit
  ├── speedup_ratio→ v.levels[0].stats.speedup_ratio
  ├── nitro_duration→ 通过 JSONL: vehicle_data → n2o_skill → skill_instruction → duration*2
  │                  (在 index.html 中填入 time_1x6)
  ├── nitro_charge → 从 skillPanelGroups.ultimate/passive 中排查 "氮气"+"充能"
  │                  → 失败时从文本 /使用氮气[\w\W]*?获得(\d+(?:\.\d+)?)%/
  │                  (在 index.html 中填入 valExtraNitro)
  ├── ult_charge_first → 起步额外充能:
  │     Source 1: skillPanelGroups.ultimate 中 "额外起步充能"
  │     Source 2: skill_value_details_data.jsonl 中 vehicle_id匹配+"额外起步充能"
  │     Source 3: ace_time_effect → /开局获得X%能量/
  │     Source 4: special_passive_skill_desc → "起步时" 行
  │                  (在 index.html 中填入 valExtraUltFirst)
  ├── ult_charge_loop → 大招自充能:
  │     skillPanelGroups.ultimate/passive 中 "大招"/"自身"+"充能"
  │     (排除敌方依赖的)
  │     → 失败时从文本 /自充能X%/ 或 /大招自充X%/
  │                  (在 index.html 中填入 valExtraUltLoop)
  ├── per_sec_charge→ skillPanelGroups.ultimate/passive 中 "每秒"+"充能"
  │                  (在 index.html 中填入 valExtraPerSec)
  ├── sp_charge    → skillPanelGroups.sp 中 "充能"项
  │                 → 失败时从 sp_skill_desc 取 "获得XXX集气量和X%能量"
  │                  (在 index.html 中填入 valCustomTrig, 首发/循环各计1次)
  ├── search_text  → 中文转拼音 + 常用别名 (aliases 字典)
  └── asset_dir    → 'assets/' + name + '_' + id
```

### 额外起步充能 4 数据源优先级

优先 `skillPanelGroups` 数值 → JSONL `skill_value_details` → `ace_time_effect` 文本 → `special_passive_skill_desc` 文本

### 大招自充能 敌方依赖过滤

如果车辆文本（feature_desc / ace_time_effect / special_passive_skill_desc）包含 "敌方"，则 `ult_charge_loop` 强制为 null（不在前端自动填入，因为依赖敌方站位/数量）

## 添加新车 (有 single-{ID} 数据包)

### 手动复制数据

```
single-{ID}/vehicles/{ID}.json → data/26-07-15_29734784_android/full/vehicles/{ID}.json
single-{ID}/assets/*           → data/26-07-15_29734784_android/full/assets/
```

注意：`assets/` 下面是 `{车名}_{ID}/body/{ID}_m.png` 的目录结构

### 一键更新

```bash
node scripts/update.mjs [车ID...]
```

- 不加 ID: 自动扫描所有 `single-*` 目录
- 加 ID: 只处理指定车辆 (如 `node scripts/update.mjs 10037 12099`)
- 自动完成: 复制数据 → 重建 car-database.js → 上传图片到 B站 CDN → 刷新 index.html 中的 CDN URL 映射

### 跳过数据复制直接更新

如果 `full/vehicles/` 和 `full/assets/` 已就绪：
```bash
node scripts/extract-cars.js      # 重建 car-database.js
node scripts/upload-bili.mjs      # 上传新图到 CDN
```

### 验证数据是否提取正确

```bash
# 查看指定车辆的提取结果
node -e "
require('fs').readFileSync('car-database.js', 'utf-8').replace('const CAR_DATABASE', 'var CAR_DATABASE');
eval(require('fs').readFileSync('car-database.js', 'utf-8').replace('const CAR_DATABASE', 'var CAR_DATABASE'));
var car = CAR_DATABASE.find(c => c.id === 12099);
console.log(JSON.stringify(car, null, 2));
"
```

## B 站 Cookie 维护

Cookie 文件: `.agent_tmp/bili-cookies.json` (不受版本控制，需要从开发环境复制)

`scripts/upload-bili.mjs` 内置了 cookie。更新步骤：
1. 修改文件顶部 `SESSDATA` 和 `BILI_JCT` 两行
2. 保存到 `.agent_tmp/bili-cookies.json` 备份

获取 cookie: 登录 `bilibili.com` → F12 → Application → Cookies → 复制 `SESSDATA` 和 `bili_jct`

## Git 推送

```bash
cd /path/to/Ace-Racer-Calc
git pull
# 有新车数据: node scripts/update.mjs [车ID...]
# 无新车数据: 只需推送
git push
```

推送前自动执行 gitleaks 安全扫描和敏感文件检查。

## 文件说明

| 文件 | 作用 |
|------|------|
| `scripts/update.mjs` | 主工作流脚本，一键完成全部更新步骤 |
| `scripts/extract-cars.js` | 从 `full/vehicles/*.json` 提取数据生成 `car-database.js` |
| `scripts/upload-bili.mjs` | 上传新图片到 B站 CDN，保存 URL 映射 |
| `data/bili-url-mapping.json` | CDN URL → 本地路径映射表 |
| `car-database.js` | 全部车辆数据（由 extract-cars.js 生成，前端自动加载） |
| `data/26-07-15_29734784_android/full/vehicles/` | 车辆 JSON 源文件 |
| `data/26-07-15_29734784_android/full/assets/` | 车辆图片源文件 |
