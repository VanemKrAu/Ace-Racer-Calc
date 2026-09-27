#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重新渲染 PWA 截图（manifest.json / sw.js 引用的那 6 张）。

用法：
    python3 scripts/render-screenshots.py                 # 默认截线上 https://aceracercalc.top/
    python3 scripts/render-screenshots.py --url <地址>     # 换地址（如本地 index.html 的 file:// 或 http 服务）
    python3 scripts/render-screenshots.py --out <目录>     # 换输出目录（默认项目根目录）

输出（与 manifest.json 中的 sizes 声明一致）：
    screenshot-desktop-1.png ~ 3.png   2560×1516（1280×758 视口 @2x）
    screenshot-mobile-1.png  ~ 3.png   1440×3200（720×1600 视口 @2x）

截图状态：布加迪 Bolide（飞火流星）· 对手反制 0% · 先机 20.5 / 汇能 50
          · 释放一大所需氮气 1 个 · 勾选「能源回收」赋能 → 首发✅ 循环✅

依赖：python3 + playwright（chromium）
"""
import argparse
import os
import sys

from playwright.sync_api import sync_playwright

DEFAULT_URL = "https://aceracercalc.top/"
CAR_NAME = "布加迪 Bolide"

# 把页面调成「双轨达成」的展示状态
SETUP_JS = """() => {
  function setVal(id, v) {
    const el = document.getElementById(id);
    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event('input', {bubbles: true}));
  }
  function check(id, on) {
    const el = document.getElementById(id);
    if (el && el.checked !== on) { el.checked = on; el.dispatchEvent(new Event('change', {bubbles: true})); }
  }
  const cr = document.getElementById('counterRange');
  if (cr) { cr.value = '0'; if (window.updateCounterSlider) updateCounterSlider(); }
  setVal('inputXianji', 20.5);
  setVal('inputHuineng', 50);
  setVal('inputFirstNitroCount', 1);
  check('chk_huishou', true);          // 能源回收（仅循环生效 +10%）
  if (window.calculate) calculate();
  return true;
}"""

# 截图前清掉环境噪音：性能提示 toast / performance-mode class
CLEAN_JS = """() => {
  document.body.classList.remove('performance-mode');
  const t = document.getElementById('copyToast');
  if (t) t.className = 'copy-toast';
}"""

# 各区块的定位锚点（文字 → CSS 类名过滤）
POS_JS = """(marks) => {
  const out = {};
  for (const m of marks) {
    const els = [...document.querySelectorAll('div,span,h2,h3')].filter(e =>
      (e.textContent || '').includes(m) && (e.className || '').toString().match(/divider|card-title|result-title/));
    out[m] = els.length ? Math.round(els[0].getBoundingClientRect().top + window.scrollY) : null;
  }
  out['__scrollH'] = document.body.scrollHeight;
  return out;
}"""

# 结果卡的几何信息（用于把「计算结果」完整框进画面、不被截断）
CARDS_JS = """() => {
  const g = id => { const e = document.getElementById(id); if (!e) return null;
    const r = e.getBoundingClientRect();
    return {top: Math.round(r.top + window.scrollY), bot: Math.round(r.bottom + window.scrollY)}; };
  const byTitle = t => { const e = [...document.querySelectorAll('.card-title')].find(x => x.textContent.includes(t));
    if (!e) return null; const r = e.closest('.card').getBoundingClientRect();
    return {top: Math.round(r.top + window.scrollY), bot: Math.round(r.bottom + window.scrollY)}; };
  return { first: g('resultCardFirst'), loop: g('resultCardLoop'),
           chip: byTitle('智能芯片'), nitro: byTitle('大招期间氮气'),
           vh: window.innerHeight, scrollH: document.body.scrollHeight };
}"""


def framed_y(cards, keys, vh, scroll_h, margin=20):
    """把 cards[keys] 的并集区间尽量完整地框进视口。
    策略：优先底部对齐（上方少留白）；若区间比视口还高则居中。顶部永不被切。"""
    tops, bots = [], []
    for k in keys:
        c = cards.get(k)
        if c:
            tops.append(c["top"]); bots.append(c["bot"])
    if not tops:
        return None
    top, bot = min(tops), max(bots)
    h = bot - top
    if h > vh - 2 * margin:
        y = round(top - max(0, (vh - h) / 2))
    else:
        y = min(bot + margin - vh, top - margin)   # 底部对齐，且顶部留 margin
    return int(max(0, min(y, scroll_h - vh)))


def prepare(pg, url):
    """打开页面 → 关教程 → 选车 → 填参数 → 勾赋能。"""
    pg.goto(url, wait_until="networkidle", timeout=90000)
    pg.wait_for_timeout(2800)
    try:
        pg.click("#closeTutorialBtn", timeout=2500)
        pg.wait_for_timeout(400)
    except Exception:
        pass
    pg.click("#carListBtn")
    pg.wait_for_timeout(900)
    pg.click(f"text={CAR_NAME}", timeout=8000)
    pg.wait_for_timeout(1800)
    pg.evaluate(SETUP_JS)
    pg.wait_for_timeout(1000)


def shoot(pg, y, path):
    """滚到 y 并截图，截图前清环境噪音。"""
    pg.evaluate(CLEAN_JS)
    pg.evaluate(f"window.scrollTo(0, {int(y)})")
    pg.wait_for_timeout(700)
    pg.evaluate(CLEAN_JS)
    pg.screenshot(path=path)
    print(f"  写出 {path}  (y={int(y)})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default=DEFAULT_URL)
    ap.add_argument("--out", default=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    a = ap.parse_args()
    out = a.out
    os.makedirs(out, exist_ok=True)

    with sync_playwright() as p:
        b = p.chromium.launch()

        # ── 桌面 2560×1516 ────────────────────────────────────────────
        ctx = b.new_context(viewport={"width": 1280, "height": 758}, device_scale_factor=2,
                            locale="zh-CN")
        pg = ctx.new_page()
        prepare(pg, a.url)
        pos = pg.evaluate(POS_JS, ["基础属性及赋能调整区"])
        cards = pg.evaluate(CARDS_JS)
        print("桌面锚点:", pos, "| 卡片:", cards)
        # 1 顶部：标题 + 选车 + 车辆信息
        shoot(pg, 0, f"{out}/screenshot-desktop-1.png")
        # 2 参数区：左列核心参数/氮气规格 + 右列七大赋能矩阵
        shoot(pg, max(0, (pos["基础属性及赋能调整区"] or 700) - 60), f"{out}/screenshot-desktop-2.png")
        # 3 结果区：芯片面板 + 首发/循环两张结果卡完整入画
        y3 = framed_y(cards, ["chip", "nitro", "first", "loop"], cards["vh"], cards["scrollH"])
        if y3 is None:
            y3 = max(0, 2000)
        shoot(pg, y3, f"{out}/screenshot-desktop-3.png")
        ctx.close()

        # ── 移动 1440×3200 ────────────────────────────────────────────
        ctx2 = b.new_context(viewport={"width": 720, "height": 1600}, device_scale_factor=2,
                             locale="zh-CN", is_mobile=True, has_touch=True)
        pg2 = ctx2.new_page()
        prepare(pg2, a.url)
        cards2 = pg2.evaluate(CARDS_JS)
        print("移动卡片:", cards2)
        # 1 顶部
        shoot(pg2, 0, f"{out}/screenshot-mobile-1.png")
        # 2 结果区：芯片面板 + 首发/循环两张结果卡完整入画
        y2 = framed_y(cards2, ["chip", "nitro", "first", "loop"], cards2["vh"], cards2["scrollH"])
        if y2 is None:
            y2 = 3520
        shoot(pg2, y2, f"{out}/screenshot-mobile-2.png")
        # 3 循环评估区：氮气次数卡完整露出 + 循环结果卡 + 分享区
        y3m = max(0, (cards2["nitro"]["top"] if cards2.get("nitro") else 4400) - 25)
        shoot(pg2, y3m, f"{out}/screenshot-mobile-3.png")
        ctx2.close()
        b.close()

    print("完成。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
