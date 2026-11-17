"""本地回归：需要 Python Playwright 和已安装的 Chrome；不访问线上服务。"""
from pathlib import Path
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=CHROME, headless=True)
    page = browser.new_page(viewport={"width": 375, "height": 812})
    page.route("https://**", lambda route: route.abort())
    page.route("http://**", lambda route: route.abort())
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((ROOT / "index.html").as_uri(), wait_until="load")

    page.evaluate("""() => {
      const car = CAR_DATABASE.find(item => getCarVSlots(item) >= 2);
      pickCar(car.id);
      chipRestore('0');
      _chipPickerSet(true, true);
    }""")
    assert page.locator('#chipSlots [data-act="open"]').count() == 1
    assert page.locator('#chipSlots [data-act="open"] .zh').text_content() == '选择芯片'
    assert page.locator('#chipGrid .chip-tile').first.get_attribute('data-id') == 'acecore'
    assert page.locator('#chipGrid [data-id="hunter"]').count() == 1
    page.evaluate("chipEquip('acecore'); _chipPickerSet(true, true); chipEquip('hunter')")
    assert page.evaluate("_chipCount('core') === 1 && _chipCount('v') === 1")
    assert page.locator('#chipSlots [data-act="open"]').count() == 1
    assert page.locator('#chipSlots [data-id="acecore"][data-opt="level"]').count() == 0
    assert page.evaluate("_chipOptionDefs(_chipDef('acecore')).length") == 0

    for level in range(1, 11):
        result = page.evaluate("""level => {
          _chipsOn = [{id:'acecore', opts:{level:String(level)}}];
          return chipAgg(0.82, 1.2);
        }""", level)
        expected = 5 * 0.82 * 1.2
        assert result["first"] == 0
        assert abs(result["loop"] - expected) < 1e-9
        assert all(abs(value - expected) < 1e-9 for value in result["ult"])

    page.evaluate("""() => {
      const car = CAR_DATABASE.find(item => getCarVSlots(item) >= 2);
      pickCar(car.id);
      chipRestore('acecore.level=7-hunter.loopMode=peak-catnap');
    }""")
    assert page.evaluate("_chipCount('core') === 1 && _chipCount('v') === 2")
    page.evaluate("window.copyToClipboard = url => window.__testShare = url; exportConfigLink()")
    share = page.evaluate("window.__testShare")
    page.goto((ROOT / "index.html").as_uri() + "?s=" + share.split("?s=", 1)[1], wait_until="load")
    assert page.evaluate("_chipCount('core') === 1 && _chipCount('v') === 2")
    assert page.evaluate("_chipsOn.find(item => item.id === 'acecore').opts.level === undefined")
    assert abs(page.evaluate("chipAgg(0.82, 1.2).ult[0]") - 5 * 0.82 * 1.2) < 1e-9

    page.evaluate("chipRestore('acecore.level=10'); renderChain(99, 100, 100, 0, 0, {}, 100, chipAgg(1, 1))")
    assert page.evaluate("_chainRes.brk") == 0
    page.evaluate("renderChain(100, 100, 100, 0, 0, {}, 100, chipAgg(1, 1))")
    assert page.evaluate("_chainRes.brk") == -1
    formula = page.locator("#formulaChain").text_content()
    assert "100.000" in formula and "105.000" not in formula
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")
    assert not errors, errors
    browser.close()

print("王牌核心固定满级、旧配装兼容、倍率、独立槽位、分享与连发回归通过")
