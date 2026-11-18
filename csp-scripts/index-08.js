

    var _selectedCar = null;
    var _selectedCarId = null;

    function _n(car) {
        return currentLang === 'en' ? (car.name_en || car.name) : car.name;
    }
    function _spec(s) {
        return currentLang === 'en'
            ? ({'山路':'Mountain','场地':'Track','城市':'Urban'})[s] || s
            : s;
    }
    function _pos(p) {
        if (!p) return '';
        return currentLang === 'en'
            ? ({'竞速位':'Racing','辅助位':'Support','干扰位':'Interfere','天平位':'Balance'})[p] || p
            : p;
    }
    function _setQualityBg(car) {
        var img = document.getElementById('carImage');
        var wrap = document.getElementById('carImgWrap');
        if (!img || !wrap) return;
        var map = {'普通':['#55b685','#55b685'],'稀有':['#38bdf8','#38bdf8'],'史诗':['#c084fc','#c084fc'],'传说':['#fbbf24','#fbbf24']};
        var pair = map[car.quality];
        // Remove old bar
        var oldBar = document.getElementById('carQualityBar');
        if (oldBar) oldBar.remove();
        if (pair) {
            wrap.style.position = 'relative';
            var bar = document.createElement('div');
            bar.id = 'carQualityBar';
            bar.style.cssText = 'position:absolute;top:0;left:0;right:0;height:3px;border-radius:12px 12px 0 0;z-index:2;background:linear-gradient(90deg,transparent 0%,' + pair[1] + ' 25%,' + pair[1] + ' 75%,transparent 100%);';
            wrap.insertBefore(bar, wrap.firstChild);
        } else {
            wrap.style.position = '';
        }
        // Set quality badge
        var tags = document.getElementById('carPreviewTags');
        if (!tags) return;
        var q = car.quality;
        var p = car.position;
        var s = car.specialization;
        var html = '';
        if (q) {
            var qc = map[q] ? map[q][1] : '#94a3b8';
            var qn = currentLang === 'en' ? ({'普通':'Common','稀有':'Rare','史诗':'Epic','传说':'Legendary'})[q] || q : q;
            html += '<span style=\"display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:6px;font-size:12px;font-weight:bold;color:' + qc + ';background:' + qc + '22;border:1px solid ' + qc + '44;\">' + qn + '</span>';
        }
        if (p) {
            var pi = getPosIcon(p);
            html += '<span style=\"display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:6px;font-size:12px;color:var(--text-muted);background:var(--box-bg);border:1px solid var(--border);\">' + (pi ? '<img src=\"' + pi + '\" style=\"width:14px;height:14px;\">' : '') + _pos(p) + '</span>';
        }
        if (s) {
            var si = getSpecIcon(s);
            html += '<span style=\"display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:6px;font-size:12px;color:var(--text-muted);background:var(--box-bg);border:1px solid var(--border);\">' + (si ? '<img src=\"' + si + '\" style=\"width:14px;height:14px;\">' : '') + _spec(s) + '</span>';
        }
        if (html) {
            tags.innerHTML = html;
            tags.style.display = 'flex';
        } else {
            tags.style.display = 'none';
        }
    }

    function _syncSpecLayout() {
        var _sl = document.getElementById('specLabel');
        var _si = document.getElementById('baseUltDuration');
        var _rg = document.getElementById('specGrid');
        var _lc = document.getElementById('specLeft');
        var _rc = document.getElementById('specRight');
        if (!_sl || !_si || !_rg || !_lc || !_rc) return;
        _sl.style.fontSize = '14px';
        _sl.parentElement.style.minHeight = _si.offsetHeight + 'px';
        // Right column always fills remaining space
        _rc.style.flex = '1'; _rc.style.minWidth = '0';
        // Start: left at 50%, right fills rest
        _lc.style.flex = '0 0 50%'; _lc.style.maxWidth = '50%'; _lc.style.width = '';
        var gap = 12; var pad = 28;
        var total = _rg.offsetWidth - gap;
        var leftMax = total * 0.5;
        var leftMin = total / 3;
        var rightAvail = total - leftMax - pad;
        if (rightAvail > 0 && _sl.scrollWidth > rightAvail) {
            // Shrink left column to give right more space
            var needRight = _sl.scrollWidth + pad;
            var leftW = Math.max(leftMin, Math.min(leftMax, total - needRight));
            _lc.style.flex = 'none';
            _lc.style.width = leftW + 'px';
            _lc.style.maxWidth = leftW + 'px';
            rightAvail = total - leftW - pad;
            if (rightAvail > 0 && _sl.scrollWidth > rightAvail) {
                _sl.style.fontSize = Math.max(9, Math.round(14 * rightAvail / _sl.scrollWidth * 10) / 10) + 'px';
            }
        }
    }

    function calcMaxHuineng(chipSlots) {
        if (!chipSlots) return 50;
        var maxH = 0;
        for (var ci = 0; ci < chipSlots.length; ci++) {
            var sym = chipSlots[ci];
            if (sym === '\u25C7') maxH += 18;
            else if (sym === '\u25B3') maxH += 9;
            else if (sym === '\u25E3') maxH += 9;
        }
        return maxH;
    }

    // 带上核心增幅之后的汇能上限 —— 只用来放宽「手动输入」的口子。
    // 核心增幅一次只能带一个：菱形增幅抬菱形芯片、三角形增幅抬三角芯片、六边形增幅抬六边形
    // 芯片，三种的幅度都是 +50%（所以三角、六边从 9 抬到 13.5，菱形从 18 抬到 27）。
    // 这里不知道用户带的是哪一种，就三种各算一遍取最大值 —— 这样带哪个都不会被误拦。
    // ★ 卡片右上角显示的、以及自动反算封顶用的，仍是没增幅的基础值 calcMaxHuineng()。
    function calcMaxHuinengBoosted(chipSlots) {
        if (!chipSlots) return 50;
        function total(boostDiamond, boostTriangle, boostHex) {
            var t = 0;
            for (var ci = 0; ci < chipSlots.length; ci++) {
                var sym = chipSlots[ci];
                if (sym === '\u25C7') t += boostDiamond ? 27 : 18;
                else if (sym === '\u25B3') t += boostTriangle ? 13.5 : 9;
                else if (sym === '\u25E3') t += boostHex ? 13.5 : 9;
            }
            return t;
        }
        return Math.max(
            total(true, false, false),
            total(false, true, false),
            total(false, false, true)
        );
    }

    function getPosIcon(pos) {
        if (!pos) return '';
        if (pos.indexOf('\u7ADE\u901F') >= 0) return (_ICONS||{})['commonnew_icon_racing1.png'] || '';
        if (pos.indexOf('\u8F85\u52A9') >= 0) return (_ICONS||{})['commonnew_icon_auxiliary1.png'] || '';
        if (pos.indexOf('\u5E72\u6270') >= 0) return (_ICONS||{})['commonnew_icon_interference1.png'] || '';
        if (pos.indexOf('\u5929\u5E73') >= 0) return (_ICONS||{})['commonnew_icon_auncel1.png'] || '';
        return '';
    }
    function getSpecIcon(spec) {
        if (!spec) return '';
        if (spec.indexOf('\u5C71\u8DEF') >= 0) return (_ICONS||{})['new_carport_icon_mountainroad.png'] || '';
        if (spec.indexOf('\u573A\u5730') >= 0) return (_ICONS||{})['new_carport_icon_court.png'] || '';
        if (spec.indexOf('\u57CE\u5E02') >= 0) return (_ICONS||{})['new_carport_icon_city.png'] || '';
        return '';
    }

    function sortCarsByAdded() {
        return CAR_DATABASE.slice().sort(function(a, b) {
            // 主键：游戏排期时间（新的在上）
            var ra = a.release_at || 0, rb = b.release_at || 0;
            if (ra !== rb) return rb - ra;
            // 副键：加入网站时间
            var ta = a.added_at || 0, tb = b.added_at || 0;
            if (ta !== tb) return tb - ta;
            return (b.id || 0) - (a.id || 0);
        });
    }
    var _SEL_Q_MAP = {'普通':' sel-common','稀有':' sel-rare','史诗':' sel-epic','传说':' sel-legend'};
    function _fastCarById(id) {
        if (window.__carById) return window.__carById(id);
        for (var i = 0; i < CAR_DATABASE.length; i++) if (CAR_DATABASE[i].id === id) return CAR_DATABASE[i];
        return null;
    }
    function populateCarGrid() {
        var list = document.getElementById('carDropdown');
        if (!list || !CAR_DATABASE) return;
        var lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
        // 已构建且语言未变时：只增量切换选中项类名，避免每次选车都把 198 辆车的 DOM 和缩略图推倒重建
        if (list.__built && list.__lang === lang && list.children.length > 1) {
            var opts = list.querySelectorAll('.dropdown-option');
            for (var oi = 0; oi < opts.length; oi++) {
                var el = opts[oi], oid = parseInt(el.getAttribute('data-id'), 10);
                var isSel = oid === _selectedCarId;
                if (isSel) {
                    var oc = oid > 0 ? _fastCarById(oid) : null;
                    el.className = 'dropdown-option selected' + (oc ? (_SEL_Q_MAP[oc.quality] || '') : '');
                } else if (el.classList.contains('selected')) {
                    el.className = 'dropdown-option';
                }
            }
            filterCarList();
            return;
        }
        var html = '';
        // Add "Unreleased car" as first option
        var sel0 = (_selectedCarId === -1) ? ' selected' : '';
        html += '<div class="dropdown-option' + sel0 + '" data-id="-1">'
            + '<span style="flex:1;"><span style="opacity:0.5;"><svg class=\"ico pv-q\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17v.01\"/></svg></span> ' + _("未上线车辆", "Unreleased Car") + '</span>'
            + '<span style="font-size:11px;color:var(--text-muted);">' + _("手动填写", "Manual Input") + '</span>'
            + '</div>';
        var sortedCars = sortCarsByAdded();
        for (var i = 0; i < sortedCars.length; i++) {
            var c = sortedCars[i];
            var posIcon = getPosIcon(c.position);
            var specIcon = getSpecIcon(c.specialization);
            var icons = '';
            if (posIcon) icons += '<img src=\"' + posIcon + '\" style=\"width:18px;height:18px;vertical-align:middle;\">';
            if (specIcon) icons += '<img src=\"' + specIcon + '\" style=\"width:18px;height:18px;vertical-align:middle;margin-left:4px;\">';
            var sel = (_selectedCarId === c.id) ? ' selected' : '';
            var selQ = (_selectedCarId === c.id) ? (_SEL_Q_MAP[c.quality] || '') : '';
            html += '<div class=\"dropdown-option' + sel + selQ + '\" data-id=\"' + c.id + '\" data-pos=\"' + (c.position||'') + '\" data-spec=\"' + (c.specialization||'') + '\">'
                + '<span style=\"flex:1;\">' + icons + ' ' + _n(c) + '</span>'
                + '<span style=\"font-size:11px;color:var(--text-muted);\">[' + (c.ace_charge || '?') + ']' + (c.ult_duration ? ' ' + c.ult_duration + 's' : '') + '</span>'
                + '</div>';
        }
        list.innerHTML = html;
        if (!list.__cspCarClickBound) {
            list.__cspCarClickBound = true;
            list.addEventListener('click', function (event) {
                var opt = event.target && event.target.closest ? event.target.closest('.dropdown-option[data-id]') : null;
                if (!opt || !list.contains(opt)) return;
                var cid = parseInt(opt.getAttribute('data-id'), 10);
                if (!isNaN(cid)) {
                    pickCar(cid);
                    var dd = document.getElementById('carDropdown');
                    if (dd) dd.classList.remove('show');
                }
            });
        }
        list.__built = true;
        list.__decorated = false;
        list.__lang = lang;
        filterCarList();
    }

    function toggleCarDropdown() {
        document.getElementById('filterPosMenu').classList.remove('show');
        document.getElementById('filterSpecMenu').classList.remove('show');
        var menu = document.getElementById('carDropdown');
        menu.classList.toggle('show');
        filterCarList();
    }

    function filterCarList() {
        var q = document.getElementById('carSearch').value.trim().toLowerCase();
        var pos = _filterPos;
        var posExcl = pos.charAt(0) === '!', posRaw = posExcl ? pos.slice(1) : pos;   // 「!辅助位」= 排除该定位
        var spec = _filterSpec;
        var items = document.querySelectorAll('#carDropdown .dropdown-option');
        var matchCount = 0;
        for (var i = 0; i < items.length; i++) {
            var isSpecial = items[i].getAttribute('data-id') === '-1';
            var id = parseInt(items[i].getAttribute('data-id'), 10);
            var matchName = !q;
            if (!matchName) {
                if (id > 0) {
                    var c = _fastCarById(id);
                    if (c) {
                        var qs = c.__q || (c.__q = (c.name + ' ' + (c.name_en || '') + ' ' + (c.search_text || '')).toLowerCase());
                        matchName = qs.indexOf(q) >= 0;
                    }
                } else {
                    var name = items[i].querySelector('span').textContent.toLowerCase();
                    matchName = name.indexOf(q) >= 0;
                }
            }
            var itemPos = items[i].getAttribute('data-pos');
            var matchPos = !pos || (posExcl ? itemPos !== posRaw : itemPos === posRaw);
            var matchSpec = !spec || items[i].getAttribute('data-spec') === spec;
            var show = isSpecial || (matchName && matchPos && matchSpec);
            items[i].style.display = show ? '' : 'none';
            if (show && !isSpecial) matchCount++;
        }
        var label = document.getElementById('carListLabel');
        if (_selectedCarId === -1) {
            label.innerHTML = '<span style=\"opacity:0.5;\"><svg class=\"ico pv-q\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17v.01\"/></svg></span> ' + _("未上线车辆", "Unreleased Car");
        } else if (_selectedCarId && _selectedCarId > 0) {
            var cc = _fastCarById(_selectedCarId);
            if (cc) {
                var cp = getPosIcon(cc.position);
                var cs = getSpecIcon(cc.specialization);
                var ci = '';
                if (cp) ci += '<img src=\"' + cp + '\" style=\"width:14px;height:14px;vertical-align:middle;margin-right:4px;\">';
                if (cs) ci += '<img src=\"' + cs + '\" style=\"width:14px;height:14px;vertical-align:middle;margin-right:4px;\">';
                label.innerHTML = ci + '<span>' + _n(cc) + '</span>';
            }
        } else if (q || pos || spec) {
            label.innerHTML = matchCount + _(" 辆匹配", " matched");
        } else {
            label.innerHTML = _("选择车辆", "Select a car");
        }
        // Auto-open car dropdown when searching, close when cleared
        if (q) {
            document.getElementById('carDropdown').classList.add('show');
        }
    }

    function _playCarEnter() {
        if (typeof isRestoringConfig !== 'undefined' && isRestoringConfig) return;
        if (typeof _motionOK === 'function' && !_motionOK()) return;
        var wrap = document.getElementById('carImgWrap');
        if (wrap) {
            var useCarB = wrap.classList.contains('pv-car-enter');
            wrap.classList.remove(useCarB ? 'pv-car-enter' : 'pv-car-enter-b');
            wrap.classList.add(useCarB ? 'pv-car-enter-b' : 'pv-car-enter');
        }
        var metas = [document.getElementById('carPreviewName'), document.getElementById('carPreviewTags'), document.getElementById('carPreviewChips')];
        for (var mi = 0; mi < metas.length; mi++) {
            var m = metas[mi];
            if (m && m.style.display !== 'none') {
                var useMetaB = m.classList.contains('pv-meta-enter');
                m.classList.remove(useMetaB ? 'pv-meta-enter' : 'pv-meta-enter-b');
                m.classList.add(useMetaB ? 'pv-meta-enter-b' : 'pv-meta-enter');
            }
        }
    }

    function _closeDropdown(menu) {
        if (!menu || !menu.classList.contains('show')) return;
        if (menu.closest && menu.closest('.pv-sheet')) {
            menu.classList.remove('show', 'is-closing');
            return;
        }
        if (typeof _motionOK === 'function' && !_motionOK()) {
            menu.classList.remove('show', 'is-closing');
            return;
        }
        if (menu.__closeTimer) clearTimeout(menu.__closeTimer);
        menu.classList.add('is-closing');
        menu.__closeTimer = setTimeout(function() {
            menu.classList.remove('show', 'is-closing');
            menu.__closeTimer = null;
        }, 150);
    }

    function _toggleDropdown(menu) {
        if (!menu) return;
        if (menu.classList.contains('show') && !menu.classList.contains('is-closing')) {
            _closeDropdown(menu);
        } else {
            if (menu.__closeTimer) { clearTimeout(menu.__closeTimer); menu.__closeTimer = null; }
            menu.classList.remove('is-closing');
            menu.classList.add('show');
        }
    }

    function updateCarPreview(car) {
        // 打开带配置的分享链接走的是这条分支（不经过 pickCar），上限与夹取也得跟着刷新
        if (typeof applyChipLimits === 'function') applyChipLimits(car);
        document.getElementById('carPreviewPlaceholder').style.display = 'none';
        document.getElementById('carPreviewName').style.display = '';
        document.getElementById('carPreviewName').textContent = _n(car) + ' (' + _pos(car.position) + ')';
        var filledItems = [_("大招阈值","Ult Threshold"), _("基础双充","Base Dual Charge"), _("氮气时长","Nitro Dur")];
        if (car.ult_duration) filledItems.push(_("大招时长","Ult Dur"));
        if (car.ult_charge_first) filledItems.push(_("起步额外充能","Start Bonus"));
        var autoEl = document.getElementById('carPreviewAutoMsg');
        autoEl.style.display = '';
        var msgHtml = _('\u2713 \u5DF2\u81EA\u52A8\u586B\u5145\uFF1A', '\u2713 Auto-filled: ') + filledItems.join(_('\u3001', ', '));
        if (!car.ult_duration) {
            msgHtml += _('<br><span style=\"color:var(--warning);font-weight:bold;\"><svg class=\"ico pv-warn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.5 2.8 19.5h18.4L12 3.5z\"/><path d=\"M12 10v4.2M12 17v.01\"/></svg>该车无固定大招时长，大招时长和其他参数请手动填写</span>', '<br><span style=\"color:var(--warning);font-weight:bold;\"><svg class=\"ico pv-warn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.5 2.8 19.5h18.4L12 3.5z\"/><path d=\"M12 10v4.2M12 17v.01\"/></svg>This car has no fixed ult duration, ult and other params need manual input</span>');
        } else {
            msgHtml += _('<br><span style=\"color:var(--warning);font-weight:bold;\"><svg class=\"ico pv-warn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.5 2.8 19.5h18.4L12 3.5z\"/><path d=\"M12 10v4.2M12 17v.01\"/></svg>其他参数请手动调整</span>', '<br><span style=\"color:var(--warning);font-weight:bold;\"><svg class=\"ico pv-warn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.5 2.8 19.5h18.4L12 3.5z\"/><path d=\"M12 10v4.2M12 17v.01\"/></svg>Other params need manual tuning</span>');
        }
        // 条件触发类自充能 (custom_charge)：数值自动填，「触发次数」必须由用户按跑法手填
        if (car.custom_charge) {
            var _trigDesc = car.custom_charge_every
                ? _('每 ' + car.custom_charge_every + ' 次触发记 1 次', '1 trigger per ' + car.custom_charge_every + ' events')
                : _('每次触发均生效', 'every trigger counts');
            msgHtml += _('<br><span style="color:var(--warning);font-weight:bold;">' + _WARN_ICO + '该车自充能不是「每次放大招必给」，而是条件触发（' + _trigDesc + '）：「首发一大触发次数 / 循环内触发次数」请按跑法手动填写</span>',
                '<br><span style="color:var(--warning);font-weight:bold;">' + _WARN_ICO + 'This self-charge is conditional, not granted on every ult (' + _trigDesc + ') — fill the 1st-ult / loop trigger counts manually.</span>');
        }
        // 大招连发 (ult_chain)：一管能量实得两段大招，时长已按两段累计填入
        if (car.ult_chain) {
            msgHtml += _('<br><span style="color:var(--warning);font-weight:bold;">' + _WARN_ICO + '该车大招连发：大招时长已按两段累计填入</span>',
                '<br><span style="color:var(--warning);font-weight:bold;">' + _WARN_ICO + 'Ult chain: ult duration filled as two stacked ults.</span>');
        }
        msgHtml += _('<br>\u8BE6\u7EC6\u8F66\u8F86\u6280\u80FD\u8BF7\u53C2\u8003 \u2192', '<br>Details \u2192') + ' <a href=\"https://reca.seimu.cn/ace-racer/vehicles/' + car.id + '\" target=\"_blank\" style=\"color:var(--primary);text-decoration:underline;font-weight:bold;\">' + _('瑞卡情报站-', 'Racer Wiki-') + _n(car) + '</a>';
        if (window._morphInlineBox) window._morphInlineBox(autoEl, '<span class="pv-box-in">' + msgHtml + '</span>'); else autoEl.innerHTML = msgHtml;
        var chipInfo = document.getElementById('carPreviewChips');
        if (car.chip_slots) {
            chipInfo.style.display = 'flex';
            chipInfo.innerHTML = '';
            for (var ci = 0; ci < car.chip_slots.length; ci++) {
                var sym = car.chip_slots[ci];
                var iconNum = '1';
                if (sym === '\u25CB') iconNum = '1';
                else if (sym === 'V' || sym === 'v') iconNum = '2';
                else if (sym === '\u25E3') iconNum = '3';
                else if (sym === '\u25B3') iconNum = '4';
                else if (sym === '\u25C7') iconNum = '5';
                chipInfo.innerHTML += (window.__pvChip ? __pvChip(sym) : '<img loading=\"lazy\" src=\"' + _ICONS['carport_new_skill_chip_none_icon_' + iconNum + '.png'] + '\" style=\"width:30px;height:30px;object-fit:contain;\">');
            }
        }
        var img = document.getElementById('carImage');
        img.onerror = function() { this.src = _ICONS['icon_mhyck_m.png']; this.onerror = null; };
        img.src = _CAR_IMG[car.id] || ('data/26-07-15_29734784_android/full/' + encodeURI(car.asset_dir + '/body/' + car.id + '_m.png'));
        _setQualityBg(car);
        // Sync checkbox card
        setTimeout(function() { _syncSpecLayout(); }, 50);
        img.alt = _n(car);
        img.style.display = '';
        img.loading = 'lazy';
        _playCarEnter();
        var info = document.getElementById('carSelectInfo');
        info.style.display = 'flex';
        info.innerHTML = '<b>' + _n(car) + '</b>'
            + ' &nbsp;|&nbsp; ' + _pos(car.position) + ' / ' + _spec(car.specialization)
            + ' &nbsp;|&nbsp; ace_charge: <b>' + (car.ace_charge || '?') + '</b>'
            + (car.ult_duration ? ' &nbsp;|&nbsp; ' + _("大招时长:","Ult Dur:") + ' <b>' + car.ult_duration + 's</b>' : '')
            + (car.has_sp ? ' &nbsp;|&nbsp; <span class="car-badge">SP</span>' : '');
    }

    // Flash system for auto-filled sections（持续呼吸闪烁，直到用户选中/修改卡片内任意数值或切车后停止）
    var _flashTimers = {};
    // 自动填充提示里的警示图标（原先是各条警告内联一长串 svg，统一抽出来）
    var _WARN_ICO = '<svg class="ico pv-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4L12 3.5z"/><path d="M12 10v4.2M12 17v.01"/></svg>';
    function flashSection(sectionId, inputIds) {
        var sec = document.getElementById(sectionId);
        if (!sec) return;
        var state = _flashTimers[sectionId];
        if (state && state.stopFlash) state.stopFlash();
        state = { stopFlash: null, bindings: [] };
        _flashTimers[sectionId] = state;
        sec.classList.add('is-flashing');
        var onSecFocus = function(e) {
            var tg = e.target;
            if (!tg || !tg.tagName) return;
            var tag = tg.tagName.toUpperCase();
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
                state.stopFlash();
            }
        };
        state.stopFlash = function() {
            if (_flashTimers[sectionId] === state) {
                delete _flashTimers[sectionId];
            }
            sec.classList.remove('is-flashing');
            for (var bi = 0; bi < state.bindings.length; bi++) {
                var b = state.bindings[bi];
                b.el.removeEventListener(b.ev, b.fn);
            }
            state.bindings = [];
        };
        var bindStop = function(el, ev, fn) {
            el.addEventListener(ev, fn);
            state.bindings.push({ el: el, ev: ev, fn: fn });
        };
        bindStop(sec, 'focusin', onSecFocus);
        bindStop(sec, 'input', state.stopFlash);
        bindStop(sec, 'change', state.stopFlash);
        for (var fi = 0; fi < inputIds.length; fi++) {
            var el = document.getElementById(inputIds[fi]);
            if (el) {
                bindStop(el, 'focus', state.stopFlash);
                bindStop(el, 'click', state.stopFlash);
            }
        }
    }

    function _stopAllAutoFlashes() {
        var ids = ['cardCoreParams', 'cardNitro', 'extraUltSection', 'extraNitroSection', 'extraPerSecSection', 'extraCustomSection', 'cardSupportOut', 'cardTeamIn'];
        for (var i = 0; i < ids.length; i++) {
            var st = _flashTimers[ids[i]];
            if (st && st.stopFlash) st.stopFlash();
        }
    }

    // 切车时彻底清除上一辆车的全部手动改动并恢复各计算区出厂默认值
    function _resetManualCarEdits() {
        var prevRestoring = isRestoringConfig;
        isRestoringConfig = true;
        try {
            _stopAllAutoFlashes();

            // 1. 清除增益装置锁定前快照与装置状态（先清快照防止解锁时还原旧反制/旧赋能）
            if (typeof _devSavedEnv !== 'undefined') _devSavedEnv = null;
            if (typeof _devSavedEmp !== 'undefined') _devSavedEmp = null;
            if (typeof setDevice === 'function') setDevice('', true);
            var devF = document.getElementById('dev_sub_first');
            var devL = document.getElementById('dev_sub_loop');
            if (devF) devF.value = '1';
            if (devL) devL.value = '0';

            // 2. 复位核心底座及氮气规格默认值
            var elUlt = document.getElementById('ultThreshold');
            var elStart = document.getElementById('startCharge');
            var elBaseN = document.getElementById('baseNitro');
            var elUltD = document.getElementById('baseUltDuration');
            if (elUlt) elUlt.value = '100';
            if (elStart) elStart.value = '36';
            if (elBaseN) elBaseN.value = '36';
            if (elUltD) elUltD.value = '5.0';

            var nitroDefaults = { '1x5': '5.0', '1x6': '6.0', '2x2': '2.0', '2x3': '2.0', '2x25': '2.5', '3x2': '2.0' };
            for (var nk in nitroDefaults) {
                if (nitroDefaults.hasOwnProperty(nk)) {
                    var nEl = document.getElementById('time_' + nk);
                    if (nEl) nEl.value = nitroDefaults[nk];
                }
            }
            var r1x5 = document.getElementById('r_1x5');
            if (r1x5) r1x5.checked = true;
            if (typeof handleNitroRadioChange === 'function') handleNitroRadioChange(true);

            // 3. 复位专精地图、反制/干扰与附加充能效率
            var specEl = document.getElementById('isSpec');
            if (specEl) specEl.checked = true;
            if (typeof setEnvSliders === 'function') setEnvSliders(18, 0);
            var effEl = document.getElementById('extraEfficiency');
            if (effEl) effEl.value = '0';

            // 4. 清空全部赋能及子参数默认值
            var empBoxes = document.querySelectorAll('.empower-checkbox');
            for (var ei = 0; ei < empBoxes.length; ei++) {
                empBoxes[ei].checked = false;
                empBoxes[ei].disabled = false;
            }
            var qs = document.getElementById('queyi_sub_self');
            var qe = document.getElementById('queyi_sub_enemy');
            var jf = document.getElementById('jiezou_sub_first');
            var jl = document.getElementById('jiezou_sub_loop');
            var hf = document.getElementById('huaxin_sub_first');
            var hl = document.getElementById('huaxin_sub_loop');
            if (qs) qs.checked = true;
            if (qe) qe.checked = false;
            if (jf) jf.value = '0';
            if (jl) jl.value = '1';
            if (hf) hf.value = '1';
            if (hl) hl.value = '0';
            if (typeof handleEmpowerChange === 'function') handleEmpowerChange(empBoxes[0]);

            // 5. 清空特殊芯片装备与选择状态
            _chipsOn = [];
            if (typeof _chipPickerSet === 'function') _chipPickerSet(false);
            if (typeof _chipSwapTarget !== 'undefined') _chipSwapTarget = null;
            var chipSearchEl = document.getElementById('chipSearch');
            if (chipSearchEl) chipSearchEl.value = '';

            // 6. 复位扩展自充能附加模块与生效作用域
            document.getElementById('hasExtraUlt').checked = false;
            document.getElementById('valExtraUltFirst').value = 0;
            document.getElementById('valExtraUltLoop').value = 0;
            document.getElementById('hasExtraNitro').checked = false;
            document.getElementById('valExtraNitro').value = 0;
            document.getElementById('chkExtraNitroFirst').checked = true;
            document.getElementById('chkExtraNitroLoop').checked = true;
            document.getElementById('hasExtraPerSec').checked = false;
            document.getElementById('valExtraPerSec').value = 0;
            document.getElementById('chkExtraPerSecFirst').checked = true;
            document.getElementById('chkExtraPerSecLoop').checked = true;
            document.getElementById('valCustomTrig').value = 0;
            document.getElementById('customTrigFirstCount').value = 0;
            document.getElementById('customTrigLoopCount').value = 0;
            if (typeof toggleExtraUI === 'function') toggleExtraUI();

            // 7. 恢复两个计算区域的氮气数量默认态与联动/团魂状态
            var firstNEl = document.getElementById('inputFirstNitroCount');
            var loopNEl = document.getElementById('inputNitroCount');
            var xjEl = document.getElementById('inputXianji');
            var hnEl = document.getElementById('inputHuineng');
            var thEl = document.getElementById('inputTuanhun');
            if (firstNEl) firstNEl.value = '1';
            if (loopNEl) loopNEl.value = '0';
            if (xjEl) xjEl.value = '0';
            if (hnEl) { hnEl.value = '0'; hnEl.max = 50; hnEl.dataset.baseMax = 50; }
            if (thEl) thEl.value = '0';
            isManualNitroCount = false;
            autoLinked = true;
            currentActiveField = null;
            if (typeof _chipStash !== 'undefined') _chipStash = {};
            if (typeof _tm !== 'undefined') {
                _tm.lock = { soul: false, xianji: false, huineng: false };
                _tm.res = null;
            }
            if (typeof updateNitroCountUI === 'function') updateNitroCountUI();
            if (typeof updateAutoCalcUI === 'function') updateAutoCalcUI();

            // 8. 复位队友辅助充能与辅助供能参数
            var mateCarEl = document.getElementById('teamMateCar');
            var teamBaseEl = document.getElementById('teamInBase');
            var teamCoreEl = document.getElementById('teamInCore');
            var teamFirstEl = document.getElementById('teamInFirst');
            var teamLoopEl = document.getElementById('teamInLoop');
            if (mateCarEl) mateCarEl.value = '0';
            if (teamBaseEl) teamBaseEl.value = '0';
            if (teamCoreEl) teamCoreEl.checked = true;
            if (teamFirstEl) teamFirstEl.value = '1';
            if (teamLoopEl) teamLoopEl.value = '0';
            if (typeof onMateCarChange === 'function') onMateCarChange(true);

            var supBaseEl = document.getElementById('supBase');
            var supCoreEl = document.getElementById('supCore');
            var supCountEl = document.getElementById('supCount');
            var supSoulEl = document.getElementById('supMateSoul');
            var supEffEl = document.getElementById('supMateEff');
            if (supBaseEl) supBaseEl.value = '0';
            if (supCoreEl) supCoreEl.checked = true;
            if (supCountEl) supCountEl.value = '1';
            if (supSoulEl) supSoulEl.value = '0';
            if (supEffEl) supEffEl.value = '100';
        } finally {
            isRestoringConfig = prevRestoring;
        }
    }

    function pickCar(id) {
        // 切换车辆时若处于「编辑已上传方案」状态，直接退出编辑
        if (window.CommunityPlans && typeof window.CommunityPlans.notifyCarChanged === 'function') {
            window.CommunityPlans.notifyCarChanged(id);
        }
        // Handle "Unreleased car"
        if (id === -1) {
            _selectedCar = null;
            _selectedCarId = -1;
            _resetManualCarEdits();
            CHIP_MAX = 1;
            if (typeof _chipPruneByCar === 'function') _chipPruneByCar(null);
            document.getElementById('carPreviewPlaceholder').style.display = '';
            document.getElementById('carPreviewName').style.display = 'none';
            document.getElementById('carPreviewInfo').style.display = 'none';
            document.getElementById('carPreviewChips').style.display = 'none';
            document.getElementById('carPreviewAutoMsg').style.display = 'none';
            var img = document.getElementById('carImage');
            var wrap = document.getElementById('carImgWrap');
            if (wrap) wrap.style.position = '';
            var oldBar = document.getElementById('carQualityBar');
            if (oldBar) oldBar.remove();
            var ut = document.getElementById('carPreviewTags');
            if (ut) ut.style.display = 'none';
            img.src = _ICONS['icon_mhyck_m.png'];
            img.alt = _("未上线车辆", "Unreleased Car");
            img.style.display = '';
            img.loading = 'lazy';
            _playCarEnter();
            document.getElementById('carSelectInfo').style.display = 'none';
            if (typeof renderChips === 'function') renderChips(true);
            populateCarGrid();
            if (typeof fillSupportFromCar === 'function') { fillSupportFromCar(null); calculate(); }
            if (typeof window.__pvRefreshCollapse === 'function') window.__pvRefreshCollapse(false);
            if (window.CommunityPlans && typeof window.CommunityPlans.onCarChanged === "function") { window.CommunityPlans.onCarChanged(null); }
            return;
        }

        var car = null;
        for (var i = 0; i < CAR_DATABASE.length; i++) {
            if (CAR_DATABASE[i].id === id) { car = CAR_DATABASE[i]; break; }
        }
        if (!car) return;
        _selectedCar = car;
        _selectedCarId = car.id;

        // Reset all previous car edits & auto-fillable fields before filling new car data
        _resetManualCarEdits();

        if (car.ace_charge) {
            var nitroV = Math.round(car.ace_charge / 100 * 10) / 10;
            document.getElementById('baseNitro').value = nitroV;
            // startCharge = (ace_charge + init_ratio) / 100, capped at 100%
            var initBonus = car.init_ratio || 0;
            var startV = Math.min(100, Math.round((car.ace_charge + initBonus) / 100 * 10) / 10);
            document.getElementById('startCharge').value = startV;
        }
        if (car.ult_threshold) {
            document.getElementById('ultThreshold').value = car.ult_threshold;
        }
        document.getElementById('baseUltDuration').value = car.ult_duration || 0;
        if (car.nitro_duration) {
            document.getElementById('time_1x6').value = car.nitro_duration;
            document.getElementById('r_1x6').checked = true;
            if (typeof handleNitroRadioChange === 'function') handleNitroRadioChange();
            if (typeof syncNitroTimes === 'function') syncNitroTimes('1x6');
        }
        // 先机 / 汇能上限：刷新卡片右上角提示 + 更新汇能框 max + 把超限值夹回范围内
        if (typeof applyChipLimits === 'function') applyChipLimits(car);
        if (typeof renderChips === 'function') renderChips(true);
        populateCarGrid();

        if (car.ace_charge) flashSection('cardCoreParams', ['baseNitro', 'startCharge', 'ultThreshold']);
        if (car.nitro_duration) flashSection('cardNitro', ['time_1x6', 'time_1x5', 'time_2x2', 'time_2x3', 'time_2x25', 'time_3x2', 'baseUltDuration', 'r_1x5', 'r_1x6', 'r_2x2', 'r_2x3', 'r_2x25', 'r_3x2']);
        // Auto-fill start bonus / ult self-charge into ult section
        if (car.ult_charge_first || car.ult_charge_loop) {
            document.getElementById('hasExtraUlt').checked = true;
            if (car.ult_charge_first) document.getElementById('valExtraUltFirst').value = car.ult_charge_first;
            if (car.ult_charge_loop) document.getElementById('valExtraUltLoop').value = car.ult_charge_loop;
            if (typeof toggleExtraUI === 'function') toggleExtraUI();
            flashSection('extraUltSection', ['valExtraUltFirst', 'valExtraUltLoop', 'hasExtraUlt']);
        }
        // Auto-fill nitro self-charge
        if (car.nitro_charge) {
            document.getElementById('hasExtraNitro').checked = true;
            document.getElementById('valExtraNitro').value = car.nitro_charge;
            if (typeof toggleExtraUI === 'function') toggleExtraUI();
            flashSection('extraNitroSection', ['valExtraNitro', 'hasExtraNitro']);
        }
        // Auto-fill per-sec self-charge
        if (car.per_sec_charge) {
            document.getElementById('hasExtraPerSec').checked = true;
            document.getElementById('valExtraPerSec').value = car.per_sec_charge;
            if (typeof toggleExtraUI === 'function') toggleExtraUI();
            flashSection('extraPerSecSection', ['valExtraPerSec', 'hasExtraPerSec']);
        }
        // Auto-fill SP charge into custom trigger section
        // SP 技能要先用过大招才会就绪，开局那一发（首发一大）根本按不出来，
        // 所以首发计 0 次；进入循环之后每轮可用一次，循环计 1 次。
        if (car.sp_charge) {
            document.getElementById('valCustomTrig').value = car.sp_charge;
            document.getElementById('customTrigFirstCount').value = 0;
            document.getElementById('customTrigLoopCount').value = 1;
            flashSection('extraCustomSection', ['valCustomTrig', 'customTrigFirstCount', 'customTrigLoopCount']);
        }
        // Auto-fill custom trigger self-charge（条件触发类，例：布加迪 LVN「每2次进入漂移时自充能6%」）
        // 只填「每次触发附加百分比」，触发次数不预设（留 0），由用户按跑法手填。
        // 这里把两个次数显式写 0：万一某辆车同时带 sp_charge 和 custom_charge（目前还没有），
        // 上面那支会把循环次数设成 1，得在这里清掉，否则条件触发的次数会被 SP 的默认值顶掉。
        if (car.custom_charge) {
            document.getElementById('valCustomTrig').value = car.custom_charge;
            document.getElementById('customTrigFirstCount').value = 0;
            document.getElementById('customTrigLoopCount').value = 0;
            flashSection('extraCustomSection', ['valCustomTrig', 'customTrigFirstCount', 'customTrigLoopCount']);
        }

        document.getElementById('carPreviewPlaceholder').style.display = 'none';
        document.getElementById('carPreviewName').style.display = '';
        document.getElementById('carPreviewName').textContent = _n(car) + ' (' + _pos(car.position) + ')';
        // Show auto-fill info message
        var autoEl2 = document.getElementById('carPreviewAutoMsg');
        autoEl2.style.display = '';
        // Build green message dynamically
        var filledItems = [_("大招阈值","Ult Threshold"), _("基础双充","Base Dual Charge"), _("氮气时长","Nitro Dur")];
        if (car.ult_duration) filledItems.push(_("大招时长","Ult Dur"));
        if (car.ult_charge_first) filledItems.push(_("起步额外充能","Start Bonus"));
        if (car.nitro_charge) filledItems.push(_("氮气自充能","Nitro SC"));
        if (car.ult_charge_loop) filledItems.push(_("大招自充能","Ult SC"));
        if (car.per_sec_charge) filledItems.push(_("每秒自充能","PerSec SC"));
        if (car.sp_charge) filledItems.push(_("SP自充能","SP Charge"));
        if (car.custom_charge) filledItems.push(_("自定义触发自充能","Custom Trig SC"));
        var msgHtml = _('\u2713 \u5DF2\u81EA\u52A8\u586B\u5145\uFF1A', '\u2713 Auto-filled: ') + filledItems.join(_('\u3001', ', '));
        if (!car.ult_duration) {
            msgHtml += _('<br><span style=\"color:var(--warning);font-weight:bold;\"><svg class=\"ico pv-warn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.5 2.8 19.5h18.4L12 3.5z\"/><path d=\"M12 10v4.2M12 17v.01\"/></svg>该车无固定大招时长，大招时长和其他参数请手动填写</span>', '<br><span style=\"color:var(--warning);font-weight:bold;\"><svg class=\"ico pv-warn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.5 2.8 19.5h18.4L12 3.5z\"/><path d=\"M12 10v4.2M12 17v.01\"/></svg>This car has no fixed ult duration, ult and other params need manual input</span>');
        } else {
            msgHtml += _('<br><span style=\"color:var(--warning);font-weight:bold;\"><svg class=\"ico pv-warn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.5 2.8 19.5h18.4L12 3.5z\"/><path d=\"M12 10v4.2M12 17v.01\"/></svg>其他参数请手动调整</span>', '<br><span style=\"color:var(--warning);font-weight:bold;\"><svg class=\"ico pv-warn\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M12 3.5 2.8 19.5h18.4L12 3.5z\"/><path d=\"M12 10v4.2M12 17v.01\"/></svg>Other params need manual tuning</span>');
        }
        // 条件触发类自充能 (custom_charge)：数值自动填，「触发次数」必须由用户按跑法手填
        if (car.custom_charge) {
            var _trigDesc = car.custom_charge_every
                ? _('每 ' + car.custom_charge_every + ' 次触发记 1 次', '1 trigger per ' + car.custom_charge_every + ' events')
                : _('每次触发均生效', 'every trigger counts');
            msgHtml += _('<br><span style="color:var(--warning);font-weight:bold;">' + _WARN_ICO + '该车自充能不是「每次放大招必给」，而是条件触发（' + _trigDesc + '）：「首发一大触发次数 / 循环内触发次数」请按跑法手动填写</span>',
                '<br><span style="color:var(--warning);font-weight:bold;">' + _WARN_ICO + 'This self-charge is conditional, not granted on every ult (' + _trigDesc + ') — fill the 1st-ult / loop trigger counts manually.</span>');
        }
        // 大招连发 (ult_chain)：一管能量实得两段大招，时长已按两段累计填入
        if (car.ult_chain) {
            msgHtml += _('<br><span style="color:var(--warning);font-weight:bold;">' + _WARN_ICO + '该车大招连发：大招时长已按两段累计填入</span>',
                '<br><span style="color:var(--warning);font-weight:bold;">' + _WARN_ICO + 'Ult chain: ult duration filled as two stacked ults.</span>');
        }
        msgHtml += _('<br>\u8BE6\u7EC6\u8F66\u8F86\u6280\u80FD\u8BF7\u53C2\u8003 \u2192', '<br>Details \u2192') + ' <a href=\"https://reca.seimu.cn/ace-racer/vehicles/' + car.id + '\" target=\"_blank\" style=\"color:var(--primary);text-decoration:underline;font-weight:bold;\">' + _('瑞卡情报站-', 'Racer Wiki-') + _n(car) + '</a>';
        if (window._morphInlineBox) window._morphInlineBox(autoEl2, '<span class="pv-box-in">' + msgHtml + '</span>'); else autoEl2.innerHTML = msgHtml;
        var chipInfo = document.getElementById('carPreviewChips');
        if (car.chip_slots) {
            chipInfo.style.display = 'flex';
            chipInfo.innerHTML = '';
            for (var ci = 0; ci < car.chip_slots.length; ci++) {
                var sym = car.chip_slots[ci];
                var iconNum = '1';
                if (sym === '\u25CB') iconNum = '1';
                else if (sym === 'V' || sym === 'v') iconNum = '2';
                else if (sym === '\u25E3') iconNum = '3';
                else if (sym === '\u25B3') iconNum = '4';
                else if (sym === '\u25C7') iconNum = '5';
                chipInfo.innerHTML += (window.__pvChip ? __pvChip(sym) : '<img loading=\"lazy\" src=\"' + _ICONS['carport_new_skill_chip_none_icon_' + iconNum + '.png'] + '\" style=\"width:30px;height:30px;object-fit:contain;\">');
            }
        }
        var img = document.getElementById('carImage');
        // Try local image, fallback to placeholder on error
        img.onerror = function() { this.src = _ICONS['icon_mhyck_m.png']; this.onerror = null; };
        img.src = _CAR_IMG[car.id] || ('data/26-07-15_29734784_android/full/' + encodeURI(car.asset_dir + '/body/' + car.id + '_m.png'));
        _setQualityBg(car);
        // Sync checkbox card
        setTimeout(function() { _syncSpecLayout(); }, 50);
        img.alt = _n(car);
        img.style.display = '';
        img.loading = 'lazy';
        _playCarEnter();

        var info = document.getElementById('carSelectInfo');
        info.style.display = 'flex';
        info.innerHTML = '<b>' + _n(car) + '</b>'
            + ' &nbsp;|&nbsp; ' + _pos(car.position) + ' / ' + _spec(car.specialization)
            + ' &nbsp;|&nbsp; ace_charge: <b>' + (car.ace_charge || '?') + '</b>'
            + (car.ult_duration ? ' &nbsp;|&nbsp; ' + _("大招时长:","Ult Dur:") + ' <b>' + car.ult_duration + 's</b>' : '')
            + (car.has_sp ? ' &nbsp;|&nbsp; <span class="car-badge">SP</span>' : '');
        if (typeof fillSupportFromCar === 'function') fillSupportFromCar(car);   // 辅助充能：读取这辆车给队友的辅助充能
        calculate();   // 自动填充全部写完之后再算一次
        if (typeof window.__pvRefreshCollapse === 'function') window.__pvRefreshCollapse(false);
        if (window.CommunityPlans && typeof window.CommunityPlans.onCarChanged === "function") { window.CommunityPlans.onCarChanged(_selectedCar); }
    }

    function populateFilters() {
        var posMenu = document.getElementById('filterPosMenu');
        var specMenu = document.getElementById('filterSpecMenu');
        if (!posMenu || !specMenu || !CAR_DATABASE) return;
        var positions = {}, specs = {};
        for (var i = 0; i < CAR_DATABASE.length; i++) {
            var c = CAR_DATABASE[i];
            if (c.position) positions[c.position] = 1;
            if (c.specialization) specs[c.specialization] = 1;
        }
        var sortedPos = Object.keys(positions).sort();
        posMenu.innerHTML = '<div class="dropdown-option" data-value=""><span class="zh">全部定位</span><span class="lang-en">All Positions</span></div>';
        for (var i = 0; i < sortedPos.length; i++) {
            var p = sortedPos[i];
            var pIcon = getPosIcon(p);
            var pHtml = pIcon ? '<img src="' + pIcon + '" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;">' : '';
            posMenu.innerHTML += '<div class="dropdown-option" data-value="' + p + '">' + pHtml + _pos(p) + '</div>';
        }
        if (!posMenu.__cspFilterBound) {
            posMenu.__cspFilterBound = true;
            posMenu.addEventListener('click', function (event) {
                var opt = event.target && event.target.closest ? event.target.closest('.dropdown-option[data-value]') : null;
                if (!opt || !posMenu.contains(opt)) return;
                selectFilter('pos', opt.getAttribute('data-value') || '');
            });
        }
        var sortedSpec = Object.keys(specs).sort();
        specMenu.innerHTML = '<div class="dropdown-option" data-value=""><span class="zh">全部专精</span><span class="lang-en">All Specs</span></div>';
        for (var i = 0; i < sortedSpec.length; i++) {
            var s = sortedSpec[i];
            var sIcon = getSpecIcon(s);
            var sHtml = sIcon ? '<img src="' + sIcon + '" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;">' : '';
            specMenu.innerHTML += '<div class="dropdown-option" data-value="' + s + '">' + sHtml + _spec(s) + '</div>';
        }
        if (!specMenu.__cspFilterBound) {
            specMenu.__cspFilterBound = true;
            specMenu.addEventListener('click', function (event) {
                var opt = event.target && event.target.closest ? event.target.closest('.dropdown-option[data-value]') : null;
                if (!opt || !specMenu.contains(opt)) return;
                selectFilter('spec', opt.getAttribute('data-value') || '');
            });
        }
    }

    var _filterPos = '', _filterSpec = '';

    function toggleFilterMenu(type) {
        var menuId = type === 'pos' ? 'filterPosMenu' : 'filterSpecMenu';
        var otherMenuId = type === 'pos' ? 'filterSpecMenu' : 'filterPosMenu';
        _closeDropdown(document.getElementById(otherMenuId));
        _closeDropdown(document.getElementById('carDropdown'));
        _toggleDropdown(document.getElementById(menuId));
    }

    function selectFilter(type, value) {
        if (type === 'pos') {
            _filterPos = value;
            var pExcl = value.charAt(0) === '!', pRaw = pExcl ? value.slice(1) : value;
                var pIcon = (pRaw && !pExcl) ? getPosIcon(pRaw) : '';
            document.getElementById('filterPosLabel').innerHTML = (pIcon ? '<img src=\"' + pIcon + '\" style=\"width:16px;height:16px;vertical-align:middle;margin-right:8px;\">' : '') + (value ? (pExcl ? _('非', 'Non-') + _pos(pRaw) : _pos(pRaw)) : _('全部定位', 'All Positions'));
            _closeDropdown(document.getElementById('filterPosMenu'));
        } else {
            _filterSpec = value;
            var sIcon = value ? getSpecIcon(value) : '';
            document.getElementById('filterSpecLabel').innerHTML = (sIcon ? '<img src=\"' + sIcon + '\" style=\"width:16px;height:16px;vertical-align:middle;margin-right:8px;\">' : '') + (value ? _spec(value) : _('全部专精', 'All Specializations'));
            _closeDropdown(document.getElementById('filterSpecMenu'));
        }
        filterCarList();
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown-container') && !e.target.closest('#carSearch')) {
            var menus = document.querySelectorAll('#filterPosMenu, #filterSpecMenu, #carDropdown');
            for (var i = 0; i < menus.length; i++) {
                _closeDropdown(menus[i]);
            }
        }
    });

            
