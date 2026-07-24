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

import { readFileSync, writeFileSync, readdirSync, copyFileSync, existsSync, mkdirSync } from 'fs';
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

// ── Step 0: Parse car IDs ──
const carIds = process.argv.slice(2);

// ── Step 1: Discover new car data ──
step('1. Discover new single-car data');

const dataRoot = dirname(DATA);
const singles = readdirSync(dataRoot)
  .filter(d => d.startsWith('single-') && !d.includes('packages'));

if (singles.length === 0) {
  log('SKIP', 'No single-* directories found');
} else {
  const discoveredIds = singles.map(s => s.replace('single-', ''));
  const targetIds = carIds.length > 0 ? carIds : discoveredIds;

  for (const id of targetIds) {
    const srcDir = join(dataRoot, `single-${id}`);
    if (!existsSync(srcDir)) {
      log('SKIP', `single-${id} not found, skipping`);
      continue;
    }

    // Copy vehicle JSON
    const srcVehicle = join(srcDir, 'vehicles', `${id}.json`);
    const dstVehicle = join(VEHICLES, `${id}.json`);
    if (existsSync(srcVehicle) && !existsSync(dstVehicle)) {
      copyFileSync(srcVehicle, dstVehicle);
      log('COPY', `vehicles/${id}.json`);
    }

    // Copy asset images
    const srcAssets = join(srcDir, 'assets');
    if (existsSync(srcAssets)) {
      const assetDirs = readdirSync(srcAssets).filter(d => {
        try { return statSync(join(srcAssets, d)).isDirectory(); } catch { return false; }
      });
      for (const ad of assetDirs) {
        const srcAssetDir = join(srcAssets, ad, 'body');
        if (!existsSync(srcAssetDir)) continue;
        const dstAssetDir = join(ASSETS, ad, 'body');
        mkdirSync(dstAssetDir, { recursive: true });
        for (const f of readdirSync(srcAssetDir).filter(f => f.endsWith('_m.png') && !f.startsWith('tz_'))) {
          const src = join(srcAssetDir, f);
          const dst = join(dstAssetDir, f);
          if (!existsSync(dst)) {
            copyFileSync(src, dst);
            log('COPY', `assets/${ad}/body/${f}`);
          }
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
  const oldBlock = html.slice(blockStart, blockEnd + 9);
  const newBlock = generateCDNBlock(iconKeys, carUrls);
  html = html.replace(oldBlock, newBlock);
  log('REPLACE', 'Updated CDN block in index.html');
}

writeFileSync(INDEX, html, 'utf-8');
log('DONE', 'index.html CDN references updated');

// ── Step 5: Summary ──
step('5. Summary');
const dbCars = readFileSync(join(ROOT, 'car-database.js'), 'utf-8');
const dbMatch = dbCars.match(/const CAR_DATABASE = \[([\s\S]*?)\];/);
const carCount = dbMatch ? (dbMatch[1].match(/"id":/g) || []).length : 0;
console.log(`  Cars in database: ${carCount}`);
console.log(`  Images on CDN:    ${Object.keys(carUrls).length}`);
console.log(`  Icons on CDN:     ${Object.keys(iconKeys).length}`);

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
