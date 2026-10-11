# 长截图导出回归：点「保存长截图」，确认三版 × 深浅色都能下载到 PNG。输出 ../shots/export/
# 用法：python export_check.py [v3-cockpit.html ...]
import os, sys, pathlib
CHROME = r"C:\Users\Vanem\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe"
TMP = r"E:\WorkSpace\.agent_tmp\pw-tmp"
os.makedirs(TMP, exist_ok=True)
os.environ["TMP"] = os.environ["TEMP"] = TMP
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
OUT = HERE.parent / "shots" / "export"
OUT.mkdir(parents=True, exist_ok=True)
files = sys.argv[1:] or ["v1-timing.html", "v2-spec-sheet.html", "v3-cockpit.html"]
ok = True
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=CHROME)
    for f in files:
        for theme in ("dark", "light"):
            ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
            ctx.add_init_script(f"localStorage.setItem('theme','{theme}');")
            pg = ctx.new_page()
            pg.goto((HERE.parent / f).as_uri() + "?shot=1", wait_until="networkidle")
            pg.wait_for_timeout(600)
            try:
                with pg.expect_download(timeout=45000) as dl:
                    pg.click(".share-btn.btn-image")
                path = OUT / f"{f[:-5]}-{theme}.png"
                dl.value.save_as(str(path))
                print(f, theme, "OK", path.stat().st_size // 1024, "KB")
            except Exception:
                ok = False
                print(f, theme, "FAIL", pg.text_content("#copyToast"))
            ctx.close()
    b.close()
sys.exit(0 if ok else 1)
