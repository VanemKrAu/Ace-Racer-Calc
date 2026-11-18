
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
    function populateCarGrid() {
        var list = document.getElementById('carDropdown');
        if (!list || !CAR_DATABASE) return;
        var html = '';
        // Add "Unreleased car" as first option
        var sel0 = (_selectedCarId === -1) ? ' selected' : '';
        html += '<div class="dropdown-option' + sel0 + '" data-id="-1" data-legacy-click="a10">'
            + '<span style="flex:1;"><span style="opacity:0.5;">\u2753</span> ' + _("未上线车辆", "Unreleased Car") + '</span>'
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
            var selQ = (_selectedCarId === c.id) ? ({'普通':' sel-common','稀有':' sel-rare','史诗':' sel-epic','传说':' sel-legend'})[c.quality] || '' : '';
            html += '<div class=\"dropdown-option' + sel + selQ + '\" data-id=\"' + c.id + '\" data-pos=\"' + (c.position||'') + '\" data-spec=\"' + (c.specialization||'') + '\" data-legacy-click=\"a42\">'
                + '<span style=\"flex:1;\">' + icons + ' ' + _n(c) + '</span>'
                + '<span style=\"font-size:11px;color:var(--text-muted);\">[' + (c.ace_charge || '?') + ']' + (c.ult_duration ? ' ' + c.ult_duration + 's' : '') + '</span>'
                + '</div>';
        }
        list.innerHTML = html;
        window.__legacyBindGenerated(list, 'car');
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
        var spec = _filterSpec;
        var items = document.querySelectorAll('#carDropdown .dropdown-option');
        var matchCount = 0;
        for (var i = 0; i < items.length; i++) {
            var isSpecial = items[i].getAttribute('data-id') === '-1';
            var id = parseInt(items[i].getAttribute('data-id'));
            var matchName = false;
            if (id > 0) {
                for (var di = 0; di < CAR_DATABASE.length; di++) {
                    if (CAR_DATABASE[di].id === id) {
                        var c = CAR_DATABASE[di];
                        matchName = c.name.toLowerCase().indexOf(q) >= 0 || (c.search_text && c.search_text.indexOf(q) >= 0);
                        break;
                    }
                }
            } else {
                var name = items[i].querySelector('span').textContent.toLowerCase();
                matchName = name.indexOf(q) >= 0;
            }
            var matchPos = !pos || items[i].getAttribute('data-pos') === pos;
            var matchSpec = !spec || items[i].getAttribute('data-spec') === spec;
            var show = isSpecial || (matchName && matchPos && matchSpec);
            items[i].style.display = show ? '' : 'none';
            if (show && !isSpecial) matchCount++;
        }
        var label = document.getElementById('carListLabel');
        if (_selectedCarId === -1) {
            label.innerHTML = '<span style=\"opacity:0.5;\">\u2753</span> ' + _("未上线车辆", "Unreleased Car");
        } else if (_selectedCarId && _selectedCarId > 0) {
            for (var i = 0; i < CAR_DATABASE.length; i++) {
                if (CAR_DATABASE[i].id === _selectedCarId) {
                    var cc = CAR_DATABASE[i];
                    var cp = getPosIcon(cc.position);
                    var cs = getSpecIcon(cc.specialization);
                    var ci = '';
                    if (cp) ci += '<img src=\"' + cp + '\" style=\"width:14px;height:14px;vertical-align:middle;margin-right:4px;\">';
                    if (cs) ci += '<img src=\"' + cs + '\" style=\"width:14px;height:14px;vertical-align:middle;margin-right:4px;\">';
                    label.innerHTML = ci + ' ' + _n(cc);
                    break;
                }
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

    function updateCarPreview(car) {
        document.getElementById('carPreviewPlaceholder').style.display = 'none';
        document.getElementById('carPreviewName').style.display = '';
        document.getElementById('carPreviewName').textContent = _n(car) + ' (' + _pos(car.position) + ')';
        var filledItems = [_("大招阈值","Ult Threshold"), _("基础双充","Base Dual Charge"), _("氮气时长","Nitro Dur")];
        if (car.ult_duration) filledItems.push(_("大招时长","Ult Dur"));
        if (car.ult_charge_first) filledItems.push(_("起步额外充能","Start Bonus"));
        document.getElementById('carPreviewAutoMsg').style.display = '';
        var msgHtml = _('\u2713 \u5DF2\u81EA\u52A8\u586B\u5145\uFF1A', '\u2713 Auto-filled: ') + filledItems.join(_('\u3001', ', '));
        if (!car.ult_duration) {
            msgHtml += _('<br><span style=\"color:var(--warning);font-weight:bold;\">⚠️ 该车无固定大招时长，大招时长和其他参数请手动填写</span>', '<br><span style=\"color:var(--warning);font-weight:bold;\">⚠️ This car has no fixed ult duration, ult and other params need manual input</span>');
        } else {
            msgHtml += _('<br><span style=\"color:var(--warning);font-weight:bold;\">⚠️ 其他参数请手动调整</span>', '<br><span style=\"color:var(--warning);font-weight:bold;\">⚠️ Other params need manual tuning</span>');
        }
        msgHtml += _('<br>\u8BE6\u7EC6\u8F66\u8F86\u6280\u80FD\u8BF7\u53C2\u8003 \u2192', '<br>Details \u2192') + ' <a href=\"https://reca.seimu.cn/ace-racer/vehicles/' + car.id + '\" target=\"_blank\" style=\"color:var(--primary);text-decoration:underline;font-weight:bold;\">' + _('瑞卡情报站-', 'Racer Wiki-') + _n(car) + '</a>';
        document.getElementById('carPreviewAutoMsg').innerHTML = msgHtml;
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
                chipInfo.innerHTML += '<img loading=\"lazy\" src=\"' + _ICONS['carport_new_skill_chip_none_icon_' + iconNum + '.png'] + '\" style=\"width:30px;height:30px;object-fit:contain;\">';
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
        var info = document.getElementById('carSelectInfo');
        info.style.display = 'flex';
        info.innerHTML = '<b>' + _n(car) + '</b>'
            + ' &nbsp;|&nbsp; ' + _pos(car.position) + ' / ' + _spec(car.specialization)
            + ' &nbsp;|&nbsp; ace_charge: <b>' + (car.ace_charge || '?') + '</b>'
            + (car.ult_duration ? ' &nbsp;|&nbsp; ' + _("大招时长:","Ult Dur:") + ' <b>' + car.ult_duration + 's</b>' : '')
            + (car.has_sp ? ' &nbsp;|&nbsp; <span class="car-badge">SP</span>' : '');
    }

    // Flash system for auto-filled sections (persistent across car switches)
    var _flashTimers = {};
    function flashSection(sectionId, inputIds) {
        var sec = document.getElementById(sectionId);
        if (!sec) return;
        var state = _flashTimers[sectionId];
        if (state) {
            // Already flashing — just re-attach stop listeners
            if (state.stopFlash) {
                for (var fi = 0; fi < inputIds.length; fi++) {
                    var el = document.getElementById(inputIds[fi]);
                    if (el) {
                        el.addEventListener('input', state.stopFlash, { once: true });
                        el.addEventListener('change', state.stopFlash, { once: true });
                        el.addEventListener('focus', state.stopFlash, { once: true });
                        el.addEventListener('click', state.stopFlash, { once: true });
                    }
                }
            }
            return;
        }
        var origBorder = sec.style.border;
        var origShadow = sec.style.boxShadow;
        state = { opacity: 0.3, dir: 0.04, timer: null, stopFlash: null };
        _flashTimers[sectionId] = state;
        state.timer = setInterval(function() {
            state.opacity += state.dir;
            if (state.opacity >= 0.8) state.dir = -0.04;
            if (state.opacity <= 0.2) state.dir = 0.04;
            var c = 'rgba(0, 242, 254, ' + state.opacity + ')';
            sec.style.setProperty('border', '1px solid ' + c, 'important');
            sec.style.setProperty('box-shadow', '0 0 6px ' + c, 'important');
        }, 50);
        state.stopFlash = function() {
            if (_flashTimers[sectionId]) {
                clearInterval(_flashTimers[sectionId].timer);
                delete _flashTimers[sectionId];
            }
            sec.style.border = origBorder;
            sec.style.boxShadow = origShadow;
        };
        for (var fi = 0; fi < inputIds.length; fi++) {
            var el = document.getElementById(inputIds[fi]);
            if (el) {
                el.addEventListener('input', state.stopFlash, { once: true });
                el.addEventListener('change', state.stopFlash, { once: true });
                el.addEventListener('focus', state.stopFlash, { once: true });
                el.addEventListener('click', state.stopFlash, { once: true });
            }
        }
    }

    function pickCar(id) {
        // Handle "Unreleased car"
        if (id === -1) {
            _selectedCar = null;
            _selectedCarId = -1;
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
            document.getElementById('carSelectInfo').style.display = 'none';
            populateCarGrid();
            return;
        }

        var car = null;
        for (var i = 0; i < CAR_DATABASE.length; i++) {
            if (CAR_DATABASE[i].id === id) { car = CAR_DATABASE[i]; break; }
        }
        if (!car) return;
        _selectedCar = car;
        _selectedCarId = car.id;

        // Reset all auto-fillable fields before filling new car data
        function _stopFlash(sid) {
            var st = _flashTimers[sid];
            if (st && st.stopFlash) st.stopFlash();
        }
        _stopFlash('extraUltSection');
        _stopFlash('extraNitroSection');
        _stopFlash('extraPerSecSection');
        _stopFlash('extraCustomSection');
        document.getElementById('hasExtraUlt').checked = false;
        document.getElementById('valExtraUltFirst').value = 0;
        document.getElementById('valExtraUltLoop').value = 0;
        document.getElementById('hasExtraNitro').checked = false;
        document.getElementById('valExtraNitro').value = 0;
        document.getElementById('hasExtraPerSec').checked = false;
        document.getElementById('valExtraPerSec').value = 0;
        document.getElementById('valCustomTrig').value = 0;
        document.getElementById('customTrigFirstCount').value = 0;
        document.getElementById('customTrigLoopCount').value = 0;
        if (typeof toggleExtraUI === 'function') toggleExtraUI();

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
        var maxH = calcMaxHuineng(car.chip_slots);
        document.getElementById('inputHuineng').max = maxH;
        document.querySelectorAll('.limit-badge')[1].innerHTML = '<span class="zh">\u4E0A\u9650\uFF1A\u5148\u673A30% | \u6C47\u80FD' + maxH + '%</span><span class="lang-en">Limit: Xianji 30% | Huineng ' + maxH + '%</span>';
        if (parseFloat(document.getElementById('inputHuineng').value) > maxH) {
            document.getElementById('inputHuineng').value = maxH;
        }
        calculate();
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
        if (car.sp_charge) {
            document.getElementById('valCustomTrig').value = car.sp_charge;
            document.getElementById('customTrigFirstCount').value = 1;
            document.getElementById('customTrigLoopCount').value = 1;
            flashSection('extraCustomSection', ['valCustomTrig', 'customTrigFirstCount', 'customTrigLoopCount']);
        }

        document.getElementById('carPreviewPlaceholder').style.display = 'none';
        document.getElementById('carPreviewName').style.display = '';
        document.getElementById('carPreviewName').textContent = _n(car) + ' (' + _pos(car.position) + ')';
        // Show auto-fill info message
        document.getElementById('carPreviewAutoMsg').style.display = '';
        // Build green message dynamically
        var filledItems = [_("大招阈值","Ult Threshold"), _("基础双充","Base Dual Charge"), _("氮气时长","Nitro Dur")];
        if (car.ult_duration) filledItems.push(_("大招时长","Ult Dur"));
        if (car.ult_charge_first) filledItems.push(_("起步额外充能","Start Bonus"));
        if (car.nitro_charge) filledItems.push(_("氮气自充能","Nitro SC"));
        if (car.ult_charge_loop) filledItems.push(_("大招自充能","Ult SC"));
        if (car.per_sec_charge) filledItems.push(_("每秒自充能","PerSec SC"));
        if (car.sp_charge) filledItems.push(_("SP自充能","SP Charge"));
        var msgHtml = _('\u2713 \u5DF2\u81EA\u52A8\u586B\u5145\uFF1A', '\u2713 Auto-filled: ') + filledItems.join(_('\u3001', ', '));
        if (!car.ult_duration) {
            msgHtml += _('<br><span style=\"color:var(--warning);font-weight:bold;\">⚠️ 该车无固定大招时长，大招时长和其他参数请手动填写</span>', '<br><span style=\"color:var(--warning);font-weight:bold;\">⚠️ This car has no fixed ult duration, ult and other params need manual input</span>');
        } else {
            msgHtml += _('<br><span style=\"color:var(--warning);font-weight:bold;\">⚠️ 其他参数请手动调整</span>', '<br><span style=\"color:var(--warning);font-weight:bold;\">⚠️ Other params need manual tuning</span>');
        }
        msgHtml += _('<br>\u8BE6\u7EC6\u8F66\u8F86\u6280\u80FD\u8BF7\u53C2\u8003 \u2192', '<br>Details \u2192') + ' <a href=\"https://reca.seimu.cn/ace-racer/vehicles/' + car.id + '\" target=\"_blank\" style=\"color:var(--primary);text-decoration:underline;font-weight:bold;\">' + _('瑞卡情报站-', 'Racer Wiki-') + _n(car) + '</a>';
        document.getElementById('carPreviewAutoMsg').innerHTML = msgHtml;
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
                chipInfo.innerHTML += '<img loading=\"lazy\" src=\"' + _ICONS['carport_new_skill_chip_none_icon_' + iconNum + '.png'] + '\" style=\"width:30px;height:30px;object-fit:contain;\">';
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

        var info = document.getElementById('carSelectInfo');
        info.style.display = 'flex';
        info.innerHTML = '<b>' + _n(car) + '</b>'
            + ' &nbsp;|&nbsp; ' + _pos(car.position) + ' / ' + _spec(car.specialization)
            + ' &nbsp;|&nbsp; ace_charge: <b>' + (car.ace_charge || '?') + '</b>'
            + (car.ult_duration ? ' &nbsp;|&nbsp; ' + _("大招时长:","Ult Dur:") + ' <b>' + car.ult_duration + 's</b>' : '')
            + (car.has_sp ? ' &nbsp;|&nbsp; <span class="car-badge">SP</span>' : '');
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
        posMenu.innerHTML = '<div class="dropdown-option" data-value="" data-legacy-click="a11"><span class="zh">全部定位</span><span class="lang-en">All Positions</span></div>';
        for (var i = 0; i < sortedPos.length; i++) {
            var p = sortedPos[i];
            var pIcon = getPosIcon(p);
            var pHtml = pIcon ? '<img src="' + pIcon + '" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;">' : '';
            posMenu.innerHTML += '<div class="dropdown-option" data-value="' + p + '" data-legacy-click="a12">' + pHtml + _pos(p) + '</div>';
        }
        window.__legacyBindGenerated(posMenu, 'pos');
        var sortedSpec = Object.keys(specs).sort();
        specMenu.innerHTML = '<div class="dropdown-option" data-value="" data-legacy-click="a13"><span class="zh">全部专精</span><span class="lang-en">All Specs</span></div>';
        for (var i = 0; i < sortedSpec.length; i++) {
            var s = sortedSpec[i];
            var sIcon = getSpecIcon(s);
            var sHtml = sIcon ? '<img src="' + sIcon + '" style="width:18px;height:18px;vertical-align:middle;margin-right:6px;">' : '';
            specMenu.innerHTML += '<div class="dropdown-option" data-value="' + s + '" data-legacy-click="a14">' + sHtml + _spec(s) + '</div>';
        }
        window.__legacyBindGenerated(specMenu, 'spec');
    }

    var _filterPos = '', _filterSpec = '';

    function toggleFilterMenu(type) {
        var menuId = type === 'pos' ? 'filterPosMenu' : 'filterSpecMenu';
        var otherMenuId = type === 'pos' ? 'filterSpecMenu' : 'filterPosMenu';
        document.getElementById(otherMenuId).classList.remove('show');
        document.getElementById('carDropdown').classList.remove('show');
        var menu = document.getElementById(menuId);
        menu.classList.toggle('show');
    }

    function selectFilter(type, value) {
        if (type === 'pos') {
            _filterPos = value;
            var pIcon = value ? getPosIcon(value) : '';
            document.getElementById('filterPosLabel').innerHTML = (pIcon ? '<img src=\"' + pIcon + '\" style=\"width:16px;height:16px;vertical-align:middle;margin-right:8px;\">' : '') + (value ? _pos(value) : _('全部定位', 'All Positions'));
            document.getElementById('filterPosMenu').classList.remove('show');
        } else {
            _filterSpec = value;
            var sIcon = value ? getSpecIcon(value) : '';
            document.getElementById('filterSpecLabel').innerHTML = (sIcon ? '<img src=\"' + sIcon + '\" style=\"width:16px;height:16px;vertical-align:middle;margin-right:8px;\">' : '') + (value ? _spec(value) : _('全部专精', 'All Specializations'));
            document.getElementById('filterSpecMenu').classList.remove('show');
        }
        filterCarList();
    }

    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.dropdown-container') && !e.target.closest('#carSearch')) {
            var menus = document.querySelectorAll('#filterPosMenu, #filterSpecMenu, #carDropdown');
            for (var i = 0; i < menus.length; i++) {
                menus[i].classList.remove('show');
            }
        }
    });

            
