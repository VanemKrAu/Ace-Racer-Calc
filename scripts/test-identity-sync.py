"""离线验证本人方案同步、通知隔离及并发；不访问真实服务或用户数据。"""
import hashlib
import json
import mimetypes
from pathlib import Path
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
TOKEN = "a" * 64
IDENTITY = hashlib.sha256(TOKEN.encode()).hexdigest()
OTHER_IDENTITY = hashlib.sha256(("b" * 64).encode()).hexdigest()
INITIAL = [
    {"id": "local_one", "remote_id": "mine_one", "owner_identity_hash": IDENTITY,
     "remote_status": "pending_review", "car_id": 12104, "title": "owned plan", "params": {}, "annotations": []},
    {"id": "local_removed", "remote_id": "mine_removed", "owner_identity_hash": IDENTITY,
     "remote_status": "approved", "car_id": 12104, "title": "removed plan", "params": {}, "annotations": []},
]
RESPONSE = {"success": True, "data": {"identity_version": 1, "identity_hash": IDENTITY,
    "has_more": False, "items": [{"id": "mine_one", "car_id": 12104, "car_name": "test",
    "title": "owned plan", "status": "approved", "params": {}, "created_at": 1,
    "annotations": [{"id": "annotation1", "content": "new"}]}]}}


def serve(route):
    parsed = urlparse(route.request.url)
    if parsed.hostname != "localhost":
        return route.abort()
    relative = unquote(parsed.path).lstrip("/") or "index.html"
    candidate = (ROOT / relative).resolve()
    if ROOT not in candidate.parents or not candidate.is_file():
        return route.abort()
    if relative == "community-plans.js":
        text = candidate.read_text(encoding="utf-8").replace(
            "window.CommunityPlans = CommunityPlans;",
            "window.__testState = state; window.CommunityPlans = CommunityPlans;",
        )
        return route.fulfill(body=text, content_type="application/javascript")
    return route.fulfill(body=candidate.read_bytes(), content_type=mimetypes.guess_type(str(candidate))[0] or "application/octet-stream")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=CHROME, headless=True)
    page = browser.new_page(viewport={"width": 375, "height": 850})
    setup = """(() => {
      localStorage.setItem('arc_user_identity_v1', TOKEN);
      localStorage.setItem('arc_profile_intro_v1', '1');
      localStorage.setItem('arc_saved_plans_v1', JSON.stringify(INITIAL));
      window.__mineResponse = RESPONSE;
      window.fetch = (url) => {
        url = String(url);
        if (url.includes('mine=1')) {
          if (window.__deferMine) {
            const stale = JSON.stringify(window.__mineResponse);
            return new Promise(resolve => { window.__resolveMine = () => resolve(new Response(stale, {status:200})); });
          }
          return Promise.resolve(new Response(JSON.stringify(window.__mineResponse), {status:200}));
        }
        if (url.includes('check_statuses=')) return Promise.resolve(new Response(JSON.stringify({success:true,data:{items:{mine_one:{found:true,status:'approved',viewer_is_author:true,annotations:[{id:'annotation1',content:'new'}]},mine_removed:{found:false,status:'cleaned'}}}}),{status:200}));
        return Promise.resolve(new Response(JSON.stringify({success:true,data:{items:[],total:0},site_meta:{}}),{status:200}));
      };
    })();""".replace("TOKEN", json.dumps(TOKEN)).replace("INITIAL", json.dumps(INITIAL)).replace("RESPONSE", json.dumps(RESPONSE))
    page.add_init_script(setup)
    page.route("**/*", serve)
    page.goto("http://localhost:8421/index.html", wait_until="load")
    page.wait_for_function("window.__testState && window.__testState.identityApiReady", timeout=10000)
    types = page.evaluate("JSON.parse(localStorage.getItem('arc_notifications_v1:' + window.__testState.currentIdentityHash) || '[]').map(x => x.type)")
    assert {"approved", "removed", "annotation"}.issubset(types), types
    page.evaluate("pickCar(12104)")
    page.wait_for_timeout(300)
    assert "removed plan" in page.locator("#communityPlansContainer").inner_text()

    page.evaluate("""() => {
      window.__deferMine = true;
      CommunityPlans.syncOwnedPlans(true);
    }""")
    page.wait_for_function("typeof window.__resolveMine === 'function'")
    page.evaluate("""() => {
      var s = window.__testState;
      s._ownedMutationEpoch = (s._ownedMutationEpoch || 0) + 1;
      s.savedPlans.push({id:'new_local', remote_id:'new_remote', owner_identity_hash:s.currentIdentityHash,
        remote_status:'pending_review', car_id:12104, title:'new plan', params:{}});
      s.ownedRemoteIds.new_remote = true;
      window.__deferMine = false;
      window.__mineResponse.data.items.push({id:'new_remote',car_id:12104,car_name:'test',title:'new plan',status:'pending_review',params:{}});
      window.__resolveMine();
    }""")
    page.wait_for_function("!window.__testState._syncingOwned", timeout=10000)
    assert page.evaluate("window.__testState.savedPlans.find(x=>x.remote_id==='new_remote').remote_status") == "pending_review"
    page.close()

    page = browser.new_page(viewport={"width": 375, "height": 850})
    offline = """(() => { localStorage.setItem('arc_user_identity_v1',TOKEN);
      localStorage.setItem('arc_profile_intro_v1','1'); localStorage.setItem('arc_saved_plans_v1',JSON.stringify(INITIAL));
      window.fetch=()=>Promise.reject(new Error('offline')); })();""".replace("TOKEN", json.dumps(TOKEN)).replace("INITIAL", json.dumps(INITIAL[:1]))
    page.add_init_script(offline)
    page.route("**/*", serve)
    page.goto("http://localhost:8421/index.html", wait_until="load")
    page.wait_for_function("window.__testState && window.__testState.ownedRemoteIds && window.__testState.ownedRemoteIds.mine_one")
    page.evaluate("pickCar(12104)")
    page.wait_for_timeout(300)
    assert "owned plan" in page.locator("#communityPlansContainer").inner_text()
    page.close()

    page = browser.new_page()
    other = offline.replace(json.dumps(TOKEN), json.dumps("b" * 64)).replace(
        "window.fetch=", "localStorage.setItem('arc_notifications_v1:" + IDENTITY + "', JSON.stringify([{id:'private',type:'annotation',extra:'private note'}]));window.fetch="
    )
    page.add_init_script(other)
    page.route("**/*", serve)
    page.goto("http://localhost:8421/index.html", wait_until="load")
    page.wait_for_function("window.__testState && window.__testState.currentIdentityHash")
    assert page.evaluate("window.__testState.currentIdentityHash") == OTHER_IDENTITY
    assert not page.evaluate("Boolean(window.__testState.ownedRemoteIds.mine_one)")
    assert page.evaluate("window.__testState.notifications.length") == 0
    assert page.evaluate("localStorage.getItem('arc_notifications_v1:" + IDENTITY + "') !== null")
    context = browser.new_context()
    prompt = context.new_page()
    prompt.add_init_script("window.fetch=()=>Promise.reject(new Error('offline'))")
    prompt.route("**/*", serve)
    prompt.goto("http://localhost:8421/index.html", wait_until="load")
    prompt.evaluate("ArcProfile.configurePrompt({enabled:false,max_shows:2,delay_seconds:0,interval_hours:0})")
    prompt.wait_for_timeout(150)
    assert prompt.locator('.profile-overlay').count() == 0
    for expected in (1, 2):
        prompt.evaluate("ArcProfile.configurePrompt({enabled:true,max_shows:2,delay_seconds:0,interval_hours:0})")
        prompt.wait_for_selector('.profile-overlay')
        assert prompt.evaluate("JSON.parse(localStorage.getItem('arc_profile_prompt_state_v1')).count") == expected
        prompt.locator('[data-profile=skip]').click()
        prompt.wait_for_selector('.profile-overlay', state='detached')
        prompt.reload(wait_until='load')
    prompt.evaluate("ArcProfile.configurePrompt({enabled:true,max_shows:2,delay_seconds:0,interval_hours:0})")
    prompt.wait_for_timeout(150)
    assert prompt.locator('.profile-overlay').count() == 0
    context.close()

    # 验证「不填昵称时，每打开 5 次网站弹出 1 次（第 1、6 次弹；填完昵称后不再弹）」
    freq_ctx = browser.new_context()
    fp = freq_ctx.new_page()
    fp.add_init_script("window.fetch=()=>Promise.reject(new Error('offline'))")
    fp.route("**/*", serve)
    policy5 = "ArcProfile.configurePrompt({enabled:true,visit_interval:5,show_on_first:true,max_shows:0,delay_seconds:0,interval_hours:0})"
    for visit in range(1, 7):
        fp.goto("http://localhost:8421/index.html", wait_until="load")
        fp.evaluate(policy5)
        if visit in (1, 6):
            fp.wait_for_selector('.profile-overlay')
            if visit == 1:
                fp.locator('[data-profile=skip]').click()
                fp.wait_for_selector('.profile-overlay', state='detached')
            else:
                fp.locator('#profileNickname').fill('测试车手')
                fp.locator('[data-profile=save]').click()
                fp.wait_for_selector('.profile-overlay', state='detached')
        else:
            fp.wait_for_timeout(120)
            assert fp.locator('.profile-overlay').count() == 0, f"visit {visit} should not prompt"
    # 已填昵称后即使后续到达周期也不再弹出
    for _ in range(5):
        fp.goto("http://localhost:8421/index.html", wait_until="load")
        fp.evaluate(policy5)
        fp.wait_for_timeout(80)
        assert fp.locator('.profile-overlay').count() == 0
    freq_ctx.close()
    browser.close()

print("身份同步、通知、本地备份、并发与离线身份隔离通过")
