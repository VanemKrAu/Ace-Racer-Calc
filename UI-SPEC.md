# 王牌竞速芯片计算器 · 网站 UI 设计与工程规范 (UI-SPEC)

> **版本**：v2.6 (2026-11-14)  
> **适用范围**：本项目所有前端页面（`index.html`）、组件样式（`style.css`、`community-plans.css`）、动态动效与交互逻辑（`v4.js`、`community-plans.js`、`view.js`）。  
> **核心宗旨**：**所有后续开发人员与 Agent 必须 100% 遵守本规范，严禁凭主观臆想自创 UI 或随意打破既有排版平衡**。

---

## 目录
- [一、 第 0 号最高复用准则（UI 红线）](#一-第-0-号最高复用准则ui-红线)
- [二、 色彩系统与材质规范](#二-色彩系统与材质规范)
- [三、 PC 端双列排版与“抗瘸腿”数学平衡准则](#三-pc-端双列排版与抗瘸腿数学平衡准则)
- [四、 全站统一高度变形与展开动画规范（__pvMorph 铁律）](#四-全站统一高度变形与展开动画规范__pvmorph-铁律)
- [五、 徽章与图标纯净展示规范](#五-徽章与图标纯净展示规范)
- [六、 赋能系统与状态互斥设计规范](#六-赋能系统与状态互斥设计规范)
- [七、 移动端与全端响应式适配规范](#七-移动端与全端响应式适配规范)
- [八、 核心组件设计与交互样板](#八-核心组件设计与交互样板)

---

## 一、 第 0 号最高复用准则（UI 红线）

1. **绝对复用，禁止自创与禁用原生 `<select>`**：
   - 网站已有成熟组件模式的一律 100% 复用，严禁在不同卡片里自造第二套开关、下拉框、分段器或折叠机制；
   - **全站任何页面与弹窗绝对禁止使用原生 `<select>` 标签**，统一下拉控件复用 `.dropdown-container` / `.dropdown-menu`；
   - 严禁擅自引入未在规范中的色彩、圆角、阴影或动画曲线。
2. **严禁纯色死黑底**：
   - 本站背景为深邃微透多层毛玻璃（Glassmorphism），任何卡片、分段器、条目**绝对禁止写死 `#000` / `#111` 等纯色无层次死黑背景**；
   - 必须使用系统变量 `--surface`、`--fill`，配合 180° 顶光微渐变与 `--surface-rim` 内高光描边。
3. **视觉语言一致性**：
   - 状态激活态（Active）必须统一为：**暖金琥珀色描边高光（`var(--acc)`）+ 180° 金黄微光渐变（`linear-gradient(180deg, color-mix(in oklab, var(--acc) 12%, transparent), transparent)`）**；
   - 字体与排版统一使用系统字体栈（`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto...`），数字展示必须启用 `font-variant-numeric: tabular-nums` 避免抖动。

---

## 二、 色彩系统与材质规范

全站严格依托 CSS 变量构建深色与浅色双套色彩体系：

### 1. 全局设计 Token 表

| 变量名 | 深色模式（Dark）典型值 | 用途与语义 |
| :--- | :--- | :--- |
| `--bg` | `#0f1013` | 页面底层主背景 |
| `--surface` | `rgba(26, 28, 35, 0.72)` | 一级卡片毛玻璃基底（配合 `backdrop-filter: blur(16px)`） |
| `--surface-edge` | `rgba(255, 255, 255, 0.08)` | 一级卡片外边框，柔和微透 |
| `--surface-rim` | `rgba(255, 255, 255, 0.12)` | 卡片顶部 1px 模拟光照的高光内描边 |
| `--fill` | `rgba(255, 255, 255, 0.04)` | 二级嵌套条目、选项框底色（微透底） |
| `--fill-hover` | `rgba(255, 255, 255, 0.08)` | 悬停态背景 |
| `--raise` | `rgba(255, 255, 255, 0.06)` | 点击激活或浮起层底色 |
| `--ink` | `#f0f2f5` | 主文字颜色（对比度 > 12:1） |
| `--ink-2` | `#9ba1ad` | 次要说明文字、辅助标签 |
| `--ink-3` | `#636b78` | 占位符、禁用态文字 |
| `--acc` | `#d4a359` / `#e5b567` | 品牌琥珀金高光、强调色、激活边框 |
| `--r-lg` | `16px` | 大卡片外层圆角 |
| `--r-md` | `10px` | 内部子卡片、输入框、条目圆角 |
| `--r-sm` | `6px` | 徽章、小型 Pill 标签圆角 |

### 2. 标准卡片材质代码范式
```css
.ds-c .card {
  position: relative;
  background-color: var(--surface);
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
  border: 1px solid var(--surface-edge);
  box-shadow: 0 8px 32px -4px rgba(0, 0, 0, 0.45),
              inset 0 1px 0 var(--surface-rim);
  border-radius: var(--r-lg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}
```

---

## 三、 PC 端双列排版与“抗瘸腿”数学平衡准则

### 1. 什么是“瘸腿”问题？
在桌面端宽屏（`≥850px`），主操作区由两列构成的 Flex 布局（`#topLayout > .desktop-col`）。当其中某一列的内容远长于另一列时，短的那一侧下方会产生一大段空荡荡的死黑空白，被用户称为“瘸腿”。

### 2. 双列高度平衡法则（硬性约束）
两列卡片职责分配经过严谨的高度测算，**严禁随意跨列移动卡片**：
- **左列固定卡片集合**（总高约 `1137px`）：
  1. `全局核心基准充能参数`（~230px）
  2. `氮气规格及单发时长同步`（~463px）
  3. `对手反制干扰设定`（~253px）
  4. `车辆技能附加充能效率`（~145px）
- **右列固定卡片集合**（总高约 `1141px`）：
  1. `全赋能系统矩阵`（限制视口最大高度为 460px + 半透明细滚动条，展开态维持在 ~644px）
  2. `扩展自充能附加模块`（~236px）
  3. `自定义触发自充能`（~230px）
- **两列下方全宽独立展示卡片**：
  - `特殊芯片卡片（#cardChips）`：独占全宽放置在 `#topLayout` 容器正下方！**绝对禁止将特殊芯片塞进左列或右列**！
    - *血泪教训*：一旦把特殊芯片塞入左列，左列高度瞬间从 1137px 暴增至 1357px，导致右列下方立刻空出 220px 巨大死黑断层，引发更严重的瘸腿！

### 3. 动态展开卡片的“最大高度视口化”铁律
右列的卡片如果带有丰富子项（如全赋能的 12 项矩阵）：
- **禁止让卡片无限向下自由撑开**；
- 必须为滚动子容器（如 `.empower-tab-pane`）设置固定的 `max-height: 460px`，并配置优雅的半透明细滚动条：
  ```css
  @media (min-width: 850px) {
    .ds-c .empower-tab-pane {
      max-height: 460px;
      overflow-y: auto;
      overflow-x: hidden;
      padding-right: 4px;
      scrollbar-width: thin;
      scrollbar-color: var(--fill-2) transparent;
    }
  }
  ```
- 这样无论右侧赋能内容如何切换展开，右列高度始终锚定在 ~1141px，与左列的 1137px 保持 **±4px 内的完美对称平齐**。

---

## 四、 全站统一高度变形与展开动画规范（__pvMorph 铁律）

网站所有可折叠卡片（方案库、赋能、特殊芯片、自充能模块等）**全部由 `window.__pvMorph` 统一驱动 Web Animations API**，严禁使用粗糙的 CSS `max-height` 猜测动画或瞬间切 display。

### 1. `window.__pvMorph` 参数签名与运行机制
```javascript
window.__pvMorph(el, opening, keys, kids, prepare, finish, fromZero);
```
- `el`：执行高度变形的目标元素容器（卡片根节点）；
- `opening`：是否为展开（`true` 为展开，`false` 为收起）；
- `keys`：变形的属性键名（通常为 `['height']`）；
- `kids`：参与透明度淡入/平移渐变的**直接子元素数组**（不能传 `el` 自身）；
- `prepare`：**核心回调**。必须在回调内部改变 DOM/类名，并返回目标终点尺寸 `{ height: h }`；
- `finish`：动画彻底完成后的清理回调。

### 2. 展开与收起的标准时序（绝不可颠倒！）
```javascript
// ✅ 正确范式（展开时必须在 prepare 内移除 pv-collapsed）
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
  // ⚠️ 严禁在此处提前调用 card.classList.remove('pv-collapsed')！
  window.__pvMorph(card, true, ['height'], kids, function () {
    card.classList.remove('pv-collapsed');
    container.classList.remove('pv-collapsed');
    return { height: card.getBoundingClientRect().height };
  }, function () {
    card.classList.remove('pv-collapsed');
    container.classList.remove('pv-collapsed');
  });
}
```

### 3. 展开动画避坑红线
1. **绝不提前破坏起点高度**：
   展开前若提前执行 `card.classList.remove('pv-collapsed')`，`morph` 内部量测的起点高度会直接等于终点高度，高度差为 0，直接 `return` 跳过动画，导致用户视觉上看到卡片“吭一下瞬间弹开”！
2. **移动端高度暴冲限制**：
   在小屏幕手机上（宽度 `<850px`），卡片展开高度差严禁超过 `500px`。如果子内容很多，必须设置 `max-height: 400px; overflow-y: auto; -webkit-overflow-scrolling: touch;`。如果在 400ms 内暴冲 1500px（速度每秒 3700px），人眼根本无法捕捉插值帧，会产生剧烈的向下砸落感。

---

## 五、 徽章与图标纯净展示规范

### 1. 标志独立悬浮原则（图 0 规范）
- 官方徽标、国服车神黑面罩冰晶头盔、赋能图标等视觉符号，**直接输出为无外框的 `<img>` 标签**；
- **严禁**在其外部强行套用带背景底色、圆角矩形边框的容器框（如旧版的 `.cp-sec-icon-box`）；
- 必须保持悬浮透明、直接衬于卡片背景之上，与标题文本自然垂直对齐：
  ```css
  .ds-c .cp-sec-pro-icon {
    width: 28px;
    height: 28px;
    object-fit: contain;
    flex: none;
    display: inline-block;
    filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.35));
  }
  ```

### 2. SVG 矢量图标规范
- 全站 SVG 图标必须遵循微描边风格：
  ```html
  <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">...</svg>
  ```
- 严禁引入带写死颜色的第三方色彩图标，严禁出现 emoji 字符代替图标。

---

## 六、 赋能系统与状态互斥设计规范

赋能矩阵分为 **核心赋能 (12)** 与 **次要赋能 (12)**，涵盖创造、防御、战斗、能量四大系：

### 1. 互斥变灰显示规范
- 当选中任意一个核心赋能或次要赋能后，同系其他未选赋能**立即变为禁用/变灰态**（`.is-muted-exclusive`）；
- 变灰态样式规则：
  - `opacity: 0.38;`
  - `filter: grayscale(85%);`
  - `cursor: not-allowed;`
  - 严禁保留点击 hover 浮起效果；
- 严禁在点其他项时擅自取消前一项后重新激活，必须明确给用户视觉锁定信号。

### 2. 冲突解决逻辑（核心赋能优先）
- 若次要赋能先选择，随后选择核心赋能时若两者冲突：
  - 核心赋能具有最高优先级，照常选中；
  - 自动清空先前选择的冲突次要赋能；
  - 弹出系统级 Toast 气泡明确提示用户：“已自动清空冲突的次要赋能，请重新选择”。

---

## 七、 移动端与全端响应式适配规范

### 1. 响应式断点定义
- **移动端 (Mobile)**：`max-width: 640px`
- **平板端 (Tablet)**：`641px ~ 849px`
- **桌面宽屏 (Desktop)**：`min-width: 850px`

### 2. 移动端头部单行排布铁律
- 移动端卡片标题栏（如芯片方案库卡片头部）：
  - 标题、标签、操作按钮组（保存当前配装、下载、上传、折叠箭头）**必须通过 `flex-wrap: nowrap` 保持在单行展示**；
  - 标题文本使用 `text-overflow: ellipsis; white-space: nowrap; overflow: hidden;` 自适应缩写，按钮采用紧凑图标按钮（`.cp-icon-btn`），**严禁折行断裂到第二行**。

### 3. 移动端单列流与卡片折叠
- 平板与手机端下，`#topLayout > .desktop-col` 采用 `display: contents;`，让卡片按自然流单列垂直排布；
- 默认加载时所有非核心次级卡片折叠（`.pv-collapsed`），标题栏右侧展示轻量摘要（`.pv-sum`），用户主动点击标题展开。

---

## 八、 核心组件设计与交互样板

### 1. 开关组件 (Switch)
```html
<label class="ui-switch">
  <input type="checkbox" id="mySwitch">
  <span class="ui-switch-track">
    <span class="ui-switch-thumb"></span>
  </span>
</label>
```
- 激活态 Track 背景为暖金渐变，Thumb 平滑平移，支持触控与键盘无障碍访问。

### 2. 分段选择器 (Segmented Control)
- 滑块底层采用深色半透明基底，当前选中的滑块药丸（Active Pill）带有 1px 细微内描边与暖金光泽，切换时带有 `transform` 平滑位移过渡。

---
**遵循本规范是一切前端修改的最高前提。未经评审严禁违背上述任何一项规则。**
