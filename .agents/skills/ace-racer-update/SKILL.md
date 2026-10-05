---
name: ace-racer-update
description: "更新 Ace-Racer-Calc 项目的数据和 CDN。当用户说「更新网站」「加新车」「更新车辆数据」或需要运行 update workflow 时使用。"
allowed-tools: Read, Bash, Glob, Grep, Write, Edit
user-invocable: true
---

# Ace-Racer-Calc Update Workflow

项目路径: 仓库根目录 (clone 后进入项目目录)

---

## 0 · 铁律：字段填到哪个格子，由 agent 读原文判定，脚本只负责搬数据

**脚本做不了语义判断。** 它读到什么字面就填什么，读不出字缝里的条件。

看一个真实翻车案例（兰博基尼 Revuelto）：

```
面板 skillPanelGroups.ultimate 里写着：
    「大招充能」        10%
      ✱ (超越/被超越)          ← 这一行是灰色小字 #a9a9a9，紧跟在上一条后面
```

脚本只看见「大招充能 10%」，看不见后面那行灰字，于是判定为「每次放大招都给 10%」，
填进 `ult_charge_loop`。结果循环模型每放一次大招就白送 10% 充能，**循环产出直接虚高**。

真相是这 10% 要靠超越或被超越才给 —— 它属于条件触发，该填 `custom_charge`。

**所以：每辆新车的每个字段，都要人（agent）读完原文、想清楚归属，再下结论。
结论写进 `data/car-overrides.json`。凡是不看原文、直接采信脚本提取值的，都算没做完。**

`car-database.js` 顶部写着 DO NOT EDIT MANUALLY，它是每次重建生成的 ——
手工改会在下次更新时被打回。**任何「提取值不对」的结论，都必须落到裁决表里才留得住。**

---

## 1 · 新车更新：六步

### 第 1 步 · 拉数据

```bash
node scripts/update.mjs [车ID...]
```

不加 ID 就扫所有 `single-*` 目录。这一步会自动完成：复制车辆 JSON → 复制图片 →
重建 car-database.js → 上传图片到 B站 CDN → 刷新 index.html 里的图片映射。

⚠ 这一步重建出来的值是**脚本提取值**，还没有经过裁决，先别当成最终结果。

### 第 2 步 · 摊开原文（必做，不许跳）

```bash
node scripts/dump-car-skills.mjs <车ID>
# 还没裁决过的车一次全看：
node scripts/dump-car-skills.mjs --unaudited
```

输出里包含：底子（品质/定位/专精/芯片槽）、面板数值（**灰色条件小字会单独标
`✱` 挑出来**）、大招一句话效果、指令表的时长与消耗、被动描述、特性简介，以及
**当前数据库里的值**和一份**归属自检**。

自检会把「`ult_charge_loop` 有值，但原文出现条件触发词」这类矛盾直接点名。

### 第 3 步 · 逐字段裁决

对着第 2 节的陷阱清单，把每个字段过一遍。**不要跳过任何一个字段**，
哪怕结论是「保持脚本提取值」也要过 —— 留下「我看过了」的痕迹。

### 第 4 步 · 写裁决表

把结论写进 `data/car-overrides.json`：

```json
"12079": {
  "name": "兰博基尼 Revuelto",
  "audited_at": "2026-10-03",
  "fields": { "ult_charge_loop": null, "custom_charge": 10 },
  "evidence": {
    "custom_charge": "面板写着「大招充能 10%」，紧挨着一条灰字「(超越/被超越)」……"
  }
}
```

- `fields` 只写**要改的**字段。结论是「脚本提取值正确」时，`fields` 留空对象 `{}` 也要留一条记录。
- `evidence` 必须写清依据 —— **引原文原句**，说明为什么这么归。不要只写「修正为 X」。
- 数值不许自己发明，写进去的数必须能在原文或面板里找到出处。

### 第 5 步 · 重建并核对

```bash
node scripts/extract-cars.js
```

- 生成时会打印 `Applied N human rulings`，确认条数对不对。
- **如果打印出 `⚠ 有 N 辆已入库的新车还没有人工裁决记录`，说明第 3、4 步没做完，
  回去补。**这条关卡就是为了不让没审过的车悄悄混进数据库。
- **如果打印出 `⚠ 读不到 JSONL 原始数据包`**，说明当前机器没有 `E:` 盘那份数据包，
  `nitro_duration` 等字段会失真 —— **这种产物不要提交**，回开发机重跑。

### 第 6 步 · 验收

```bash
node -e "
eval(require('fs').readFileSync('car-database.js','utf-8').replace('const CAR_DATABASE','var CAR_DATABASE'));
var car = CAR_DATABASE.find(c => c.id === <车ID>);
console.log(JSON.stringify(car, null, 2));
"
```

再跑一次 `node scripts/dump-car-skills.mjs <车ID>`，确认**归属自检**不再报矛盾。

---

## 2 · 逐字段裁决要点

### 2.1 看到灰色小字，就要停下来想

`skillPanelGroups` 里凡是名字长成 `参数 NNNN` 的条目，**它其实是紧挨在上一条后面的
条件说明**，内容是 `#a9a9a9(...)` 这种灰色小字。这是判断归属最关键的一行，
也是最容易漏读的一行。

```
「大招充能」   10%
  ✱ (超越/被超越)          → 条件触发 → custom_charge
「自动充能」   每秒2%      → 按秒走 → per_sec_charge
「加速时长」   8秒         → ult_duration = 8
```

### 2.2 语义陷阱清单

| 陷阱 | 长什么样 | 怎么填 | 真实例子 |
|---|---|---|---|
| **条件触发充能** | 面板有灰字条件，或原文带「超越 / 漂移 / 涡轮 / 受到 / 每 N 秒 / 第 N 名 / 合体失败」 | 填 `custom_charge`，**不要填 `ult_charge_loop`** | Revuelto「超越/被超越 10%」 |
| **每 N 次触发** | 「每 2 次进入漂移时自充能 6%」 | `custom_charge` + `custom_charge_every = N` | 布加迪 LVN（N=2） |
| **敌方 / 队友依赖** | 文本里出现「敌方」「为队友」 | `ult_charge_loop` 置 `null` | 奥迪 RS 3 的 13% 是给队友的 |
| **氮气损失充能** | 「氮气损失时获得充能」 | 是负收益，**不填** `nitro_charge` | 丰田 86（脚本提到 7，是错的） |
| **大招连发两段** | 「大招结束后自动释放一次无消耗的大招」 | `ult_duration` 按**两段累计**，`ult_chain: true` | 柯尼塞格 One:1（6 秒 → 12 秒） |
| **一次性充能** | 「第 1 次使用大招时解锁获得 22%」 | `custom_charge`，触发次数由用户按跑法填 | 圣骑士（首发 1 次、循环 0 次） |
| **init_ratio 重复计** | 车有 RECU 变体技能 | `init_ratio` **只取基础技能**（`particular_skill` 指向的那个） | — |
| **跨段误匹配** | 「使用氮气」在被动里、「获得 X%」在大招里 | 逐段独立搜索，**绝不能把多段文本 join 后统一搜索** | — |

**判断口径一句话**：这份充能**是不是每次放大招都必然到手**？
是 → `ult_charge_loop`；要靠条件、看名次、看运气 → `custom_charge`。

### 2.3 前端绿框是免费的自检器

选车之后，车辆图片下方那个提示框（`carPreviewAutoMsg`）由代码根据字段**自动拼出来**，
里面会写「✓ 已自动填充：大招时长、起步额外充能、自定义触发自充能…」，并按情况追加提示：

- 填了 `custom_charge` → 弹出「该车自充能不是『每次放大招必给』，而是条件触发
  （每 N 次触发记 1 次 / 每次触发均生效），触发次数请按跑法手动填写」
- 填了 `ult_chain` → 弹出「该车大招连发：大招时长已按两段累计填入」
- `ult_duration` 为空 → 弹出「该车无固定大招时长，请手动填写」

**这些提示是字段归属的一次公开检验。** 填完裁决表，去界面上选一次这辆车看看绿框说了什么：

- 明明是条件触发，绿框却什么都没提 → 你八成把它填进 `ult_charge_loop` 了
- 明明每次大招必给，绿框却提示「条件触发」 → 你归错了，该放 `ult_charge_loop`
- `custom_charge_every` 忘了填 → 绿框会说成「每次触发均生效」，与实际不符

### 2.4 裁决表就是人机接口

agent 的经验只有落进 `data/car-overrides.json` 才不会丢。这张表的三个作用：

1. **留得住** —— `car-database.js` 每次重建，手改会被打回；表里的裁决优先级最高，不会被覆盖
2. **说得清** —— 每条 `evidence` 都是「引原文 + 讲理由」，下一个人看得懂为什么这么填
3. **拦得住** —— 生成脚本会检查「已入库的新车有没有裁决记录」，没审过的车会被点名

> ⚠ `scripts/extract-cars.js` 顶部还有一张内建的 `FIELD_OVERRIDE`，那是早期条目的存档。
> **不要再往那里加新条目**，新裁决一律写 JSON。

---

## 3 · 起步能量计算公式 (核心逻辑)

```
起步能量 = ace_charge + init_ratio + 额外起步充能
         (万分比)    (万分比)     (百分比)
```

三部分来源各自独立，前端在 `pickCar()` 中分两步填入：
1. `startCharge = (ace_charge + init_ratio) / 100` → 起步基础充能
2. `valExtraUltFirst = ult_charge_first` → 起步额外充能 (额外模块)

### init_ratio 的提取规则

`init_ratio` 只取 **基础技能**（`particular_skill` 指向的技能）的值。RECU 变体技能的 `init_ratio`
与 `ult_charge_first` 中的加成是同一份，不加重复。

当前实现：`v.skills?.ultimate?.init_ratio` (22 辆车有值)。未来需改为从 `vehicle_data.jsonl`
中查 `particular_skill` 再取 `init_ratio`。

### ult_charge_first (起步额外充能) 的 5 数据源

| 优先级 | 来源 | 提取方式 | 备注 |
|--------|------|----------|------|
| 1 | `skillPanelGroups.ultimate` | 查找 `name` 包含"额外起步充能" | |
| 2 | `skill_value_details_data.jsonl` | `skill_value_name` 包含"额外起步充能" + `vehicle_id` 匹配 | |
| 3 | `ace_time_effect` 文本 | 正则 `/开局(?:时)?获得\s*(\d+(?:\.\d+)?)\s*%\s*(?:大招能量\|能量)/` | 纯文本兜底 |
| 4 | `special_passive_skill_desc` 文本 | 查找含"起步"+"%"的行，正则 `/获得[^%]*?(\d+(?:\.\d+)?)\s*%/` | 仅接受 1-200% 合理范围 |
| 5 | `levels[最高级].rich_text.passive_skill_effect` | 查找含"开局"+"能量"/"充能"的标签，取对应 value | 覆盖 10 级才有的起步充能 |

---

## 4 · 脚本提取规则（参考 · 判断归属不靠它）

以下是 `scripts/extract-cars.js` 怎么提数，供你核对「脚本会提成什么样」用。
**注意：这些规则只管字面，语义归属一律以第 2 节的裁决为准。**

### 数据来源

| 来源 | 路径 | 用途 |
|------|------|------|
| 车辆 JSON | `data/.../full/vehicles/{id}.json` | 主数据源，每辆车一个文件 |
| JSONL 原始数据 (可选) | `E:/AceRacer/AceRacing-Workbench/data/.../` | 补充技能时长/阈值等（**仅开发机上有**，缺了 nitro_duration 会失真） |
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
  │     ★ 大招连发（技能描述含「大招结束后自动释放一次无大招」这类，一管能量实得两段）
  │       面板只给单段值 → 在裁决表里按两段登记，并标 ult_chain: true
  │       例：柯尼塞格 One:1 面板 6 秒 → 登记 12 秒（改前它被填成 6 秒，少算一段）
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
  │     ★ 提到「氮气损失」的是负收益，不要填
  ├── ult_charge_first (起步额外充能) → 见上方 5 数据源
  │     (前端填入 valExtraUltFirst)
  ├── ult_charge_loop (大招自充能) →
  │     skillPanelGroups.ultimate/passive 中 "大招"/"自身"+"充能"
  │     (排除友方、敌方、范围、降低、损失、扣能、上限、每秒)
  │     → 失败时逐段搜索文本 /自充能(\d+(?:\.\d+)?)%/
  │     (前端填入 valExtraUltLoop)
  │     ★ 车辆文本包含"敌方"时整个字段置 null (依赖敌方站位)
  │     ★★ 但脚本这套排除词不够用 —— 面板上的灰色条件小字它读不懂，
  │         所以「条件触发 vs 每次必给」必须由裁决表拍板（见第 2.2 节）
  ├── per_sec_charge (每秒自充能) →
  │     skillPanelGroups.ultimate/passive 中 "每秒"+"充能"
  │     (前端填入 valExtraPerSec)
  ├── sp_charge (SP自充能) →
  │     skillPanelGroups.sp 中 "充能" (排除友方、冷却、集气、自动、压缩)
  │     → 失败时从 sp_skill_desc 取 "获得XXX集气量和X%大招能量"
  │     (前端填入 valCustomTrig, 首发/循环各计 1 次)
  ├── custom_charge (条件触发自充能) →
  │     文本 /每N次[^。；\n]{0,24}?自充能X%/ → custom_charge = X, custom_charge_every = N
  │     ★ 「每 N 次触发一次」的条件充能**不是**大招自充能，绝不能让 ult_charge_loop 收走
  │     (前端填入 valCustomTrig；触发次数不预设，留 0 由用户按跑法手填)
  │     例：布加迪 LVN 大招「加速期间每 2 次进入漂移时自充能 6%」
  ├── search_text  → 中文转拼音 + 常用别名 (aliases 字典, 99 辆车有)
  ├── added_at     → ADDED_AT 登记表 (extract-cars.js 顶部)
  │                  → 无登记的车为 null
  │                  → 前端列表按 added_at 降序，新车在上；同批按 ID 降序
  └── asset_dir    → 'assets/' + name + '_' + id
```

### 文本提取的跨段误匹配防护

`nitro_charge` 和 `ult_charge_loop` 的文本 fallback 需要逐段独立搜索，不能将多段文本
`join(' ')` 后统一搜索。否则会出现"使用氮气"在被动描述中匹配、"获得X%"在大招效果中匹配的跨段误匹配。

---

## 5 · 添加新车的机械步骤

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

⚠ 注意顺序：`update.mjs` 会先重建一次数据库。**裁决流程（第 1~5 步）要在它之后做**，
最后再单独跑一次 `node scripts/extract-cars.js` 把裁决应用上去。

### ⚠️ 图片必须上传 B站 CDN (硬性要求)

新车的车身图（`full/assets/{车名}_{ID}/body/{ID}_m.png`）**必须上传 B站图床**：

1. 图片文件**同时必须提交进仓库**（前端兜底路径，`update.mjs` 已自动复制）
2. **必须**执行 `node scripts/upload-bili.mjs` 上传到 B站 CDN（需要 cookie）
3. 上传成功后 `bili-url-mapping.json` 自动更新，`index.html` 的 `_CAR_IMG` 指向 CDN URL
4. **无 cookie 时流程会中断**（`upload-bili.mjs` 直接 `exit(1)`），此时必须向用户索要 cookie
   （`SESSDATA` + `bili_jct`，见下方 Cookie 维护），**不允许跳过上传直接结束**
5. 上传完成后用 `curl -sI <CDN_URL>` 验证返回 200 且 `content-type: image/png`

**判定标准**：新车在 `index.html` 的 `_CAR_IMG` 中必须能查到对应的 `i0.hdslb.com` URL，
查不到 = 流程未完成。

### ⚠️ 新车登记 ADDED_AT (必须，否则不排最前)

车辆列表按**添加时间排序**（新车在上，同批按 ID 降序），前端读取每辆车的 `added_at` 字段排序。

每加一批新车，必须在 `scripts/extract-cars.js` 顶部的 `ADDED_AT` 表中登记：

```js
const ADDED_AT = {
  12094: 1787240818462, // 罗刹 (2026-08-20)
  12102: 1787240818462, // 货拉拉多拉 (2026-08-20)
};
```

时间戳获取：`node -e "console.log(Date.now())"`
同批车用同一时间戳即可（同批按 ID 降序由前端自动处理）。
**漏登记后果**：新车数据正常但会排在列表最底（视为旧车）。

★ `ADDED_AT` 还有第二个作用：**它是「哪些车属于新入库、必须审过」的名单**。
生成脚本会拿它跟 `data/car-overrides.json` 对账，没裁决记录的新车会被点名警告。

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

---

## 6 · B 站 Cookie 维护

`scripts/upload-bili.mjs` 从环境变量或 `.agent_tmp/bili-cookies.json` 读取 cookie:
- 环境变量: `BILI_SESSDATA` + `BILI_JCT`
- 配置文件: `.agent_tmp/bili-cookies.json` → `{"SESSDATA": "...", "bili_jct": "..."}`

获取 cookie: 登录 `bilibili.com` → F12 → Application → Cookies → 复制 `SESSDATA` 和 `bili_jct`

⚠️ **没有 cookie = 流程无法完成**。upload-bili.mjs 在缺少 cookie 时会报错退出，
必须向用户索要 cookie 后继续，**不允许以"图片已提交仓库"为由跳过 CDN 上传**。

---

## 7 · Git 推送

```bash
python3 /workspace/photo-to-svg/tools/secret_scan.py --staged   # 环境里没有 gitleaks，用这个
git add -A
git commit -m "feat: ..."
git push
```

推送前检查：暂存区文件清单里没有 `.env` / `.pem` / `.key` / `credentials.json` / `*.secret` 等敏感文件。

---

## 8 · 文件说明

| 文件 | 作用 |
|------|------|
| `scripts/update.mjs` | 主工作流脚本，一键完成复制数据、重建、传图 |
| `scripts/extract-cars.js` | 从 `full/vehicles/*.json` 提取数据生成 `car-database.js`；顶部 `ADDED_AT` 表登记入库时间（列表排序 + 审核名单）；顶部 `FIELD_OVERRIDE` 是早期覆盖存档，**不要再往里加条目** |
| `scripts/dump-car-skills.mjs` | **证据包生成器** —— 把一辆车的技能原文摊开（含灰色条件小字）+ 打印当前库值 + 归属自检。`--added` / `--unaudited` 可批量 |
| `scripts/upload-bili.mjs` | 上传新图片到 B站 CDN，保存 URL 映射 |
| `data/car-overrides.json` | **人工裁决表** —— agent 读原文后的结论与依据，生成时优先级最高 |
| `data/bili-url-mapping.json` | CDN URL → 本地路径映射表 |
| `car-database.js` | 全部车辆数据（生成物，勿手改） |
| `data/.../full/vehicles/` | 车辆 JSON 源文件 |
| `data/.../full/assets/` | 车辆图片源文件 |
| `package.json` | 依赖: pinyin (用于中文→拼音转换) |
