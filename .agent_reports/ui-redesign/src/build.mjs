// ============================================================================================
// ⚠ 已冻结（2026-10-03 起）：线上的 index.html 才是唯一源头，这套构建源码不再同步。
//   V4.2 之后的改动（套壳浏览器卡顿修复、分区光画布、选车面板拖拽、菜单动画开关、电脑端选车下拉 /
//   出厂数据 等）都是直接改在 index.html 上的，这里没有。用它重新生成 index.html 会把那些改动全部冲掉。
//   改界面请直接改 index.html。下面的防覆盖检查会拦住「输出路径已有文件且内容不同」的情况，详见 ../README.md。
// ============================================================================================
//
// UI 重构构建脚本：复用线上 index.html 的全部业务 JS（原样搬运，只做配色读取的小补丁）。
//
//   node build.mjs --src <旧版>           → 生成三套设计预览到 ../v*.html
//   node build.mjs --src <旧版> --prod --out <新文件>  → 正式版输出到一个新文件（只供对照，不能拿去替换线上）
//   node build.mjs --src <路径>           → 指定构建源（必须是迁移前的原站，见下面的防呆）
//   --force                              → 跳过防覆盖检查（会丢掉 index.html 上的直接改动，一般用不到）
//
// 正式版与预览版的差别（见交接文档第五节）：
//   · <head> 整段保留原站（SEO / OG / JSON-LD / manifest / canonical / vercel / 外链 html2canvas+car-database）
//   · 保留 // Bilibili CDN image URLs (auto-generated) 脚本块原样且位置不变（scripts/update.mjs 靠它定位）
//   · 原站 <style> 与 body 里两个零散 <style> 换成 base.css + c-1/2/3.css，去掉预览专用版本切换条
//   · body markup 用 buildBody('c') 且不带 switcher；保留 body 开头防闪烁脚本
//   · view.js 去掉「预览演示数据」与 ?shot/?blank 处理
//   · theme-color 换成新配色
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBody } from './markup.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');           // Ace-Racer-Calc/
const OUT = path.resolve(HERE, '..');                   // .agent_reports/ui-redesign/
const read = (p) => fs.readFileSync(p, 'utf8');

const argv = process.argv.slice(2);
const PROD = argv.includes('--prod');
const argVal = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const PROD_OUT = argVal('--out') ? path.resolve(argVal('--out')) : path.join(ROOT, 'index.html');
const SRC_FILE = argVal('--src') ? path.resolve(argVal('--src')) : path.join(ROOT, 'index.html');

const src = read(SRC_FILE);

// 防呆：源文件必须是「迁移前的原站」。正式版落地后 index.html 本身就是产物，
// 再拿它当源会把产物当原站、生成一堆垃圾。需要重建时用 --src 指向归档的旧版。
if (/<body class="ds-c">/.test(src)) {
  throw new Error(
    `源文件看起来已经是迁移后的新版页面，不能再当构建源：${SRC_FILE}\n` +
    '  另外这套构建已冻结（见文件开头）：改界面请直接改 index.html。\n' +
    '  只是想对照旧的构建结果：git show cdca7f2:index.html > old-index.html，\n' +
    '  再 node build.mjs --src old-index.html --prod --out <一个新文件>');
}

// ---------- 1. 抽取原站脚本块 ----------
const blocks = [...src.matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .filter((m) => !/\ssrc=/.test(m[1] || '') && !/ld\+json/.test(m[1] || ''))
  .map((m) => m[2]);

const RULES = [
  ['icons', (s) => s.includes('var _ICONS =')],
  ['lang', (s) => s.includes('let userLangs')],
  ['tutorial', (s) => s.includes('function generateHash')],
  ['carpicker', (s) => s.includes('function pickCar')],
  ['imginit', (s) => s.includes("getElementById('carImage').src")],
  ['placeholder', (s) => s.includes("getElementById('carSearch')") && s.length < 400],
  ['main', (s) => s.includes('function calculate(')],
  ['details', (s) => s.includes("querySelector('.tutorial-details')") && s.includes('closing')],
  ['fps', (s) => s.includes('function checkFPS')],
  ['init', (s) => s.includes('populateFilters();') && s.length < 400],
  ['vercel', (s) => /window\.(si|va) = /.test(s)],
];
const S = {};
for (const b of blocks) {
  const hit = RULES.find(([, fn]) => fn(b));
  if (!hit) throw new Error('未识别的脚本块: ' + b.slice(0, 80));
  if (hit[0] !== 'vercel') S[hit[0]] = b;
}
for (const [k] of RULES) if (k !== 'vercel' && !S[k]) throw new Error('缺少脚本块: ' + k);

// ---------- 站名统一 ----------
// 同一站点曾同时存在三种叫法（页面内大标题「王牌竞速一大和循环能量计算器」、
// 标签页/分享卡片/结构化数据「王牌竞速 - 大招能量精密计算器」、manifest「王牌竞速一大和循环能量计算器」）。
// 按用户要求统一成一个名字：页面内大标题见 markup.mjs 的 header()，其余（head 四处、
// 标签页两处、长截图水印一处、manifest）都在这里 / manifest.json 统一。
const SITE_ZH = '王牌竞速芯片计算器';
const SITE_EN = 'Ace Racer Chip Calculator';
const NAME_ZH_OLD = '王牌竞速 - 大招能量精密计算器';

// ---------- 2. 仅针对硬编码配色的补丁（不动任何计算 / 交互逻辑） ----------
function patch(key, from, to, count = 1) {
  const n = S[key].split(from).length - 1;
  if (n !== count) throw new Error(`补丁匹配数不符 [${key}] 期望 ${count} 实际 ${n}: ${from.slice(0, 60)}`);
  S[key] = S[key].split(from).join(to);
}
// 选车后自动填充区块的呼吸描边：颜色改读设计 token
patch('carpicker', "var c = 'rgba(0, 242, 254, ' + state.opacity + ')';",
  "var c = 'rgba(' + (getComputedStyle(document.body).getPropertyValue('--flash-rgb').trim() || '0, 242, 254') + ', ' + state.opacity + ')';");
// 长图导出：背景 / 强调色 / 状态色改读当前设计的 token（兜底仍是原值）
const TOK = "function __tok(n, d) { var v = getComputedStyle(document.body).getPropertyValue(n).trim(); return v || d; }\n";
S.main = TOK + S.main;
patch('main', "var bgColor = isLight ? '#f0f4f8' : '#18213d';",
  "var bgColor = __tok('--export-bg', isLight ? '#f0f4f8' : '#18213d');");
patch('main', "color:'+(isLight?'#007bb5':'#00f2fe')+';", "color:'+__tok('--export-accent', isLight?'#007bb5':'#00f2fe')+';");
patch('main', "var filledTrackColor = isLight ? '#e53e3e' : '#ff007f';", "var filledTrackColor = __tok('--export-range', isLight ? '#e53e3e' : '#ff007f');");
patch('main', "if (isError) el.style.color = isLight ? '#e53e3e' : '#ff007f';", "if (isError) el.style.color = __tok('--export-fail', isLight ? '#e53e3e' : '#ff007f');");
patch('main', "else if (isLoop) el.style.color = isLight ? '#2f855a' : '#4cdf8a';", "else if (isLoop) el.style.color = __tok('--export-pass', isLight ? '#2f855a' : '#4cdf8a');");
patch('main', "else el.style.color = isLight ? '#007bb5' : '#00f2fe';", "else el.style.color = __tok('--export-pass', isLight ? '#007bb5' : '#00f2fe');");
patch('main', "ctx.fillStyle = isLight ? '#007bb5' : '#00f2fe';", "ctx.fillStyle = __tok('--export-accent', isLight ? '#007bb5' : '#00f2fe');");
// 导出加载遮罩里残留的 emoji 📸：全站图标都已经换成内联 SVG 了，这里也该跟着走 —— 换成 CSS 转圈
// 注意：匹配的只是整段字符串的前半截，替换串结尾绝不能补引号（补了会把后面的字符串提前闭合）
patch('main', `'<div style="font-size:40px; margin-bottom:16px;">📸</div>`,
  `'<div style="width:38px;height:38px;margin-bottom:16px;border-radius:50%;`
  + `border:3px solid rgba(142,154,175,.35);border-top-color:var(--export-accent,#00f2fe);`
  + `animation:dsSpin .9s linear infinite;"></div>`);
// 车辆下拉框里的车名是「裸文本节点」，html2canvas 会把它整个丢掉（导出图里只剩图标、没有名字）。
// 包一层 <span> 就能正常渲染（实测左区墨点 396 → 1676）。
patch('carpicker', "label.innerHTML = ci + ' ' + _n(cc);", "label.innerHTML = ci + '<span>' + _n(cc) + '</span>';");

// ---------- 主题持久化修复（原站 bug：「跟随系统」刷新后被强行改回深色）----------
// 原站 selectTheme('system') 的做法是 localStorage.removeItem('theme')，而 initTheme() 把
// 「没有存档」一律当成新用户 → 强制深色并把 'dark' 写回存档。结果：用户选了「跟随系统」，
// 当时生效，一刷新就被拉回深色（系统为浅色时尤其明显）。
// 期望行为：新用户（真的没有任何存档）默认深色；用户显式选过 light / dark / system 之后，
// 一律按他自己的选择走。修法：system 也显式存下来，initTheme 与系统偏好监听都认它。
patch('main', "if (savedTheme === 'light' || savedTheme === 'dark') {",
  "if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {");
patch('main', "applyThemeMode(savedTheme === 'light');",
  "applyThemeMode(savedTheme === 'system' ? !isSystemDark : savedTheme === 'light');");
patch('main', "localStorage.removeItem('theme');", "localStorage.setItem('theme', 'system');");
patch('main', "if (!localStorage.getItem('theme')) {",
  "if (!localStorage.getItem('theme') || localStorage.getItem('theme') === 'system') {");

// 站名统一：标签页标题（两处：语言初始化 + 语言切换）与长截图导出底部的水印文字
// 注意：语言初始化那一份在正式版里是从 <head> 原样搬运的（不经过 js(S.lang)），
// 所以下面 head 段落里还要再替换一次；这里的 patch 是给三套预览版用的。
patch('lang', "document.title = 'Ace Racer - Ult Energy Calculator';", `document.title = '${SITE_EN}';`);
patch('main', "document.title = currentLang === 'en' ? 'Ace Racer - Ult Energy Calculator' : '王牌竞速 - 大招能量精密计算器';",
  `document.title = currentLang === 'en' ? '${SITE_EN}' : '${SITE_ZH}';`);
patch('main', "'王牌竞速 · 大招能量精密计算器', 'Ace Racer · Ult Energy Calculator'", `'${SITE_ZH}', '${SITE_EN}'`);

// ---------- V4 业务 / 文案补丁 ----------
// A) 选车后结果不刷新（原站 bug）：pickCar 先 calculate() 再自动填充 SP / 起步 / 氮气 / 每秒自充能，
//    界面上显示的是填充前的旧结果（41 辆带这些字段的车全部中招）。在 pickCar 末尾补算一次。
{
  const re = /(\+ \(car\.has_sp \? ' &nbsp;\|&nbsp; <span class="car-badge">SP<\/span>' : ''\);)(\r?\n    \}\r?\n\r?\n    function populateFilters\(\) \{)/;
  if (!re.test(S.carpicker)) throw new Error('V4 补丁 A 未匹配：pickCar 结尾');
  S.carpicker = S.carpicker.replace(re, (m0, a, b) => a + '\n        calculate();   // 自动填充全部写完之后再算一次' + b);
}
// B) 长截图：交给 html2canvas 之前修正克隆里的开关 / 单选 / 输入框与 oklab 颜色（v4.js 的 __pvExportFix）
patch('main', "var tempWrapper = document.createElement('div');",
  "if (window.__pvExportFix) window.__pvExportFix(clone);\n           var tempWrapper = document.createElement('div');");
// C) 选车提示里的 ⚠️ → 线性图标（8 处：两个函数 × 两行 × 中英）
{
  const WARN = '<svg class=\\"ico pv-warn\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"1.8\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" aria-hidden=\\"true\\"><path d=\\"M12 3.5 2.8 19.5h18.4L12 3.5z\\"/><path d=\\"M12 10v4.2M12 17v.01\\"/></svg>';
  let n = 0;
  S.carpicker = S.carpicker.split('\n').map((l) => {
    if (l.includes('msgHtml +=') && l.includes('⚠️ ')) { n += l.split('⚠️ ').length - 1; return l.split('⚠️ ').join(WARN); }
    return l;
  }).join('\n');
  if (n !== 8) throw new Error('V4 补丁 C 匹配数不符：' + n);
}
// D) 「未上线车辆」的 ❓ → 线性图标
patch('carpicker', '\\u2753', '<svg class=\\"ico pv-q\\" viewBox=\\"0 0 24 24\\" fill=\\"none\\" stroke=\\"currentColor\\" stroke-width=\\"1.8\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" aria-hidden=\\"true\\"><circle cx=\\"12\\" cy=\\"12\\" r=\\"9\\"/><path d=\\"M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17v.01\\"/></svg>', 2);
// F) 芯片槽位：游戏原版图标去底盘后的抠图（v4.js 的 __pvChip，按主题切换浅 / 深两版）
{
  const re = /chipInfo\.innerHTML \+= ('<img loading=[^\n]*?carport_new_skill_chip_none_icon_' \+ iconNum \+ '\.png'\] \+ '[^\n]*?>');/g;
  const n = (S.carpicker.match(re) || []).length;
  if (n !== 2) throw new Error('V4 补丁 F 匹配数不符：' + n);
  S.carpicker = S.carpicker.replace(re, (m0, orig) => 'chipInfo.innerHTML += (window.__pvChip ? __pvChip(sym) : ' + orig + ');');
}
// H) 长截图：原逻辑把克隆里所有文字强制成 Arial（中文会落到手机系统字体，装了第三方字体就走样）→ 站内字体优先
patch('main', `'font-family', 'Arial, "Helvetica Neue", Helvetica, sans-serif', 'important'`,
  `'font-family', '"Noto Sans SC", Arial, "Helvetica Neue", Helvetica, sans-serif', 'important'`, 2);
// I) 长截图底部水印（canvas 直接绘制）同样用站内字体
patch('main', "px -apple-system, BlinkMacSystemFont, sans-serif';", "px \"Noto Sans SC\", -apple-system, BlinkMacSystemFont, sans-serif';", 2);
// G) 长截图失败时把原因打到控制台，便于排查
patch('main', "cleanup();\n                   showToast(_(\"❌ 生成失败", "console.error('[export]', err);\n                   cleanup();\n                   showToast(_(\"❌ 生成失败");

// 防闪脚本：首帧前就把已保存的主题应用到 <body>。
// 原写法只认 'light'，于是「跟随系统 + 系统是浅色」的用户每次进站都会先闪一下深色。
const ANTI_FLASH = `<script>try{var __t=localStorage.getItem('theme');`
  + `if(typeof __t==='string'&&(__t==='light'||(__t==='system'&&!(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches))))`
  + `document.body.classList.add('light-mode');}catch(e){}</script>`;

// ---------- 3. 原样搬运的内容 ----------
const notesInner = src.match(/<ul id="notesContent"[^>]*>([\s\S]*?)<\/ul>/)[1];
const carDb = read(path.join(ROOT, 'car-database.js'));
const h2c = read(path.join(ROOT, 'html2canvas.min.js'));
const baseCss = read(path.join(HERE, 'base.css'));
const viewJs = read(path.join(HERE, 'view.js'));
const v4Js = read(path.join(HERE, 'v4.js'));
const headMeta = src.match(/<head>([\s\S]*?)<script type="application\/ld\+json">/)[1]
  .replace(/<link rel="(manifest|canonical)"[^>]*>\s*/g, '')
  .replace(/href="(icon\.(png|svg))"/g, 'href="../../$1"');

const js = (code) => `<script>\n${code}\n</script>`;

// ======================= 正式版（--prod） =======================
if (PROD) {
  const cCss = fs.readdirSync(HERE).filter((f) => f.startsWith('c-') && f.endsWith('.css')).sort()
    .map((f) => read(path.join(HERE, f))).join('\n')
    // 预览专用的版本切换条规则（c-3 里还有两条定位覆写）正式版一并剔除
    .split('\n').filter((l) => !l.includes('ds-switch')).join('\n');

  // 预览专用：版本切换条规则（base.css 末尾一段，正式版不要）
  const SWITCH_MARK = '/* 预览专用：版本切换条 */';
  const si = baseCss.indexOf(SWITCH_MARK);
  if (si < 0) throw new Error('base.css 缺少版本切换条标记，无法为正式版剔除');
  const baseCssProd = baseCss.slice(0, si).replace(/\s*$/, '\n');

  // view.js：剔除「预览演示数据」整段（含 ?shot / ?blank 处理），只保留纯展示层
  const DEMO_MARK = '  // ---------- 预览演示数据';
  const di = viewJs.indexOf(DEMO_MARK);
  if (di < 0) throw new Error('view.js 缺少预览演示数据标记');
  const viewJsProd = viewJs.slice(0, di) + '  sync();\n})();\n';

  // <head> 整段保留，只换掉里面那个大 <style>
  const headEnd = src.indexOf('</head>');
  const styleStart = src.indexOf('<style>');
  const styleEnd = src.indexOf('</style>', styleStart);
  if (headEnd < 0 || styleStart < 0 || styleEnd < 0 || styleEnd > headEnd) throw new Error('index.html 的 <head>/<style> 结构不符合预期');
  // 字体：改由 npmmirror（阿里云，中国大陆可直连）托管的 Noto Sans SC 全字符集分片 CSS 提供，
  // 不再随仓库分发子集字体 —— 网站以后增删任何文字都不必重新裁剪字体。
  // media="print" → onload 切回 all：字体不是首屏关键资源，不该阻塞渲染。
  const FONT_LINKS = [
    '<link rel="preconnect" href="https://registry.npmmirror.com" crossorigin>',
    ...[400, 500, 700].map((w) => `<link rel="stylesheet" media="print" onload="this.media='all'" href="https://registry.npmmirror.com/@fontsource/noto-sans-sc/5.3.0/files/${w}.css">`)
  ].join('\n');
  if (/ace-sans|AceRacer Sans/.test(cCss)) throw new Error('c-4 里还残留旧的站内字体 @font-face，请同步更新为 CDN 方案');
  let head = src.slice(0, styleStart)
    + `${FONT_LINKS}\n<style>\n${baseCssProd}\n${cCss}\n</style>`
    + src.slice(styleEnd + '</style>'.length, headEnd + '</head>'.length);

  // theme-color 换新配色（浅 #f2f2f6 / 深 #000000，与 c-1-tokens.css 的 --bg 一致）
  head = head.replace('content="#18213d" media="(prefers-color-scheme: dark)"', 'content="#000000" media="(prefers-color-scheme: dark)"');
  head = head.replace('content="#f0f4f8" media="(prefers-color-scheme: light)"', 'content="#f2f2f6" media="(prefers-color-scheme: light)"');
  if (!/content="#000000" media="\(prefers-color-scheme: dark\)"/.test(head) || !/content="#f2f2f6" media="\(prefers-color-scheme: light\)"/.test(head)) {
    throw new Error('theme-color 补丁未生效（原站 meta 可能已改动）');
  }

  // 站名统一：head 里的标签页标题 / 分享卡片标题 / og:site_name / 结构化数据 name
  head = head.replace(`<title>${NAME_ZH_OLD}</title>`, `<title>${SITE_ZH}</title>`);
  head = head.replace(`<meta property="og:title" content="${NAME_ZH_OLD}">`, `<meta property="og:title" content="${SITE_ZH}">`);
  head = head.replace('<meta property="og:site_name" content="王牌竞速计算器">', `<meta property="og:site_name" content="${SITE_ZH}">`);
  head = head.replace(`<meta name="twitter:title" content="${NAME_ZH_OLD}">`, `<meta name="twitter:title" content="${SITE_ZH}">`);
  head = head.replace(`"name": "${NAME_ZH_OLD}"`, `"name": "${SITE_ZH}"`);
  for (const need of [`<title>${SITE_ZH}</title>`,
                      `<meta property="og:title" content="${SITE_ZH}">`,
                      `<meta property="og:site_name" content="${SITE_ZH}">`,
                      `<meta name="twitter:title" content="${SITE_ZH}">`,
                      `"name": "${SITE_ZH}"`]) {
    if (!head.includes(need)) throw new Error('站名统一补丁未生效：' + need);
  }
  if (head.includes(NAME_ZH_OLD)) throw new Error('站名统一后 head 里仍残留旧名：' + NAME_ZH_OLD);
  // head 里还原样带着「语言初始化」那段脚本（见上面 patch('lang') 的说明）
  if (!head.includes("document.title = 'Ace Racer - Ult Energy Calculator';")) {
    throw new Error('head 里未找到语言初始化的标题赋值，站名统一补丁需要复核');
  }
  head = head.replace("document.title = 'Ace Racer - Ult Energy Calculator';", `document.title = '${SITE_EN}';`);
  if (head.includes('Ace Racer - Ult Energy Calculator')) throw new Error('站名统一后 head 里仍残留旧英文名');

  // <noscript> 兜底页的标题（仅禁用 JS 时可见）也统一
  const noscript = (src.match(/<noscript>[\s\S]*?<\/noscript>/) || [''])[0]
    .replace('<h1>Ace Racer - Ultimate Energy Calculator</h1>', `<h1>${SITE_EN}</h1>`);

  let html = `${head}
<body class="ds-c">
${ANTI_FLASH}
${noscript}
${buildBody('c', { notesInner })}
${js(v4Js)}
${js(S.tutorial)}
${js(S.carpicker)}
${js(S.imginit)}
${js(S.placeholder)}
${js(S.main)}
${js(S.details)}
${js(S.fps)}
${js(S.init)}
${js(viewJsProd)}
</body>
</html>
`;
  // 全文件统一 CRLF，与仓库既有 index.html 保持一致
  html = html.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

  // ---------- 防覆盖 ----------
  // index.html 现在是唯一源头（见文件开头）。输出路径上已经有文件、且内容和这次构建结果不同，就拒绝写入 ——
  // 不同就说明那个文件里有这套源码之外的改动，覆盖等于把它们删掉。
  // 比较时忽略换行符差异和 CDN 图片映射块（那一块由 scripts/update.mjs 维护，本来就会不同）。
  const CDN_BLOCK = /<script>\r?\n\/\/ Bilibili CDN image URLs \(auto-generated\)[\s\S]*?<\/script>/;
  const norm = (t) => t.replace(/\r\n/g, '\n').replace(CDN_BLOCK, '');
  if (fs.existsSync(PROD_OUT) && !argv.includes('--force') && norm(read(PROD_OUT)) !== norm(html)) {
    throw new Error(
      `拒绝覆盖：${PROD_OUT}\n` +
      '  这个文件里有构建源码之外的改动（2026-10-03 起 index.html 是唯一源头，之后的改动都直接改在它上面），\n' +
      '  用构建结果覆盖会把这些改动全部丢掉。\n' +
      '  · 想改界面：直接改 index.html，不要走这套构建。\n' +
      '  · 只想看构建结果：用 --out 指向一个还不存在的新文件。\n' +
      '  · 确定要覆盖并丢掉那些改动：加 --force。');
  }
  if (PROD_OUT === path.join(ROOT, 'index.html') && argv.includes('--force')) {
    console.warn('⚠ --force：正在用（已冻结的）构建结果覆盖线上 index.html，之后的直接改动会丢失');
  } else if (PROD_OUT !== path.join(ROOT, 'index.html')) {
    console.warn('⚠ 提示：这份构建结果不含 index.html 上的直接改动（构建源码已冻结），只能用来对照，不能拿去替换线上文件');
  }

  fs.writeFileSync(PROD_OUT, html);
  console.log('built PROD →', PROD_OUT, (html.length / 1024).toFixed(0) + 'KB');
  process.exit(0);
}

// ======================= 三套预览版 =======================
const VERSIONS = [
  { id: 'a', file: 'v1-timing.html', name: '计时塔' },
  { id: 'b', file: 'v2-spec-sheet.html', name: '规格书' },
  { id: 'c', file: 'v3-cockpit.html', name: '车机' },
];

for (const v of VERSIONS) {
  const cssFiles = fs.readdirSync(HERE).filter((f) => f.startsWith(`${v.id}-`) && f.endsWith('.css')).sort();
  if (!cssFiles.length) { console.warn('跳过（尚无样式）:', v.id); continue; }
  const css = cssFiles.map((f) => read(path.join(HERE, f))).join('\n');
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>${headMeta}
<!-- 预览版：${v.name} · 由 build.mjs 生成，请勿手改 -->
<link rel="icon" type="image/png" href="../../icon.png">
${js(h2c)}
${js(carDb)}
${js(S.icons)}
${js(S.lang)}
<style>
${baseCss}
${css}
</style>
<base target="_blank">
</head>
<body class="ds-${v.id}">
${ANTI_FLASH}
${buildBody(v.id, { notesInner, versions: VERSIONS, current: v.id })}
${v.id === 'c' ? js(v4Js) : ''}
${js(S.tutorial)}
${js(S.carpicker)}
${js(S.imginit)}
${js(S.placeholder)}
${js(S.main)}
${js(S.details)}
${js(S.fps)}
${js(S.init)}
${js(viewJs)}
</body>
</html>
`;
  fs.writeFileSync(path.join(OUT, v.file), html);
  console.log('built', v.file, (html.length / 1024).toFixed(0) + 'KB');
}
