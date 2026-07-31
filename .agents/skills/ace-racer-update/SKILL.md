---
name: ace-racer-update
description: "更新 Ace-Racer-Calc 项目的数据和 CDN。当用户说「更新网站」「加新车」「更新车辆数据」或需要运行 update workflow 时使用。"
allowed-tools: Read, Bash, Glob, Grep, Write, Edit
user-invocable: true
---

# Ace-Racer-Calc Update Workflow

项目路径: 仓库根目录 (clone 后进入项目目录)

## 起步能量计算公式 (核心逻辑)

```
起步能量 = ace_charge + init_ratio + 额外起步充能
         (万分比)    (万分比)     (百分比)
```

三部分来源各自独立，前端在 `pickCar()` 中分两步填入：
1. `startCharge = (ace_charge + init_ratio) / 100` → 起步基础充能
2. `valExtraUltFirst = ult_charge_first` → 起步额外充能 (额外模块)

### init_ratio 的提取规则

`init_ratio` 只取 **基础技能**（`particular_skill` 指向的技能）的值。RECU 变体技能的 `init_ratio` 与 `ult_charge_first` 中的加成是同一份，不加重复。

当前实现：`v.skills?.ultimate?.init_ratio` (22 辆车有值)。未来需改为从 `vehicle_data.jsonl` 中查 `particular_skill` 再取 `init_ratio`。

### ult_charge_first (起步额外充能) 的 5 数据源

| 优先级 | 来源 | 提取方式 | 备注 |
|--------|------|----------|------|
| 1 | `skillPanelGroups.ultimate` | 查找 `name` 包含"额外起步充能" | |
| 2 | `skill_value_details_data.jsonl` | `skill_value_name` 包含"额外起步充能" + `vehicle_id` 匹配 | |
| 3 | `ace_time_effect` 文本 | 正则 `/开局(?:时)?获得\s*(\d+(?:\.\d+)?)\s*%\s*(?:大招能量\|能量)/` | 纯文本兜底 |
| 4 | `special_passive_skill_desc` 文本 | 查找含"起步"+"%"的行，正则 `/获得[^%]*?(\d+(?:\.\d+)?)\s*%/` | 仅接受 1-200% 合理范围 |
| 5 | `levels[最高级].rich_text.passive_skill_effect` | 查找含"开局"+"能量"/"充能"的标签，取对应 value | 覆盖 10 级才有的起步充能 |

## 数据提取与解析 (scripts/extract-cars.js 核心逻辑)

### 数据来源

| 来源 | 路径 | 用途 |
|------|------|------|
| 车辆 JSON | `data/.../full/vehicles/{id}.json` | 主数据源，每辆车一个文件 |
| JSONL 原始数据 (可选) | `E:/AceRacer/AceRacing-Workbench/data/.../` | 补充技能时长/阈值等（仅本地开发环境） |
| 百度 pinyin 包 | `npm install` 后位于 `node_modules/` | 中文→拼音，用于搜索 |

### 字段解析规则

```
vehicle JSON → data.item
  ├── id           → 文件名去掉 .json
  ├── name         → v.name
  ├── name_en      → 品牌翻译 + 保留型号 / 中文名拼音 / 手动覆盖
  ├── position     → v.positionLabel (天平位同时合并非干扰/竞速)
  ├── specialization → v.specialization
  ├── ace_charge   → v.levels[0].stats.charge.ace_charge (万分比)
  │                  → 前端 baseNitro = ace_charge / 100
  ├── init_ratio   → v.skills.ultimate.init_ratio (万分比)
  │                  → 前端 startCharge = (ace_charge + init_ratio)/100, 上限 100%
  │                  ★ 没有 init_ratio 的车 → startCharge = ace_charge/100
  ├── ult_duration →
  │     Source 1: v.levels[最高级].rich_text.passive_skill_effect 含"持续时间"/"时长" → 对应 value
  │     Source 2: v.skills.ultimate.instructions 中最先找到的 1-30s 合理 duration
  │     (前端填入 baseUltDuration, 无值填 0)
  ├── ult_type     → v.skills.ultimate.type
  ├── ult_threshold→ ace_time_effect 文本 /达到(\d+)%/ 提取
  │                  → 失败时从 ultimate.value_texts 取 min_charge/100
  ├── cost_ratio   → ultimate.instructions 中 cost_ratio 字段
  ├── has_sp       → v.skills.sp 是否存在
  ├── chip_slots   → v.report.sections 中 "扩展芯片类型" 的值 (如 "○○△◇◇V")
  ├── nitro_duration→ JSONL: vehicle_data → n2o_skill → skill_instruction → duration*2
  │                  (前端填入 time_1x6)
  ├── nitro_charge (氮气自充能) →
  │     skillPanelGroups.ultimate/passive 中 "氮气"+"充能" 数值
  │     → 失败时逐段搜索文本 /使用氮气[\w\W]*?获得(\d+(?:\.\d+)?)%/
  │     (前端填入 valExtraNitro)
  ├── ult_charge_first (起步额外充能) → 见上方 5 数据源
  │     (前端填入 valExtraUltFirst)
  ├── ult_charge_loop (大招自充能) →
  │     skillPanelGroups.ultimate/passive 中 "大招"/"自身"+"充能"
  │     (排除友方、敌方、范围、降低、损失、扣能、上限、每秒)
  │     → 失败时逐段搜索文本 /自充能(\d+(?:\.\d+)?)%/
  │     (前端填入 valExtraUltLoop)
  │     ★ 车辆文本包含"敌方"时整个字段置 null (依赖敌方站位)
  ├── per_sec_charge (每秒自充能) →
  │     skillPanelGroups.ultimate/passive 中 "每秒"+"充能"
  │     (前端填入 valExtraPerSec)
  ├── sp_charge (SP自充能) →
  │     skillPanelGroups.sp 中 "充能" (排除友方、冷却、集气、自动、压缩)
  │     → 失败时从 sp_skill_desc 取 "获得XXX集气量和X%大招能量"
  │     (前端填入 valCustomTrig, 首发/循环各计 1 次)
  ├── search_text  → 中文转拼音 + 常用别名 (aliases 字典, 99 辆车有)
  └── asset_dir    → 'assets/' + name + '_' + id
```

### 额外起步充能 4 数据源优先级

优先 `skillPanelGroups` 数值 → JSONL `skill_value_details` → `ace_time_effect` 文本 → `special_passive_skill_desc` 文本

### 大招自充能 敌方依赖过滤

如果车辆文本（feature_desc / ace_time_effect / special_passive_skill_desc）包含 "敌方"，则 `ult_charge_loop` 强制为 null（不在前端自动填入，因为依赖敌方站位/数量）

### 文本提取的跨段误匹配防护

`nitro_charge` 和 `ult_charge_loop` 的文本 fallback 需要逐段独立搜索，不能将多段文本 `join(' ')` 后统一搜索。否则会出现"使用氮气"在被动描述中匹配、"获得X%"在大招效果中匹配的跨段误匹配。

## 添加新车 (有 single-{ID} 数据包)

### 手动复制数据

```
single-{ID}/vehicles/{ID}.json → data/.../full/vehicles/{ID}.json
single-{ID}/assets/*           → data/.../full/assets/
```

### 一键更新

```bash
node scripts/update.mjs [车ID...]
```

- 不加 ID: 自动扫描所有 `single-*` 目录
- 加 ID: 只处理指定车辆 (如 `node scripts/update.mjs 10037 12099`)
- 自动完成: 复制数据 → 重建 car-database.js → 上传图片到 B站 CDN → 刷新 index.html 中的 CDN URL 映射

### 单独重建数据库

```bash
node scripts/extract-cars.js
```

### 验证数据是否提取正确

```bash
node -e "
eval(require('fs').readFileSync('car-database.js', 'utf-8').replace('const CAR_DATABASE', 'var CAR_DATABASE'));
var car = CAR_DATABASE.find(c => c.id === 12099);
console.log(JSON.stringify(car, null, 2));
"
```

## B 站 Cookie 维护

`scripts/upload-bili.mjs` 从环境变量或 `.agent_tmp/bili-cookies.json` 读取 cookie:
- 环境变量: `BILI_SESSDATA` + `BILI_JCT`
- 配置文件: `.agent_tmp/bili-cookies.json` → `{"SESSDATA": "...", "bili_jct": "..."}`

获取 cookie: 登录 `bilibili.com` → F12 → Application → Cookies → 复制 `SESSDATA` 和 `bili_jct`

## Git 推送

```bash
git add -A
git commit -m "feat: ..."
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
| `data/.../full/vehicles/` | 车辆 JSON 源文件 |
| `data/.../full/assets/` | 车辆图片源文件 |
| `package.json` | 依赖: pinyin (用于中文→拼音转换) |
