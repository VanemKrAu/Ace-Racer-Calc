(function () {
  'use strict';
  var identityKey = 'arc_user_identity_v1';
  var nicknameKey = 'arc_profile_nickname_v1';
  var visitedKey = 'arc_profile_intro_v1';
  var HOLD_MS = 1000;
  var main; // 个人信息弹窗遮罩

  var ICON_CLOSE = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  var ICON_WARN = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4Z"/><path d="M12 10v4.5M12 17.2v.1"/></svg>';
  function bi(zh, en) { return '<span class="zh">' + zh + '</span><span class="lang-en">' + en + '</span>'; }

  function getNickname() {
    try { return (localStorage.getItem(nicknameKey) || '').trim(); } catch (_) { return ''; }
  }
  function getIdentity() {
    var token = localStorage.getItem(identityKey);
    if (/^[a-f0-9]{64}$/.test(token || '')) return token;
    if (!window.crypto || !crypto.getRandomValues) throw new Error('当前环境无法安全生成身份凭据');
    var bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    token = Array.from(bytes, function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
    localStorage.setItem(identityKey, token);
    return token;
  }
  function tell(message) {
    var status = main && main.querySelector('[data-profile="status"]');
    if (status) { status.textContent = message; status.hidden = false; }
    else if (window.CommunityPlans && CommunityPlans.toast) CommunityPlans.toast(message);
  }

  /* ---------- 复用社区方案弹窗外壳：.cp-modal-overlay > .card.cp-modal-dialog ---------- */
  var lockCount = 0;
  function openModal(html, opts) {
    opts = opts || {};
    var opener = document.activeElement;
    var overlay = document.createElement('div');
    overlay.className = 'cp-modal-overlay is-open profile-overlay';
    overlay.innerHTML = '<div class="card cp-modal-dialog profile-dialog" role="dialog" aria-modal="true" tabindex="-1">' + html + '</div>';
    var dialog = overlay.firstChild;
    dialog.setAttribute('aria-labelledby', opts.titleId);
    document.body.appendChild(overlay);
    document.body.classList.add('cp-modal-locked'); lockCount++;
    var closing = false;
    function close() {
      if (closing || !overlay.parentNode) return;
      closing = true;
      if (opts.onStartClose) opts.onStartClose();
      var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      function finish() {
        overlay.remove();
        if (--lockCount <= 0) { lockCount = 0; document.body.classList.remove('cp-modal-locked'); }
        var openOverlays = document.querySelectorAll('.profile-overlay:not(.is-closing)');
        var topOverlay = openOverlays[openOverlays.length - 1];
        if (opener && opener.focus && document.contains(opener) && (!topOverlay || topOverlay.contains(opener))) opener.focus();
        if (opts.onClose) opts.onClose();
      }
      if (reduce) { finish(); return; }
      overlay.classList.add('is-closing');
      setTimeout(finish, 180);
    }
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay && !opts.persistent) close(); });
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.from(dialog.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])')).filter(function (n) { return !n.disabled && !n.hidden && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    var focusTarget = dialog.querySelector(opts.focus || '[data-autofocus]') || dialog;
    setTimeout(function () {
      var openOverlays = document.querySelectorAll('.profile-overlay:not(.is-closing)');
      if (!closing && openOverlays[openOverlays.length - 1] === overlay) focusTarget.focus();
    }, 30);
    return { overlay: overlay, dialog: dialog, close: close };
  }

  function head(id, zh, en, withClose) {
    return '<div class="cp-modal-head"><h4 class="cp-modal-title" id="' + id + '">' + bi(zh, en) + '</h4>' +
      (withClose ? '<button type="button" class="nav-btn select-btn cp-modal-close" data-profile="close" aria-label="关闭 / Close">' + ICON_CLOSE + '</button>' : '') + '</div>';
  }

  /* ---------- 个人信息主弹窗 ---------- */
  function buildMain() {
    var html = head('profileTitle', '个人信息', 'Profile', true) +
      '<div class="cp-modal-body">' +
      '<div class="profile-nick-card"><div class="profile-nick-head"><span class="profile-nick-ico" aria-hidden="true"><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></span>' +
      '<label class="profile-nick-label" for="profileNickname">' + bi('你的昵称', 'Your nickname') + '</label><span class="profile-nick-count" data-nick-count aria-hidden="true">0/20</span></div>' +
      '<input id="profileNickname" class="form-control cp-modal-input profile-nick-input" maxlength="20" autocomplete="nickname" aria-describedby="profileNickHint" placeholder="例如：Vanem / e.g. Vanem" data-autofocus>' +
      '<div class="profile-nick-hint" id="profileNickHint">' + bi('投稿必须先有昵称，随时可修改；也可以先跳过。', 'A nickname is required to submit a setup. Editable anytime; you may skip for now.') + '</div></div>' +
      '<div class="cp-setting-switch-row profile-stack"><div class="cp-setting-switch-info"><span class="cp-setting-switch-title">' + bi('身份凭据（跨设备使用）', 'Identity credential (other devices)') + '</span>' +
      '<span class="cp-setting-switch-desc">' + bi('凭据相当于身份钥匙，他人获得后可冒用你的身份，请妥善保管。', 'Anyone holding it can act as you. Keep it private.') + '</span></div>' +
      '<div class="profile-actions"><button type="button" class="nav-btn cp-btn profile-danger" data-profile="export">' + bi('导出凭据', 'Export credential') + '</button>' +
      '<button type="button" class="nav-btn cp-btn" data-profile="import">' + bi('导入凭据', 'Import credential') + '</button></div>' +
      '<input type="file" accept="application/json,.json" data-profile="file" hidden></div>' +
      '<div class="cp-setting-switch-row profile-stack"><div class="cp-setting-switch-info"><span class="cp-setting-switch-title">' + bi('通知', 'Notifications') + '</span>' +
      '<span class="cp-setting-switch-desc">' + bi('查看方案审核结果与站点公告。', 'See review results and site announcements.') + '</span></div>' +
      '<div class="profile-actions"><button type="button" class="nav-btn cp-btn" data-profile="notifications">' + bi('查看通知', 'Open notifications') + '</button></div></div>' +
      '<div class="cp-setting-switch-desc profile-status" data-profile="status" role="status" aria-live="polite" hidden></div></div>' +
      '<div class="cp-modal-footer"><button type="button" class="nav-btn cp-btn" data-profile="skip">' + bi('稍后再说', 'Skip for now') + '</button>' +
      '<button type="button" class="nav-btn cp-btn cp-btn-save" data-profile="save">' + bi('保存', 'Save') + '</button></div>';
    var m = openModal(html, { titleId: 'profileTitle', onClose: function () { main = null; } });
    main = m.overlay;
    m.overlay.addEventListener('click', function (event) {
      var button = event.target.closest('[data-profile]');
      if (!button || button.tagName !== 'BUTTON') return;
      var action = button.getAttribute('data-profile');
      if (action === 'close' || action === 'skip') { try { localStorage.setItem(visitedKey, '1'); } catch (_) {} m.close(); }
      else if (action === 'save') {
        var name = m.dialog.querySelector('#profileNickname').value.trim();
        if (!name || Array.from(name).length > 20) {
          var card = m.dialog.querySelector('.profile-nick-card');
          card.classList.remove('is-invalid'); void card.offsetWidth; card.classList.add('is-invalid');
          tell('请填写 1–20 个字符的昵称'); m.dialog.querySelector('#profileNickname').focus(); return;
        }
        try { localStorage.setItem(nicknameKey, name); localStorage.setItem(visitedKey, '1'); m.close(); if (window.CommunityPlans && CommunityPlans.toast) CommunityPlans.toast('昵称已保存'); }
        catch (_) { tell('无法保存昵称，请启用浏览器本地存储'); }
      }
      else if (action === 'notifications') { m.close(); if (window.CommunityPlans) CommunityPlans.openNotificationCenter(); }
      else if (action === 'export') exportIdentity();
      else if (action === 'import') m.dialog.querySelector('[data-profile="file"]').click();
    });
    m.dialog.querySelector('#profileNickname').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); m.dialog.querySelector('[data-profile="save"]').click(); } });
    m.dialog.querySelector('[data-profile="file"]').addEventListener('change', importIdentity);
    return m;
  }
  function open() {
    if (main) return;
    var m = buildMain();
    var input = m.dialog.querySelector('#profileNickname');
    var count = m.dialog.querySelector('[data-nick-count]');
    function sync() { count.textContent = Array.from(input.value).length + '/20'; input.closest('.profile-nick-card').classList.toggle('has-value', !!input.value.trim()); }
    input.addEventListener('input', sync);
    input.value = getNickname();
    sync();
  }

  /* ---------- 确认弹窗（第一次确认）---------- */
  function confirmMessage(titleZh, titleEn, zh, en, danger) {
    return new Promise(function (resolve) {
      var done = false;
      var m = openModal(head('profileConfirmTitle', titleZh, titleEn, false) +
        '<div class="cp-modal-body"><div class="cp-summary-bar' + (danger ? ' profile-warn' : '') + '">' + (danger ? ICON_WARN : '') + '<span>' + bi(zh, en) + '</span></div></div>' +
        '<div class="cp-modal-footer"><button type="button" class="nav-btn cp-btn" data-cancel data-autofocus>' + bi('取消', 'Cancel') + '</button>' +
        '<button type="button" class="nav-btn cp-btn ' + (danger ? 'profile-danger' : 'cp-btn-save') + '" data-confirm>' + bi('继续', 'Continue') + '</button></div>',
        { titleId: 'profileConfirmTitle', persistent: true, onClose: function () { if (!done) { done = true; resolve(false); } } });
      m.dialog.querySelector('[data-cancel]').addEventListener('click', function () { m.close(); });
      m.dialog.querySelector('[data-confirm]').addEventListener('click', function () { done = true; m.close(); resolve(true); });
    });
  }

  /* ---------- 导出：确认 → 长按确认（复用后台 .btn-hold 视觉与交互）---------- */
  async function exportIdentity() {
    var token;
    try { token = getIdentity(); } catch (_) { tell('无法使用本地存储或安全生成身份凭据'); return; }
    var go = await confirmMessage('导出身份凭据', 'Export credential',
      '身份凭据相当于账号钥匙。任何人拿到它，都可以冒用你的身份投稿、点赞和管理你的方案。请只保存到自己的安全位置，切勿发给他人。',
      'Anyone who gets this credential can act as you: submit, like and manage your setups. Store it somewhere safe and never share it.', true);
    if (!go) return;
    var timer = null, finished = false;
    var m = openModal(head('profileExportTitle', '最终确认：导出身份凭据', 'Final check: export credential', false) +
      '<div class="cp-modal-body"><div class="cp-summary-bar profile-warn">' + ICON_WARN + '<span>' + bi('凭据一旦被盗用，无法撤销。确认后将下载凭据文件。', 'A stolen credential cannot be revoked. Confirming will download the file.') + '</span></div>' +
      '<div class="profile-hold-hint" data-hint>' + bi('长按下方红色按钮约 1 秒；键盘可按住空格或回车。松开则取消。', 'Press and hold the red button for about 1 second (or hold Space / Enter). Release to cancel.') + '</div></div>' +
      '<div class="cp-modal-footer"><button type="button" class="nav-btn cp-btn" data-cancel data-autofocus>' + bi('取消', 'Cancel') + '</button>' +
      '<button type="button" class="nav-btn cp-btn profile-danger btn-hold" data-hold aria-describedby="profileExportTitle"><span class="hold-ring-wrap" aria-hidden="true"><svg class="hold-ring-svg" viewBox="0 0 24 24"><circle class="hold-ring-track" cx="12" cy="12" r="9"></circle><circle class="hold-ring-progress" cx="12" cy="12" r="9"></circle></svg></span>' + bi('长按确认导出', 'Hold to export') + '</button></div>',
      { titleId: 'profileExportTitle', persistent: true, onStartClose: function () { cancel(); } });
    var hold = m.dialog.querySelector('[data-hold]');
    var hint = m.dialog.querySelector('[data-hint]');
    function cancel() {
      if (timer) clearTimeout(timer); timer = null;
      if (hold) hold.classList.remove('is-holding');
      if (hint) hint.classList.remove('is-holding');
    }
    function complete() {
      timer = null; finished = true;
      hold.classList.remove('is-holding'); hold.classList.add('is-hold-complete');
      var blob = new Blob([JSON.stringify({ version: 1, identity: token, nickname: getNickname() }, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a'); link.href = url; link.download = 'ace-racer-identity.json'; document.body.appendChild(link); link.click(); link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      setTimeout(function () { m.close(); tell('凭据文件已下载，请妥善保管'); }, 240);
    }
    function start(event) {
      if (finished || timer) return;
      if (event.type === 'keydown' && (event.repeat || (event.key !== ' ' && event.key !== 'Enter'))) return;
      if (event.type === 'pointerdown' && event.button !== 0) return;
      event.preventDefault();
      hold.classList.add('is-holding'); hint.classList.add('is-holding');
      timer = setTimeout(complete, HOLD_MS);
    }
    hold.addEventListener('pointerdown', start);
    hold.addEventListener('keydown', start);
    hold.addEventListener('click', function (e) { e.preventDefault(); });
    hold.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach(function (t) { hold.addEventListener(t, function () { if (!finished) cancel(); }); });
    hold.addEventListener('keyup', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !finished) cancel(); });
    m.dialog.querySelector('[data-cancel]').addEventListener('click', function () { m.close(); });
  }

  async function importIdentity(event) {
    var input = event.target, file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (file.size > 4096) { tell('凭据文件过大'); return; }
    try {
      var data = JSON.parse(await file.text());
      if (!data || data.version !== 1 || !/^[a-f0-9]{64}$/.test(data.identity || '') || typeof data.nickname !== 'string' || Array.from(data.nickname).length > 20) throw new Error();
      if (!await confirmMessage('导入身份凭据', 'Import credential', '导入会替换当前设备的身份。请先备份当前身份，否则可能无法再管理原身份的方案。确定导入？', 'Importing replaces this device\'s identity. Back up the current one first, or you may lose access to its setups. Continue?', true)) return;
      var keys = [identityKey, nicknameKey, visitedKey];
      var previous = keys.map(function (key) { return localStorage.getItem(key); });
      try {
        localStorage.setItem(identityKey, data.identity);
        localStorage.setItem(nicknameKey, data.nickname.trim());
        localStorage.setItem(visitedKey, '1');
      } catch (writeError) {
        try {
          keys.forEach(function (key, index) {
            if (previous[index] === null) localStorage.removeItem(key);
            else localStorage.setItem(key, previous[index]);
          });
        } catch (_) { tell('导入中断且无法恢复原身份，请勿关闭页面，检查浏览器存储权限'); return; }
        throw writeError;
      }
      window.location.reload();
    } catch (_) { tell('凭据文件无效或无法保存，请检查文件与浏览器存储权限'); }
  }

  var promptTimer = null;
  var promptedThisPage = false;
  function configurePrompt(policy) {
    if (promptTimer) clearTimeout(promptTimer);
    promptTimer = null;
    if (!policy || policy.enabled === false || promptedThisPage || getNickname()) return;
    function bounded(value, min, max, fallback) {
      var n = Number(value);
      return isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
    }
    var limit = bounded(policy.max_shows, 1, 20, 1);
    var delay = bounded(policy.delay_seconds, 0, 120, 1);
    var interval = bounded(policy.interval_hours, 0, 720, 24) * 3600000;
    var key = 'arc_profile_prompt_state_v1';
    var state;
    try {
      var saved = localStorage.getItem(key);
      state = saved ? JSON.parse(saved) : { count: localStorage.getItem(visitedKey) ? 1 : 0, last: 0 };
      if (!state || typeof state !== 'object') state = { count: 0, last: 0 };
      if ((Number(state.count) || 0) >= limit || (state.last && Date.now() - Number(state.last) < interval)) return;
    } catch (_) { return; }
    function showWhenReady() {
      if (getNickname() || promptedThisPage) return;
      if (document.hidden || document.querySelector('.cp-modal-overlay:not(.is-closing), .profile-overlay:not(.is-closing), dialog[open]')) {
        promptTimer = setTimeout(showWhenReady, 1000);
        return;
      }
      promptedThisPage = true;
      try { localStorage.setItem(key, JSON.stringify({ count: (Number(state.count) || 0) + 1, last: Date.now() })); } catch (_) {}
      open();
    }
    promptTimer = setTimeout(showWhenReady, delay * 1000);
  }
  window.ArcProfile = { open: open, getNickname: getNickname, configurePrompt: configurePrompt };
  document.getElementById('profileBtn').addEventListener('click', open);
})();
