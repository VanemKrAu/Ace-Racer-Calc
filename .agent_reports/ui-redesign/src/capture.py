# 预览截图：python capture.py [a|b|c ...] ；输出到 ../shots/
import os, sys, pathlib
# 复用本机已装的 chromium-1234（与宣传片渲染同一份）；临时 profile 放工作区，不往 C 盘写
CHROME = r"C:\Users\Vanem\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe"
TMP = r"E:\WorkSpace\.agent_tmp\pw-tmp"
os.makedirs(TMP, exist_ok=True)
os.environ["TMP"] = os.environ["TEMP"] = TMP
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "shots"
OUT.mkdir(exist_ok=True)
FILES = {"a": "v1-timing.html", "b": "v2-spec-sheet.html", "c": "v3-cockpit.html"}
want = sys.argv[1:] or list(FILES)
full = "--full" in want
want = [w for w in want if w in FILES]

VIEWS = [
    ("desktop-dark", 1440, 900, 1, "dark"),
    ("desktop-light", 1440, 900, 1, "light"),
    ("mobile-dark", 390, 844, 2, "dark"),
    ("mobile-light", 390, 844, 2, "light"),
]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    for k in want:
        url = (HERE.parent / FILES[k]).as_uri() + "?shot=1"
        for name, w, h, dpr, theme in VIEWS:
            ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=dpr, locale="zh-CN")
            ctx.add_init_script(f"localStorage.setItem('theme','{theme}');")
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            page.goto(url, wait_until="networkidle", timeout=60000)
            page.wait_for_timeout(700)
            page.screenshot(path=str(OUT / f"{k}-{name}.png"), full_page=full)
            if name.startswith("desktop-dark"):
                page.screenshot(path=str(OUT / f"{k}-{name}-full.png"), full_page=True)
            real = [e for e in errs if "favicon" not in e and "sw.js" not in e and "ERR_FILE_NOT_FOUND" not in e]
            print(k, name, "errors:" if real else "ok", real[:5])
            ctx.close()
    b.close()
