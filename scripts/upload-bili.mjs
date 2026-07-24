/**
 * Upload car images to Bilibili CDN.
 * Cookies are read from .agent_tmp/bili-cookies.json (gitignored).
 *
 * Usage:
 *   node scripts/upload-bili.mjs              # upload new images only
 *
 * First time: create .agent_tmp/bili-cookies.json:
 *   {"SESSDATA": "...", "bili_jct": "..."}
 *
 * Or set env vars: BILI_SESSDATA, BILI_JCT
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { request } from 'https';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

// Load cookies: env vars > .agent_tmp/bili-cookies.json > prompt
let SESSDATA = process.env.BILI_SESSDATA;
let BILI_JCT = process.env.BILI_JCT;

if (!SESSDATA || !BILI_JCT) {
  const cookieFile = join(projectRoot, '.agent_tmp', 'bili-cookies.json');
  if (existsSync(cookieFile)) {
    try {
      const c = JSON.parse(readFileSync(cookieFile, 'utf-8'));
      SESSDATA = SESSDATA || c.SESSDATA;
      BILI_JCT = BILI_JCT || c.bili_jct;
    } catch (e) {}
  }
}

if (!SESSDATA || !BILI_JCT) {
  console.error('❌ Bilibili cookies required.');
  console.error('   Option 1: Set env vars BILI_SESSDATA and BILI_JCT');
  console.error('   Option 2: Create .agent_tmp/bili-cookies.json:');
  console.error('     {"SESSDATA": "your_sessdata", "bili_jct": "your_bili_jct"}');
  process.exit(1);
}

const API = 'https://api.bilibili.com/x/upload/web/image';
const BUCKET = 'openplatform';
const COOKIE = `SESSDATA=${SESSDATA}; bili_jct=${BILI_JCT}`;

const mappingFile = join(projectRoot, 'data', 'bili-url-mapping.json');
const iconDir = join(projectRoot, 'data', 'icon');
const assetsDir = join(projectRoot, 'data', '26-07-15_29734784_android', 'full', 'assets');

let mapping = {};
if (existsSync(mappingFile)) {
  try { mapping = JSON.parse(readFileSync(mappingFile, 'utf-8')); }
  catch (e) {}
  console.log(`Loaded ${Object.keys(mapping).length} existing mappings`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function uploadFile(filePath, name) {
  const buf = readFileSync(filePath);
  const boundary = '----Boundary' + Math.random().toString(36).slice(2);
  const enc = str => Buffer.from(str, 'utf-8');
  const body = Buffer.concat([
    enc(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: image/png\r\n\r\n`),
    buf,
    enc(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="bucket"\r\n\r\n${BUCKET}`),
    enc(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="csrf"\r\n\r\n${BILI_JCT}`),
    enc(`\r\n--${boundary}--\r\n`),
  ]);
  const u = new URL(API);
  return new Promise((resolve, reject) => {
    const opts = { hostname: u.hostname, path: u.pathname, method: 'POST', headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length, 'Cookie': COOKIE,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
    }};
    const req = request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(d);
          if (json.code === 0 && json.data?.location) resolve(json.data.location.replace('http://', 'https://'));
          else reject(new Error(json.message || JSON.stringify(json)));
        } catch (e) { reject(new Error('Parse: ' + d.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function saveMapping() { writeFileSync(mappingFile, JSON.stringify(mapping, null, 2), 'utf-8'); }

async function uploadOne(relPath, absPath) {
  if (mapping[relPath]) { console.log(`  SKIP ${relPath}`); return; }
  try {
    const url = await uploadFile(absPath, relPath.split(/[/\\]/).pop());
    mapping[relPath] = url;
    saveMapping();
    console.log(`  OK ${relPath} → ${url}`);
  } catch (e) {
    console.error(`  FAIL ${relPath}: ${e.message}`);
    throw e;
  }
}

async function main() {
  if (existsSync(assetsDir)) {
    const carDirs = readdirSync(assetsDir).filter(d => statSync(join(assetsDir, d)).isDirectory());
    let up = 0;
    for (const dir of carDirs) {
      const bodyDir = join(assetsDir, dir, 'body');
      if (!existsSync(bodyDir)) continue;
      for (const file of readdirSync(bodyDir).filter(f => f.endsWith('_m.png') && !f.startsWith('tz_'))) {
        const relPath = `full/${dir}/body/${file}`;
        if (mapping[relPath]) continue;
        try { await uploadOne(relPath, join(bodyDir, file)); up++; await sleep(1200); }
        catch (e) { await sleep(5000); }
      }
    }
    console.log(`Uploaded ${up} new car images`);
  }
  console.log(`Total mappings: ${Object.keys(mapping).length}`);
  saveMapping();
}

main().catch(console.error);
