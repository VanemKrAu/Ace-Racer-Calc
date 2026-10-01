/**
 * Website Update Workflow
 * ========================
 * Run this after getting new car data from game update.
 *
 * Usage:
 *   node scripts/update.mjs [single-car-id...]
 *
 * Examples:
 *   node scripts/update.mjs             # check for any new single-* dirs
 *   node scripts/update.mjs 10037       # add car 10037
 *   node scripts/update.mjs 12095 12099 # add multiple cars
 */

import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';

const ROOT = join(import.meta.dirname, '..');
const DATA = join(ROOT, 'data', '26-07-15_29734784_android');
const FULL = join(DATA, 'full');
const VEHICLES = join(FULL, 'vehicles');
const ASSETS = join(FULL, 'assets');
const INDEX = join(ROOT, 'index.html');
const MAPPING = join(ROOT, 'data', 'bili-url-mapping.json');

function log(step, msg) {
  console.log(`\n  [${step}] ${msg}`);
}

function step(msg) {
  const line = '─'.repeat(Math.min(msg.length + 6, 60));
  console.log(`\n┌${line}┐\n│   ${msg}   │\n└${line}┘`);
}

// ── Step 0: Parse args ──
//   node scripts/update.mjs [--from <导出根目录>] [车ID...]
// 历史数据包放在 data/<数据集>/single-{id}/（.gitignore 也是这么声明的），
// 手工投放的包放在仓库根的 updata/ 下（可能还套一层批次目录，如 updata/26-09-18_delta/single-10019）。
const fromIdx = process.argv.indexOf('--from');
const FROM = fromIdx >= 0 ? process.argv[fromIdx + 1] : null;
const carIds = process.argv.slice(2).filter(a => a !== '--from' && a !== FROM);

const sourceRoots = [FROM, join(ROOT, 'updata'), DATA].filter(Boolean);

/** 在候选源目录（含一层批次子目录）里找 single-{id} */
function findSingle(id) {
  for (const root of sourceRoots) {
    if (!existsSync(root)) continue;
    const direct = join(root, `single-${id}`);
    if (existsSync(direct)) return direct;
    for (const e of readdirSync(root, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      const nested = join(root, e.name, `single-${id}`);
      if (existsSync(nested)) return nested;
    }
  }
  return null;
}

/** 列出所有可见的 single-* 目录 */
function listSingles() {
  const found = new Map();
  for (const root of sourceRoots) {
    if (!existsSync(root)) continue;
    const scan = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith('single-') && !e.name.includes('packages')) found.set(e.name.replace('single-', ''), join(dir, e.name));
        else if (e.name !== 'full' && e.name !== 'packages') {
          // 批次目录（如 updata/26-09-18_delta/）再看一层
          for (const e2 of readdirSync(join(dir, e.name), { withFileTypes: true })) {
            if (e2.isDirectory() && e2.name.startsWith('single-') && !e2.name.includes('packages'))
              found.set(e2.name.replace('single-', ''), join(dir, e.name, e2.name));
          }
        }
      }
    };
    scan(root);
  }
  return found;
}

/** 递归复制目录（已存在的文件不覆盖） */
function copyDir(src, dst) {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, e.name), d = join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else if (!existsSync(d)) { copyFileSync(s, d); log('COPY', `assets/${dst.split(/[\\/]assets[\\/]/)[1] || e.name}`); }
  }
}

// ── Step 1: Discover new car data ──
step('1. Discover new single-car data');
if (FROM) log('FROM', `使用指定导出目录: ${FROM}`);
log('SCAN', `候选源: ${sourceRoots.join('  |  ')}`);

const singles = listSingles();
if (singles.size === 0) {
  log('SKIP', '找不到任何 single-* 目录（可用 --from <导出根目录> 指定）');
} else {
  const targetIds = carIds.length > 0 ? carIds : [...singles.keys()];
  for (const id of targetIds) {
    const srcDir = findSingle(id) || singles.get(String(id));
    if (!srcDir) { log('SKIP', `找不到 single-${id}，跳过`); continue; }
    log('FOUND', `${id} → ${srcDir}`);

    // 车辆 JSON：兼容两种导出布局
    //   旧: single-{id}/vehicles/{id}.json
    //   新: single-{id}/vehicles/vehicles/{id}.json   (schemaVersion 2 导出)
    const jsonCandidates = [join(srcDir, 'vehicles', `${id}.json`), join(srcDir, 'vehicles', 'vehicles', `${id}.json`)];
    const srcVehicle = jsonCandidates.find(existsSync);
    const dstVehicle = join(VEHICLES, `${id}.json`);
    if (!srcVehicle) {
      log('WARN', `single-${id} 里找不到 ${id}.json（找过: ${jsonCandidates.map(p => p.replace(ROOT, '.')).join(' , ')}）`);
    } else {
      const isNew = !existsSync(dstVehicle);
      copyFileSync(srcVehicle, dstVehicle);
      log(isNew ? 'COPY' : 'UPDATE', `vehicles/${id}.json${isNew ? '' : '（已存在，按新导出覆盖）'}`);
    }

    // 资源图：兼容两种布局
    //   旧: single-{id}/assets/{车名}_{id}/body/*_m.png
    //   新: single-{id}/vehicles/images/{车名}_{id}/body/*_m.png
    const assetRoots = [join(srcDir, 'assets'), join(srcDir, 'vehicles', 'images')].filter(existsSync);
    if (assetRoots.length === 0) log('WARN', `single-${id} 里找不到资源目录（assets/ 或 vehicles/images/）`);
    for (const assetRoot of assetRoots) {
      for (const ad of readdirSync(assetRoot, { withFileTypes: true })) {
        if (!ad.isDirectory()) continue;
        const bodyDir = join(assetRoot, ad.name, 'body');
        if (existsSync(bodyDir)) {
          const dstBody = join(ASSETS, ad.name, 'body');
          mkdirSync(dstBody, { recursive: true });
          for (const f of readdirSync(bodyDir).filter(f => f.endsWith('_m.png') && !f.startsWith('tz_'))) {
            const dst = join(dstBody, f);
            if (!existsSync(dst)) { copyFileSync(join(bodyDir, f), dst); log('COPY', `assets/${ad.name}/body/${f}`); }
          }
        }
        // 其余资源（skins / skill-icons 等）整目录补齐
        for (const sub of readdirSync(join(assetRoot, ad.name), { withFileTypes: true })) {
          if (!sub.isDirectory() || sub.name === 'body') continue;
          const s = join(assetRoot, ad.name, sub.name), d = join(ASSETS, ad.name, sub.name);
          if (!existsSync(d)) copyDir(s, d);
        }
      }
    }
    log('DONE', `Car ${id} data staged`);
  }
}

// ── Step 2: Rebuild car-database.js ──
step('2. Rebuild car database');
execSync('node scripts/extract-cars.js', { cwd: ROOT, stdio: 'inherit' });

// ── Step 3: Upload new images to B站 CDN ──
step('3. Upload new images to B站 CDN');
execSync('node scripts/upload-bili.mjs', { cwd: ROOT, stdio: 'inherit' });

// ── Step 4: Regenerate CDN URL mappings in index.html ──
step('4. Regenerate CDN code in index.html');

const mapping = JSON.parse(readFileSync(MAPPING, 'utf-8'));

// Build icon lookup
const iconKeys = {};
for (const [key, url] of Object.entries(mapping)) {
  if (key.startsWith('data/icon/')) iconKeys[key.replace('data/icon/', '')] = url;
}

// Build car ID lookup
const carUrls = {};
for (const [key, url] of Object.entries(mapping)) {
  if (key.startsWith('full/')) {
    const m = key.match(/(\d+)_m\.png$/);
    if (m) carUrls[m[1]] = url;
  }
}

// Read current index.html
let html = readFileSync(INDEX, 'utf-8');

// Find and replace the CDN JS block (between _BILI_CDN marker)
const startMarker = '// Bilibili CDN image URLs (auto-generated)';
const endMarker = '</script>';
const blockStart = html.indexOf(startMarker);
const blockEnd = html.indexOf(endMarker, blockStart);

if (blockStart < 0) {
  log('ERROR', 'Cannot find CDN block marker in index.html. Inserting new block after car-database.js');
  const insertPoint = html.indexOf('</script>', html.indexOf('car-database.js')) + 9;
  const newBlock = generateCDNBlock(iconKeys, carUrls);
  html = html.slice(0, insertPoint) + newBlock + html.slice(insertPoint);
} else {
  // 从注释向前找到所属的 <script> 开标签，整块替换。
  // 若只从注释开始替换，原有 <script> 会残留，而新块又自带一个 <script>，
  // 结果出现连续两个 <script> 开标签（标签不配平）→ 该段脚本语法错误 → 页面 JS 全挂。
  const scriptOpen = html.lastIndexOf('<script', blockStart);
  // 仅当 <script> 与注释之间只有空白时才连开标签一起替换，否则退回只替换注释块
  const between = scriptOpen >= 0 ? html.slice(scriptOpen, blockStart) : '';
  const from = (scriptOpen >= 0 && /^<script[^>]*>\s*$/.test(between)) ? scriptOpen : blockStart;
  const oldBlock = html.slice(from, blockEnd + 9);
  const newBlock = generateCDNBlock(iconKeys, carUrls);
  html = html.replace(oldBlock, newBlock);
  log('REPLACE', 'Updated CDN block in index.html');
}

writeFileSync(INDEX, html, 'utf-8');
log('DONE', 'index.html CDN references updated');

// ── Step 5: Summary ──
step('5. Summary');
// 读不到就如实说，不要因为最后一步读文件失败把整条命令弄成失败退出
let carCount = '?';
try {
  const dbCars = readFileSync(join(ROOT, 'car-database.js'), 'utf-8');
  const dbMatch = dbCars.match(/const CAR_DATABASE = \[([\s\S]*?)\];/);
  carCount = dbMatch ? (dbMatch[1].match(/"id":/g) || []).length : '?';
} catch (e) {
  carCount = `读取失败（${e.code || e.message}）`;
}
console.log(`  Cars in database: ${carCount}`);
console.log(`  Images on CDN:    ${Object.keys(carUrls).length}`);
console.log(`  Icons on CDN:     ${Object.keys(iconKeys).length}`);

console.log('\n  ⚠️  REMEMBER: 新车请登记 scripts/extract-cars.js 顶部 ADDED_AT 表!');
console.log('     时间戳: node -e "console.log(Date.now())"（否则新车不排列表最前）');

console.log('\n  ✅ Update complete! Ready to commit and push.');
console.log('  ───────────────────────────────────────');
console.log('  Suggested commit: git add -A && git commit -m "feat: add N new cars + CDN upload"');
console.log('  Then push:        git push\n');

// ── Helper ──
function generateCDNBlock(icons, carImg) {
  let js = '\n<script>\n// Bilibili CDN image URLs (auto-generated)\n';
  js += 'var _BILI_CDN = true;\n';
  js += 'var _ICONS = ' + JSON.stringify(icons, null, 2) + ';\n';
  js += 'var _CAR_IMG = {\n';
  const sorted = Object.entries(carImg).sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
  for (const [id, url] of sorted) {
    js += `  ${id}: "${url}",\n`;
  }
  js += '};\n';
  js += '</script>\n';
  return js;
}
