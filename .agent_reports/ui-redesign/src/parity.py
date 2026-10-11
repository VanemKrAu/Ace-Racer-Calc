# 交互一致性测试：同一套用户操作分别跑在线上 index.html 与三个预览上，逐项比对状态。
import os, sys, json, pathlib
CHROME = r"C:\Users\Vanem\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe"
TMP = r"E:\WorkSpace\.agent_tmp\pw-tmp"
os.makedirs(TMP, exist_ok=True)
os.environ["TMP"] = os.environ["TEMP"] = TMP
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PAGES = {
    "original": ROOT / "index.html",
    "a": HERE.parent / "v1-timing.html",
    "b": HERE.parent / "v2-spec-sheet.html",
    "c": HERE.parent / "v3-cockpit.html",
}

STUB = "window.__copied=[];Object.defineProperty(navigator,'clipboard',{value:{writeText:function(t){window.__copied.push(t);return Promise.resolve();}}});"

SNAP = """() => {
  const g = id => document.getElementById(id);
  const vis = el => !!el && getComputedStyle(el).display !== 'none';
  return {
    first: g('resultValueFirst').textContent.trim(),
    loop: g('resultValueLoop').textContent.trim(),
    firstErr: g('resultCardFirst').classList.contains('error-state'),
    loopErr: g('resultCardLoop').classList.contains('error-state'),
    formulaFirst: g('formulaDisplayFirst').textContent.trim(),
    formulaLoop: g('formulaDisplayLoop').textContent.trim(),
    detailLoop: g('resultDetailLoop').textContent.replace(/^[\\s✅❌⚠✨️]+/, '').trim(),
    xianji: g('inputXianji').value, huineng: g('inputHuineng').value, huinengMax: g('inputHuineng').max,
    nitroCount: g('inputNitroCount').value, autoInfo: g('autoCalcInfo').textContent.trim(),
    nitroInfo: g('nitroCountModeInfo').textContent.trim(),
    times: ['1x5','1x6','2x2','2x3','2x25','3x2'].map(k => g('time_' + k).value).join(','),
    selectedNitro: [...document.querySelectorAll('.nitro-item')].findIndex(e => e.classList.contains('selected')),
    empowerActive: [...document.querySelectorAll('.empower-item.active')].map(e => e.id).join(','),
    empowerDisabled: [...document.querySelectorAll('.empower-checkbox:disabled')].map(e => e.value).join(','),
    tip: vis(g('empowerTip')),
    extraNitroOpen: g('extraNitroSection').classList.contains('extra-active-nitro'),
    jiezouOpen: g('item_jiezou').classList.contains('active'),
    ult: g('actualUltTimeSpan').textContent.trim(),
    carLabel: g('carListLabel').textContent.trim(),
    carInfo: g('carSelectInfo').textContent.replace(/\\s+/g, ' ').trim(),
    autoMsg: g('carPreviewAutoMsg').textContent.trim(),
    chips: g('carPreviewChips').children.length,
    limitBadge: document.querySelectorAll('.limit-badge')[1].textContent.trim(),
    counter: g('counterValue').textContent, debuff: g('debuffValue').textContent,
    light: document.body.classList.contains('light-mode'), en: document.body.classList.contains('en-mode'),
    copied: (window.__copied || []).map(t => t.replace(/^.*\\?s=/, '?s=')),
  };
}"""

def run(page, url):
    page.goto(url, wait_until="load")
    page.wait_for_timeout(400)
    steps = {}
    page.fill("#carSearch", "lc")
    steps["searchCount"] = page.eval_on_selector_all("#carDropdown .dropdown-option", "els => els.filter(e => e.style.display !== 'none').length")
    steps["dropdownOpen"] = page.eval_on_selector("#carDropdown", "e => e.classList.contains('show')")
    page.locator("#carDropdown .dropdown-option:visible").nth(1).click()
    page.fill("#carSearch", "")
    page.eval_on_selector("#counterRange", "e => { e.value = '5'; e.dispatchEvent(new Event('input', {bubbles:true})); }")
    page.eval_on_selector("#debuffRange", "e => { e.value = '10'; e.dispatchEvent(new Event('input', {bubbles:true})); }")
    page.click("label[for=chk_fusu]")
    page.click("label[for=chk_yichu]", force=True)   # 应被拒：主要赋能最多 1 个（此时已禁用）
    page.click("label[for=chk_jiezou]")
    page.fill("#jiezou_sub_first", "2")
    page.click("label[for=r_2x3]")
    page.fill("#time_2x3", "3")
    page.check("#hasExtraNitro")
    page.fill("#valExtraNitro", "2")
    page.fill("#inputFirstNitroCount", "2")
    page.fill("#inputXianji", "10")             # 联动：自动反算汇能
    page.fill("#inputNitroCount", "3")          # 手动覆盖氮气个数
    steps["s1"] = page.evaluate(SNAP)
    page.click("text=恢复自动计算")
    page.click("#themeBtn"); page.click("#themeMenu .dropdown-option >> nth=0")
    page.click(".share-btn.btn-text"); page.click(".share-btn.btn-link")
    page.wait_for_timeout(200)
    steps["s2"] = page.evaluate(SNAP)
    page.click("#langToggleBtn")
    page.wait_for_timeout(150)
    steps["s3_en"] = page.evaluate(SNAP)
    return steps

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    out = {}
    for k, f in PAGES.items():
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, locale="zh-CN")
        ctx.add_init_script(STUB + "localStorage.setItem('theme','dark');localStorage.setItem('hideTutorial','true');")
        page = ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        out[k] = run(page, f.as_uri() + ("?blank=1" if k != "original" else ""))
        out[k]["pageErrors"] = errs
        # 用原站生成的分享链接回灌到该页面，校验 loadConfigFromUrl
        link = out["original"]["s2"]["copied"][-1]
        page.goto(f.as_uri() + link, wait_until="load")
        page.wait_for_timeout(500)
        out[k]["fromLink"] = page.evaluate(SNAP)
        ctx.close()
    b.close()

base = out["original"]
ok = True
for k in ("a", "b", "c"):
    diffs = []
    for step in ("searchCount", "dropdownOpen"):
        if out[k][step] != base[step]: diffs.append((step, base[step], out[k][step]))
    for step in ("s1", "s2", "s3_en", "fromLink"):
        for key, v in base[step].items():
            if out[k][step][key] != v: diffs.append((f"{step}.{key}", v, out[k][step][key]))
    if out[k]["pageErrors"]: diffs.append(("pageErrors", [], out[k]["pageErrors"]))
    ok &= not diffs
    print(f"== {k}: {'一致' if not diffs else str(len(diffs)) + ' 处差异'}")
    for d in diffs[:12]: print("   ", d[0], "| 原:", str(d[1])[:90], "| 新:", str(d[2])[:90])
print("原站关键结果:", base["s1"]["first"], "/", base["s1"]["loop"], "| 汇能", base["s1"]["huineng"], "| 禁用", base["s1"]["empowerDisabled"], "| 提示", base["s1"]["tip"])
print("原站 pageErrors:", base["pageErrors"])
sys.exit(0 if ok else 1)
