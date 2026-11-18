
function __tok(n, d) { var v = getComputedStyle(document.body).getPropertyValue(n).trim(); return v || d; }

       document.addEventListener('wheel', function(e) {
           if (document.activeElement && document.activeElement.type === 'number') {
               document.activeElement.blur();
           }
       }, { passive: true });

       var isRestoringConfig = false;

       function toggleTheme() {
           _closeDropdown(document.getElementById('authorMenu'));
           var btn = document.getElementById('themeBtn');
           var revealRunning = !!(window.LiquidThemeReveal && typeof window.LiquidThemeReveal.isRunning === 'function' && window.LiquidThemeReveal.isRunning());
           var currentReal = document.body.classList.contains('light-mode') ? 'light' : 'dark';
           var logicalCurrent = (revealRunning && window.__ltTargetTheme) ? window.__ltTargetTheme : currentReal;
           var nextMode = (logicalCurrent === 'light') ? 'dark' : 'light';
           window.__ltTargetTheme = nextMode;

           var apply = function() {
               window.__ltTargetTheme = null;
               selectTheme(nextMode);
               if (typeof window.__pvSyncThemeNow === 'function') {
                   window.__pvSyncThemeNow();
               }
           };
           if (revealRunning && nextMode === currentReal) {
               window.LiquidThemeReveal.cancel();
               window.__ltTargetTheme = null;
               return;
           }
           if (window.LiquidThemeReveal && typeof window.LiquidThemeReveal.run === 'function') {
               window.LiquidThemeReveal.run({
                   triggerEl: btn,
                   toLight: nextMode === 'light',
                   duration: 1300,
                   isReducedMotion: function() {
                       return typeof _motionOK === 'function' ? !_motionOK() : false;
                   },
                   applyTheme: apply,
                   onInterrupt: function() {
                       if (window.__ltTargetTheme === nextMode) window.__ltTargetTheme = null;
                   }
               });
           } else {
               apply();
           }
       }

       function toggleAuthorMenu() {
           var menu = document.getElementById('authorMenu');
           _toggleDropdown(menu);
       }

       window.onclick = function(event) {
           if (!event.target.closest('#authorBtn') && !event.target.closest('#authorMenu')) {
               var authorMenu = document.getElementById('authorMenu');
               if (authorMenu && authorMenu.classList.contains('show')) {
                   _closeDropdown(authorMenu);
               }
           }
       }

       function applyThemeMode(isLight) {
           var body = document.body;
           if (isLight) {
               body.classList.add('light-mode');
           } else {
               body.classList.remove('light-mode');
           }
       }

       function updateThemeIcon(mode) {
           var icon = document.getElementById('themeIcon');
           if (!icon) return;
           icon.innerText = (mode === 'light') ? '☀️' : '🌙';
       }

       function initTheme() {
           var savedTheme = null;
           try { savedTheme = localStorage.getItem('theme'); } catch (e) {}
           if (savedTheme === 'light') {
               applyThemeMode(true);
               updateThemeIcon('light');
           } else {
               applyThemeMode(false);
               updateThemeIcon('dark');
               try { localStorage.setItem('theme', 'dark'); } catch (e) {}
           }
       }

       function selectTheme(mode) {
           var normalized = (mode === 'light') ? 'light' : 'dark';
           try { localStorage.setItem('theme', normalized); } catch (e) {}
           applyThemeMode(normalized === 'light');
           updateThemeIcon(normalized);
       }

       function showToast(message, isTrustedHtml) {
           var toast = document.getElementById("copyToast");
           if (!toast) return;
           if (toast.__hideTimer) clearTimeout(toast.__hideTimer);
           if (isTrustedHtml === true) toast.innerHTML = message;
           else toast.textContent = message == null ? "" : String(message);
           toast.className = "copy-toast show";
           toast.__hideTimer = setTimeout(function() {
               toast.className = "copy-toast";
           }, 2500);
       }

       function triggerCopyBtnSuccess(btn) {
           if (!btn || !btn.classList) return;
           if (btn.__pvCopyTimer) clearTimeout(btn.__pvCopyTimer);
           btn.classList.add('is-copied');
           btn.__pvCopyTimer = setTimeout(function() {
               btn.classList.remove('is-copied');
               btn.__pvCopyTimer = null;
           }, 1400);
       }

       function copyToClipboard(text, successMsg, sourceBtn) {
           var fallbackCopy = function() {
               var textArea = document.createElement("textarea");
               textArea.value = text;
               textArea.style.position = "fixed";
               textArea.style.left = "-999999px";
               textArea.style.top = "-999999px";
               document.body.appendChild(textArea);
               
               textArea.focus();
               textArea.select();
               textArea.setSelectionRange(0, 999999);
               
               try {
                   var successful = document.execCommand('copy');
                   if (successful) {
                       triggerCopyBtnSuccess(sourceBtn);
                       showToast(successMsg);
                   } else {
                       showToast(_("❌ 复制失败，您的浏览器拦截了操作。", "❌ Copy failed, intercepted by browser."));
                   }
               } catch (error) {
                   showToast(_("❌ 复制失败，请尝试截图分享。", "❌ Copy failed, try a screenshot."));
               } finally {
                   textArea.remove();
               }
           };

           if (navigator.clipboard && window.isSecureContext) {
               navigator.clipboard.writeText(text).then(function() {
                   triggerCopyBtnSuccess(sourceBtn);
                   showToast(successMsg);
               }).catch(function(err) {
                   fallbackCopy();
               });
           } else {
               fallbackCopy();
           }
       }

       function exportConfigText(sourceBtn) {
           var btn = (sourceBtn && sourceBtn.nodeType === 1) ? sourceBtn : document.querySelector('.share-btn.btn-text');
           if (getCalcMode() === 'support') return exportSupportText(btn);
           var target = document.getElementById('ultThreshold').value || '0';
           var startCharge = document.getElementById('startCharge').value || '0';
           var baseNitro = document.getElementById('baseNitro').value || '0';
           
           var checkedRadio = document.querySelector('input[name="nitroRadio"]:checked');
           var labelElem = checkedRadio ? checkedRadio.parentElement.querySelector('label span.' + (currentLang === 'en' ? 'lang-en' : 'zh')) : null;
           var nitroType = labelElem ? labelElem.textContent.trim() : '未知';
           var nitroVal = checkedRadio ? checkedRadio.value : '1x5';
           var nitroTime = document.getElementById('time_' + nitroVal).value || '0';
           
           var isSpec = document.getElementById('isSpec').checked ? _("是", "Yes") : _("否", "No");
           var counter = document.getElementById('counterRange').value || '0';
           var debuff = document.getElementById('debuffRange').value || '0';
           
           var activeEmpowers = [];
           var checkedBoxes = document.querySelectorAll('.empower-checkbox:checked');
           for (var i = 0; i < checkedBoxes.length; i++) {
               var titleElem = checkedBoxes[i].parentElement.nextElementSibling.querySelector('.title span.' + (currentLang === 'en' ? 'lang-en' : 'zh'));
               if(!titleElem) titleElem = checkedBoxes[i].parentElement.nextElementSibling.querySelector('.title');
               if(titleElem) {
                   var titleText = titleElem.textContent || titleElem.innerText || '';
                   activeEmpowers.push(titleText.trim().split(/\s+/)[0]);
               }
           }
           var empowerStr = activeEmpowers.length > 0 ? activeEmpowers.join(' + ') : _("无", "None");

           var valExtraNitro = document.getElementById('hasExtraNitro').checked ? (document.getElementById('valExtraNitro').value || "0") : "0";
           var hasExtraUlt = document.getElementById('hasExtraUlt').checked;
           var veuFirst = parseFloat(document.getElementById('valExtraUltFirst').value) || 0;
           var veuLoop = parseFloat(document.getElementById('valExtraUltLoop').value) || 0;
           var valExtraUltStr = hasExtraUlt ? (_("首发", "1st ") + veuFirst + _("% / 循环", "% / Loop ") + veuLoop) : "0";
           var isExtraUltActive = hasExtraUlt && (veuFirst > 0 || veuLoop > 0);
           var valExtraPerSec = document.getElementById('hasExtraPerSec').checked ? (document.getElementById('valExtraPerSec').value || "0") : "0";
           var extraEfficiency = document.getElementById('extraEfficiency').value || "0";

           var xianji = document.getElementById('inputXianji').value || '0';
           var huineng = document.getElementById('inputHuineng').value || '0';
           var firstNitroCount = document.getElementById('inputFirstNitroCount').value || '0';
           var loopNitroCount = document.getElementById('inputNitroCount').value || '0';

           var resValFirstElem = document.getElementById('resultValueFirst');
           var resFirst = (resValFirstElem.textContent || resValFirstElem.innerText || '').replace(/✅|❌/g, '').trim();
           
           var resValLoopElem = document.getElementById('resultValueLoop');
           var resLoop = (resValLoopElem.textContent || resValLoopElem.innerText || '').replace(/✅|❌/g, '').trim();

            var text = _("🏎️【王牌竞速·大招能量配置单】\n", "🏎️[Ace Racer Config]\n");
            if (_selectedCar) text += _("🚗 车辆：", "🚗 Car: ") + _n(_selectedCar) + "\n";
            text += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
           text += _("🔹 基础充能：阈值", "🔹 Base Charge: Threshold ") + target + _("% |起步", "% | Start ") + startCharge + _("% |专精(", "% | Specialty(") + isSpec + ")\n";
           text += _("🔹 氮气充能：", "🔹 Nitro Charge: ") + baseNitro + "% (" + nitroType + " / " + nitroTime + _("秒)\n", "s)\n");
           text += _("🔹 环境影响：反制", "🔹 Environment: Counter ") + counter + _("% | 降效", "% | Debuff ") + debuff + "%\n";
           text += _("🔹 赋能充能：", "🔹 Empowerment: ") + empowerStr + "\n";
           if (_chipsOn.length > 0) {
               var chipNames = _chipsOn.map(function (c) {
                   var d = _chipDef(c.id);
                   if (!d) return c.id;
                   var nm = d.name[currentLang === 'en' ? 'en' : 'zh'] || d.id;
                   if (typeof _chipOptionDefs === 'function' && typeof _chipOptVal === 'function') {
                       var optTexts = [];
                       _chipOptionDefs(d).forEach(function (od) {
                           var v = _chipOptVal(c, od);
                           for (var oi = 0; oi < od.choices.length; oi++) {
                               if (od.choices[oi].v === v) {
                                   optTexts.push(od.choices[oi][currentLang === 'en' ? 'en' : 'zh'] || v);
                                   break;
                               }
                           }
                       });
                       if (optTexts.length) nm += ' (' + optTexts.join(', ') + ')';
                   }
                   return nm;
               }).join(' + ');
               text += _("🔹 特殊芯片：", "🔹 Special Chip: ") + chipNames + "\n";
           }
           if (getCalcMode() === 'team') {
               var _devNow = getDevice();
               text += _("🔹 团魂获能：团魂", "🔹 Team Soul Gain: Soul ") + _mv('inputTuanhun') + "%";
               if (_devNow) {
                   text += _(" | 增益装置：", " | Device: ") + deviceName(_devNow);
                   if (DEVICE_CHARGE[_devNow]) text += _("（首发前", " (before 1st Ult ") + _mi('dev_sub_first') + _("次 / 循环", " / loop ") + _mi('dev_sub_loop') + _("次）", ")");
               } else {
                   var _mate = _carById(parseInt(document.getElementById('teamMateCar').value, 10) || 0);
                   text += _(" | 队友辅助：", " | Ally assist: ") + (_mate ? _n(_mate) + " " : "") + (_mateKind === 'full' ? _("补满一管", "full bar") : _mv('teamInBase') + "%" + (_mc('teamInCore') ? _("×辅助核心", " ×Core") : ""))
                       + _("（首发前", " (before 1st Ult ") + _mi('teamInFirst') + _("次 / 循环", " / loop ") + _mi('teamInLoop') + _("次）", ")");
               }
               text += "\n";
           }
           
           var valCustomTrig = document.getElementById('valCustomTrig').value || "0";
           var customTrigFirstCount = document.getElementById('customTrigFirstCount').value || "0";
           var customTrigLoopCount = document.getElementById('customTrigLoopCount').value || "0";

           if (parseFloat(valExtraNitro) > 0 || isExtraUltActive || parseFloat(valExtraPerSec) > 0 || parseFloat(extraEfficiency) !== 0 || parseFloat(valCustomTrig) > 0) {
               text += _("🔹 附加充能：额外氮气(", "🔹 Extra Charge: Nitro Bonus(") + valExtraNitro + _("%) | 额外大招(", "%) | Ult Bonus(") + valExtraUltStr + _("%) | 持续每秒(", "%) | Per sec(") + valExtraPerSec + _("%) | 充能效率提升(", "%) | Eff Boost(") + extraEfficiency + "%)\n";
           }
           if (parseFloat(valCustomTrig) > 0) {
               text += _("🔹 自定义触发自充：每次 ", "🔹 Custom Trig: ") + valCustomTrig + _("% × 首发", "% × 1st ") + customTrigFirstCount + _("次 / 循环", " trigs / Loop ") + customTrigLoopCount + _("次\n", " trigs\n");
           }

           text += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
           text += _("▶ 首发：需氮", "▶ 1st Ult: Needs ") + firstNitroCount + _("个 | 先机", " Nitros | Xianji ") + xianji + _("% | 汇能", "% | Huineng ") + huineng + "%\n";
           text += _("▶ 状态：", "▶ Status: ") + (resFirst || _("计算中...", "Calculating...")) + "\n";
           text += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
           text += _("▶ 循环：大招内含 ", "▶ Loop: Ult contains ") + loopNitroCount + _(" 个氮气\n", " Nitros\n");
           text += _("▶ 状态：", "▶ Status: ") + (resLoop || _("计算中...", "Calculating...")) + "\n";
           if (_chainRes) {
               text += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
               text += _("▶ 开局连发：", "▶ Opening chain: ") + _chainRes.line + "\n";
           }
           text += _("🔗 by Vanem - 王牌芯片计算器 - aceracercalc.top", "🔗 by Vanem - Ace Racer Calculator - aceracercalc.top");

           copyToClipboard(text, _("✅ 文本已复制，快去分享吧！", "✅ Text copied, ready to share!"), btn);
       }

       // 辅助供能模式只有「供能」一个结果，纯文本也只导出这一块
       function exportSupportText(sourceBtn) {
           var btn = (sourceBtn && sourceBtn.nodeType === 1) ? sourceBtn : document.querySelector('.share-btn.btn-text');
           var car = _selectedCar;
           var text = _("🏎️【王牌竞速·辅助供能】\n", "🏎️[Ace Racer · Support Supply]\n");
           if (car) text += _("🚗 辅助车：", "🚗 Support car: ") + _n(car) + "\n";
           text += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
           if (_supKind === 'full') {
               text += _("🔹 给法：大招直接为队友补满一管能量\n", "🔹 Effect: refills the ally's whole bar\n");
           } else {
               text += _("🔹 单次辅助充能：", "🔹 Assist per hit: ") + _mv('supBase') + "%" + (_mc('supCore') ? _("（带辅助核心 ×1.3）", " (Core ×1.3)") : "") + _(" | 一次大招 ", " | ") + _mi('supCount') + _(" 次\n", " hits per ult\n");
               text += _("🔹 队友：团魂", "🔹 Ally: soul ") + _mv('supMateSoul') + _("% | 充能效率", "% | eff ") + (document.getElementById('supMateEff').value || '100') + _("% | 反制", "% | counter ") + (document.getElementById('counterRange').value || '0') + "%\n";
           }
           text += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
           text += _("▶ 队友合计实收：", "▶ Ally receives in total: ") + (document.getElementById('supportHitValue').textContent || '--').trim() + "\n";
           text += _("▶ ", "▶ ") + (document.getElementById('supportTotalLabel').textContent || '') + _("：", ": ") + (document.getElementById('supportTotalValue').textContent || '--').trim() + "\n";
           text += _("🔗 by Vanem - 王牌芯片计算器 - aceracercalc.top", "🔗 by Vanem - Ace Racer Calculator - aceracercalc.top");
           copyToClipboard(text, _("✅ 文本已复制，快去分享吧！", "✅ Text copied, ready to share!"), btn);
       }

       function exportConfigImage() {
           if (typeof html2canvas === 'undefined') {
               showToast(_("❌ 截图组件未加载，请检查网络或配置！", "❌ Screenshot component missing!"));
               return;
           }
           
           var originalScrollY = window.scrollY || document.documentElement.scrollTop;
           window.scrollTo(0, 0);
           
           var appContainer = document.querySelector('.app-container');
           var isLight = document.body.classList.contains('light-mode');
           var bgColor = __tok('--export-bg', isLight ? '#f0f4f8' : '#18213d');
           
           var exactWidth = appContainer.getBoundingClientRect().width;
           if (exactWidth < 380) exactWidth = 480;

           var loaderOverlay = document.createElement('div');
           loaderOverlay.style.position = 'fixed';
           loaderOverlay.style.top = '0';
           loaderOverlay.style.left = '0';
           loaderOverlay.style.width = '100vw';
           loaderOverlay.style.height = '100vh';
           loaderOverlay.style.backgroundColor = bgColor;
           loaderOverlay.style.zIndex = '10000';
           loaderOverlay.style.display = 'flex';
           loaderOverlay.style.flexDirection = 'column';
           loaderOverlay.style.justifyContent = 'center';
           loaderOverlay.style.alignItems = 'center';
           loaderOverlay.innerHTML = '<div class="pv-shot-load"><i></i><svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m21 16-5-5-9 9"/></svg></div><div style="font-size:18px; font-weight:bold; color:'+__tok('--export-accent', isLight?'#007bb5':'#00f2fe')+';">' + _("正在生成超清长图...", "Generating HD screenshot...") + '</div><div style="font-size:12px; color:#8e9aaf; margin-top:8px;">' + _("(极速渲染引擎运转中，请稍候)", "(Rendering engine running, please wait...)") + '</div>';
           document.body.appendChild(loaderOverlay);

        setTimeout(function() {

        var clone = appContainer.cloneNode(true);

           var origElements = appContainer.querySelectorAll('*');
           var cloneElements = clone.querySelectorAll('*');
           for (var i = 0; i < origElements.length; i++) {
               var origEl = origElements[i];
               if (origEl.hasAttribute('style')) {
                   var compStyle = window.getComputedStyle(origEl);
                   cloneElements[i].style.setProperty('background-color', compStyle.backgroundColor, 'important');
                   cloneElements[i].style.setProperty('color', compStyle.color, 'important');
                   cloneElements[i].style.setProperty('border-color', compStyle.borderColor, 'important');
               }
               cloneElements[i].style.setProperty('font-family', '"Noto Sans SC", Arial, "Helvetica Neue", Helvetica, sans-serif', 'important');
               cloneElements[i].style.setProperty('letter-spacing', 'normal', 'important');
           }
           clone.style.setProperty('font-family', '"Noto Sans SC", Arial, "Helvetica Neue", Helvetica, sans-serif', 'important');

           var origInputs = appContainer.querySelectorAll('input, select, textarea');
           var cloneInputs = clone.querySelectorAll('input, select, textarea');
           
           for (var i = 0; i < origInputs.length; i++) {
               var orig = origInputs[i];
               var cln = cloneInputs[i];
               
               if (orig.type === 'checkbox' || orig.type === 'radio') {
                   if (orig.type === 'radio') {
                       cln.name = orig.name + '_clone';
                   }
                   cln.checked = orig.checked;
                   if (orig.checked) {
                       cln.setAttribute('checked', 'checked');
                   } else {
                       cln.removeAttribute('checked');
                   }
               } else if (orig.type === 'range') {
                   var rangeVal = parseFloat(orig.value) || 0;
                   var min = parseFloat(orig.min) || 0;
                   var max = parseFloat(orig.max) || 100;
                   var percent = ((rangeVal - min) / (max - min)) * 100;
                   
                   var trackDiv = document.createElement('div');
                   trackDiv.style.width = '100%';
                   trackDiv.style.height = '6px';
                   
                   var emptyTrackColor = isLight ? '#cbd5e0' : 'rgba(100, 120, 180, 0.25)';
                   var filledTrackColor = __tok('--export-range', isLight ? '#e53e3e' : '#ff007f');
                   trackDiv.style.background = 'linear-gradient(to right, ' + filledTrackColor + ' ' + percent + '%, ' + emptyTrackColor + ' ' + percent + '%)';
                   
                   trackDiv.style.borderRadius = '3px';
                   trackDiv.style.position = 'relative';
                   trackDiv.style.margin = '10px 0';
                   
                   var thumbDiv = document.createElement('div');
                   thumbDiv.style.width = '16px';
                   thumbDiv.style.height = '16px';
                   thumbDiv.style.background = filledTrackColor;
                   thumbDiv.style.borderRadius = '50%';
                   thumbDiv.style.position = 'absolute';
                   thumbDiv.style.top = '-5px';
                   thumbDiv.style.left = 'calc(' + percent + '% - 8px)';
                   
                   trackDiv.appendChild(thumbDiv);
                   cln.parentNode.insertBefore(trackDiv, cln);
                   cln.style.display = 'none';
               } else {
                   cln.value = orig.value;
                   cln.setAttribute('value', orig.value);
               }
           }

           var clonedResultNums = clone.querySelectorAll('.result-num');
           for (var i = 0; i < clonedResultNums.length; i++) {
               var el = clonedResultNums[i];
               el.style.background = 'transparent';
               el.style.webkitBackgroundClip = 'initial';
               el.style.webkitTextFillColor = 'initial';
               el.style.textShadow = 'none';
               
               var parentCard = el.closest('.result-card, .result-card-loop');
               var isError = parentCard && parentCard.classList.contains('error-state');
               var isLoop = parentCard && parentCard.classList.contains('result-card-loop');
               
               if (isError) el.style.color = __tok('--export-fail', isLight ? '#e53e3e' : '#ff007f');
               else if (isLoop) el.style.color = __tok('--export-pass', isLight ? '#2f855a' : '#4cdf8a');
               else el.style.color = __tok('--export-pass', isLight ? '#007bb5' : '#00f2fe');
           }
           
           var loopInClone = clone.querySelector('#resultCardChain') || clone.querySelector('#resultCardLoop');   // 截到开局连发卡为止
           if (loopInClone) {
               var sibling = loopInClone.nextElementSibling;
               while (sibling) {
                   var next = sibling.nextElementSibling;
                   sibling.remove();
                   sibling = next;
               }
               var parent = loopInClone.parentElement;
               while (parent && parent !== clone) {
                   var parentSibling = parent.nextElementSibling;
                   while (parentSibling) {
                       var nextParentSibling = parentSibling.nextElementSibling;
                       parentSibling.remove();
                       parentSibling = nextParentSibling;
                   }
                   parent = parent.parentElement;
               }
           }
           
           var ignoredElements = clone.querySelectorAll('[data-html2canvas-ignore="true"]');
           for (var i = 0; i < ignoredElements.length; i++) {
               if (ignoredElements[i].parentNode) {
                   ignoredElements[i].parentNode.removeChild(ignoredElements[i]);
               }
           }
           
           if (window.__pvExportFix) window.__pvExportFix(clone);
           var tempWrapper = document.createElement('div');
           tempWrapper.style.position = 'absolute';
           tempWrapper.style.left = '0px';
           tempWrapper.style.top = '0px';
           tempWrapper.style.zIndex = '9998';
           tempWrapper.style.width = exactWidth + 'px';
           tempWrapper.style.backgroundColor = bgColor;
           
           document.body.appendChild(tempWrapper);
           tempWrapper.appendChild(clone);
           
           clone.style.width = exactWidth + 'px';
           clone.style.maxWidth = 'none';
           clone.style.margin = '0';
           clone.style.padding = getComputedStyle(appContainer).padding;
           clone.style.boxSizing = 'border-box';
           
           var targetHeight = clone.offsetHeight;
           
           var smartScale = 1600 / exactWidth;
           var hdScale = Math.max(2, Math.min(smartScale, 4));
           
           setTimeout(function() {
               html2canvas(clone, {
                   backgroundColor: bgColor,
                   scale: hdScale,
                   useCORS: true,
                   allowTaint: false,
                   logging: false,
                   width: exactWidth,
                   height: targetHeight,
                   windowWidth: exactWidth,
                   windowHeight: targetHeight,
                   x: 0,
                   y: 0,
                   scrollX: 0,
                   scrollY: 0
               }).then(function(canvas) {
                   cleanup();
                   
                   var scaleMultiplier = canvas.width / exactWidth;
                   var footerHeight = 70 * scaleMultiplier;
                   
                   var newCanvas = document.createElement('canvas');
                   newCanvas.width = canvas.width;
                   newCanvas.height = canvas.height + footerHeight;
                   
                   var ctx = newCanvas.getContext('2d');
                   ctx.imageSmoothingEnabled = true;
                   ctx.imageSmoothingQuality = 'high';
                   
                   ctx.fillStyle = bgColor;
                   ctx.fillRect(0, 0, newCanvas.width, newCanvas.height);
                   ctx.drawImage(canvas, 0, 0);
                   
                   ctx.beginPath();
                   ctx.moveTo(30 * scaleMultiplier, canvas.height + 1);
                   ctx.lineTo(newCanvas.width - (30 * scaleMultiplier), canvas.height + 1);
                   ctx.strokeStyle = isLight ? '#cbd5e0' : 'rgba(100, 120, 180, 0.25)';
                   ctx.lineWidth = 1.5 * scaleMultiplier;
                   ctx.stroke();
                   
                   ctx.fillStyle = __tok('--export-accent', isLight ? '#007bb5' : '#00f2fe');
                   ctx.font = 'bold ' + (22 * scaleMultiplier) + 'px "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif';
                   ctx.textAlign = 'center';
                   ctx.textBaseline = 'middle';
                   ctx.fillText('aceracercalc.top', newCanvas.width / 2, canvas.height + (30 * scaleMultiplier));
                   
                   ctx.fillStyle = isLight ? '#4a5568' : '#8e9aaf';
                   ctx.font = (13 * scaleMultiplier) + 'px "Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif';
                   ctx.fillText(_('王牌竞速芯片计算器', 'Ace Racer Chip Calculator'), newCanvas.width / 2, canvas.height + (52 * scaleMultiplier));
                   
                   var link = document.createElement('a');
                   var dateStr = new Date().toISOString().slice(0,10).replace(/-/g,"");
                   link.download = _('王牌计算器_', 'Ace_Calc_') + dateStr + '.png';
                   link.href = newCanvas.toDataURL('image/png', 1.0);
                   link.click();
                   
                   showToast(_("✅ 高清长图已保存到您的设备！", "✅ HD image saved to your device!"));
               }).catch(function(err) {
                   console.error('[export]', err);
                   cleanup();
                   showToast(_("❌ 生成失败，请重试或更换浏览器。", "❌ Generation failed, try again."));
               });

               function cleanup() {
                   if (tempWrapper.parentNode) document.body.removeChild(tempWrapper);
                   if (loaderOverlay.parentNode) document.body.removeChild(loaderOverlay);
                   window.scrollTo(0, originalScrollY);
               }
           }, 350);
           
       }, 50); 

       }

       function exportConfigLink(sourceBtn) {
           var btn = (sourceBtn && sourceBtn.nodeType === 1) ? sourceBtn : document.querySelector('.share-btn.btn-link');
           var checkedRadio = document.querySelector('input[name="nitroRadio"]:checked');
           var nr = checkedRadio ? checkedRadio.value : '1x5';
           var nd = document.getElementById('time_' + nr).value;
           
           var emps = Array.from(document.querySelectorAll('.empower-checkbox:checked')).map(function(cb) { return cb.value; }).join('-');

           var compactArr = [
               document.getElementById('ultThreshold').value,        
               document.getElementById('startCharge').value,        
               document.getElementById('baseNitro').value,          
               nr,                                                  
               nd,                                                  
               document.getElementById('baseUltDuration').value,    
               document.getElementById('isSpec').checked ? 1 : 0,    
               document.getElementById('counterRange').value,        
               document.getElementById('debuffRange').value,        
               emps || "0",                                          
               document.getElementById('jiezou_sub_first').value,    
               document.getElementById('jiezou_sub_loop').value,    
               document.getElementById('queyi_sub_self').checked ? 1 : 0,  
               document.getElementById('queyi_sub_enemy').checked ? 1 : 0,
               document.getElementById('huaxin_sub_first').value,    
               document.getElementById('huaxin_sub_loop').value,    
               document.getElementById('hasExtraNitro').checked ? 1 : 0,  
               document.getElementById('valExtraNitro').value,      
               document.getElementById('chkExtraNitroFirst').checked ? 1 : 0,
               document.getElementById('chkExtraNitroLoop').checked ? 1 : 0,  
               document.getElementById('hasExtraUlt').checked ? 1 : 0,    
               (document.getElementById('valExtraUltFirst').value || "0") + "_" + (document.getElementById('valExtraUltLoop').value || "0"),        
               0,
               0,  
               document.getElementById('extraEfficiency').value,    
               document.getElementById('inputFirstNitroCount').value,
               document.getElementById('inputXianji').value,        
               document.getElementById('inputHuineng').value,        
               isManualNitroCount ? 1 : 0,                          
               document.getElementById('inputNitroCount').value,
               document.getElementById('time_1x6').value,            
               document.getElementById('hasExtraPerSec').checked ? 1 : 0,  
               document.getElementById('valExtraPerSec').value,          
               document.getElementById('chkExtraPerSecFirst').checked ? 1 : 0,
               document.getElementById('chkExtraPerSecLoop').checked ? 1 : 0,  
               document.getElementById('valCustomTrig').value,          
               document.getElementById('customTrigFirstCount').value,      
               document.getElementById('customTrigLoopCount').value,
               // 38+ ：计算模式 / 增益装置 / 团魂 / 队友辅助 / 辅助供能
               getCalcMode(),
               getDevice() || "0",
               document.getElementById('dev_sub_first').value,
               document.getElementById('dev_sub_loop').value,
               document.getElementById('teamMateCar').value || "0",
               document.getElementById('inputTuanhun').value,
               document.getElementById('teamInBase').value,
               document.getElementById('teamInCore').checked ? 1 : 0,
               document.getElementById('teamInFirst').value,
               document.getElementById('teamInLoop').value,
               document.getElementById('supBase').value,
               document.getElementById('supCore').checked ? 1 : 0,
               document.getElementById('supMateSoul').value,
               document.getElementById('supMateEff').value,
               document.getElementById('supCount').value,
               // 54：团魂获能的三把锁（团魂 / 先机 / 汇能），例如 100 = 只锁团魂
               (_tm.lock.soul ? '1' : '0') + (_tm.lock.xianji ? '1' : '0') + (_tm.lock.huineng ? '1' : '0'),
               // 55：特殊芯片序列化（'0' 表示未装备）
               typeof chipSerialize === 'function' ? chipSerialize() : '0'
           ];

           var cfgStr = encodeURIComponent(btoa(compactArr.join('|')));
            var baseUrl = window.location.origin + window.location.pathname;
             var shareUrl = baseUrl + '?s=' + cfgStr;
             if (_selectedCarId && _selectedCarId > 0) {
                 shareUrl += '&car=' + _selectedCarId;
             }

            copyToClipboard(shareUrl, _("🔗 短链接已复制，分享给车友可直接打开！", "🔗 Short link copied, share to open directly!"), btn);
       }
       
       // URL 参数进来的一切数值/枚举都要过白名单，挡住 ?s= / ?cfg= 注入
       function _numOr(v, def) {
           var n = parseFloat(v);
           return isFinite(n) ? n : (def === undefined ? 0 : def);
       }
       function _enumOr(v, allow, def) {
           return allow.indexOf(String(v)) >= 0 ? String(v) : def;
       }

       function loadConfigFromUrl() {
           var urlParams = new URLSearchParams(window.location.search);
           if (!urlParams.has('s') && !urlParams.has('cfg') && !urlParams.has('car')) return false;
           // 配装分享参数来自 URL，限制解码体积，避免恶意链接占满主线程。
           if ((urlParams.get('s') || '').length > 16384 || (urlParams.get('cfg') || '').length > 16384) return false;

           isRestoringConfig = true;
           var result = false;
           _chipStash = {};   // 链接里的先机 / 汇能就是要打开的那一套，别被模式切换换掉

           if (urlParams.has('s')) {
               try {
                   var safeB64 = urlParams.get('s').replace(/ /g, '+');
                   var arr = atob(safeB64).split('|');
                   if (arr.length >= 29) {
                       var isOldVersion = arr.length === 29;
                       var offset = isOldVersion ? -1 : 0;

                       document.getElementById('ultThreshold').value = arr[0];
                       document.getElementById('startCharge').value = arr[1];
                       document.getElementById('baseNitro').value = arr[2];
                       
                       var nr = _enumOr(arr[3], ['1x5', '1x6', '2x2'], '1x5');
                       
                       if (arr.length >= 31) {
                           var anchorInput = document.getElementById('time_1x6');
                           if (anchorInput) {
                               anchorInput.value = arr[30];
                               syncNitroTimes('1x6');
                           }
                       } else if (!isOldVersion) {
                           var timeInput = document.getElementById('time_' + nr);
                           if (timeInput) {
                               timeInput.value = arr[4];
                               syncNitroTimes(nr);
                           }
                       }

                       var radio = document.getElementById('r_' + nr);
                       if (radio) {
                           radio.checked = true;
                           handleNitroRadioChange(true);
                       }

                       document.getElementById('baseUltDuration').value = arr[5 + offset];
                       document.getElementById('isSpec').checked = arr[6 + offset] === '1';

                       var _crSafe = _numOr(arr[7 + offset], 0);
                       var _drSafe = _numOr(arr[8 + offset], 0);
                       document.getElementById('counterRange').value = _crSafe;
                       if (window._renderOdoValue) {
                           window._renderOdoValue(document.getElementById('counterValue'), _crSafe + '%');
                       } else {
                           document.getElementById('counterValue').innerText = _crSafe + '%';
                       }
                       document.getElementById('debuffRange').value = _drSafe;
                       if (window._renderOdoValue) {
                           window._renderOdoValue(document.getElementById('debuffValue'), _drSafe + '%');
                       } else {
                           document.getElementById('debuffValue').innerText = _drSafe + '%';
                       }

                       var cbs = document.querySelectorAll('.empower-checkbox');
                       for (var i = 0; i < cbs.length; i++) { cbs[i].checked = false; }
                       if (arr[9 + offset] !== "0") {
                           var emps = arr[9 + offset].split('-');
                           for (var j = 0; j < emps.length; j++) {
                               var cb = document.getElementById('chk_' + emps[j]);
                               if (cb) { cb.checked = true; handleEmpowerChange(cb); }
                           }
                       }

                       document.getElementById('jiezou_sub_first').value = arr[10 + offset];
                       document.getElementById('jiezou_sub_loop').value = arr[11 + offset];
                       document.getElementById('queyi_sub_self').checked = arr[12 + offset] === '1';
                       document.getElementById('queyi_sub_enemy').checked = arr[13 + offset] === '1';
                       document.getElementById('huaxin_sub_first').value = arr[14 + offset];
                       document.getElementById('huaxin_sub_loop').value = arr[15 + offset];

                       document.getElementById('hasExtraNitro').checked = arr[16 + offset] === '1';
                       toggleExtraUI();
                       document.getElementById('valExtraNitro').value = arr[17 + offset];
                       document.getElementById('chkExtraNitroFirst').checked = arr[18 + offset] === '1';
                       document.getElementById('chkExtraNitroLoop').checked = arr[19 + offset] === '1';

                       document.getElementById('hasExtraUlt').checked = arr[20 + offset] === '1';
                       toggleExtraUI();
                       var ultValStr = String(arr[21 + offset]);
                       if (ultValStr.indexOf('_') !== -1) {
                           var parts = ultValStr.split('_');
                           document.getElementById('valExtraUltFirst').value = parts[0];
                           document.getElementById('valExtraUltLoop').value = parts[1];
                       } else {
                           var baseVal = parseFloat(ultValStr) || 0;
                           document.getElementById('valExtraUltFirst').value = (arr[22 + offset] === '1') ? baseVal : 0;
                           document.getElementById('valExtraUltLoop').value = (arr[23 + offset] === '1') ? baseVal : 0;
                       }

                       document.getElementById('extraEfficiency').value = arr[24 + offset];
                       document.getElementById('inputFirstNitroCount').value = arr[25 + offset];
                       document.getElementById('inputXianji').value = arr[26 + offset];
                       document.getElementById('inputHuineng').value = arr[27 + offset];

                       if (arr[28 + offset] === '1') {
                           isManualNitroCount = true;
                           document.getElementById('inputNitroCount').value = arr[29 + offset];
                           updateNitroCountUI();
                       }
                       
                       if (arr.length >= 35) {
                           document.getElementById('hasExtraPerSec').checked = arr[31] === '1';
                           toggleExtraUI();
                           document.getElementById('valExtraPerSec').value = arr[32];
                           document.getElementById('chkExtraPerSecFirst').checked = arr[33] === '1';
                           document.getElementById('chkExtraPerSecLoop').checked = arr[34] === '1';
                       }
                       if (arr.length >= 38) {
                           document.getElementById('valCustomTrig').value = arr[35];
                           document.getElementById('customTrigFirstCount').value = arr[36];
                           document.getElementById('customTrigLoopCount').value = arr[37];
                       }
                       if (arr.length < 53) {
                           // 旧版链接诞生时只有先机汇能：按先机汇能打开（除非地址里另带 ?mode=）
                           if (!urlParams.has('mode')) setCalcMode('solo', true, true);
                       } else {
                           setCalcMode(_enumOr(arr[38], ['solo', 'team'], 'solo'), true, true);
                           document.getElementById('dev_sub_first').value = arr[40];
                           document.getElementById('dev_sub_loop').value = arr[41];
                           document.getElementById('teamMateCar').value = _carById(parseInt(arr[42], 10) || 0) ? String(parseInt(arr[42], 10)) : '0';
                           document.getElementById('inputTuanhun').value = arr[43];
                           document.getElementById('teamInBase').value = arr[44];
                           document.getElementById('teamInCore').checked = arr[45] === '1';
                           document.getElementById('teamInFirst').value = arr[46];
                           document.getElementById('teamInLoop').value = arr[47];
                           document.getElementById('supBase').value = arr[48];
                           document.getElementById('supCore').checked = arr[49] === '1';
                           document.getElementById('supMateSoul').value = arr[50];
                           document.getElementById('supMateEff').value = arr[51];
                           document.getElementById('supCount').value = arr[52];
                           onMateCarChange(true);
                           setDevice(arr[39] === '0' ? '' : arr[39], true);
                           // 三把锁：新链接按发送者的状态还原；旧链接没有这一项 —— 三个值都是发送者定好的，全部锁上原样打开
                           var lk = arr.length >= 54 && /^[01]{3}$/.test(arr[53]) ? arr[53] : '111';
                           _tm.lock = { soul: lk[0] === '1', xianji: lk[1] === '1', huineng: lk[2] === '1' };
                           if (arr.length >= 55 && typeof chipRestore === 'function') {
                               chipRestore(arr[54], true);
                           }
                       }
                       
                       result = true;
                   }
               } catch (e) {
               }
           } else if (urlParams.has('cfg')) {
               try {
                   var safeCfgB64 = urlParams.get('cfg').replace(/ /g, '+');
                   var config = JSON.parse(decodeURIComponent(atob(safeCfgB64)));
                   if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('invalid config');
                   if (config.emps !== undefined && (!Array.isArray(config.emps) || config.emps.length > document.querySelectorAll('.empower-checkbox').length || config.emps.some(function (v) { return typeof v !== 'string' || !/^[a-zA-Z0-9_]{1,64}$/.test(v); }))) throw new Error('invalid empowers');

                   if(config.ut !== undefined) document.getElementById('ultThreshold').value = config.ut;
                   if(config.sc !== undefined) document.getElementById('startCharge').value = config.sc;
                   if(config.bn !== undefined) document.getElementById('baseNitro').value = config.bn;
                   if(config.nr) {
                       var radioObj = document.getElementById('r_' + config.nr);
                       if (radioObj) radioObj.checked = true;
                   }
                   if(config.bud !== undefined) document.getElementById('baseUltDuration').value = config.bud;
                   if(config.sp !== undefined) document.getElementById('isSpec').checked = config.sp;

                   if(config.cr !== undefined) {
                       var _cfgCr = _numOr(config.cr, 0);
                       document.getElementById('counterRange').value = _cfgCr;
                       if (window._renderOdoValue) window._renderOdoValue(document.getElementById('counterValue'), _cfgCr + '%');
                       else document.getElementById('counterValue').innerText = _cfgCr + '%';
                   }
                   if(config.dr !== undefined) {
                       var _cfgDr = _numOr(config.dr, 0);
                       document.getElementById('debuffRange').value = _cfgDr;
                       if (window._renderOdoValue) window._renderOdoValue(document.getElementById('debuffValue'), _cfgDr + '%');
                       else document.getElementById('debuffValue').innerText = _cfgDr + '%';
                   }

                   var allCbs = document.querySelectorAll('.empower-checkbox');
                   for (var k = 0; k < allCbs.length; k++) { allCbs[k].checked = false; }
                   if(Array.isArray(config.emps)) {
                       for (var m = 0; m < config.emps.length; m++) {
                           var oldCb = document.getElementById('chk_' + config.emps[m]);
                           if (oldCb) { oldCb.checked = true; handleEmpowerChange(oldCb); }
                       }
                   }

                   if(config.jf !== undefined) document.getElementById('jiezou_sub_first').value = config.jf;
                   if(config.jl !== undefined) document.getElementById('jiezou_sub_loop').value = config.jl;
                   if(config.qs !== undefined) document.getElementById('queyi_sub_self').checked = config.qs;
                   if(config.qe !== undefined) document.getElementById('queyi_sub_enemy').checked = config.qe;
                   if(config.hf !== undefined) document.getElementById('huaxin_sub_first').value = config.hf;
                   if(config.hl !== undefined) document.getElementById('huaxin_sub_loop').value = config.hl;

                   if(config.hen !== undefined) { document.getElementById('hasExtraNitro').checked = config.hen; toggleExtraUI(); }
                   if(config.ven !== undefined) document.getElementById('valExtraNitro').value = config.ven;
                   if(config.enf !== undefined) document.getElementById('chkExtraNitroFirst').checked = config.enf;
                   if(config.enl !== undefined) document.getElementById('chkExtraNitroLoop').checked = config.enl;

                   if(config.heu !== undefined) { document.getElementById('hasExtraUlt').checked = config.heu; toggleExtraUI(); }
                   if(config.veu !== undefined) {
                       var baseV = config.veu;
                       if(config.euf !== undefined) document.getElementById('valExtraUltFirst').value = config.euf ? baseV : 0;
                       if(config.eul !== undefined) document.getElementById('valExtraUltLoop').value = config.eul ? baseV : 0;
                   }
                   if(config.veuf !== undefined) document.getElementById('valExtraUltFirst').value = config.veuf;
                   if(config.veul !== undefined) document.getElementById('valExtraUltLoop').value = config.veul;
                   
                   if(config.hps !== undefined) { document.getElementById('hasExtraPerSec').checked = config.hps; toggleExtraUI(); }
                   if(config.vps !== undefined) document.getElementById('valExtraPerSec').value = config.vps;
                   if(config.psf !== undefined) document.getElementById('chkExtraPerSecFirst').checked = config.psf;
                   if(config.psl !== undefined) document.getElementById('chkExtraPerSecLoop').checked = config.psl;

                   if(config.ee !== undefined) document.getElementById('extraEfficiency').value = config.ee;
                   if(config.ctv !== undefined) document.getElementById('valCustomTrig').value = config.ctv;
                   if(config.ctf !== undefined) document.getElementById('customTrigFirstCount').value = config.ctf;
                   if(config.ctl !== undefined) document.getElementById('customTrigLoopCount').value = config.ctl;
                   
                   if(config.fnc !== undefined) document.getElementById('inputFirstNitroCount').value = config.fnc;
                   if(config.xj !== undefined) document.getElementById('inputXianji').value = config.xj;
                   if(config.hn !== undefined) document.getElementById('inputHuineng').value = config.hn;

                   if(config.mn) {
                       isManualNitroCount = true;
                       if(config.nc !== undefined) document.getElementById('inputNitroCount').value = config.nc;
                       updateNitroCountUI();
                   }

                   result = true;
               } catch (e) {
                }
            }

            // 分享链接里带来的先机 / 汇能 / 氮气次数同样受上限约束，先夹一遍。
            // 后面若还按 car 参数选车，applyChipLimits 会用那辆车的上限再夹一次。
            if (typeof clampAllLimited === 'function') clampAllLimited();

            // Handle car parameter after config (if any)
            if (urlParams.has('car')) {
                var carId = parseInt(urlParams.get('car'), 10);
                if (carId > 0 && CAR_DATABASE) {
                    var found = null;
                    for (var ci = 0; ci < CAR_DATABASE.length; ci++) {
                        if (CAR_DATABASE[ci].id === carId) { found = CAR_DATABASE[ci]; break; }
                    }
                     if (found) {
                         _selectedCar = found;
                         _selectedCarId = found.id;
                         if (urlParams.has('s') || urlParams.has('cfg')) {
                             // Config exists: only update preview, don't overwrite values
                             updateCarPreview(found);
                             populateCarGrid();
                             if (found.assist_charge && _mv('supBase') === found.assist_charge) _supKind = found.assist_kind || 'once';
                             labelsForKind(_supKind, 'supBaseLabel', 'supCountLabel', false);
                         } else {
                            // No config: auto-fill everything
                            setTimeout(function() { if (typeof pickCar === 'function') pickCar(carId); }, 300);
                        }
                    }
                }
            } else if (typeof _chipPruneByCar === 'function' && _chipPruneByCar(_selectedCar)) {
                if (typeof renderChips === 'function') renderChips(true);
            }

            isRestoringConfig = false;
           return result;
       }

       var nitroRatios = { '1x5': 1.0, '1x6': 1.2, '2x2': 0.4, '2x3': 0.6, '2x25': 0.5, '3x2': 0.4 };
       var isManualNitroCount = false;

       function syncNitroTimes(changedId) {
           var radio = document.getElementById('r_' + changedId);
           if (radio && !radio.checked) { radio.checked = true; handleNitroRadioChange(); }
           var changedValue = parseFloat(document.getElementById('time_' + changedId).value) || 0;
           if (changedValue <= 0) { if (!isRestoringConfig) calculate(); return; }
           var baseValue = changedValue / nitroRatios[changedId];
           for (var key in nitroRatios) {
               if (nitroRatios.hasOwnProperty(key) && key !== changedId) {
                   document.getElementById('time_' + key).value = parseFloat((baseValue * nitroRatios[key]).toFixed(2));
               }
           }
           if (!isRestoringConfig) calculate();
       }

       function updateCounterSlider() {
           var cVal = document.getElementById('counterValue'), val = document.getElementById('counterRange').value;
           if (window._renderOdoValue) window._renderOdoValue(cVal, val + '%');
           else if (cVal) cVal.innerText = val + '%';
           if (!isRestoringConfig) { triggerAutoCalc(currentActiveField); calculate(); }
       }

       function updateDebuffSlider() {
           var dVal = document.getElementById('debuffValue'), val = document.getElementById('debuffRange').value;
           if (window._renderOdoValue) window._renderOdoValue(dVal, val + '%');
           else if (dVal) dVal.innerText = val + '%';
           if (!isRestoringConfig) { triggerAutoCalc(currentActiveField); calculate(); }
       }

       function _morphSubBox(sub, wantOpen, applyState) {
           if (!sub) { applyState(); return; }
           wantOpen = !!wantOpen;
           if (sub.__subOpen === undefined) sub.__subOpen = sub.getClientRects().length > 0 && !sub.classList.contains('is-closing');
           if (sub.__subOpen === wantOpen) { applyState(); return; }
           sub.__subOpen = wantOpen;
           var M = window.__pvMorph;
           var instant = (typeof isRestoringConfig !== 'undefined' && isRestoringConfig) || !M || typeof _motionOK !== 'function' || !_motionOK() || !sub.parentElement || sub.parentElement.getClientRects().length === 0;
           if (instant) {
               if (typeof _stopSlide === 'function') _stopSlide(sub);
               sub.classList.remove('is-closing');
               applyState();
               return;
           }
           if (wantOpen) {
               var fromZero = !sub.classList.contains('is-closing');
               M(sub, true, _SLIDE_KEYS, [sub], function() {
                   sub.classList.remove('is-closing');
                   applyState();
                   return _boxOf(sub);
               }, null, fromZero);
           } else {
               M(sub, false, _SLIDE_KEYS, [sub], function() {
                   sub.classList.add('is-closing');
                   applyState();
                   return {};
               }, function() {
                   sub.classList.remove('is-closing');
               });
           }
       }

       function toggleExtraUI() {
           var nitroCb = document.getElementById('hasExtraNitro');
           if (nitroCb) {
               var nitroSec = nitroCb.parentElement.parentElement;
               var nitroBody = document.getElementById('extraNitroContainer');
               _morphSubBox(nitroBody, nitroCb.checked, function() {
                   nitroSec.classList.toggle('extra-active-nitro', nitroCb.checked);
               });
           }
           
           var ultCb = document.getElementById('hasExtraUlt');
           if (ultCb) {
               var ultSec = ultCb.parentElement.parentElement;
               var ultBody = document.getElementById('extraUltContainer');
               _morphSubBox(ultBody, ultCb.checked, function() {
                   ultSec.classList.toggle('extra-active-ult', ultCb.checked);
               });
           }
           
           var persecCb = document.getElementById('hasExtraPerSec');
           if (persecCb) {
               var persecSec = persecCb.parentElement.parentElement;
               var persecBody = document.getElementById('extraPerSecContainer');
               _morphSubBox(persecBody, persecCb.checked, function() {
                   persecSec.classList.toggle('extra-active-persec', persecCb.checked);
               });
           }
       }

       function handleNitroRadioChange(isInit) {
           var items = document.querySelectorAll('.nitro-item');
           for (var i = 0; i < items.length; i++) items[i].classList.remove('selected');
           var checkedRadio = document.querySelector('input[name="nitroRadio"]:checked');
           if (checkedRadio) {
               var parent = checkedRadio.parentElement;
               while (parent && !parent.classList.contains('nitro-item')) parent = parent.parentElement;
               if (parent) parent.classList.add('selected');
           }
           
           if (isInit !== true && !isRestoringConfig) {
               triggerAutoCalc(currentActiveField);
               calculate();
           }
       }

              // ── 全量赋能系统：核心与次要分类、滑块动画、单选互斥变灰与优先级冲突 ────────────────────────
       var _empowerAnimUntil = 0;
       function placeEmpowerThumb(noAnim) {
           var seg = document.querySelector('.empower-seg'),
               th = seg && seg.querySelector('.empower-seg-thumb'),
               on = seg && seg.querySelector('.empower-seg-opt.is-on');
           if (!th || !on || !on.offsetWidth) return;
           if (noAnim) {
               th.classList.add('no-anim');
           } else {
               th.classList.remove('no-anim');
               _empowerAnimUntil = (window.performance ? performance.now() : Date.now()) + 520;
           }
           th.style.width = on.offsetWidth + 'px';
           th.style.height = on.offsetHeight + 'px';
           th.style.transform = 'translate(' + on.offsetLeft + 'px,' + on.offsetTop + 'px)';
           if (noAnim) { void th.offsetWidth; th.classList.remove('no-anim'); }
       }

       window.switchEmpowerTab = function(tab) {
           var opts = document.querySelectorAll('.empower-seg-opt');
           opts.forEach(function(opt) {
               opt.classList.toggle('is-on', opt.getAttribute('data-tab') === tab);
           });
           var paneCore = document.getElementById('paneCoreEmpower');
           var paneSub = document.getElementById('paneSubEmpower');
           if (tab === 'core') {
               if (paneCore) paneCore.style.display = '';
               if (paneSub) paneSub.style.display = 'none';
           } else {
               if (paneCore) paneCore.style.display = 'none';
               if (paneSub) paneSub.style.display = '';
           }
           placeEmpowerThumb();
       };

       window.clearAllEmpowers = function() {
           var cbs = document.querySelectorAll('.empower-checkbox');
           cbs.forEach(function(cb) { cb.checked = false; });
           handleEmpowerChange();
       };

       // 站内统一轻量提示 Toast
       function showEmpowerToast(msg) {
           if (window.CommunityPlans && typeof window.CommunityPlans.toast === 'function') {
               window.CommunityPlans.toast(msg);
               return;
           }
           var toast = document.getElementById('copyToast');
           if (!toast) {
               toast = document.createElement('div');
               toast.id = 'copyToast';
               toast.className = 'copy-toast';
               document.body.appendChild(toast);
           }
           toast.textContent = msg;
           toast.classList.add('is-shown');
           clearTimeout(window.__empowerToastTimer);
           window.__empowerToastTimer = setTimeout(function () {
               toast.classList.remove('is-shown');
           }, 2800);
       }

       function updateEmpowerStateUI() {
           var coreCb = document.querySelector('.empower-checkbox[data-role="core"]:checked');
           var subCb = document.querySelector('.empower-checkbox[data-role="sub"]:checked');

           var coreSeries = coreCb ? parseInt(coreCb.getAttribute('data-series'), 10) : null;
           var subSeries = subCb ? parseInt(subCb.getAttribute('data-series'), 10) : null;

           var seriesNames = { 1: '战斗', 2: '防御', 3: '能量', 4: '创造' };

           // 1. 核心赋能更新：
           // 核心拥有绝对优先权，候选池永远不受次要赋能锁定限制！
           // 规则1：一旦选了任意一个核心赋能，核心分类下的其他 11 个全部变灰禁用 (is-muted-exclusive)
           var coreItems = document.querySelectorAll('.empower-item[data-role="core"]');
           coreItems.forEach(function(item) {
               var cb = item.querySelector('.empower-checkbox');
               var conflictTip = item.querySelector('.empower-conflict-tip');
               if (conflictTip) conflictTip.style.display = 'none';

               if (coreCb) {
                   if (cb === coreCb) {
                       item.classList.remove('is-muted-exclusive');
                       if (cb) cb.disabled = false;
                   } else {
                       item.classList.add('is-muted-exclusive');
                       if (cb) cb.disabled = true;
                   }
               } else {
                   item.classList.remove('is-muted-exclusive');
                   if (cb) cb.disabled = false;
               }
           });

           // 2. 次要赋能更新：
           // 规则 A：若已选核心系，次要赋能中的同系 3 个赋能判定为同系互斥锁定 (is-conflict)
           // 规则 B：若已选了某个次要赋能，次要分类下的其他赋能全部变灰禁用 (is-muted-exclusive)
           var subItems = document.querySelectorAll('.empower-item[data-role="sub"]');
           subItems.forEach(function(item) {
               var s = parseInt(item.getAttribute('data-series'), 10);
               var cb = item.querySelector('.empower-checkbox');
               var conflictTip = item.querySelector('.empower-conflict-tip');

               var isConflict = coreSeries && (s === coreSeries);
               if (isConflict) {
                   item.classList.add('is-conflict');
                   item.classList.add('is-muted-exclusive');
                   if (cb) {
                       cb.disabled = true;
                       if (cb.checked) {
                           cb.checked = false;
                           item.classList.remove('active');
                       }
                   }
                   if (conflictTip) {
                       conflictTip.textContent = '同系互斥 (核心已装配' + seriesNames[s] + '系)';
                       conflictTip.style.display = 'block';
                   }
               } else {
                   item.classList.remove('is-conflict');
                   if (conflictTip) conflictTip.style.display = 'none';

                   if (subCb) {
                       if (cb === subCb) {
                           item.classList.remove('is-muted-exclusive');
                           if (cb) cb.disabled = false;
                       } else {
                           item.classList.add('is-muted-exclusive');
                           if (cb) cb.disabled = true;
                       }
                   } else {
                       item.classList.remove('is-muted-exclusive');
                       if (cb) cb.disabled = false;
                   }
               }
           });

           // 3. 刷新装配概览条与 Tab 状态
           var coreItem = coreCb ? coreCb.closest('.empower-item') : null;
           var coreNameText = coreItem ? coreItem.querySelector('.empower-name-text').textContent.trim() : '';
           var coreName = coreCb ? (coreNameText + ' (' + seriesNames[coreSeries] + ')') : null;

           var subItem = subCb ? subCb.closest('.empower-item') : null;
           var subNameText = subItem ? subItem.querySelector('.empower-name-text').textContent.trim() : '';
           var subName = subCb ? (subNameText + ' (' + seriesNames[subSeries] + ')') : null;

           var slotCoreVal = document.getElementById('slotCoreVal');
           if (slotCoreVal) {
               slotCoreVal.textContent = coreName || '未选择';
               slotCoreVal.classList.toggle('empty', !coreName);
           }
           var slotSubVal = document.getElementById('slotSubVal');
           if (slotSubVal) {
               slotSubVal.textContent = subName || '未选择';
               slotSubVal.classList.toggle('empty', !subName);
           }
           var clearBtn = document.getElementById('empowerClearBtn');
           if (clearBtn) clearBtn.style.display = (coreCb || subCb) ? 'inline-block' : 'none';

           var coreChosenStatus = document.getElementById('coreChosenStatus');
           if (coreChosenStatus) {
               coreChosenStatus.textContent = coreName ? coreName.split(' ')[0] : '未装备';
               coreChosenStatus.classList.toggle('has-pick', !!coreName);
           }
           var subChosenStatus = document.getElementById('subChosenStatus');
           if (subChosenStatus) {
               subChosenStatus.textContent = subName ? subName.split(' ')[0] : '未装备';
               subChosenStatus.classList.toggle('has-pick', !!subName);
           }
       }

       function handleEmpowerChange(element) {
           if (element && element.checked) {
               var role = element.getAttribute('data-role');
               var series = parseInt(element.getAttribute('data-series'), 10);
               var seriesNames = { 1: '战斗', 2: '防御', 3: '能量', 4: '创造' };

               // 冲突逻辑：如果选择的是核心赋能，且之前选的次要赋能与当前核心同系
               if (role === 'core') {
                   var curSubCb = document.querySelector('.empower-checkbox[data-role="sub"]:checked');
                   if (curSubCb) {
                       var subSeries = parseInt(curSubCb.getAttribute('data-series'), 10);
                       if (subSeries === series) {
                           // 核心优先！自动取消前面冲突的次要赋能，并提示用户
                           var conflictSubItem = curSubCb.closest('.empower-item');
                           var conflictSubName = conflictSubItem ? conflictSubItem.querySelector('.empower-name-text').textContent.trim() : '次要赋能';
                           curSubCb.checked = false;
                           if (conflictSubItem) conflictSubItem.classList.remove('active');
                           showEmpowerToast('核心赋能已装配【' + seriesNames[series] + '系】，已自动取消冲突的次要赋能【' + conflictSubName + '】，请重新选择次要赋能');
                       }
                   }
               }
           }

           // 处理所有复选框的 active 状态与子选项展开/收起
           var allCbs = document.querySelectorAll('.empower-checkbox');
           allCbs.forEach(function(cb) {
               var item = cb.closest('.empower-item');
               var sub = item ? item.querySelector('.empower-sub-options') : null;
               var isChecked = cb.checked;
               if (sub && item) {
                   _morphSubBox(sub, isChecked, function() {
                       item.classList.toggle('active', isChecked);
                   });
               } else if (item) {
                   item.classList.toggle('active', isChecked);
               }
           });

           updateEmpowerStateUI();

           if (!isRestoringConfig) {
               triggerAutoCalc(currentActiveField);
               calculate();
           }
       }

       function onNitroCountInput() {
           clampInput('inputNitroCount');
           isManualNitroCount = true;
           updateNitroCountUI();
           if (!isRestoringConfig) calculate();
       }

       function resetAutoNitroCount() {
           isManualNitroCount = false;
           updateNitroCountUI();
           if (!isRestoringConfig) {
               calculate();
               if (window.CommunityPlans && typeof window.CommunityPlans.scheduleDraftSave === 'function') window.CommunityPlans.scheduleDraftSave();
           }
       }

       function updateNitroCountUI() {
           var info = document.getElementById('nitroCountModeInfo');
           if (!isManualNitroCount) {
               _morphInlineBox(info, '<span style="color:var(--success); font-weight:bold;">' + (window.__pvIcon ? __pvIcon('auto', 'pv-mode-ico') : '▶ ') + _("自动计算就绪", "Auto-calc Ready") + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + _("根据大招时长和氮时计算氮气个数", "Calc nitros by Ult & nitro duration") + ')</span>', null, info.parentElement);
           } else {
               _morphInlineBox(info, '<span style="color:var(--warning); font-weight:bold;">' + (window.__pvIcon ? __pvIcon('edit', 'pv-mode-ico') : '▶ ') + _("手动覆盖中", "Manual Override") + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + _("当前为自由微调，需点重置恢复", "Manual override, click reset to restore") + ')</span>', null, info.parentElement);
           }
       }

       // ── 数字输入框的硬上限 ──────────────────────────────────────────────
       // 光靠 <input max="..."> 拦不住超限值：浏览器只在表单校验时拿 max 做判断，
       // 手打或粘贴照样能塞进去。所以每次输入都要在这里夹一遍。
       // 各框的上限：先机 30%（固定）、汇能随车型的芯片槽变化（换车时写进 el.max）、
       // 氮气次数 50 个。
       function clampInput(idOrEl) {
           var el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
           if (!el) return;
           var raw = String(el.value);
           if (raw === '' || raw === '-' || raw === '.') return;   // 半输入状态，别打断用户
           var v = parseFloat(raw);
           if (isNaN(v)) return;
           var max = parseFloat(el.max);
           var min = parseFloat(el.min);
           if (isNaN(min)) min = 0;
           var out = v;
           if (!isNaN(max) && out > max) out = max;
           if (out < min) out = min;
           if (out !== v) el.value = out;
       }

       // 受上限约束的四个框一次性夹完（选车、导入分享配置后调用）
       function clampAllLimited() {
           clampInput('inputXianji');
           clampInput('inputHuineng');
           clampInput('inputFirstNitroCount');
           clampInput('inputNitroCount');
           clampInput('inputTuanhun');
           clampInput('supMateSoul');
       }

       // 按车型刷新「先机 / 汇能」上限：卡片右上角的提示文字、汇能框的 max、超限值的夹取。
       // pickCar（正常选车）和 updateCarPreview（打开带配置的分享链接）都要走这条，
       // 否则从分享链接进来时上限既不刷新、超限值也拦不住。
       function applyChipLimits(car) {
           if (!car) return;
           var baseMax = calcMaxHuineng(car.chip_slots);
           var hnEl = document.getElementById('inputHuineng');
           if (hnEl) {
               // 手动输入的口子放宽到「带了核心增幅之后」的上限
               hnEl.max = (typeof _chipIndex === 'function' && _chipIndex('acecore') >= 0)
                   ? baseMax : calcMaxHuinengBoosted(car.chip_slots);
               // 没增幅的基础值另存一份：卡片显示和自动反算都用它
               hnEl.dataset.baseMax = baseMax;
           }
           // 动态计算特殊芯片（V型槽）上限与车辆适配限定
           var newChipMax = getCarVSlots(car);
           var chipLimitChanged = (CHIP_MAX !== newChipMax);
           if (chipLimitChanged) CHIP_MAX = newChipMax;
           var chipPruned = (typeof _chipPruneByCar === 'function') ? _chipPruneByCar(car) : false;
           if (chipLimitChanged || chipPruned) {
               if (typeof renderChips === 'function') renderChips(true);
           } else if (typeof _chipRenderGrid === 'function') {
               var chipGrid = document.getElementById('chipGrid');
               if (chipGrid && chipGrid.__built) _chipRenderGrid();
           }
           _chipBadge();   // 上限徽标（团魂获能里多一项团魂上限）
           clampAllLimited();
       }

       var autoLinked = true;
       var currentActiveField = null;
        var _userInput = false;   // 用户是否真的动过输入：没选车又没动过任何数值 = 还没开始测算，结果区保持「等待测算」

       function onFieldInput(field) {
           // 先过上限：先机固定 30%，汇能上限由车型芯片槽决定
           if (field === 'xianji') clampInput('inputXianji');
           else if (field === 'huineng') clampInput('inputHuineng');
           if (getCalcMode() === 'team') { _tmTyped(field); return; }   // 团魂获能：手填即上锁，交给团魂三值联动
           if (autoLinked) {
               if (currentActiveField === null) currentActiveField = field;
               if (currentActiveField === field) triggerAutoCalc(field);
               else { autoLinked = false; updateAutoCalcUI(); }
           }
           if (!isRestoringConfig) calculate();
       }

       function resetAutoCalc() {
           if (getCalcMode() === 'team') { _tmReset(); return; }
           autoLinked = true;
           currentActiveField = null;
           document.getElementById('inputXianji').value = "0";
           document.getElementById('inputHuineng').value = "0";
           updateAutoCalcUI();
           if (!isRestoringConfig) {
               calculate();
               if (window.CommunityPlans && typeof window.CommunityPlans.scheduleDraftSave === 'function') window.CommunityPlans.scheduleDraftSave();
           }
       }

       function updateAutoCalcUI() {
           var info = document.getElementById('autoCalcInfo');
           _chipBadge();
           if (getCalcMode() === 'team') { _tmRender(); return; }
           if (autoLinked) _morphInlineBox(info, '<span style="color:var(--success); font-weight:bold;">' + (window.__pvIcon ? __pvIcon('link', 'pv-mode-ico') : '▶ ') + _("联动就绪", "Linkage Ready") + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + _("修改一项自动算另一项", "Modify one to auto-calc the other") + ')</span>', null, info.parentElement);
           else _morphInlineBox(info, '<span style="color:var(--warning); font-weight:bold;">' + (window.__pvIcon ? __pvIcon('lock', 'pv-mode-ico') : '▶ ') + _("联动锁定", "Linkage Locked") + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + _("当前为自由微调，需点重置恢复", "Manual override, click reset to restore") + ')</span>', null, info.parentElement);
       }

       function triggerAutoCalc(sourceField) {
           if (isRestoringConfig || !autoLinked || !sourceField) return;
           if (getCalcMode() === 'team') return;   // 团魂获能由 _tmSolve() 在 calculate() 里统一反算
           
           var target = parseFloat(document.getElementById('ultThreshold').value) || 100;
           var startCharge = parseFloat(document.getElementById('startCharge').value) || 0;
           var baseNitroInput = parseFloat(document.getElementById('baseNitro').value) || 0;
           var defenseMult = 1 - ((parseFloat(document.getElementById('counterRange').value) || 0) / 100);

           var activeEmpowers = [];
           var checkedBoxes = document.querySelectorAll('.empower-checkbox:checked');
           for (var i = 0; i < checkedBoxes.length; i++) {
               if (checkedBoxes[i].checked) activeEmpowers.push(checkedBoxes[i].value);
           }

           if (activeEmpowers.indexOf('weilai') !== -1) {
               target = Math.min(target, 90);
           }
           for (var ci = 0; ci < _chipsOn.length; ci++) {
               var cdef = _chipDef(_chipsOn[ci].id);
               if (cdef && typeof cdef.ultThreshold === 'function') {
                   var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
                   var cth = cdef.ultThreshold(curCar);
                   if (cth && cth > 0) target = Math.min(target, cth);
               }
           }
           var dev = getDevice();
           var targetFirst = (dev === 'acc') ? Math.min(target, 80) : target;

           var extraNitroBase = (document.getElementById('hasExtraNitro') && document.getElementById('hasExtraNitro').checked) ? (parseFloat(document.getElementById('valExtraNitro').value) || 0) : 0;
           var extraNitroFirstVal = (document.getElementById('chkExtraNitroFirst') && document.getElementById('chkExtraNitroFirst').checked) ? extraNitroBase : 0;

           var hasExtraUlt = (document.getElementById('hasExtraUlt') && document.getElementById('hasExtraUlt').checked);
           var extraUltFirstVal = hasExtraUlt ? (parseFloat(document.getElementById('valExtraUltFirst').value) || 0) : 0;
           
           var extraPerSecBase = (document.getElementById('hasExtraPerSec') && document.getElementById('hasExtraPerSec').checked) ? (parseFloat(document.getElementById('valExtraPerSec').value) || 0) : 0;
           var extraPerSecFirstVal = (document.getElementById('chkExtraPerSecFirst') && document.getElementById('chkExtraPerSecFirst').checked) ? extraPerSecBase : 0;

           var extraEfficiency = (parseFloat(document.getElementById('extraEfficiency').value) || 0) / 100;
           var chipEff = typeof chipEffBonus === 'function' ? chipEffBonus() : 0;
           var efficiencyReduce = (parseFloat(document.getElementById('debuffRange').value) || 0) / 100;
           var efficiencyMult = ((activeEmpowers.indexOf('yichu') !== -1) ? 1.05 : 1.00) + extraEfficiency + chipEff - efficiencyReduce;

           if (efficiencyMult < 0) efficiencyMult = 0;
           var chipTriggerRes = chipAgg(defenseMult, efficiencyMult);
           var chipFirstBonus = chipTriggerRes.first || 0;
           

           var customTrigVal = parseFloat(document.getElementById('valCustomTrig').value) || 0;
           var customTrigFirstCount = parseInt(document.getElementById('customTrigFirstCount').value) || 0;

           var jiezouFirstCount = (activeEmpowers.indexOf('jiezou') !== -1) ? (parseFloat(document.getElementById('jiezou_sub_first').value) || 0) : 0;
           var huaxinFirstCount = (activeEmpowers.indexOf('huaxin') !== -1) ? (parseFloat(document.getElementById('huaxin_sub_first').value) || 0) : 0;
           
           var checkedRadio = document.querySelector('input[name="nitroRadio"]:checked');
           var selectedNitroType = checkedRadio ? checkedRadio.value : '1x5';
           var currentNitroDuration = parseFloat(document.getElementById('time_' + selectedNitroType).value) || 0;
           
           var nitroRatioMult = 1.0;
           if (selectedNitroType === '2x2' || selectedNitroType === '2x3' || selectedNitroType === '2x25') nitroRatioMult = 0.5;
           else if (selectedNitroType === '3x2') nitroRatioMult = 1/3;

            var currentBaseNitro = baseNitroInput * nitroRatioMult;
            var specBonus = document.getElementById('isSpec').checked ? (10.0 * nitroRatioMult) : 0;
            var _hnEl = document.getElementById('inputHuineng');
            // 自动反算按「没增幅」的基础上限封顶 —— 核心增幅只是把手动输入的口子放宽，
            // 不参与反算（卡片右上角显示的也还是这个基础值）
            var _maxHuineng = parseFloat(_hnEl.dataset.baseMax) || parseFloat(_hnEl.max) || 50;

            var initFixedBase = startCharge + (jiezouFirstCount * 4.0 * defenseMult);
           var initMultBase = (huaxinFirstCount * 7.0) * defenseMult * efficiencyMult;

           var firstNitrosCount = parseInt(document.getElementById('inputFirstNitroCount').value);
           if (isNaN(firstNitrosCount) || firstNitrosCount < 0) firstNitrosCount = 0;
           
           var firstDuration = firstNitrosCount * currentNitroDuration;
           var firstPerSecOutput = Math.floor(firstDuration + 0.000001) * extraPerSecFirstVal * defenseMult * efficiencyMult;
           
           var queyiPerSecond = 0;
           if (activeEmpowers.indexOf('queyi') !== -1) {
               if (document.getElementById('queyi_sub_self').checked) queyiPerSecond += 0.8;
               if (document.getElementById('queyi_sub_enemy').checked) queyiPerSecond += 1.2;
           }
           var firstQueyiOutput = Math.floor(firstDuration + 0.000001) * queyiPerSecond * defenseMult;
           var firstCustomTrigOutput = customTrigVal * customTrigFirstCount * defenseMult * efficiencyMult;
           var firstTeamDevOutput = getTeamDeviceTerms(defenseMult, efficiencyMult, firstNitrosCount, 0).first;   // 团魂获能：装置 / 队友辅助

           if (sourceField === 'xianji') {
               var xianji = parseFloat(document.getElementById('inputXianji').value) || 0;
               var netFirstUltRemain = targetFirst - initFixedBase - initMultBase - (extraUltFirstVal * defenseMult * efficiencyMult) - firstPerSecOutput - firstCustomTrigOutput - (xianji * defenseMult) - firstQueyiOutput - firstTeamDevOutput - chipFirstBonus;
               var reqHuineng = 0;
               if (currentBaseNitro > 0 && netFirstUltRemain > 0 && efficiencyMult > 0 && firstNitrosCount > 0) {
                   var neededBaseOutput = netFirstUltRemain / (defenseMult * efficiencyMult);
                   var neededPerNitro = neededBaseOutput / firstNitrosCount;
                   reqHuineng = (((neededPerNitro - specBonus - extraNitroFirstVal) / currentBaseNitro) - 1) * 100;
               } else if (efficiencyMult <= 0 && netFirstUltRemain > 0) {
                   reqHuineng = 999;
               }
               if (reqHuineng < 0) reqHuineng = 0;
                if (reqHuineng > _maxHuineng) reqHuineng = _maxHuineng;
               reqHuineng = Math.ceil(Number(reqHuineng.toFixed(4)) * 10) / 10;
               document.getElementById('inputHuineng').value = reqHuineng.toFixed(1);
           } else if (sourceField === 'huineng') {
               var huineng = parseFloat(document.getElementById('inputHuineng').value) || 0;
               var netSingleNitroOutput = (currentBaseNitro * (1 + huineng / 100) + specBonus + extraNitroFirstVal) * defenseMult * efficiencyMult;
               var firstNitroTotalOutput = firstNitrosCount * netSingleNitroOutput;
               var netRemainForXianjiFirst = targetFirst - initFixedBase - initMultBase - (extraUltFirstVal * defenseMult * efficiencyMult) - firstPerSecOutput - firstCustomTrigOutput - firstNitroTotalOutput - firstQueyiOutput - firstTeamDevOutput - chipFirstBonus;
               var reqXianji = 0;
               if (netRemainForXianjiFirst > 0) reqXianji = (netRemainForXianjiFirst / defenseMult);
               if (reqXianji < 0) reqXianji = 0;
               if (reqXianji > 30) reqXianji = 30;
               reqXianji = Math.ceil(Number(reqXianji.toFixed(4)) * 10) / 10;
               document.getElementById('inputXianji').value = reqXianji.toFixed(1);
           }
       }

       function calculate(isInit) {
           if (isRestoringConfig) return;
           var _num = function (id, minVal) {
               var el = document.getElementById(id);
               var v = el ? parseFloat(el.value) : 0;
               if (!isFinite(v) || isNaN(v)) return 0;
               return (typeof minVal === 'number' && v < minVal) ? minVal : v;
           };

           var originalTarget = parseFloat(document.getElementById('ultThreshold').value);
           if (!isFinite(originalTarget) || isNaN(originalTarget) || originalTarget <= 0) originalTarget = 100;
           var target = originalTarget;

           var startCharge = _num('startCharge', 0);
           var baseNitroInput = _num('baseNitro', 0);
           var counterPct = Math.min(100, _num('counterRange', 0));
           var defenseMult = Math.max(0, 1 - (counterPct / 100));

           var activeEmpowers = [];
           var checkedBoxes = document.querySelectorAll('.empower-checkbox:checked');
           for (var i = 0; i < checkedBoxes.length; i++) {
               if (checkedBoxes[i].checked) activeEmpowers.push(checkedBoxes[i].value);
           }

           if (activeEmpowers.indexOf('weilai') !== -1) {
                target = Math.min(target, 90);
            }
            for (var ci = 0; ci < _chipsOn.length; ci++) {
                var cdef = _chipDef(_chipsOn[ci].id);
                if (cdef && typeof cdef.ultThreshold === 'function') {
                    var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
                    var cth = cdef.ultThreshold(curCar);
                    if (cth && cth > 0) target = Math.min(target, cth);
                }
            }
            var dev = getDevice();
            var targetLoop = target;
            var targetFirst = (dev === 'acc') ? Math.min(targetLoop, 80) : targetLoop;

           var extraNitroBase = (document.getElementById('hasExtraNitro') && document.getElementById('hasExtraNitro').checked) ? (parseFloat(document.getElementById('valExtraNitro').value) || 0) : 0;
           var extraNitroFirstVal = (document.getElementById('chkExtraNitroFirst') && document.getElementById('chkExtraNitroFirst').checked) ? extraNitroBase : 0;
           var extraNitroLoopVal = (document.getElementById('chkExtraNitroLoop') && document.getElementById('chkExtraNitroLoop').checked) ? extraNitroBase : 0;

           var hasExtraUlt = (document.getElementById('hasExtraUlt') && document.getElementById('hasExtraUlt').checked);
           var extraUltFirstVal = hasExtraUlt ? (parseFloat(document.getElementById('valExtraUltFirst').value) || 0) : 0;
           var extraUltLoopVal = hasExtraUlt ? (parseFloat(document.getElementById('valExtraUltLoop').value) || 0) : 0;

           var extraPerSecBase = (document.getElementById('hasExtraPerSec') && document.getElementById('hasExtraPerSec').checked) ? (parseFloat(document.getElementById('valExtraPerSec').value) || 0) : 0;
           var extraPerSecFirstVal = (document.getElementById('chkExtraPerSecFirst') && document.getElementById('chkExtraPerSecFirst').checked) ? extraPerSecBase : 0;
           var extraPerSecLoopVal = (document.getElementById('chkExtraPerSecLoop') && document.getElementById('chkExtraPerSecLoop').checked) ? extraPerSecBase : 0;

           var extraEfficiency = (parseFloat(document.getElementById('extraEfficiency').value) || 0) / 100;
           var chipEff = typeof chipEffBonus === 'function' ? chipEffBonus() : 0;
           var efficiencyReduce = (parseFloat(document.getElementById('debuffRange').value) || 0) / 100;
           var efficiencyMult = ((activeEmpowers.indexOf('yichu') !== -1) ? 1.05 : 1.00) + extraEfficiency + chipEff - efficiencyReduce;

           if (efficiencyMult < 0) efficiencyMult = 0;
           var chipAggRes = chipAgg(defenseMult, efficiencyMult);

           var customTrigVal = parseFloat(document.getElementById('valCustomTrig').value) || 0;
           var customTrigFirstCount = parseInt(document.getElementById('customTrigFirstCount').value) || 0;
           var customTrigLoopCount = parseInt(document.getElementById('customTrigLoopCount').value) || 0;

           var baseUltDuration = parseFloat(document.getElementById('baseUltDuration').value) || 0;
           var chipDurMult = typeof chipUltDurMult === 'function' ? chipUltDurMult() : 1;
           var actualUltDuration = baseUltDuration * chipDurMult * (target / 100);
           var yijuTag = chipDurMult > 1 ? _('墨染：逸菊耗能-40%（时长×', 'Ink: Yiju -40% Cost (Dur ×') + chipDurMult.toFixed(2) + _('）', ')') : '';
           
           var ultLabel = document.getElementById('actualUltTimeSpan');
           var nextUltText = '';
           if (target < originalTarget) {
               var reason = [];
               if (activeEmpowers.indexOf('weilai') !== -1 && originalTarget > 90) reason.push(_('未来视界', 'Future Vision'));
               for (var ci = 0; ci < _chipsOn.length; ci++) {
                   var cdef = _chipDef(_chipsOn[ci].id);
                   if (cdef && typeof cdef.ultThreshold === 'function') {
                       var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
                       if (cdef.ultThreshold(curCar) === target) reason.push(cdef.name[currentLang === 'en' ? 'en' : 'zh'] || cdef.id);
                   }
               }
               var reasonStr = reason.length > 0 ? (reason.join('+') + _('生效：', ' Active: ')) : '';
               nextUltText = _("（", " (") + reasonStr + _("阈值降为 ", "Threshold lowered to ") + target + "%" + (yijuTag ? _("，", ", ") + yijuTag : "") + _("，实际时长折算为: ", ", actual scaled to: ") + actualUltDuration.toFixed(2) + _(" 秒）", " s)");
           } else if (activeEmpowers.indexOf('weilai') !== -1) {
               nextUltText = _("（未来视界未降低：当前阈值已达标", " (Future Vision inactive: Threshold met") + (yijuTag ? _("，", ", ") + yijuTag : "") + _("，实际时长为: ", ", actual duration: ") + actualUltDuration.toFixed(2) + _(" 秒）", " s)");
           } else {
               if (target !== 100) nextUltText = _("（当前阈值 ", " (Current threshold ") + target + "%" + (yijuTag ? _("，", ", ") + yijuTag : "") + _("，实际时长折算为: ", ", scaled to: ") + actualUltDuration.toFixed(2) + _(" 秒）", " s)");
               else if (yijuTag) nextUltText = _("（", " (") + yijuTag + _("，实际时长折算为: ", ", actual scaled to: ") + actualUltDuration.toFixed(2) + _(" 秒）", " s)");
               else nextUltText = '';
           }
           if (ultLabel && (ultLabel._targetText !== undefined ? ultLabel._targetText : ultLabel.textContent) !== nextUltText) {
               var prevUltTarget = ultLabel._targetText !== undefined ? ultLabel._targetText : ultLabel.textContent;
               ultLabel._targetText = nextUltText;
               if (ultLabel._leaveTimer) { clearTimeout(ultLabel._leaveTimer); ultLabel._leaveTimer = null; }
               var canAnimUlt = !isRestoringConfig && typeof _motionOK === 'function' && _motionOK() && !document.body.classList.contains('calc-boot');
               if (!canAnimUlt) {
                   ultLabel.classList.remove('is-entering', 'is-leaving', 'is-updating-a', 'is-updating-b');
                   ultLabel.textContent = nextUltText;
               } else if (!nextUltText) {
                   ultLabel.classList.remove('is-entering', 'is-updating-a', 'is-updating-b');
                   ultLabel.classList.add('is-leaving');
                   ultLabel._leaveTimer = setTimeout(function () {
                       ultLabel._leaveTimer = null;
                       if (!ultLabel._targetText) {
                           ultLabel.textContent = '';
                           ultLabel.classList.remove('is-leaving');
                       }
                   }, 200);
               } else if (!prevUltTarget || ultLabel.classList.contains('is-leaving')) {
                   ultLabel.textContent = nextUltText;
                   ultLabel.classList.remove('is-leaving', 'is-updating-a', 'is-updating-b');
                   ultLabel.classList.add('is-entering');
               } else {
                   ultLabel.textContent = nextUltText;
                   var nowUlt = performance.now();
                   if (!ultLabel._lastUpd || nowUlt - ultLabel._lastUpd > 140) {
                       ultLabel._lastUpd = nowUlt;
                       ultLabel.classList.remove('is-entering', 'is-leaving');
                       var useUltB = ultLabel.classList.contains('is-updating-a');
                       ultLabel.classList.remove(useUltB ? 'is-updating-a' : 'is-updating-b');
                       ultLabel.classList.add(useUltB ? 'is-updating-b' : 'is-updating-a');
                   }
               }
           }

           var checkedRadio = document.querySelector('input[name="nitroRadio"]:checked');
           var selectedNitroType = checkedRadio ? checkedRadio.value : '1x5';
           var currentNitroDuration = 0;

           if (selectedNitroType === '1x5') currentNitroDuration = parseFloat(document.getElementById('time_1x5').value) || 0;
           else if (selectedNitroType === '1x6') currentNitroDuration = parseFloat(document.getElementById('time_1x6').value) || 0;
           else if (selectedNitroType === '2x2') currentNitroDuration = parseFloat(document.getElementById('time_2x2').value) || 0;
           else if (selectedNitroType === '2x3') currentNitroDuration = parseFloat(document.getElementById('time_2x3').value) || 0;
           else if (selectedNitroType === '2x25') currentNitroDuration = parseFloat(document.getElementById('time_2x25').value) || 0;
           else if (selectedNitroType === '3x2') currentNitroDuration = parseFloat(document.getElementById('time_3x2').value) || 0;

           var nitroRatioMult = 1.0;
           if (selectedNitroType === '2x2' || selectedNitroType === '2x3' || selectedNitroType === '2x25') nitroRatioMult = 0.5;
           else if (selectedNitroType === '3x2') nitroRatioMult = 1/3;

           var currentBaseNitro = baseNitroInput * nitroRatioMult;
           var specBonus = document.getElementById('isSpec').checked ? (10.0 * nitroRatioMult) : 0;

           var autoNitrosPerUlt = currentNitroDuration > 0 ? Math.floor((actualUltDuration / currentNitroDuration) + 0.000001) : 0;
           var nitrosPerUlt;
           
           if (isManualNitroCount) {
               nitrosPerUlt = parseInt(document.getElementById('inputNitroCount').value);
               if (isNaN(nitrosPerUlt) || nitrosPerUlt < 0) nitrosPerUlt = 0;
           } else {
               nitrosPerUlt = autoNitrosPerUlt;
               var nitroInputElem = document.getElementById('inputNitroCount');
               if (nitroInputElem) nitroInputElem.value = nitrosPerUlt;
           }

           var firstNitrosCount = parseInt(document.getElementById('inputFirstNitroCount').value);
           if (isNaN(firstNitrosCount) || firstNitrosCount < 0) firstNitrosCount = 0;

           updateSoulHint(typeof deferRender !== 'undefined' ? deferRender : (!(typeof isInit !== 'undefined' && (isInit === true || (!_selectedCar && !_userInput))) && getCalcMode() === 'team'));
           updateDevLoopHint(actualUltDuration);
           renderSupportSource();

           if (isInit === true || (!_selectedCar && !_userInput)) return;   // 没选车、也没动过任何数值：保持「等待测算」，别一进站就先甩一组数
           if (getCalcMode() === 'team') _tmSolve();   // 团魂获能：先把没锁的那几个值反算好，下面读到的就是反算后的数

           var queyiPerSecond = 0;
           if (activeEmpowers.indexOf('queyi') !== -1) {
               if (document.getElementById('queyi_sub_self').checked) queyiPerSecond += 0.8;
               if (document.getElementById('queyi_sub_enemy').checked) queyiPerSecond += 1.2;
           }
           
           var huaxinFirstCount = (activeEmpowers.indexOf('huaxin') !== -1) ? (parseFloat(document.getElementById('huaxin_sub_first').value) || 0) : 0;
           var huaxinLoopCount = (activeEmpowers.indexOf('huaxin') !== -1) ? (parseFloat(document.getElementById('huaxin_sub_loop').value) || 0) : 0;
           
           var fusuTotalBonus = (activeEmpowers.indexOf('fusu') !== -1) ? (2.5 * 5.0) : 0;
           var huishouBonus = (activeEmpowers.indexOf('huishou') !== -1) ? 10.0 : 0;
           
           var jiezouFirstCount = (activeEmpowers.indexOf('jiezou') !== -1) ? (parseFloat(document.getElementById('jiezou_sub_first').value) || 0) : 0;
           var jiezouLoopCount = (activeEmpowers.indexOf('jiezou') !== -1) ? (parseFloat(document.getElementById('jiezou_sub_loop').value) || 0) : 0;

           var resCardFirst = document.getElementById('resultCardFirst');
           var resValFirst = document.getElementById('resultValueFirst');
           var resDetFirst = document.getElementById('resultDetailFirst');
           var formulaFirst = document.getElementById('formulaDisplayFirst');

           var resCardLoop = document.getElementById('resultCardLoop');
           var resValLoop = document.getElementById('resultValueLoop');
           var resDetLoop = document.getElementById('resultDetailLoop');
           var formulaLoop = document.getElementById('formulaDisplayLoop');
           
           resCardFirst.classList.remove('error-state');
           resCardLoop.classList.remove('error-state');

           var initMultBase = (huaxinFirstCount * 7.0) * defenseMult * efficiencyMult;

           var xianji = parseFloat(document.getElementById('inputXianji').value) || 0;
           var huineng = parseFloat(document.getElementById('inputHuineng').value) || 0;

           var netSingleNitroOutputFirst = (currentBaseNitro * (1 + huineng / 100) + specBonus + extraNitroFirstVal) * defenseMult * efficiencyMult;
           var firstNitroTotalOutput = firstNitrosCount * netSingleNitroOutputFirst;
           
           var firstDuration = firstNitrosCount * currentNitroDuration;
           var firstPerSecOutput = Math.floor(firstDuration + 0.000001) * extraPerSecFirstVal * defenseMult * efficiencyMult;
           var firstQueyiOutput = Math.floor(firstDuration + 0.000001) * queyiPerSecond * defenseMult;
           
           var firstUltTotal = startCharge + (xianji * defenseMult) + initMultBase + (jiezouFirstCount * 4.0 * defenseMult) + firstNitroTotalOutput + firstPerSecOutput + firstQueyiOutput;
           // 团魂获能：增益装置 / 队友辅助的额外能量（首发与循环各一份；其他模式为 0）
           var tdx = getTeamDeviceTerms(defenseMult, efficiencyMult, firstNitrosCount, nitrosPerUlt);

           var step1_Start = startCharge.toFixed(3);
           var step2_Xianji = (xianji * defenseMult).toFixed(3);
           var step3_MultBase = initMultBase.toFixed(3);
           var step4_Jiezou = (jiezouFirstCount * 4.0 * defenseMult).toFixed(3);
           var step5_Nitro = firstNitroTotalOutput.toFixed(3);

           var formulaFirstStr = "<b>" + _("【首发大招运算解析盒】", "[First Ult Calc Breakdown]") + "</b><br>";
           var firstTargetNote = dev === 'acc' ? _("（加速装置 80%）", " (Accel Device 80%)") : (targetFirst < originalTarget ? _("（降阈生效）", " (Threshold Reduced)") : "");
           formulaFirstStr += _("及格线目标：", "Passing Target: ") + "<b>" + targetFirst + "%</b>" + firstTargetNote + "<br><br>";
           formulaFirstStr += _("① 起步充能 = ", "1. Start Charge = ") + "<b>" + step1_Start + "</b><br>";
           formulaFirstStr += _("② 先机收益：[先机(", "2. Xianji Gain: [Xianji(") + xianji + _(")] × (1-反制％)(", ")] * (1-Counter%)(") + _d(defenseMult) + ") = <b>" + step2_Xianji + "</b><br>";
           formulaFirstStr += _("③ 复合增益：[花信风(触发", "3. Compound Buff: [Floral(Triggers ") + huaxinFirstCount + _("次×7%)] × (1-反制％) × 充能效率(", " times*7%)] * (1-Counter%) * Eff(") + (efficiencyMult*100).toFixed(0) + "%) = <b>" + step3_MultBase + "</b><br>";
           formulaFirstStr += _("④ 节奏自充：[首发触发", "4. Rhythm Charge: [1st Triggers ") + jiezouFirstCount + _("次(+4%)] × (1-反制％) = ", " times(+4%)] * (1-Counter%) = ") + "<b>" + step4_Jiezou + "</b><br>";
           formulaFirstStr += _("⑤ 期间氮充：[单发威力(", "5. Nitro Charge: [Single Power(") + netSingleNitroOutputFirst.toFixed(3) + _(")] × <b>", ")] * <b>") + firstNitrosCount + _("</b>个 = <b>", "</b> = <b>") + step5_Nitro + "</b><br>";
           
           if (firstQueyiOutput > 0) {
               formulaFirstStr += _("⑥ 缺一不可：[每秒(", "6. Indispensable: [Per sec(") + queyiPerSecond + _(") × 整数时长(", ") * Int Duration(") + Math.floor(firstDuration + 0.000001) + _("s)] × (1-反制％) = <b>", "s)] * (1-Counter%) = <b>") + firstQueyiOutput.toFixed(3) + "</b><br>";
           }
           if (extraUltFirstVal > 0) {
               var step7_ExtraUlt = (extraUltFirstVal * defenseMult * efficiencyMult).toFixed(3);
               formulaFirstStr += _("⑦ 大招固定附加：[设定附加(", "7. Ult Fixed Bonus: [Set Bonus(") + extraUltFirstVal + _(")] × (1-反制％) × 充能效率(", ")] * (1-Counter%) * Eff(") + (efficiencyMult*100).toFixed(0) + "%) = <b>" + step7_ExtraUlt + "</b><br>";
               firstUltTotal += extraUltFirstVal * defenseMult * efficiencyMult;
           }
           
           if (extraPerSecFirstVal > 0) {
               var step8_ExtraPerSec = firstPerSecOutput.toFixed(3);
               formulaFirstStr += _("⑧ 持续每秒附加：[每秒(", "8. Per Sec Bonus: [Per sec(") + extraPerSecFirstVal + _(") × 整数时长(", ") * Int Duration(") + Math.floor(firstDuration + 0.000001) + _("s)] × (1-反制％) × 充能效率(", "s)] * (1-Counter%) * Eff(") + (efficiencyMult*100).toFixed(0) + "%) = <b>" + step8_ExtraPerSec + "</b><br>";
           }

           var firstCustomTrigOutput = customTrigVal * customTrigFirstCount * defenseMult * efficiencyMult;
           if (customTrigFirstCount > 0) {
               var step9_CustomTrig = firstCustomTrigOutput.toFixed(3);
               formulaFirstStr += _("⑨ 自定义触发自充：[触发(", "9. Custom Trigger: [Trig(") + customTrigFirstCount + _("次 × ", " times × ") + customTrigVal + _("%)] × (1-反制％) × 充能效率(", "%)] * (1-Counter%) * Eff(") + (efficiencyMult*100).toFixed(0) + "%) = <b>" + step9_CustomTrig + "</b><br>";
               firstUltTotal += firstCustomTrigOutput;
           }

           var stepDevFirst = '', stepTeamFirst = '';
           if (tdx.dev === 'loop') {
               stepDevFirst = tdx.devLoopFirst.toFixed(3);
               formulaFirstStr += _("⑩ 循环装置：[每次用氮 13% × <b>", "10. Loop Device: [13% per nitro × <b>") + firstNitrosCount + _("</b>次]（固定值）= <b>", "</b>] (fixed) = <b>") + stepDevFirst + "</b><br>";
               firstUltTotal += tdx.devLoopFirst;
           } else if (tdx.devBase > 0) {
               stepDevFirst = tdx.devFirst.toFixed(3);
               formulaFirstStr += assistFormulaLine(_("⑩ ", "10. "), deviceName(tdx.dev), tdx.devBase, 1, tdx.soul, defenseMult, efficiencyMult, tdx.devFirstCount, tdx.devFirst);
               firstUltTotal += tdx.devFirst;
           } else if (tdx.teamOn) {
               stepTeamFirst = tdx.teamFirst.toFixed(3);
               formulaFirstStr += assistFormulaLine(_("⑩ ", "10. "), _("队友辅助", "Ally Assist"), tdx.teamBase, tdx.teamCore, tdx.soul, defenseMult, efficiencyMult, tdx.teamFirstCount, tdx.teamFirst, tdx.teamFull);
               firstUltTotal += tdx.teamFirst;
           }

           if (chipAggRes.first > 0) {
               formulaFirstStr += _("⑪ 特殊芯片首发充能：+", "11. Special Chip 1st Ult: +") + chipAggRes.first.toFixed(3) + "%<br>";
               firstUltTotal += chipAggRes.first;
           }
           firstUltTotal = Math.floor(firstUltTotal * 1000 + 0.000001) / 1000;
           // 对账：团魂反算用的是 _tmFirst()（同一套公式的纯函数版）。两边对不上说明有人只改了一边
           if (tdx.mode === 'team') { var _tmE = _chipEnv(), _tmF = _tmFirst(_tmE, xianji, huineng, tdx.soul); if (Math.abs(_tmF - firstUltTotal) > 0.0005) console.warn('[团魂反算] 首发公式与 calculate() 不一致', _tmF, firstUltTotal); }

           // 情报站「首个大招所需氮气」：其他条件不变，最少几个氮气能首发（逐个氮气试算，与上面同一套公式）
           var firstTotalAt = function (n) {
               var dur = Math.floor(n * currentNitroDuration + 0.000001);
               var t = startCharge + (xianji * defenseMult) + initMultBase + (jiezouFirstCount * 4.0 * defenseMult)
                   + n * netSingleNitroOutputFirst
                   + dur * extraPerSecFirstVal * defenseMult * efficiencyMult
                   + dur * queyiPerSecond * defenseMult
                   + (extraUltFirstVal > 0 ? extraUltFirstVal * defenseMult * efficiencyMult : 0)
                   + (customTrigFirstCount > 0 ? firstCustomTrigOutput : 0)
                   + (tdx.dev === 'loop' ? DEVICE_LOOP_PER_NITRO * n : 0) + tdx.devFirst + tdx.teamFirst + (chipAggRes.first || 0);
               return Math.floor(t * 1000 + 0.000001) / 1000;
           };
           var minFirstNitros = -1;
           for (var mn = 0; mn <= 30; mn++) { if (firstTotalAt(mn) >= targetFirst) { minFirstNitros = mn; break; } }

           formulaFirstStr += "-------------------------<<br>";
            formulaFirstStr += "<b>" + _("及格线判定：当前产出(", "Passing Check: Output(") + firstUltTotal.toFixed(3) + _(")  vs  首发大招阀门(", ") vs 1st Ult Valve(") + targetFirst + "%" + (dev === 'acc' ? _("（加速装置80%）", " (Accel Device 80%)") : "") + ")</b><br>";
           formulaFirstStr += "<b>" + _("首发核算：", "First Ult Calc: ") + step1_Start + " + " + step2_Xianji + " + " + step3_MultBase + " + " + step4_Jiezou + " + " + step5_Nitro + (firstQueyiOutput > 0 ? " + " + firstQueyiOutput.toFixed(3) : "") + (extraUltFirstVal > 0 ? " + " + step7_ExtraUlt : "") + (extraPerSecFirstVal > 0 ? " + " + step8_ExtraPerSec : "") + (customTrigFirstCount > 0 ? " + " + step9_CustomTrig : "") + (stepDevFirst ? " + " + stepDevFirst : "") + (stepTeamFirst ? " + " + stepTeamFirst : "") + (chipAggRes.first > 0 ? " + " + chipAggRes.first.toFixed(3) : "") + " = " + firstUltTotal.toFixed(3) + "%</b>";
           formulaFirst.innerHTML = formulaFirstStr;

           if (firstUltTotal >= targetFirst) {
               resValFirst.innerHTML = "<span class='emoji-fix'>✅</span> " + _("首发达成 (", "1st Ult Achieved (") + firstUltTotal.toFixed(3) + "%)";
               var _detFirstHtml = "✨ <b>" + _("完美起步", "Perfect Start") + "</b>" + _("：总充能已超越目标！", ": Charge exceeds target!")
                   + (minFirstNitros >= 0 && minFirstNitros < firstNitrosCount ? "<span class='pv-need'>" + _("其他条件不变，其实 ", "Other things equal, just ") + "<b>" + minFirstNitros + "</b>" + _(" 个氮气就能首发。", " nitro(s) would do.") + "</span>" : "");
           } else {
               resCardFirst.classList.add('error-state');
               resValFirst.innerHTML = "<span class='emoji-fix'>❌</span> " + _("首发失败 (", "1st Ult Failed (") + firstUltTotal.toFixed(3) + "%)";
               
               var firstDiff = Math.floor((targetFirst - firstUltTotal) * 1000 + 0.000001) / 1000;
               var _detFirstHtml = "⚠️ <b>" + _("开局卡壳", "Start Stalled") + "</b>" + _("：距离及格还差 ", ": Short of passing by ") + "<b>" + firstDiff.toFixed(3) + "%</b>" + _("。", ".")
                   + "<span class='pv-need'>" + (minFirstNitros >= 0
                       ? _("其他条件不变，需要 ", "Other things equal, it takes ") + "<b>" + minFirstNitros + "</b>" + _(" 个氮气才能首发（当前填 ", " nitros to open (now ") + firstNitrosCount + _(" 个）。", ").")
                       : _("其他条件不变，30 个氮气以内都无法首发（反算最多只试到 30 个）。", "Other things equal, no first ult within 30 nitros (the solver only tries up to 30).")) + "</span>";
           }

           var loopFixedEmpowerBase = (queyiPerSecond * Math.floor(actualUltDuration + 0.000001) + fusuTotalBonus + huishouBonus + jiezouLoopCount * 4.0);
           var loopFixedEmpower = loopFixedEmpowerBase * defenseMult;
           var loopHuaxinOutput = (huaxinLoopCount * 7.0) * defenseMult * efficiencyMult;
           var netSingleNitroOutputLoop = (currentBaseNitro * (1 + huineng / 100) + specBonus + extraNitroLoopVal) * defenseMult * efficiencyMult;
           var loopNitroTotalOutput = nitrosPerUlt * netSingleNitroOutputLoop;
           var loopExtraUltOutput = extraUltLoopVal * defenseMult * efficiencyMult;
           var loopPerSecOutput = Math.floor(actualUltDuration + 0.000001) * extraPerSecLoopVal * defenseMult * efficiencyMult;
           var loopCustomTrigOutput = customTrigVal * customTrigLoopCount * defenseMult * efficiencyMult;
           
           var loopGrandTotal = loopFixedEmpower + loopHuaxinOutput + loopNitroTotalOutput + loopExtraUltOutput + loopPerSecOutput + loopCustomTrigOutput + tdx.loop + (chipAggRes.loop || 0);

           loopGrandTotal = Math.floor(loopGrandTotal * 1000 + 0.000001) / 1000;
           // 团魂获能：循环吃不吃团魂、循环至少要多少团魂（整数，上限 200）—— 循环卡的提示改用团魂来说
           var _tmSoulDep = false, _tmSL = null;
           if (tdx.mode === 'team') {
               var _tmL = _tmLoop(_tmE, huineng, tdx.soul);
               if (Math.abs(_tmL - loopGrandTotal) > 0.0005) console.warn('[团魂反算] 循环公式与 calculate() 不一致', _tmL, loopGrandTotal);
               _tmSoulDep = _tmLoop(_tmE, huineng, SOUL_MAX) > _tmLoop(_tmE, huineng, 0);
               if (_tmSoulDep) _tmSL = _gridMin(0, SOUL_MAX, 1, function (v) { return _tmLoop(_tmE, huineng, v) >= target; });
           }
           // 团魂还在自动反算时，手填汇能会让团魂按首发重算（往下掉）：汇能的建议值要按这个来，填进去才真的够循环
           var _tmHL;
           if (tdx.mode === 'team' && _tmSoulDep && !_tmE.na && !_tm.lock.soul && loopGrandTotal < target)
               _tmHL = _tmSuggest(_tmE, 'huineng', _tmCur(), function (st) { return _tmLoop(_tmE, st.h, st.s) >= target; });
           var _reqLine = document.getElementById('loopReqLine');
           if (_reqLine) {
               var _rq = tdx.mode !== 'team' ? _("先机要求：0% (起步后先机芯片对循环彻底失效)", "Xianji req: 0% (Ineffective in loop)")
                   : _tmSoulDep ? (_tmSL !== null ? _("团魂要求：循环至少 ", "Team Soul req: the loop needs ") + _tmSL + _("%（团魂同时放大首发与循环）", "% (Soul boosts both the 1st ult and the loop)")
                                                  : _("团魂要求：拉到上限 ", "Team Soul req: even the ") + SOUL_MAX + _("% 循环也不够", "% cap can’t hold the loop"))
                   : _("团魂要求：不适用（循环里没有受团魂影响的能量）", "Team Soul req: N/A (nothing in the loop scales with Soul)");
               if (_reqLine.textContent !== _rq) _morphInlineBox(_reqLine, _rq);
           }

           var reqHuinengLoop = 0;
           if (nitrosPerUlt > 0 && efficiencyMult > 0 && defenseMult > 0 && currentBaseNitro > 0) {
               var remainForLoopUlt = target - loopFixedEmpower - loopHuaxinOutput - loopExtraUltOutput - loopPerSecOutput - loopCustomTrigOutput - tdx.loop - (chipAggRes.loop || 0);
               var singleNeeded = remainForLoopUlt / nitrosPerUlt;
               var baseNeeded = singleNeeded / (defenseMult * efficiencyMult);
               reqHuinengLoop = (((baseNeeded - specBonus - extraNitroLoopVal) / currentBaseNitro) - 1) * 100;
           } else {
               reqHuinengLoop = 999;
           }
           
           reqHuinengLoop = Math.floor(reqHuinengLoop * 1000 + 0.000001) / 1000;

           var stepLoop_Empower = loopFixedEmpower.toFixed(3);
           var stepLoop_Huaxin = loopHuaxinOutput.toFixed(3);
           var stepLoop_Nitro = loopNitroTotalOutput.toFixed(3);
           var stepLoop_ExtraUlt = loopExtraUltOutput.toFixed(3);

           var formulaLoopStr = "<b>" + _("【大招循环运算解析盒】", "[Ult Loop Calc Breakdown]") + "</b><br>";
           formulaLoopStr += _("大招实机时长 = ", "Actual Ult = ") + actualUltDuration.toFixed(2) + _("秒", "s")
               + (chipDurMult > 1.0001 ? (_("（含逸菊耗能-40% ×", " (Ink -40% cost ×") + chipDurMult.toFixed(2) + _("）", ")")) : "")
               + _(" (容纳 <b>", " (fits <b>") + nitrosPerUlt + _("</b> 个单次氮气)<br><br>", "</b> single nitros)<br><br>");
           formulaLoopStr += _("① 绝对自充：[缺一(", "1. Absolute Charge: [Indispensable(") + (queyiPerSecond * Math.floor(actualUltDuration + 0.000001)).toFixed(2) + _(") + 复苏(", ") + Recovery(") + fusuTotalBonus + _(") + 回收(", ") + Recycle(") + huishouBonus + _(") + 节奏(", ") + Rhythm(") + (jiezouLoopCount * 4.0) + _(")] × (1-反制％) = <b>", ")] * (1-Counter%) = <b>") + stepLoop_Empower + "</b><br>";
           formulaLoopStr += _("② 复合自充：[花信风(大招内触发", "2. Compound Charge: [Floral(Ult Triggers ") + huaxinLoopCount + _("次×7%)] × (1-反制％) × 充能效率 = <b>", " times*7%)] * (1-Counter%) * Eff = <b>") + stepLoop_Huaxin + "</b><br>";
           formulaLoopStr += _("③ 期间氮充：[单发威力(", "3. Nitro Charge: [Single Power(") + (netSingleNitroOutputLoop).toFixed(3) + _(")] × <b>", ")] * <b>") + nitrosPerUlt + _("</b>个 = <b>", "</b> = <b>") + stepLoop_Nitro + "</b><br>";
           if (extraUltLoopVal > 0) {
               formulaLoopStr += _("④ 大招固定附加：[设定附加(", "4. Ult Fixed Bonus: [Set Bonus(") + extraUltLoopVal + _(")] × (1-反制％) × 充能效率(", ")] * (1-Counter%) * Eff(") + (efficiencyMult*100).toFixed(0) + "%) = <b>" + stepLoop_ExtraUlt + "</b><br>";
           }
           if (extraPerSecLoopVal > 0) {
               var stepLoop_ExtraPerSec = loopPerSecOutput.toFixed(3);
               formulaLoopStr += _("⑤ 持续每秒附加：[每秒(", "5. Per Sec Bonus: [Per sec(") + extraPerSecLoopVal + _(") × 整数时长(", ") * Int Duration(") + Math.floor(actualUltDuration + 0.000001) + _("s)] × (1-反制％) × 充能效率(", "s)] * (1-Counter%) * Eff(") + (efficiencyMult*100).toFixed(0) + "%) = <b>" + stepLoop_ExtraPerSec + "</b><br>";
           }
           if (customTrigLoopCount > 0) {
               var stepLoop_CustomTrig = loopCustomTrigOutput.toFixed(3);
               formulaLoopStr += _("⑥ 自定义触发自充：[触发(", "6. Custom Trigger: [Trig(") + customTrigLoopCount + _("次 × ", " times × ") + customTrigVal + _("%)] × (1-反制％) × 充能效率(", "%)] * (1-Counter%) * Eff(") + (efficiencyMult*100).toFixed(0) + "%) = <b>" + stepLoop_CustomTrig + "</b><br>";
           }
           var stepLoop_Dev = '', stepLoop_Team = '', stepLoop_Chip = '';
           if (tdx.dev === 'loop') {
               stepLoop_Dev = tdx.devLoopLoop.toFixed(3);
               formulaLoopStr += _("⑦ 循环装置：[每次用氮 13% × <b>", "7. Loop Device: [13% per nitro × <b>") + nitrosPerUlt + _("</b>次]（固定值）= <b>", "</b>] (fixed) = <b>") + stepLoop_Dev + "</b><br>";
           } else if (tdx.devBase > 0) {
               stepLoop_Dev = tdx.devLoop.toFixed(3);
               formulaLoopStr += assistFormulaLine(_("⑦ ", "7. "), deviceName(tdx.dev), tdx.devBase, 1, tdx.soul, defenseMult, efficiencyMult, tdx.devLoopCount, tdx.devLoop);
           } else if (tdx.teamOn) {
               stepLoop_Team = tdx.teamLoop.toFixed(3);
               formulaLoopStr += assistFormulaLine(_("⑦ ", "7. "), _("队友辅助", "Ally Assist"), tdx.teamBase, tdx.teamCore, tdx.soul, defenseMult, efficiencyMult, tdx.teamLoopCount, tdx.teamLoop, tdx.teamFull);
           }
           if (chipAggRes.loop > 0) {
               stepLoop_Chip = chipAggRes.loop.toFixed(3);
               formulaLoopStr += _("⑧ 特殊芯片循环充能：+", "8. Special Chip Loop: +") + stepLoop_Chip + "%<br>";
           }
           formulaLoopStr += "-------------------------<<br>";
           formulaLoopStr += "<b>" + _("循环总产出：", "Loop Total Output: ") + stepLoop_Empower + " + " + stepLoop_Huaxin + " + " + stepLoop_Nitro + (extraUltLoopVal > 0 ? " + " + stepLoop_ExtraUlt : "") + (extraPerSecLoopVal > 0 ? " + " + stepLoop_ExtraPerSec : "") + (customTrigLoopCount > 0 ? " + " + stepLoop_CustomTrig : "") + (stepLoop_Dev ? " + " + stepLoop_Dev : "") + (stepLoop_Team ? " + " + stepLoop_Team : "") + (stepLoop_Chip ? " + " + stepLoop_Chip : "") + " = " + loopGrandTotal.toFixed(3) + "%</b><br>";
           formulaLoopStr += "<b>" + _("及格线判定：当前产出(", "Passing Check: Output(") + loopGrandTotal.toFixed(3) + _(")  vs  大招阀门(", ") vs Ult Valve(") + targetLoop + "%)</b>";
           formulaLoop.innerHTML = formulaLoopStr;

           if (loopGrandTotal >= targetLoop) {
               resValLoop.innerHTML = "<span class='emoji-fix'>✅</span> " + _("循环跑通 (产出: ", "Loop Completed (Output: ") + loopGrandTotal.toFixed(3) + "%)";
               var diff = huineng - reqHuinengLoop;
               if (diff >= 0) {
                   var _detLoopHtml = "<span style='color:var(--success);'><span class='emoji-fix'>✅</span> <b>" + _("全盘跑通", "Fully Completed") + "</b>" + (_tmSoulDep && _tmSL !== null
                       ? _("：当前团魂（", ": Current Team Soul (") + tdx.soul + _("%）达到循环底线（底线：团魂 ", "%) meets the loop baseline (Baseline: Soul ") + _tmSL + _("%），火力倾泻不断档！", "%), continuous firepower!")
                       : _("：当前输入的汇能（", ": Current Huineng input (") + huineng.toFixed(1) + _("%）超过循环底线（底线：", "%) exceeds loop baseline (Baseline: ") + Math.max(0, reqHuinengLoop).toFixed(3) + _("%），火力倾泻不断档！", "%), continuous firepower!")) + "</span>";
               } else {
                   var _detLoopHtml = "<span style='color:var(--warning);'>⚠️ <b>" + _("逻辑异常", "Logic Anomaly") + "</b>" + _("：虽然满足了阈值，但这应该是极端情况的浮点漂移。", ": Met threshold, likely float drift.") + "</span>";
               }
           } else {
               resCardLoop.classList.add('error-state');
               if (nitrosPerUlt === 0) {
                   resValLoop.innerHTML = "<span class='emoji-fix'>❌</span> " + _("循环崩塌 (容纳氮气数为0)", "Loop Collapsed (0 nitros fit)");
                   var _detLoopHtml = "⚠️ <b>" + _("致命断层", "Fatal Gap") + "</b>" + _("：缩减后的大招期间", ": Reduced Ult fits ") + "<b>" + _("可放氮气数为 0 个", "0 nitros") + "</b>"
                       + (_tmSL !== null ? _("，汇能帮不上忙；团魂至少要 ", " — Huineng can't help; Team Soul needs at least ") + "<strong>" + _tmSL + "%</strong>" + _("。", ".") : _("。接力必然溃败！", ". Relay will fail!"));
               } else {
                   var loopDiff = Math.floor((targetLoop - loopGrandTotal) * 1000 + 0.000001) / 1000;
                   resValLoop.innerHTML = "<span class='emoji-fix'>❌</span> " + _("循环失败 (缺口: ", "Loop Failed (Gap: ") + loopDiff.toFixed(3) + "%)";
                   var _detLoopHtml = "⚠️ <b>" + _("循环断档", "Loop Disconnected") + "</b>" + (_tmSoulDep
                       ? (_tmSL !== null ? _("：产出未达及格线！要实现连发，团魂至少要提到 ", ": Output missed! Needs Team Soul >= ") + "<strong>" + _tmSL + "%</strong>" + (_tmHL === null ? "" : _("，或汇能至少拉升至 ", ", or Huineng >= "))
                                         : _("：产出未达及格线！团魂拉到上限 ", ": Output missed! Even the ") + SOUL_MAX + _("% 也补不上，汇能至少需要被拉升至 ", "% Team Soul cap falls short; needs Huineng >= "))
                         + (_tmHL === undefined ? "<strong>" + reqHuinengLoop.toFixed(3) + "%</strong>" + _("。", ".")
                            : _tmHL === null ? _("（汇能拉满也补不上）", " (even maxed Huineng falls short)") + _("。", ".")
                            : "<strong>" + _tmHL.toFixed(1) + "%</strong>" + _("（团魂会按首发自动重算）", " (Soul re-solves for the 1st ult)") + _("。", "."))
                       : _("：产出未达及格线！要实现连发，汇能至少需要被拉升至 ", ": Output missed! Needs Huineng >= ") + "<strong>" + reqHuinengLoop.toFixed(3) + "%</strong>" + _("。", "."));
               }
           }

           // 开 / 关增益装置会让两张结果卡的内容整块换掉（解析盒行数、状态胶囊都变），高度是瞬变的：
            // 用 _flipHeight 把这段高度差补成过渡，免得下方卡片的位移在收放动画里突然顿一下
            _morphInlineBox(resDetFirst, _detFirstHtml, function () { if (window.__stripLeadEmoji) window.__stripLeadEmoji(resDetFirst); });
            _morphInlineBox(resDetLoop, _detLoopHtml, function () { if (window.__stripLeadEmoji) window.__stripLeadEmoji(resDetLoop); });
            renderChain(firstUltTotal, loopGrandTotal, targetFirst, xianji, huineng, tdx, targetLoop, chipAggRes);   // 开局连发：一大 → 二大 → 三大
            if (window.__flipTeamCards) {
                var _rtA = document.getElementById('teamInSum'), _rtB = document.getElementById('resultCardSupport');
                _flipHeight(_rtA, function () {
                    _flipHeight(_rtB, function () { renderTeamPanels(tdx, defenseMult, efficiencyMult, target); });
                });
            } else {
                renderTeamPanels(tdx, defenseMult, efficiencyMult, target);
            }
       }

       /* ======================================================================
          计算模式：先机汇能（solo）/ 团魂获能（team）/ 辅助供能（support）
          - 模式只决定「显示哪些区块、额外算哪些项」，首发 / 循环仍是同一套 calculate()。
          - 新增能量都按本站同一套乘法折算：基础 × (1 − 反制) × 充能效率（固定值项除外）。
          - 增益装置只在团魂获能里出现，且与队友辅助二选一（单人竞速 / 组队竞速 / 巅峰赛没有辅助队友）；
            这三种模式也没有反制和赋能，所以装上装置时反制卡、赋能卡一起锁住。
          - 团魂获能里，先机 / 汇能两个输入框（连同联动状态条、上限徽标）搬到团魂旁边；离开该模式时搬回原处。
          ====================================================================== */
       var CALC_MODES = ['solo', 'team', 'support'];
       var DEVICE_TYPES = ['loop', 'chg', 'schg', 'acc'];
       var DEVICE_CHARGE = { chg: 34, schg: 48 };     // 充能 / 超级充能装置：每次触发的辅助充能
       var DEVICE_LOOP_PER_NITRO = 13;                 // 循环装置：每次使用氮气固定 +13%
       var ASSIST_CORE_MULT = 1.3;                     // 辅助核心：辅助充能 ×1.3
       var _devState = '';                             // 当前装备的装置（onchange 时复选框已变，「之前」只能从这里取）
       var _devSavedEnv = null;                        // 锁定前的反制 / 降效（解锁时还原）
       var _devSavedEmp = null;                        // 锁定前勾着的赋能（解锁时还原）
       var _supKind = 'once';                          // 辅助供能：当前辅助车的给法（once / per_sec / per_nitro / full）
       var _mateKind = 'once';                         // 团魂获能：队友辅助车的给法
       var _autoPosFilter = false;                     // 进入辅助供能时是否替用户把车辆列表筛成了辅助位

       function _mv(id) { var e = document.getElementById(id); return e ? (parseFloat(e.value) || 0) : 0; }
       function _mi(id) { var v = parseInt(_mv(id), 10); return (isNaN(v) || v < 0) ? 0 : v; }
       function _mc(id) { var e = document.getElementById(id); return !!(e && e.checked); }
       function _f3(x) { return Math.floor(x * 1000 + 0.000001) / 1000; }
       function _d(x) { return String(+(+x).toFixed(4)); }   // 系数显示：0.8200000000000001 → 0.82
       function _carById(id) { return window.__carById ? window.__carById(id) : null; }
       var _OK_ICO = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
       var _WARN_ICO2 = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 2.8 19.5h18.4L12 3.5z"/><path d="M12 10v4.2M12 17v.01"/></svg>';

       /* ---------- 过渡：复用 v4.js 的开合动画（高度 + 内外边距 + 透明度一起走，中途反向不跳） ---------- */
       var _SLIDE_KEYS = ['height', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'];
       function _boxOf(el) {
           var cs = getComputedStyle(el);
           return { height: el.getBoundingClientRect().height, paddingTop: parseFloat(cs.paddingTop) || 0, paddingBottom: parseFloat(cs.paddingBottom) || 0,
                    marginTop: parseFloat(cs.marginTop) || 0, marginBottom: parseFloat(cs.marginBottom) || 0 };
       }
       function _stopSlide(el) {
           if (el.__pvA) { el.__pvA.cancel(); el.__pvA = null; }
           if (el.__pvK) { el.__pvK.forEach(function (x) { x.cancel(); }); el.__pvK = null; }
           el.style.overflow = '';
       }
       function _motionOK() {
           var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
           return !!document.body.animate && !rm && !document.body.classList.contains('performance-mode');
       }
       function slideShow(el, show, instant) {
           if (!el) return;
           show = !!show;
           var gone = el.classList.contains('is-gone');
           if (el.__want === undefined) el.__want = !gone;
           if (el.__want === show) return;
           el.__want = show;
           var M = window.__pvMorph;
           var parentHidden = !el.parentElement || el.parentElement.getClientRects().length === 0;
           if (instant || parentHidden || !M || !_motionOK()) { _stopSlide(el); el.classList.toggle('is-gone', !show); return; }
           if (show) M(el, true, _SLIDE_KEYS, [el], function () { el.classList.remove('is-gone'); return _boxOf(el); }, null, gone);
           else M(el, false, _SLIDE_KEYS, [el], function () { return {}; }, function () { el.classList.add('is-gone'); });
       }
       // 已显示的内联提示框 / 说明条在内容或行数变化时，平滑过渡外框高度并触发内部文字微浮淡入
       function _morphInlineBox(el, nextHtml, onMutate, hostEl, noHeight) {
           if (!el) return;
           var host = hostEl || el;
           var prevHtml = el.__rawHtml !== undefined ? el.__rawHtml : el.innerHTML;
           if (prevHtml === nextHtml) {
               if (onMutate) onMutate(el);
               return;
           }
           var gone = host.classList.contains('is-gone') || el.classList.contains('is-gone');
           var canAnim = !gone && host.offsetParent !== null && !isRestoringConfig && _motionOK() && !window.__rangeActive && !document.body.classList.contains('calc-boot');
           if (!canAnim) {
               if (host.__pvA && !host.classList.contains('is-gone')) _stopSlide(host);
               el.innerHTML = nextHtml;
               el.__rawHtml = nextHtml;
               el.__sig = nextHtml.replace(/[0-9.+-]+%?/g, '#');
               if (onMutate) onMutate(el);
               return;
           }
           var h0 = 0;
           if (!noHeight) {
               h0 = host.getBoundingClientRect().height;
               if (host.__pvA) _stopSlide(host);
           }
           el.innerHTML = nextHtml;
           el.__rawHtml = nextHtml;
           if (onMutate) onMutate(el);
           if (!noHeight) {
               var h1 = host.getBoundingClientRect().height;
               if (Math.abs(h1 - h0) > 1) {
                   host.style.overflow = 'hidden';
                   var a = host.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 280, easing: 'cubic-bezier(.22, 1, .36, 1)' });
                   host.__pvA = a;
                   a.onfinish = a.oncancel = function () {
                       if (host.__pvA === a) {
                           host.__pvA = null;
                           host.style.overflow = '';
                       }
                   };
               }
           }
           var nextSig = nextHtml.replace(/[0-9.+-]+%?/g, '#');
           var prevSig = el.__sig;
           el.__sig = nextSig;
           var act = document.activeElement;
           var isTyping = !!(act && act.tagName === 'INPUT' && act.type !== 'checkbox' && act.type !== 'radio');
           if (prevSig !== undefined && (!isTyping || prevSig !== nextSig)) {
               var now = performance.now();
               if (!el.__swapAt || now - el.__swapAt > 90 || prevSig !== nextSig) {
                   el.__swapAt = now;
                   var useB = el.classList.contains('pv-box-swap-a');
                   el.classList.remove(useB ? 'pv-box-swap-a' : 'pv-box-swap-b');
                   el.classList.add(useB ? 'pv-box-swap-b' : 'pv-box-swap-a');
               }
           }
       }
       window._morphInlineBox = _morphInlineBox;

       /* 通用数字按位纵向滚轮（Odometer：支持结果卡大数值 ds-value、结果卡数据 cs-val / tm-stat-v 及底部胶囊 dock） */
       function _ensureOdo(valEl) {
           if (valEl.__odo) return valEl.__odo;
           var initTxt = (valEl.textContent || valEl.innerText || '').trim() || '--';
           var digits = '<i>0</i><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i><i>6</i><i>7</i><i>8</i><i>9</i>';
           var numHtml = '';
           ['d3', 'd2', 'd1', 'd0'].forEach(function (k) {
               numHtml += '<span class="pv-odo-d is-hidden" data-slot="' + k + '"><span class="pv-odo-t">' + digits + '</span></span>';
           });
           numHtml += '<small class="pv-odo-dec is-hidden" data-slot="dec-wrap">';
           numHtml += '<span class="pv-odo-sym" data-slot="dot">.</span>';
           ['df0', 'df1', 'df2'].forEach(function (k) {
               numHtml += '<span class="pv-odo-d is-hidden" data-slot="' + k + '"><span class="pv-odo-t">' + digits + '</span></span>';
           });
           numHtml += '</small>';
           numHtml += '<small class="pv-odo-pct is-hidden" data-slot="pct">%</small>';

           valEl.innerHTML = '<span class="pv-odo-txt">' + initTxt + '</span><span class="pv-odo-num is-hidden" aria-hidden="true">' + numHtml + '</span>';
           var txtNode = valEl.querySelector('.pv-odo-txt');
           var numNode = valEl.querySelector('.pv-odo-num');
           var map = {};
           ['d3', 'd2', 'd1', 'd0', 'df0', 'df1', 'df2'].forEach(function (k) {
               var wrap = numNode.querySelector('[data-slot="' + k + '"]');
               map[k] = { wrap: wrap, track: wrap.firstChild, val: 0, shown: false };
           });
           var dotNode = numNode.querySelector('[data-slot="dot"]');
           var decWrap = numNode.querySelector('[data-slot="dec-wrap"]');
           var pctNode = numNode.querySelector('[data-slot="pct"]');

           valEl.__odo = {
               txtNode: txtNode,
               numNode: numNode,
               map: map,
               dotNode: dotNode,
               decWrap: decWrap,
               pctNode: pctNode,
               mode: 'txt',
               raw: initTxt
           };
           valEl.setAttribute('aria-label', initTxt);
           return valEl.__odo;
       }

       // 只允许纯数值/纯文本形态进入 innerHTML 解析；任何带标签的内容先剥成 textContent。
       // 目的：堵住 ?s= / ?cfg= 分享参数把 <img onerror> 送进 _renderOdoValue 的 DOM XSS 路径。
       function _odoSanitize(s) {
           if (!/[<>]/.test(s)) return s;
           if (/^<span class=["']emoji-fix["']>[^<>]{1,8}<\/span>([^<>]*)$/.test(s)) return s;
           var scrub = document.createElement('div');
           scrub.textContent = s;
           return (scrub.textContent || '').trim();
       }

       function _renderOdoValue(valEl, nextHtml) {
           if (!valEl) return;
           var nextStr = _odoSanitize(String(nextHtml === undefined || nextHtml === null ? '' : nextHtml).trim());
           if (valEl.__html === nextStr && valEl.__odo) return;

           var odo = _ensureOdo(valEl);
           valEl.__html = nextStr;

           var tmpDiv = document.createElement('div');
           tmpDiv.innerHTML = nextStr;
           var plainTxt = (tmpDiv.textContent || tmpDiv.innerText || '').trim();

           // 底部胶囊 dock 只显示一位小数：不管调用方传进来几位，都四舍五入到 1 位再渲染
           if (valEl.classList && valEl.classList.contains('ds-dock-v')) {
               var dockM = plainTxt.match(/^(-?\d+(?:\.\d+)?)(%?)$/);
               if (dockM && dockM[1].indexOf('.') >= 0) {
                   var dockNum = parseFloat(dockM[1]);
                   if (isFinite(dockNum)) plainTxt = (Math.round(dockNum * 10) / 10).toFixed(1) + dockM[2];
               }
           }
           valEl.setAttribute('aria-label', plainTxt);

           // 匹配纯数值：如 100, 100.0%, 85.2%, 120.500 等
           var m = plainTxt.match(/^(-?\d+)(?:\.(\d+))?(%)?$/);
           var canAnim = !isRestoringConfig && typeof _motionOK === 'function' && _motionOK() && !document.body.classList.contains('calc-boot');
           var nowTs = window.performance ? performance.now() : Date.now();
           var isBurstInput = !!(valEl.__lastOdoTs && (nowTs - valEl.__lastOdoTs) < 85);
           valEl.__lastOdoTs = nowTs;
           var isInstant = !canAnim || document.body.classList.contains('is-dragging-slider') || isBurstInput;
           var wasInstant = valEl.classList.contains('is-odo-instant');
           valEl.classList.toggle('is-odo-instant', isInstant);
           if (wasInstant && !isInstant) void valEl.offsetWidth;

           var clearStepClasses = function (node) {
               node.classList.remove('is-roll-a', 'is-roll-b', 'is-step-up-a', 'is-step-up-b', 'is-step-down-a', 'is-step-down-b');
           };
           var triggerRoll = function (node) {
               var useB = node.classList.contains('is-roll-a');
               clearStepClasses(node);
               void node.offsetWidth;
               node.classList.add(useB ? 'is-roll-b' : 'is-roll-a');
           };
           var triggerStep = function (node, dir) {
               var clsA = dir === 'up' ? 'is-step-up-a' : 'is-step-down-a';
               var clsB = dir === 'up' ? 'is-step-up-b' : 'is-step-down-b';
               var useB = node.classList.contains(clsA);
               clearStepClasses(node);
               void node.offsetWidth;
               node.classList.add(useB ? clsB : clsA);
           };

           if (!m) {
               // 目标是文本模式（如 '0 个氮气' 或 '--'）
               var wasNum = odo.mode === 'num';
               var prevTxt = odo.txtNode.textContent;
               odo.mode = 'txt';
               odo.numVal = NaN;
               odo.raw = plainTxt;

               odo.numNode.classList.add('is-hidden');
               clearStepClasses(odo.numNode);
               odo.txtNode.textContent = plainTxt;
               odo.txtNode.classList.remove('is-hidden');

               if (!isInstant && (wasNum || prevTxt !== plainTxt)) {
                   triggerRoll(odo.txtNode);
               } else {
                   clearStepClasses(odo.txtNode);
               }
               return;
           }

           // 目标是数字模式！
           var wasTxt = odo.mode !== 'num';
           var prevNum = odo.numVal;
           var nextNum = parseFloat(m[1] + (m[2] ? ('.' + m[2]) : ''));
           odo.mode = 'num';
           odo.numVal = nextNum;
           odo.raw = plainTxt;
           odo.txtNode.textContent = plainTxt;

           var intPart = parseInt(m[1], 10);
           var fracStr = m[2] || '';
           var hasPct = !!m[3];

           var absInt = Math.abs(intPart);
           var d3 = Math.floor(absInt / 1000) % 10;
           var d2 = Math.floor(absInt / 100) % 10;
           var d1 = Math.floor(absInt / 10) % 10;
           var d0 = absInt % 10;

           var showD3 = absInt >= 1000;
           var showD2 = absInt >= 100;
           var showD1 = absInt >= 10;
           var showD0 = true;

           var slots = {
               d3: { val: d3, show: showD3 },
               d2: { val: d2, show: showD2 },
               d1: { val: d1, show: showD1 },
               d0: { val: d0, show: showD0 }
           };

           slots.df0 = { val: fracStr.length > 0 ? parseInt(fracStr[0], 10) : 0, show: fracStr.length > 0 };
           slots.df1 = { val: fracStr.length > 1 ? parseInt(fracStr[1], 10) : 0, show: fracStr.length > 1 };
           slots.df2 = { val: fracStr.length > 2 ? parseInt(fracStr[2], 10) : 0, show: fracStr.length > 2 };

           if (odo.dotNode) odo.dotNode.classList.toggle('is-hidden', !fracStr.length);
           if (odo.decWrap) odo.decWrap.classList.toggle('is-hidden', !fracStr.length);
           if (odo.pctNode) odo.pctNode.classList.toggle('is-hidden', !hasPct);

           odo.txtNode.classList.add('is-hidden');
           odo.numNode.classList.remove('is-hidden');

           if (!isInstant && wasTxt) {
               // 从文本平滑过渡到数字：数字容器触发 200ms 滚入，各数位从 0 纵向滚入到目标数值
               triggerRoll(odo.numNode);

               var needRaf = [];
               for (var slotKey in slots) {
                   var item = odo.map[slotKey];
                   var cfg = slots[slotKey];
                   if (!item) continue;
                   item.wrap.classList.toggle('is-hidden', !cfg.show);
                   if (cfg.show) {
                       item.shown = true;
                       item.val = cfg.val;
                       item.track.style.transition = 'none';
                       item.track.style.transform = 'translate3d(0, 0%, 0)';
                       needRaf.push({ track: item.track, y: -(cfg.val * 10) });
                   } else {
                       item.shown = false;
                   }
               }
               if (needRaf.length) {
                   requestAnimationFrame(function () {
                       requestAnimationFrame(function () {
                           for (var j = 0; j < needRaf.length; j++) {
                               needRaf[j].track.style.transition = '';
                               needRaf[j].track.style.transform = 'translate3d(0, ' + needRaf[j].y + '%, 0)';
                           }
                       });
                   });
               }
           } else {
               // 普通数字更新：连续拖拽滑块或高频连发时瞬时直出；离散更新时播放 200ms 垂直滚入跳变
               if (!isInstant && isFinite(prevNum) && isFinite(nextNum) && nextNum !== prevNum &&
                   valEl.classList && (valEl.classList.contains('ds-value') || valEl.classList.contains('ds-dock-v') || valEl.classList.contains('cs-val') || valEl.classList.contains('tm-stat-v'))) {
                   triggerStep(odo.numNode, nextNum > prevNum ? 'up' : 'down');
               } else if (isInstant) {
                   clearStepClasses(odo.numNode);
               }
               for (var slotKey in slots) {
                   var item = odo.map[slotKey];
                   var cfg = slots[slotKey];
                   if (!item) continue;
                   item.wrap.classList.toggle('is-hidden', !cfg.show);
                   if (cfg.show) {
                       item.track.style.transform = 'translate3d(0, -' + (cfg.val * 10) + '%, 0)';
                       item.val = cfg.val;
                       item.shown = true;
                   } else {
                       item.shown = false;
                   }
               }
           }
       }
       window._renderOdoValue = _renderOdoValue;

       // 全局滑块拖动监听：挂载 is-dragging-slider（拖拽期瞬时直出数值）+ is-jelly-dragging（果冻弹性反馈）
       if (!window.__rangeTrackBound) {
           window.__rangeTrackBound = true;
           var _burstTimer = null;
           var _startRange = function (e) {
               if (e.target && e.target.type === 'range' && !e.target.disabled) {
                   var locked = e.target.closest && e.target.closest('.counter-card.is-locked');
                   if (locked) return;
                   window.__rangeActive = true;
                   document.body.classList.add('is-dragging-slider');
                   if (window.__activeJellySlider && window.__activeJellySlider !== e.target) {
                       window.__activeJellySlider.classList.remove('is-jelly-dragging');
                   }
                   window.__activeJellySlider = e.target;
                   e.target.classList.add('is-jelly-dragging');
               }
           };
           var _endRange = function () {
               if (window.__rangeActive) {
                   window.__rangeActive = false;
                   document.body.classList.remove('is-dragging-slider');
               }
               if (window.__activeJellySlider) {
                   window.__activeJellySlider.classList.remove('is-jelly-dragging');
                   window.__activeJellySlider = null;
               }
           };
           document.addEventListener('pointerdown', _startRange, { passive: true });
           document.addEventListener('pointerup', _endRange, { passive: true });
           document.addEventListener('pointercancel', _endRange, { passive: true });
           document.addEventListener('touchstart', _startRange, { passive: true });
           document.addEventListener('touchend', _endRange, { passive: true });
           document.addEventListener('touchcancel', _endRange, { passive: true });
           document.addEventListener('input', function (e) {
               if (!e.target || e.target.type !== 'range') return;
               var now = window.performance ? performance.now() : Date.now();
               var prev = e.target.__lastRangeInput || 0;
               e.target.__lastRangeInput = now;
               if (window.__rangeActive || (now - prev) < 110) {
                   document.body.classList.add('is-dragging-slider');
                   clearTimeout(_burstTimer);
                   _burstTimer = setTimeout(function () {
                       if (!window.__rangeActive) document.body.classList.remove('is-dragging-slider');
                   }, 140);
               }
           }, { passive: true });
       }

       // 初始化反制卡片拖动条数值为 Odometer
       var _cInitEl = document.getElementById('counterValue'), _cInitR = document.getElementById('counterRange');
       if (_cInitEl && _cInitR) _renderOdoValue(_cInitEl, _cInitR.value + '%');
       var _dInitEl = document.getElementById('debuffValue'), _dInitR = document.getElementById('debuffRange');
       if (_dInitEl && _dInitR) _renderOdoValue(_dInitEl, _dInitR.value + '%');

       // 数值更新统一通过通用 Odometer 平滑纵向滚动
       function _setVal(id, html) {
           var el = document.getElementById(id);
           if (!el) return;
           _renderOdoValue(el, html);
       }

       /* ---------- 模式切换 ---------- */
       function getCalcMode() {
           var m = document.body.getAttribute('data-calc-mode');
           return CALC_MODES.indexOf(m) >= 0 ? m : 'solo';
       }
       function _inMode(el, m) { return (' ' + (el.getAttribute('data-modes') || '') + ' ').indexOf(' ' + m + ' ') >= 0; }
       // 分段控件的选中块滑到当前那一段
       var _modeAnimUntil = 0;
       function placeModeThumb(noAnim) {
           var seg = document.querySelector('.mode-seg'), th = seg && seg.querySelector('.mode-thumb'), on = seg && seg.querySelector('.mode-opt.is-on');
           if (!th || !on || !on.offsetWidth) return;
           if (noAnim) {
               th.classList.add('no-anim');
           } else {
               th.classList.remove('no-anim');
               _modeAnimUntil = (window.performance ? performance.now() : Date.now()) + 520;
           }
           th.style.width = on.offsetWidth + 'px';
           th.style.height = on.offsetHeight + 'px';
           th.style.transform = 'translate(' + on.offsetLeft + 'px,' + on.offsetTop + 'px)';
           if (noAnim) { void th.offsetWidth; th.classList.remove('no-anim'); }
       }
       // 模式说明：三段叠在一起交叉淡入淡出，外框高度量当前那段后过渡过去（CSS 负责动画）
       function syncModeDesc(instant) {
           var box = document.querySelector('.mode-desc'), on = box && box.querySelector('.md-' + getCalcMode());
           if (!on) return;
           var cs = getComputedStyle(box), h = on.offsetHeight;
           if (cs.boxSizing === 'border-box') h += (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
           if (instant || !_motionOK()) {
               box.classList.add('no-anim');
               box.style.height = h + 'px';
               void box.offsetWidth;
               box.classList.remove('no-anim');
           } else {
               box.style.height = h + 'px';
           }
       }
       // 各区块按模式显隐：组队区整块开合；组队区内部两套卡片互换时也走开合（像手风琴一样过渡）
       // 从最里层往外处理（倒序遍历，子块总在父块之前）：
       //   · 外层正要「展开」：里面的块先直接切到位，外层再量高度 —— 量到的就是最终高度，动画到头不会再弹；
       //   · 外层正要「收起」/ 已收起：里面的块一律不动，原样跟着外层一起收（不会先塌掉、留一个空壳在收）；
       //   · 外层保持显示：里面的块各自开合（团魂获能 ⇄ 辅助供能互换）。
       function _wantOf(el) { return el.__want !== undefined ? el.__want : !el.classList.contains('is-gone'); }
       // closingOnly：切模式一开始先把「要收起」的块按当前高度收起来（此时内容还没被改，量到的是真实起点），
       // 其余（展开 / 互换）等内容都更新完再做
       function syncModeBlocks(instant, mode, closingOnly) {
           var m = mode || getCalcMode();
           var els = [].filter.call(document.querySelectorAll('[data-modes]'), function (el) { return !el.classList.contains('ds-dock-item'); });
           els.forEach(function (el) {
               var on = _inMode(el, m);
               if (el.id === 'cardTeamIn') on = on && !getDevice();
                if (el.id === 'teamInSum') on = on && getDevice() !== 'acc';          // 装了增益装置就没有队友辅助
               el.__modeOn = on;
           });
           for (var i = els.length - 1; i >= 0; i--) {
               var el = els[i], skip = false, snap = !!instant;
               for (var a = el.parentElement; a; a = a.parentElement) {
                   if (els.indexOf(a) < 0) continue;
                   if (!a.__modeOn) { skip = true; break; }
                   if (_wantOf(a) !== a.__modeOn) snap = true;
               }
               if (!skip && (!closingOnly || !el.__modeOn)) slideShow(el, el.__modeOn, snap);
           }
           // 选车卡里「已自动填充 / 其余手调」那段提示：辅助供能里用不上，收起（原先是 CSS 直接 display:none，下面的内容会硬跳 100px）
           if (!closingOnly || m === 'support') slideShow(document.getElementById('carPreviewAutoMsg'), m !== 'support', instant);
       }
       // 底部胶囊：格子真的换了（进出「辅助供能」）才过渡 —— 胶囊本身一直在，宽度从旧值平滑变到新值，
       // 里面的格子先淡出、换好再淡入；先机汇能 ⇄ 团魂获能 两边格子一样，什么都不动。
       // 以前每次切模式都让整个胶囊淡出再淡入：
       //   · 格子没变也闪一下；
       //   · 这段动画压着「滚到结果区时胶囊收起」的样式 —— 切换途中结果卡从视口里路过，胶囊会先淡入、动画一完又突然消失。
       function syncDock(animate) {
           var m = getCalcMode(), dock = document.querySelector('.ds-dock');
           var items = [].slice.call(document.querySelectorAll('.ds-dock-item[data-modes]'));
           var want = items.map(function (it) { return _inMode(it, m); });
           // 上一次过渡还没做完：从「眼下看到的」宽度 / 透明度接着走，不跳回起点
           var w0 = dock ? dock.getBoundingClientRect().width : 0;
           var op = items.map(function (it) { return it.getClientRects().length ? parseFloat(getComputedStyle(it).opacity) || 0 : 0; });
           if (dock && dock.__dm) dock.__dm();
           var vis = items.filter(function (it) { return !it.classList.contains('is-gone'); });
           var same = items.every(function (it, i) { return it.classList.contains('is-gone') === !want[i]; });
           var still = !animate || !dock || !dock.animate || !_motionOK() || document.body.classList.contains('ds-results-visible');
           if (same) {
               // 格子没变；若刚才淡出到一半被打断，淡回来
               if (!still) items.forEach(function (it, i) { if (want[i] && op[i] < .99) it.animate([{ opacity: op[i] }, { opacity: 1 }], { duration: 160, easing: 'ease-out' }); });
               return;
           }
           var apply = function () { items.forEach(function (it, i) { it.classList.toggle('is-gone', !want[i]); }); };
           if (still) { apply(); return; }
           var anims = [], aw = null, over = false;
           var fin = function () {
               if (over) return;
               over = true;
               anims.forEach(function (a) { a.cancel(); });
               if (aw) aw.cancel();
               dock.style.width = '';
               dock.classList.remove('is-morphing');
               dock.__dm = null;
           };
           dock.__dm = fin;
           dock.style.width = w0 + 'px';               // 换格子前先按住当前宽度
           dock.classList.add('is-morphing');
           var out = vis.map(function (it) { var i = items.indexOf(it); return it.animate([{ opacity: op[i], transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: 'translateY(4px) scale(.94)' }], { duration: 130, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }); });
           anims = anims.concat(out);
           var swap = function () {
               if (over) return;
               apply();
               dock.style.width = '';
               var w1 = dock.getBoundingClientRect().width;  // 新格子的自然宽度（数值已经算完）
               aw = dock.animate([{ width: w0 + 'px' }, { width: w1 + 'px' }], { duration: 340, easing: 'cubic-bezier(.22, 1, .36, 1)' });
               items.forEach(function (it, i) {
                   if (want[i]) anims.push(it.animate([{ opacity: 0, transform: 'translateY(-4px) scale(.94)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], { duration: 260, delay: 50, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'backwards' }));
               });
               aw.onfinish = fin;
           };
           if (out.length) out[0].onfinish = swap; else swap();
       }
       /* 底部胶囊 Dock 项更新：复用通用 Odometer 纵向滚动 */
       window._setDockItem = function (itemEl, valEl, nextText, nextState) {
           if (!itemEl || !valEl) return;
           var prevState = itemEl.getAttribute('data-state') || 'idle';
           if (prevState !== nextState) {
               itemEl.setAttribute('data-state', nextState);
           }
           _renderOdoValue(valEl, nextText);
       };
       // 进入辅助供能时把车辆列表筛成辅助位（用户自己选过定位就不动）；离开时还原
       function syncSupportFilter(prev, m) {
           if (typeof selectFilter !== 'function') return;
           if ((m === 'support' || m === 'team') && prev !== m) {
                if (_autoPosFilter && (_filterPos === '辅助位' || _filterPos === '!辅助位')) selectFilter('pos', '');
               if (!_filterPos) { selectFilter('pos', m === 'team' ? '!辅助位' : '辅助位'); _autoPosFilter = true; }
           } else if ((prev === 'support' || prev === 'team') && m !== prev) {
               if (_autoPosFilter && (_filterPos === '辅助位' || _filterPos === '!辅助位')) selectFilter('pos', '');
               _autoPosFilter = false;
           }
       }
       // 卡片内容换了一块：高度从旧值平滑过渡到新值（不在视口里 / 关了动画就直接换）

       /* ======================================================================
          开局连发测算区：一大 → 二大 → 三大
          - 一大：首发核算 F；阈值只决定「能不能放」，每次开大实际清空 100%，所以带进二大的是 F − 100（不足 100 就按 0）
          - 每一大期间的产出 P = 后续循环的「循环总产出」（同一套输入：大招内氮气、触发次数、装置 / 队友循环次数…）
          - 二大 = 一大溢出 + P；三大 = 二大溢出 + P。只算到三大
          - 卡在哪：三连发要同时满足一、二、三大（木桶效应），给出「最少要多少」时三个条件一起算
          - 不加任何输入，所以和自充能、触发次数等模块没有额外耦合：它们怎么影响首发 / 循环，就怎么影响这里
          ====================================================================== */
       var _chainRes = null;
       // 每次开大固定清空 100% 能量：降低阈值只是允许提前放，阈值以上的部分不会留在手里。
       // 因此「放完还剩多少」= max(0, 攒到的能量 − 100)，不能拿阈值当消耗量。
       var _CHAIN_COST = 100000;   // 定点 ×1000
       function _chainCarry(v) { return v > _CHAIN_COST ? v - _CHAIN_COST : 0; }
       function _chainPass(fi, li, t1, t2) {
           var tt = (t2 === undefined) ? t1 : t2;
           if (fi < t1) return false;
           var s2 = _chainCarry(fi) + li;
           if (s2 < tt) return false;
           return (_chainCarry(s2) + li) >= tt;
       }
       function renderChain(F, P, T, xianji, huineng, tdx, targetLoopParam, chipParam) {
            var card = document.getElementById('resultCardChain');
            if (!card) return;
            var k = function (v) { return Math.round(v * 1000); }, f3 = function (i) { return (i / 1000).toFixed(3); };
            var T1 = T, T2 = targetLoopParam !== undefined ? targetLoopParam : T;
            var chip = chipParam || null;
            // 循环总量已包含每次开大触发的芯片能量；连发按每次实际触发单独加入，避免重复计入。
            var T1i = k(T1), T2i = k(T2), Fi = k(F), Pi = Math.max(0, k(P) - k(chip && chip.loopUlt || 0));
            // chip.ult[0] 是放出一大时触发给二大的能量；chip.ult[1] 是放出二大时触发给三大的能量（隐匿猎手在此触发 +16%）
            var chipAfter1st = chip && chip.ult ? k(chip.ult[0] || 0) : 0;
            var chipAfter2nd = chip && chip.ult ? k(chip.ult[1] || 0) : 0;
            
            var e = [Fi, NaN, NaN], ok = [Fi >= T1i, false, false];
            if (ok[0]) { e[1] = _chainCarry(Fi) + Pi + chipAfter1st; ok[1] = e[1] >= T2i; }
            if (ok[1]) { e[2] = _chainCarry(e[1]) + Pi + chipAfter2nd; ok[2] = e[2] >= T2i; }
            var brk = !ok[0] ? 0 : !ok[1] ? 1 : !ok[2] ? 2 : -1;   // 断在第几大（-1 = 三连发成立）
            var names = [_('一大', '1st'), _('二大', '2nd'), _('三大', '3rd')];
            // 「最少要多少」：三连发同时成立（木桶效应）—— 每次只动一个量，其余保持当前值
            var need = [];
            if (brk >= 0) {
                // 每个建议值都按「用户在页面上手填它之后，页面会怎么自动补齐」来算（团魂获能的自动反算、先机汇能的联动），
                // 保证照着填进去就能连放三大
                var env = _chipEnv(), cur = _tmCur(), team = tdx && tdx.mode === 'team';
                var pass = function (st) {
                    var fi = k(_tmFirst(env, st.x, st.h, st.s));
                    var li = Math.max(0, k(_tmLoop(env, st.h, st.s)) - k(env.chip && env.chip.loopUlt || 0));
                    var ca1 = env.chip && env.chip.ult ? k(env.chip.ult[0] || 0) : 0;
                    var ca2 = env.chip && env.chip.ult ? k(env.chip.ult[1] || 0) : 0;
                    var s2 = _chainCarry(fi) + li + ca1;
                    return fi >= T1i && s2 >= T2i && (_chainCarry(s2) + li + ca2) >= T2i;
                };
                var soulOn = team && !env.na && (_tmFirst(env, cur.x, cur.h, SOUL_MAX) > _tmFirst(env, cur.x, cur.h, 0) || _tmLoop(env, cur.h, SOUL_MAX) > _tmLoop(env, cur.h, 0));
                var nm = { soul: _('团魂', 'Team Soul'), huineng: _('汇能', 'Huineng'), xianji: _('先机', 'Xianji') };
                (soulOn ? ['soul', 'huineng'] : ['huineng', 'xianji']).forEach(function (key) {
                    var v = _tmSuggest(env, key, cur, pass);
                    need.push({ key: key, name: nm[key], v: v, txt: v === null ? null : (key === 'soul' ? String(v) : v.toFixed(1)) + '%' });
                });
            }
            var steps = card.querySelectorAll('.chain-step');
            var nextShape = '1:' + brk + ':' + (ok[0] ? 1 : 0) + (ok[1] ? 1 : 0);
            var skipFlip = !card.__shape || card.__shape === nextShape || !!window.__skipChainFlip;
            card.__shape = nextShape;
            _flipHeight(card, function () {
                card.classList.remove('is-idle');
                card.classList.toggle('error-state', brk >= 0);
                for (var i = 0; i < 3; i++) {
                    var st = steps[i], reached = i === 0 || ok[i - 1];
                    st.classList.toggle('is-ok', reached && ok[i]);
                    st.classList.toggle('is-bad', reached && !ok[i]);
                    st.classList.toggle('is-off', !reached);
                    var ico = st.querySelector('.cs-ico'), val = st.querySelector('.cs-val'), how = st.querySelector('.cs-how'), out = st.querySelector('.cs-out');
                    ico.innerHTML = window.__pvIcon ? __pvIcon(!reached ? 'minus' : ok[i] ? 'ok' : 'err') : '';
                    if (!reached) {
                        _setVal('chainVal' + i, '—');
                        how.textContent = _('上一大没放出来', 'previous ult not fired');
                        out.textContent = '';
                        continue;
                    }
                    var s3 = f3(e[i]).split('.');
                    _setVal('chainVal' + i, s3[0] + '<small>.' + s3[1] + '%</small>');
                    var thisReq = (i === 0 ? T1i : T2i);
                    var prevReq = (i === 1 ? T1i : T2i);
                    var chipExtraText = (i === 1 && chipAfter1st > 0) ? (' + ' + _('芯片', 'chip ') + f3(chipAfter1st) + '%')
                        : (i === 2 && chipAfter2nd > 0) ? (' + ' + _('芯片', 'chip ') + f3(chipAfter2nd) + '%') : '';
                    how.textContent = i === 0 ? _('首发核算', 'from the 1st-ult calc')
                        : _('带入 ', 'carried ') + f3(_chainCarry(e[i - 1])) + _(' + 产出 ', ' + gained ') + f3(Pi) + chipExtraText;
                    out.textContent = ok[i] ? (i < 2 ? _('溢出 +', 'overflow +') + f3(_chainCarry(e[i])) + '%' : _('达成', 'fires')) : _('差 ', 'short ') + f3(thisReq - e[i]) + '%';
                }
                var stEl = document.getElementById('chainStatus');
                stEl.textContent = brk < 0 ? _('连放三大', '3-ult chain') : brk === 0 ? _('首发未达成', '1st ult not ready') : names[brk] + _('断档', ' breaks');
                var targetText = (T1 !== T2) ? (_('首大 ', '1st ') + T1 + '% / ' + _('循环 ', 'loop ') + T2 + '%') : (_('阈值 ', 'Target ') + T1 + '%');
                document.getElementById('chainTarget').textContent = targetText;
                // 说明
                var ico = function (kd) { return window.__pvIcon ? '<span class="pv-det-ico">' + __pvIcon(kd) + '</span>' : ''; };
                var d;
                if (brk < 0) {
                    d = ico('ok') + '<b>' + _('开局连放三大', 'Three ults in a row') + '</b>' + (k(P) >= T2i
                        ? _('：按当前循环口径，每轮产出已达到大招阈值。', ': the current loop output reaches the ult threshold.')
                        : _('：靠一大的溢出撑住了；每一大期间的产出不够一管，溢出会一大比一大少。', ': the 1st ult’s overflow carries it — each ult gains less than a bar, so the overflow shrinks every time.'));
                } else {
                    var diffBreak = (brk === 0 ? T1i : T2i) - e[brk];
                    d = ico('err') + '<b>' + (brk === 0 ? _('首发还没凑够', '1st ult not ready') : names[brk] + _('接不上', ' doesn’t follow')) + '</b>'
                        + (brk === 0 ? _('：一大差 ', ': short by ') : _('：', ': ') + names[brk] + _('差 ', ' is short by ')) + '<b>' + f3(diffBreak) + '%</b>' + _('。', '.');
                    var can = need.filter(function (n) { return n.v !== null; });
                    d += '<span class="pv-chain-need">' + (can.length
                        ? _('连放三大最少要：', 'To chain three ults you need ') + can.map(function (n) { return n.name + ' ≥ <b>' + n.txt + '</b>'; }).join(_('，或 ', ', or ')) + _('（直接填进去就行，已算上自动反算 / 联动；按卡得最紧的那一大算）', ' (just type it in — auto-solve / linkage already accounted for; set by the tightest ult)')
                        : need.map(function (n) { return n.name; }).join(_('、', ' / ')) + _('拉到上限也连不上三大。', ' maxed out still can’t chain three ults.')) + '</span>';
                }
                _morphInlineBox(document.getElementById('resultDetailChain'), d, null, null, !skipFlip);
                // 解析盒
                var fb = '<b>' + _('【开局连发运算解析盒】', '[Opening Chain Breakdown]') + '</b><br>';
                fb += _('及格线目标：一大 ', 'Passing Target: 1st ') + '<b>' + T1 + '%</b>' + _('，二大/三大 ', ', 2nd/3rd ') + '<b>' + T2 + '%</b>' + _('；每轮其他产出（不含开大触发芯片） ', '; other gain per loop (excluding ult-triggered chips) ') + '<b>' + f3(Pi) + '</b><br><br>';
                fb += _('① 一大：首发核算 ', '1. 1st: first-ult calc ') + '<b>' + f3(Fi) + '</b>' + (ok[0] ? _(' → 放出，溢出 ', ' → fires, overflow ') + f3(_chainCarry(Fi)) : _(' → 未达成', ' → not ready')) + '<br>';
                if (ok[0]) {
                    var extraText2 = chipAfter1st > 0 ? (' + ' + _('芯片一大放出充能 ', 'chip 1st ult ') + f3(chipAfter1st)) : '';
                    fb += _('② 二大：溢出 ', '2. 2nd: overflow ') + f3(_chainCarry(Fi)) + ' + ' + _('产出 ', 'gain ') + f3(Pi) + extraText2 + ' = <b>' + f3(e[1]) + '</b>' + (ok[1] ? _(' → 放出，溢出 ', ' → fires, overflow ') + f3(_chainCarry(e[1])) : _(' → 不够', ' → short')) + '<br>';
                }
                if (ok[1]) {
                    var extraText3 = chipAfter2nd > 0 ? (' + ' + _('芯片二大放出充能 ', 'chip 2nd ult ') + f3(chipAfter2nd)) : '';
                    fb += _('③ 三大：溢出 ', '3. 3rd: overflow ') + f3(_chainCarry(e[1])) + ' + ' + _('产出 ', 'gain ') + f3(Pi) + extraText3 + ' = <b>' + f3(e[2]) + '</b>' + (ok[2] ? _(' → 放出', ' → fires') : _(' → 不够', ' → short')) + '<br>';
                }
                fb += '-------------------------<<br><b>' + _('连发判定：', 'Chain Check: ') + (brk < 0 ? _('一大 → 二大 → 三大 全部接上', '1st → 2nd → 3rd all fire') : _('断在', 'breaks at ') + names[brk]) + '</b>';
                document.getElementById('formulaChain').innerHTML = fb;
            }, skipFlip);
            _chainRes = { brk: brk, line: names.map(function (n, i) { var r = i === 0 || ok[i - 1]; return n + (!r ? ' —' : ok[i] ? ' ✓' : ' ✗'); }).join(' → ') + (brk >= 0 ? _('（', ' (') + names[brk] + _('差 ', ' short ') + f3((brk === 0 ? T1i : T2i) - e[brk]) + '%' + _('）', ')') : '') };
        }
        function _flipHeight(el, mutate, instant) {
           var live = !instant && el && el.offsetParent !== null && _motionOK();
           var pre = el && el.__preH0;
           if (el) el.__preH0 = null;
           var h0 = live ? (pre != null ? pre : el.getBoundingClientRect().height) : 0;
           mutate();
           if (!live) return;
           var h1 = el.getBoundingClientRect().height;
           if (Math.abs(h1 - h0) < 1) return;
           if (el.__pvFlip) el.__pvFlip.cancel();
           el.style.overflow = 'hidden';
           var a = el.animate([{ height: h0 + 'px' }, { height: h1 + 'px' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
           el.__pvFlip = a;
           a.onfinish = a.oncancel = function () { if (el.__pvFlip === a) { el.__pvFlip = null; el.style.overflow = ''; } };
       }
       // 团魂获能：先机 / 汇能输入框（连同联动状态条、上限徽标）搬到团魂旁边；其他模式搬回智能芯片联动面板。
       // 搬的是同一组元素，id 不变，联动反算、分享链接、长截图都照旧。
       var _chipParts = null;
       function _chipHome() {
           if (_chipParts) return _chipParts;
           var card = document.querySelector('.chip-card');
           var bar = card && card.querySelector('.mode-bar'), grid = card && card.querySelector('.row-grid'), badge = document.getElementById('chipLimitBadge');
           if (!bar || !grid || !badge) return null;
           _chipParts = { card: card, where: 'home',
                          bar: [bar, bar.parentNode, bar.nextSibling], grid: [grid, grid.parentNode, grid.nextSibling], badge: [badge, badge.parentNode, badge.nextSibling] };
           return _chipParts;
       }
       function syncChipHome(m, instant) {
           var p = _chipHome(), want = m === 'team' ? 'team' : 'home';
           if (!p || p.where === want) return;
           _flipHeight(p.card, function () {
               var slot = document.getElementById('tmChipBarSlot');
               if (want === 'team') {
                   slot.style.height = ''; slot.style.display = '';
                   document.getElementById('tmChipRow').appendChild(p.grid[0]);
                   slot.appendChild(p.bar[0]);
                   document.getElementById('tmChipTitle').appendChild(p.badge[0]);
               } else {
                   if (slot && slot.contains(p.bar[0]) && slot.getClientRects().length) {
                       var bh = p.bar[0].getBoundingClientRect().height + (parseFloat(getComputedStyle(p.bar[0]).marginTop) || 0);
                       slot.style.display = 'block'; slot.style.height = bh + 'px';
                   }
                   [p.grid, p.bar, p.badge].forEach(function (x) { x[1].insertBefore(x[0], x[2] && x[2].parentNode === x[1] ? x[2] : null); });
               }
               p.where = want;
           }, instant);
       }
       function setCalcMode(m, silent, instant) {
           if (CALC_MODES.indexOf(m) < 0) m = 'solo';
           var prev = getCalcMode(), changed = prev !== m;
           if (changed && !instant && window.__dsHoldResults) window.__dsHoldResults();
           if (changed) _swapChipOwner(prev, m);   // 先机汇能 / 团魂获能 各有一套先机、汇能和联动状态，切换时换着用
           if (changed || instant) closeMateDropdown();
           if (changed && !instant) syncModeBlocks(false, m, true);
           var _ta = document.getElementById('teamArea');
           if (_ta && m !== 'solo') _ta.setAttribute('data-title', m);
           syncChipHome(m, instant);   // 先搬元素再开合区块：区块展开时量到的就是最终高度
           document.body.setAttribute('data-calc-mode', m);
           if (changed) updateAutoCalcUI();   // 联动状态条 / 三把锁换成这个模式的样子
           var opts = document.querySelectorAll('.mode-opt');
           for (var i = 0; i < opts.length; i++) {
               var on = opts[i].getAttribute('data-mode') === m;
               opts[i].classList.toggle('is-on', on);
               opts[i].setAttribute('aria-selected', on ? 'true' : 'false');
           }
           placeModeThumb(!!instant);
           try { localStorage.setItem('calcMode', m); } catch (e) {}
           syncDock(!instant && changed);
           syncSupportFilter(prev, m);
           syncEnvLock();
           updateSoulHint(typeof deferRender !== 'undefined' ? deferRender : (!(typeof isInit !== 'undefined' && (isInit === true || (!_selectedCar && !_userInput))) && getCalcMode() === 'team'));
           syncModeDesc(!!instant || !changed);
           if (changed && !instant && _motionOK()) {
               // 组队区标题在「团魂获能 / 辅助供能」之间换字：只做淡入，不位移
               var tt = document.querySelector('.cp-team .section-divider > span');
               if (tt && tt.animate && prev !== 'solo' && m !== 'solo') tt.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
           }
           if (!silent && !isRestoringConfig) {
               triggerAutoCalc(currentActiveField);
               calculate();
               if (changed && window.CommunityPlans && typeof window.CommunityPlans.scheduleDraftSave === 'function') window.CommunityPlans.scheduleDraftSave();
           }
           // 最后再开合：区块里的数值、提示、锁定态都已就位 —— 展开时量到的就是最终高度，展开途中也不会再变灰 / 再弹出提示
           syncModeBlocks(!!instant);
           if (window.CommunityPlans && typeof window.CommunityPlans.onModeChanged === 'function') window.CommunityPlans.onModeChanged(m);
       }

        /* ======================================================================
           特殊芯片：注册表驱动的「选芯片」卡（#cardChips）
           ----------------------------------------------------------------------
           页面上的槽位、芯片库、每枚芯片的选项，全部由下面的 CHIP_REGISTRY 渲染（renderChips），
           HTML 里只有空容器。往后新增一枚会影响大招能量的芯片，只做两件事：
             1. 把图标放进 data/icon/（建议 chip_<拼音>.png，正方形透明底 PNG）；
             2. 在 CHIP_REGISTRY 里加一项。字段：
                id          唯一英文 id（分享链接里的编码，不要含  - | . , =）
                icon        图标文件名（相对 CHIP_ICON_DIR）；缺图时自动退回名称首字
                name / desc { zh, en }；desc 是完整效果原文，可含 strong
                stats       [{ zh, en }] 只展示、不参与计算的属性（极速、涡轮之类），显示成灰色小标签
                —— 以下是能量效果（写「原始百分比」；全不写 = 纯展示芯片）——
                firstCharge   首发一大前一次性获得 %
                loopCharge    每一轮后续大招循环里固定获得 %
                ultCharge(k)  第 k 次使用大招时获得 %（k 从 1 数；返回 0 = 不触发）
                cycle         ultCharge 的周期（每 N 次大招为一个周期；默认 1 = 每次都触发）
                scale         折算：'DE'（默认，× 反制 × 充能效率）| 'D'（只 × 反制）| 'none'（固定值）
                options       额外选项（type:'seg' 分段选择），见 _chipOptionDefs
             周期内有的轮次不触发的芯片（cycle > 1），「后续大招循环」怎么计入由本模块自动给一个
             「平均每轮 / 触发轮」选项，不用另写。
           【后端接入点】chipAgg(D, E) 把已装芯片聚合成：首发额外能量 first、每轮循环额外能量 loop、
           开局连发里放出第 1 / 2 / 3 次大招时获得的能量 ult[]（已乘折算系数）。
           calculate() / _chipEnv() / renderChain() 读它即可；分享链接用 chipSerialize() / chipRestore()。
           ====================================================================== */
        function getCarVSlots(car) {
            if (!car || !car.chip_slots) return 1;
            var matches = String(car.chip_slots).match(/V|v|Ｖ/g);
            return matches ? matches.length : 0;
        }
        var CHIP_MAX = 1;                       // 动态根据当前车辆 V 型槽数量调整
        var _chipSwapTarget = null;             // 换芯片模式下记录目标芯片 id
        var CHIP_ICON_DIR = 'data/icon/';
        var CHIP_CATEGORIES = [
            { id: 'core', zh: '核心芯片', en: 'Core Chips' },
            { id: 'heroine', zh: '车姬芯片', en: 'Heroine Chips' },
            { id: 'supreme', zh: '至尊芯片', en: 'Supreme Chips', subZh: '至尊 / 墨染 / 至美系列', subEn: 'Supreme / Ink / Peerless' },
            { id: 'overclock', zh: '超频芯片', en: 'Overclock Chips' }
        ];
        var CHIP_REGISTRY = [
            {
                id: 'acecore', category: 'core', slotType: 'core', icon: 'chip_wphx.png',
                name: { zh: '王牌核心', en: 'Ace Core' },
                desc: {
                    zh: '每次点击大招时立即结束漂移，并在扣除本次大招能量后获得 <strong>5%</strong> 大招能量（按 10 级计算，受反制和充能效率影响）。',
                    en: 'Each ult ends drifting and grants <strong>5%</strong> energy after its cost (Lv. 10, scaled by Counter and Charge Eff).'
                },
                scale: 'DE', cycle: 1,
                ultCharge: function () { return 5; }
            },
            {
                id: 'hunter', category: 'heroine', icon: 'chip_hunter.png',
                name: { zh: '隐匿猎手之芯', en: 'Hidden Hunter Chip' },
                desc: {
                    zh: '极速 +18 km/h，但每次使用涡轮 −0.5 km/h（上限减少 30 次。加速不会被驱散，减速无法净化）。每 2 次使用大招时充能 <strong>16%</strong>（隐匿猎手装备时同时清空芯片减速）。',
                    en: 'Top speed +18 km/h, but each turbo use costs −0.5 km/h (up to 30 stacks; the boost can’t be dispelled and the slow can’t be cleansed). Every 2 ult uses charges <strong>16%</strong> (equipping the Hidden Hunter also clears the chip’s slow).'
                },
                stats: [
                    { zh: '极速 +18 km/h', en: 'Top speed +18 km/h' },
                    { zh: '涡轮 −0.5 km/h / 次', en: 'Turbo −0.5 km/h each' }
                ],
                cycle: 2,
                ultCharge: function (k) { return k % 2 === 0 ? 16 : 0; }
            },
            {
                id: 'catnap', category: 'heroine', icon: 'chip_catnap.png',
                name: { zh: '猫眠梦之芯', en: 'Catnap Dream Chip' },
                desc: {
                    zh: '每 6 秒获得 1200 集气量并恢复 6 点耐久值，大招达到 <strong>90%</strong> 能量即可使用（猫眠梦装备时改为 <strong>66%</strong>）。',
                    en: 'Every 6s gains 1200 nitro charge and restores 6 durability; ult can be used at <strong>90%</strong> energy (lowered to <strong>66%</strong> when equipped on Catnap Dream).'
                },
                stats: [
                    { zh: '每 6 秒集气 +1200', en: '1200 nitro / 6s' },
                    { zh: '每 6 秒耐久 +6', en: '6 durability / 6s' },
                    { zh: '大招阈值 90% (猫眠梦 66%)', en: 'Ult threshold 90% (66% for Catnap)' }
                ],
                ultThreshold: function (car) {
                    var isMmm = car && (car.id === 10058 || (car.name && car.name.indexOf('猫眠梦') !== -1));
                    return isMmm ? 66 : 90;
                }
            },
            {
                id: 'hardman', category: 'overclock', icon: 'chip_hardman.png',
                name: { zh: '超频：硬汉模式', en: 'Overclock: Hardman Mode' },
                allowLabel: { zh: '限战神 / 道奇 SRT 392', en: 'Ares / Challenger SRT 392' },
                canEquip: function (car) {
                    return !!(car && (car.id === 10021 || car.id === 10065));
                },
                desc: {
                    zh: '大招期间不会受到减速或干扰效果影响；大招结束时，若期间未受撞击则回复 <strong>45%</strong> 大招能量（受反制与充能效率影响）。',
                    en: 'Immune to slows and interference during ult; when ult ends without taking a collision, restores <strong>45%</strong> ult energy (scaled by Counter & Charge Eff).'
                },
                stats: [
                    { zh: '大招免减速与干扰', en: 'Slow & disrupt immune in ult' },
                    { zh: '专属：战神 / 道奇 SRT 392', en: 'Exclusive: Ares / SRT 392' }
                ],
                cycle: 1,
                scale: 'DE',
                options: [
                    {
                        id: 'hitState', def: 'unhit',
                        label: { zh: '大招期间撞击状态', en: 'Collision During Ult' },
                        choices: [
                            { v: 'unhit', zh: '未受撞击 +45%', en: 'Unhit +45%' },
                            { v: 'hit', zh: '已受撞击 +0%', en: 'Hit +0%' }
                        ]
                    }
                ],
                ultCharge: function (k, opts) {
                    return (opts && opts.hitState === 'hit') ? 0 : 45;
                }
            },
            {
                id: 'triple', category: 'overclock', icon: 'chip_triple.png',
                name: { zh: '超频：三重推进', en: 'Overclock: Triple Boost' },
                allowLabel: { zh: '限神剑号', en: 'Excalibur only' },
                canEquip: function (car) {
                    return !!(car && car.id === 10022);
                },
                desc: {
                    zh: '使用大招后可额外触发最多 3 次推进；每触发 1 次推进，大招结束时回复 <strong>10%</strong> 大招能量（满 3 次共 <strong>+30%</strong>，受反制与充能效率影响）。',
                    en: 'Trigger up to 3 extra boosts during ult; each boost restores <strong>10%</strong> ult energy when ult ends (up to <strong>+30%</strong>, scaled by Counter & Charge Eff).'
                },
                stats: [
                    { zh: '专属：神剑号', en: 'Exclusive: Excalibur' }
                ],
                cycle: 1,
                scale: 'DE',
                options: [
                    {
                        id: 'clicks', def: '3',
                        label: { zh: '额外推进触发次数', en: 'Boost Triggers' },
                        choices: [
                            { v: '1', zh: '1次 +10%', en: '1x +10%' },
                            { v: '2', zh: '2次 +20%', en: '2x +20%' },
                            { v: '3', zh: '3次 +30%', en: '3x +30%' }
                        ]
                    }
                ],
                ultCharge: function (k, opts) {
                    var c = opts && opts.clicks !== undefined ? parseInt(opts.clicks, 10) : 3;
                    if (isNaN(c) || c < 1) c = 1;
                    if (c > 3) c = 3;
                    return c * 10;
                }
            },
            {
                id: 'qinglong', category: 'supreme', icon: 'chip_qinglong.png',
                name: { zh: '至尊：翔宇青龙', en: 'Supreme: Azure Dragon' },
                allowLabel: { zh: '限烛龙', en: 'Zhulong only' },
                canEquip: function (car) {
                    return !!(car && car.id === 12006);
                },
                desc: {
                    zh: '开局获得 <strong>13%</strong> 大招能量（受反制与充能效率影响），并激活龙魂强化效果。',
                    en: 'Gain <strong>13%</strong> ult energy at race start (scaled by Counter & Charge Eff) and activate Dragon Soul buffs.'
                },
                stats: [
                    { zh: '专属：烛龙', en: 'Exclusive: Zhulong' }
                ],
                scale: 'DE',
                firstCharge: 13
            },
            {
                id: 'aomei', category: 'supreme', icon: 'chip_aomei.png',
                name: { zh: '墨染：傲梅', en: 'Ink: Proud Plum' },
                allowLabel: { zh: '限寒霜冰魄', en: 'Frostblade only' },
                canEquip: function (car) {
                    return !!(car && car.id === 10093);
                },
                desc: {
                    zh: '满级充能效率提升 <strong>5%</strong>（直接计入全局充能效率），并强化冰晶增益。',
                    en: 'Increases Charge Efficiency by <strong>5%</strong> at Lv.10 (added directly to global Charge Eff) and enhances frost buffs.'
                },
                stats: [
                    { zh: '专属：寒霜冰魄', en: 'Exclusive: Frostblade' }
                ],
                efficiencyBonus: 0.05
            },
            {
                id: 'xiuzhu', category: 'supreme', icon: 'chip_xiuzhu.png',
                name: { zh: '墨染：修竹', en: 'Ink: Graceful Bamboo' },
                allowLabel: { zh: '限先驱者', en: 'Pioneer only' },
                canEquip: function (car) {
                    return !!(car && car.id === 10087);
                },
                desc: {
                    zh: '满级大招能量达到 <strong>80%</strong> 即可提前使用（阈值降至 80%，按阈值比例折算大招时长）。',
                    en: 'Ult can be activated at <strong>80%</strong> energy at Lv.10 (threshold lowered to 80%, ult duration scales proportionally).'
                },
                stats: [
                    { zh: '专属：先驱者', en: 'Exclusive: Pioneer' }
                ],
                ultThreshold: function () { return 80; }
            },
            {
                id: 'yiju', category: 'supreme', icon: 'chip_yiju.png',
                name: { zh: '墨染：逸菊', en: 'Ink: Serene Chrysanthemum' },
                allowLabel: { zh: '限神剑号', en: 'Excalibur only' },
                canEquip: function (car) {
                    return !!(car && car.id === 10022);
                },
                desc: {
                    zh: '满级大招期间能量损失和消耗降低 <strong>40%</strong>（按大招实际时长延长至 <strong>1 ÷ 0.6 ≈ 1.67 倍</strong> 折算循环与自充）。',
                    en: 'Reduces ult energy loss and consumption by <strong>40%</strong> at Lv.10 (ult duration scaled by <strong>1 ÷ 0.6 ≈ 1.67x</strong> for loop and passive charge).'
                },
                stats: [
                    { zh: '专属：神剑号', en: 'Exclusive: Excalibur' }
                ],
                ultDurationMult: function () { return 1 / 0.6; }
            },
            {
                id: 'xiuhua', category: 'supreme', icon: 'chip_xiuhua.png',
                name: { zh: '至美：羞花', en: 'Peerless: Shy Blossom' },
                allowLabel: { zh: '限隐匿猎手', en: 'Hidden Hunter only' },
                canEquip: function (car) {
                    return !!(car && car.id === 10082);
                },
                desc: {
                    zh: '满级开局获得 <strong>25%</strong> 大招能量（受反制与充能效率影响），且大招能量达到 <strong>88%</strong> 即可使用。',
                    en: 'Gain <strong>25%</strong> ult energy at race start (scaled by Counter & Charge Eff) and ult threshold is lowered to <strong>88%</strong> at Lv.10.'
                },
                stats: [
                    { zh: '专属：隐匿猎手', en: 'Exclusive: Hidden Hunter' }
                ],
                scale: 'DE',
                firstCharge: 25,
                ultThreshold: function () { return 88; }
            }
        ];

        var _chipsOn = [];             // 已装备：[{ id, opts: { loopMode: 'avg' } }]
        var _chipPickerWant = false;
        var _chipNewId = '';
        var _CHIP_SVG = {
            plus: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
            x: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
            swap: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h15m-4-4 4 4-4 4M20 16H5m4-4-4 4 4 4"/></svg>'
        };

        function _chipEl(id) { return document.getElementById(id); }
        function _c2(zh, en) { return '<span class="zh">' + zh + '</span><span class="lang-en">' + en + '</span>'; }
        function _chipTxt(o) { return currentLang === 'en' ? o.en : o.zh; }
        function _chipPct(x) { return String(+(+x).toFixed(2)); }
        function _chipAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
        function _chipDef(id) { for (var i = 0; i < CHIP_REGISTRY.length; i++) if (CHIP_REGISTRY[i].id === id) return CHIP_REGISTRY[i]; return null; }
        function _chipSlotType(def) { return def && def.slotType === 'core' ? 'core' : 'v'; }
        function _chipCount(type) { return _chipsOn.filter(function (inst) { return _chipSlotType(_chipDef(inst.id)) === type; }).length; }
        function _chipCapacity(type) { return type === 'core' ? 1 : CHIP_MAX; }
        function _chipIndex(id) { for (var i = 0; i < _chipsOn.length; i++) if (_chipsOn[i].id === id) return i; return -1; }
        function _chipUlts(def, n, opts) { var a = []; for (var k = 1; k <= n; k++) a.push(def.ultCharge ? (+def.ultCharge(k, opts) || 0) : 0); return a; }
        function _chipLoopStats(def, opts) {
            var n = Math.max(1, (def.cycle | 0) || 1), v = _chipUlts(def, n, opts), s = 0, p = 0;
            v.forEach(function (x) { s += x; if (x > p) p = x; });
            return { n: n, mean: s / n, peak: p, sum: s };
        }
        function _chipCanEquip(def, car) {
            if (!def) return false;
            if (typeof def.canEquip === 'function') return !!def.canEquip(car);
            return true;
        }
        function _chipPruneByCar(car) {
            var prevLen = _chipsOn.length;
            if (!prevLen) return false;
            var counts = { core: 0, v: 0 };
            _chipsOn = _chipsOn.filter(function (inst) {
                var def = _chipDef(inst.id), type = _chipSlotType(def);
                if (!_chipCanEquip(def, car) || counts[type] >= _chipCapacity(type)) return false;
                counts[type]++;
                return true;
            });
            return _chipsOn.length !== prevLen;
        }
        function chipEffBonus() {
            var sum = 0;
            _chipsOn.forEach(function (inst) {
                var def = _chipDef(inst.id);
                if (def && def.efficiencyBonus) sum += (+def.efficiencyBonus || 0);
            });
            return sum;
        }
        function chipUltDurMult() {
            var mult = 1;
            var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
            _chipsOn.forEach(function (inst) {
                var def = _chipDef(inst.id);
                if (def && typeof def.ultDurationMult === 'function') {
                    var dm = +def.ultDurationMult(curCar) || 1;
                    if (dm > 0) mult *= dm;
                }
            });
            return mult;
        }

        /* ---------- 选项：有「周期内有的轮次不触发」的芯片，自动带一个循环口径选项（方案 B：稳妥循环 vs 偶数/触发轮） ---------- */
        function _chipOptionDefs(def) {
            var list = [], st = def.ultCharge ? _chipLoopStats(def) : null;
            if (st && st.n > 1 && st.peak > 0) {
                var p = _chipPct(st.peak);
                var peakLabelZh = st.n === 2 ? ('偶数轮 +' + p + '%') : ('触发轮 +' + p + '%');
                var peakLabelEn = st.n === 2 ? ('Even Loop +' + p + '%') : ('Peak +' + p + '%');
                list.push({
                    id: 'loopMode', def: 'peak',
                    label: { zh: '后续循环计入', en: 'Loop Calc Mode' },
                    choices: [
                        { v: 'safe', zh: '稳妥循环 +0%', en: 'Safe Loop +0%' },
                        { v: 'peak', zh: peakLabelZh, en: peakLabelEn }
                    ]
                });
            }
            (def.options || []).forEach(function (o) { list.push(o); });
            return list;
        }
        function _chipDefaultOpts(def) {
            var opts = {};
            _chipOptionDefs(def).forEach(function (od) { opts[od.id] = od.def; });
            return opts;
        }
        function _chipOptVal(inst, od) {
            var v = inst.opts && inst.opts[od.id];
            for (var i = 0; i < od.choices.length; i++) if (od.choices[i].v === v) return v;
            return od.def;
        }
        function _chipLoopMode(inst, def) {
            var st = def.ultCharge ? _chipLoopStats(def, inst && inst.opts) : null;
            if (!st || st.peak === 0) return 'safe';
            if (st.n < 2) return 'peak';
            return inst && inst.opts && inst.opts.loopMode === 'safe' ? 'safe' : 'peak';
        }

        /* ---------- 后端接入点：已装芯片 → 额外能量（已乘折算系数） ---------- */
        function chipAgg(D, E) {
            var r = { on: false, first: 0, loop: 0, loopUlt: 0, ult: [0, 0, 0], items: [] };
            _chipsOn.forEach(function (inst) {
                var def = _chipDef(inst.id);
                if (!def) return;
                var m = def.scale === 'none' ? 1 : def.scale === 'D' ? D : D * E;
                var fr = +def.firstCharge || 0, lr = +def.loopCharge || 0, ur = 0, mode = 'safe', u = [0, 0, 0];
                var instOpts = inst.opts || null;
                if (def.ultCharge) {
                    var st = _chipLoopStats(def, instOpts);
                    mode = _chipLoopMode(inst, def);
                    ur = mode === 'peak' ? st.peak : 0;
                    u = _chipUlts(def, 3, instOpts).map(function (x) { return x * m; });
                }
                r.on = true;
                r.first += fr * m; r.loop += (lr + ur) * m; r.loopUlt += ur * m;
                u.forEach(function (x, i) { r.ult[i] += x; });
                r.items.push({ def: def, mode: mode, fr: fr, lr: lr, ur: ur, m: m, first: fr * m, loop: (lr + ur) * m, ult: u });
            });
            return r;
        }

        /* ---------- 文案：能量标签与规则简注（都由数值自动生成，不用手写） ---------- */
        function _chipEnergyTags(def, inst) {
            var t = [], fc = +def.firstCharge || 0, lc = +def.loopCharge || 0;
            if (fc) t.push({ zh: '首发前 +' + _chipPct(fc) + '%', en: 'Before 1st ult +' + _chipPct(fc) + '%' });
            if (lc) t.push({ zh: '每轮循环 +' + _chipPct(lc) + '%', en: 'Per loop +' + _chipPct(lc) + '%' });
            if (def.ultCharge) {
                var st = _chipLoopStats(def, inst && inst.opts);
                if (st.sum > 0 || (inst && inst.opts)) {
                    t.push(st.n === 1 ? { zh: '每次大招 +' + _chipPct(st.sum) + '%', en: '+' + _chipPct(st.sum) + '% per ult' }
                                      : { zh: '每 ' + st.n + ' 次大招 +' + _chipPct(st.sum) + '%', en: '+' + _chipPct(st.sum) + '% every ' + st.n + ' ults' });
                }
            }
            if (def.ultThreshold) {
                var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
                var th = def.ultThreshold(curCar);
                if (def.id === 'catnap') {
                    var isMmm = curCar && (curCar.id === 10058 || (curCar.name && curCar.name.indexOf('猫眠梦') !== -1));
                    if (isMmm) {
                        t.push({ zh: '猫眠梦专属：大招阈值 66%', en: 'Catnap Exclusive: Ult 66%' });
                    } else {
                        t.push({ zh: '大招阈值 90%', en: 'Ult Threshold 90%' });
                    }
                } else if (th && th < 100) {
                    t.push({ zh: '大招阈值 ' + th + '%', en: 'Ult Threshold ' + th + '%' });
                }
            }
            if (def.efficiencyBonus) {
                var eb = _chipPct(def.efficiencyBonus * 100);
                t.push({ zh: '充能效率 +' + eb + '%', en: 'Charge Eff +' + eb + '%' });
            }
            if (def.ultDurationMult) {
                var dm = +def.ultDurationMult(typeof _selectedCar !== 'undefined' ? _selectedCar : null) || 1;
                if (dm > 1.0001) {
                    t.push({ zh: '大招耗能 −40%（时长×' + dm.toFixed(2) + '）', en: 'Ult Cost −40% (Dur ×' + dm.toFixed(2) + ')' });
                }
            }
            return t;
        }
        function _chipRuleTag(def, inst) {
            var u = def.ultCharge ? _chipUlts(def, 2, inst && inst.opts) : [0, 0], partsZh = [], partsEn = [];
            if (u[0] > 0) { partsZh.push('一大连发 +' + _chipPct(u[0]) + '%'); partsEn.push('1st chain +' + _chipPct(u[0]) + '%'); }
            if (u[1] > 0) { partsZh.push('二大连发 +' + _chipPct(u[1]) + '%'); partsEn.push('2nd chain +' + _chipPct(u[1]) + '%'); }
            if (def.scale !== 'none' && (def.firstCharge || def.loopCharge || def.ultCharge)) {
                partsZh.push(def.scale === 'D' ? '折算反制' : '折算反制与充能效率');
                partsEn.push(def.scale === 'D' ? 'Scaled by Counter' : 'Counter & Eff');
            }
            return partsZh.length ? { zh: partsZh.join(' · '), en: partsEn.join(' · ') } : null;
        }

        /* ---------- 渲染 ---------- */
        function _chipIcoHtml(def) {
            var ch = (def.name.zh || def.id).charAt(0);
            var src = def.icon ? ((typeof _ICONS !== 'undefined' && _ICONS[def.icon]) || (CHIP_ICON_DIR + def.icon)) : '';
            return '<span class="chip-ico' + (src ? '' : ' is-fb') + '" aria-hidden="true">'
                + (src ? '<img src="' + _chipAttr(src) + '" alt="" decoding="async" draggable="false">' : '')
                + '<span class="chip-ico-fb">' + ch + '</span></span>';
        }
        function _chipTagsHtml(def, inst) {
            return _chipEnergyTags(def, inst).map(function (t) { return '<span class="chip-tag is-energy">' + _c2(t.zh, t.en) + '</span>'; }).join('');
        }
        function _chipOptsHtml(inst, def) {
            var defs = _chipOptionDefs(def);
            if (!defs.length) return '';
            var h = '<div class="chip-opts">';
            defs.forEach(function (od) {
                var cur = _chipOptVal(inst, od);
                h += '<div class="chip-opt"><div class="chip-opt-label"><span>' + _c2(od.label.zh, od.label.en) + '</span></div><div class="chip-seg' + (od.id === 'level' ? ' chip-seg-levels' : '') + '" role="radiogroup">'
                    + od.choices.map(function (c) {
                        return '<button type="button" role="radio" aria-checked="' + (c.v === cur) + '" class="' + (c.v === cur ? 'is-on' : '') + '" data-act="opt" data-id="' + _chipAttr(def.id)
                            + '" data-opt="' + _chipAttr(od.id) + '" data-val="' + _chipAttr(c.v) + '">' + _c2(c.zh, c.en) + '</button>';
                    }).join('') + '</div></div>';
            });
            return h + '</div>';
        }
        function _chipSlotHtml(inst) {
            var def = _chipDef(inst.id);
            if (!def) return '';
            return '<div class="chip-slot is-filled' + (_chipNewId === def.id ? ' is-new' : '') + '" data-chip="' + _chipAttr(def.id) + '">'
                + _chipIcoHtml(def)
                + '<div class="chip-body"><div class="chip-head"><span class="chip-name">' + _c2(def.name.zh, def.name.en) + '</span><span class="chip-tags">' + _chipTagsHtml(def, inst) + '</span></div>'
                + '<div class="chip-desc">' + _c2(def.desc.zh, def.desc.en) + '</div></div>'
                + '<div class="chip-acts">'
                + (_chipSlotType(def) === 'v' ? '<button type="button" class="chip-act" data-act="swap" aria-expanded="' + _chipPickerWant + '">' + _CHIP_SVG.swap + '<span class="chip-sr zh">更换芯片</span><span class="chip-sr lang-en">Swap chip</span></button>' : '')
                + '<button type="button" class="chip-act" data-act="remove" data-id="' + _chipAttr(def.id) + '">' + _CHIP_SVG.x + '<span class="chip-sr zh">卸下芯片</span><span class="chip-sr lang-en">Remove chip</span></button>'
                + '</div>' + _chipOptsHtml(inst, def) + '</div>';
        }
        function _chipEmptyHtml() {
            var open = _chipPickerWant && !_chipSwapTarget;
            return '<button type="button" class="chip-slot is-empty' + (open ? ' is-open' : '') + '" data-act="open" aria-expanded="' + open + '">'
                + '<span class="chip-add-ico">' + _CHIP_SVG.plus + '</span><span>' + _c2('选择芯片', 'Choose a chip') + '</span></button>';
        }
        function _chipRenderGrid() {
            var grid = _chipEl('chipGrid'), q = ((_chipEl('chipSearch') || {}).value || '').trim().toLowerCase();
            if (!grid) return;
            var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
            var lang = typeof currentLang !== 'undefined' ? currentLang : 'zh';
            // 无搜索过滤且已构建过网格时：直接按 data-id 增量更新选中态、锁定态、禁用态和副标题，避免每次重建 DOM 和重新解码图片
            if (!q && grid.__built && grid.__lang === lang && grid.__q === '') {
                var tiles = grid.querySelectorAll('.chip-tile');
                if (tiles.length === CHIP_REGISTRY.length) {
                    var tileMap = {};
                    for (var ti = 0; ti < tiles.length; ti++) {
                        tileMap[tiles[ti].getAttribute('data-id')] = tiles[ti];
                    }
                    var matchedAll = true;
                    for (var i = 0; i < CHIP_REGISTRY.length; i++) {
                        var d = CHIP_REGISTRY[i], tile = tileMap[d.id];
                        if (!tile) { matchedAll = false; break; }
                        var on = _chipIndex(d.id) >= 0;
                        var locked = !_chipCanEquip(d, curCar);
                        var type = _chipSlotType(d);
                        var wrongSwap = _chipSwapTarget && _chipSlotType(_chipDef(_chipSwapTarget)) !== type;
                        var full = _chipCount(type) >= _chipCapacity(type);
                        var disabled = locked || wrongSwap || (!_chipSwapTarget && full && !on) || (_chipSwapTarget && on && d.id !== _chipSwapTarget);
                        var sub = _chipEnergyTags(d).concat(d.stats || []).map(_chipTxt).join(' · ');
                        tile.classList.toggle('is-on', on);
                        tile.classList.toggle('is-locked', locked);
                        tile.setAttribute('aria-pressed', on ? 'true' : 'false');
                        tile.disabled = !!disabled;
                        var subEl = tile.querySelector('.chip-tile-sub');
                        if (subEl && subEl.textContent !== sub) subEl.textContent = sub;
                    }
                    if (matchedAll) {
                        _chipEl('chipEmpty').classList.add('is-gone');
                        return;
                    }
                }
            }
            var total = 0;
            grid.innerHTML = CHIP_CATEGORIES.map(function (cat) {
                var catKw = (cat.zh + ' ' + cat.en + ' ' + (cat.subZh || '') + ' ' + (cat.subEn || '')).toLowerCase();
                var items = CHIP_REGISTRY.filter(function (d) {
                    if (d.category !== cat.id) return false;
                    if (!q) return true;
                    var hay = (d.name.zh + ' ' + d.name.en + ' ' + d.desc.zh + ' ' + d.desc.en + ' ' + (d.allowLabel ? d.allowLabel.zh + ' ' + d.allowLabel.en : '') + ' ' + catKw).toLowerCase();
                    return hay.indexOf(q) >= 0;
                });
                if (!items.length) return '';
                total += items.length;
                var subHead = cat.subZh ? '<span class="chip-cat-sub">' + _c2(cat.subZh, cat.subEn) + '</span>' : '';
                var tilesHtml = items.map(function (d) {
                    var on = _chipIndex(d.id) >= 0;
                    var locked = !_chipCanEquip(d, curCar);
                    var sub = _chipEnergyTags(d).concat(d.stats || []).map(_chipTxt).join(' · ');
                    var type = _chipSlotType(d);
                    var wrongSwap = _chipSwapTarget && _chipSlotType(_chipDef(_chipSwapTarget)) !== type;
                    var full = _chipCount(type) >= _chipCapacity(type);
                    var disabled = locked || wrongSwap || (!_chipSwapTarget && full && !on) || (_chipSwapTarget && on && d.id !== _chipSwapTarget);
                    var lockBadge = d.allowLabel ? '<span class="chip-tile-lock">' + _chipAttr(_chipTxt(d.allowLabel)) + '</span>' : '';
                    return '<button type="button" class="chip-tile' + (on ? ' is-on' : '') + (locked ? ' is-locked' : '') + '" data-act="pick" data-id="' + _chipAttr(d.id) + '" aria-pressed="' + on + '"' + (disabled ? ' disabled' : '') + '>'
                        + _chipIcoHtml(d) + '<span class="chip-tile-main"><span class="chip-tile-head"><span class="chip-tile-name">' + _c2(d.name.zh, d.name.en) + '</span>' + lockBadge + '</span><span class="chip-tile-sub">' + _chipAttr(sub) + '</span></span>'
                        + '<span class="chip-tile-check" aria-hidden="true"></span></button>';
                }).join('');
                return '<section class="chip-cat" data-cat="' + _chipAttr(cat.id) + '">'
                    + '<div class="chip-cat-head"><span class="chip-cat-title">' + _c2(cat.zh, cat.en) + '</span>'
                    + '<span class="chip-cat-count">' + items.length + '</span>'
                    + subHead
                    + '<span class="chip-cat-line" aria-hidden="true"></span></div>'
                    + '<div class="chip-grid">' + tilesHtml + '</div>'
                    + '</section>';
            }).join('');
            if (grid.__q !== q) {
                var sc = _chipEl('chipPickerScroll');
                if (sc) sc.scrollTop = 0;
            }
            grid.__built = true;
            grid.__lang = lang;
            grid.__q = q;
            _chipEl('chipEmpty').classList.toggle('is-gone', total > 0);
        }
        function _chipSyncOpenFlag() {
            var card = _chipEl('cardChips');
            if (!card) return;
            [].forEach.call(card.querySelectorAll('[data-act="open"], [data-act="swap"]'), function (b) {
                var active = _chipPickerWant && (b.getAttribute('data-act') === 'open' ? !_chipSwapTarget : !!_chipSwapTarget && b.closest('.chip-slot').getAttribute('data-chip') === _chipSwapTarget);
                b.setAttribute('aria-expanded', active ? 'true' : 'false');
                if (b.getAttribute('data-act') === 'open') b.classList.toggle('is-open', active);
            });
        }
        function renderChips(instant) {
            var slots = _chipEl('chipSlots');
            if (!slots) return;
            _chipBindOnce();
            var core = _chipsOn.filter(function (i) { return _chipSlotType(_chipDef(i.id)) === 'core'; });
            var vChips = _chipsOn.filter(function (i) { return _chipSlotType(_chipDef(i.id)) === 'v'; });
            var html = core.map(_chipSlotHtml).join('') + vChips.map(_chipSlotHtml).join('')
                + (core.length < 1 || vChips.length < CHIP_MAX ? _chipEmptyHtml() : '');
            if (slots.__html !== html) {
                var fill = function () { slots.innerHTML = html; slots.__html = html; };
                if (slots.__html === undefined || instant) fill(); else _flipHeight(slots, fill, instant);
            }
            _chipNewId = '';
            var bd = _chipEl('chipsLimitBadge');
            if (bd) { var bh = _c2('核心 1 · V型 ' + CHIP_MAX, 'Core 1 · V ' + CHIP_MAX); if (bd.__html !== bh) { bd.innerHTML = bh; bd.__html = bh; } }
            var se = _chipEl('chipSearch');
            if (se) { se.classList.toggle('is-gone', CHIP_REGISTRY.length <= 6); se.placeholder = currentLang === 'en' ? 'Search chips…' : '搜索芯片…'; }
            var grid = _chipEl('chipGrid');
            if (_chipPickerWant || !grid || !grid.__built) _chipRenderGrid();
            _chipSyncOpenFlag();
        }

        /* ---------- 交互 ---------- */
        function _chipPickerSet(open, instant) {
            _chipPickerWant = !!open;
            if (!open) _chipSwapTarget = null;
            if (open) {
                var s = _chipEl('chipSearch'); if (s) s.value = '';
                var sc = _chipEl('chipPickerScroll'); if (sc) sc.scrollTop = 0;
                _chipRenderGrid();
            }
            slideShow(_chipEl('chipPicker'), open, instant);
            _chipSyncOpenFlag();
        }
        function chipEquip(id) {
            var def = _chipDef(id);
            if (!def) return;
            var type = _chipSlotType(def);
            var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
            var at = _chipIndex(id);
            if (!_chipCanEquip(def, curCar) && at < 0) return;
            if (_chipSwapTarget) {
                var targetIdx = _chipIndex(_chipSwapTarget);
                if (targetIdx >= 0) {
                    if (_chipSlotType(_chipDef(_chipSwapTarget)) !== type) return;
                    if (id === _chipSwapTarget) {
                        // 点击当前芯片：保持不变
                    } else if (_chipIndex(id) >= 0) {
                        // 已经装在其他槽位上：禁止重复装入
                        return;
                    } else {
                        // 替换指定槽位
                        _chipsOn[targetIdx] = { id: id, opts: _chipDefaultOpts(def) };
                        _chipNewId = id;
                    }
                }
                _chipSwapTarget = null;
            } else {
                if (at >= 0) _chipsOn.splice(at, 1);                                   // 再点一次 = 卸下
                else {
                    if (_chipCount(type) >= _chipCapacity(type)) return;
                    _chipsOn.push({ id: id, opts: _chipDefaultOpts(def) });
                    _chipNewId = id;
                }
            }
            var slots = _chipEl('chipSlots');
            if (slots && _motionOK() && slots.offsetParent !== null) {
                slots.__preH0 = slots.getBoundingClientRect().height;
            }
            _chipPickerSet(false);
            _chipChanged(false);
        }
        function chipSetOpt(id, opt, val) {
            var at = _chipIndex(id);
            if (at < 0) return;
            _chipsOn[at].opts = _chipsOn[at].opts || {};
            _chipsOn[at].opts[opt] = val;
            _chipChanged(true);
        }
        function _chipAfterRender() {
            _userInput = true;
            if (window.__pvRefreshCollapse) window.__pvRefreshCollapse(false);   // 手机上卡片标题旁的摘要
            if (!isRestoringConfig) {
                window.__skipChainFlip = true;
                try { calculate(); } finally { window.__skipChainFlip = false; }
                if (window.CommunityPlans && typeof window.CommunityPlans.scheduleDraftSave === 'function') window.CommunityPlans.scheduleDraftSave();
            }
        }
        function _chipChanged(instantSlot) {
            if (typeof _selectedCar !== 'undefined' && _selectedCar) {
                var hn = _chipEl('inputHuineng');
                var before = hn ? hn.value : '';
                applyChipLimits(_selectedCar);
                if (hn && before !== hn.value) showToast(_('装备王牌核心后，汇能已调整为未增幅上限', 'Huineng adjusted to the non-boosted limit for Ace Core'));
            }
            renderChips(instantSlot);
            _chipAfterRender();
        }
        var _chipBound = false;
        function _chipBindOnce() {
            var card = _chipEl('cardChips');
            if (!card || _chipBound) return;
            _chipBound = true;
            card.addEventListener('error', function (e) {
                var img = e && e.target;
                if (img && img.tagName === 'IMG' && img.parentNode && img.parentNode.classList && img.parentNode.classList.contains('chip-ico')) {
                    img.parentNode.classList.add('is-fb');
                    img.remove();
                }
            }, true);
            card.addEventListener('click', function (e) {
                var b = e.target.closest ? e.target.closest('[data-act]') : null;
                if (!b || !card.contains(b) || b.disabled) return;
                var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
                if (act === 'open') {
                    var samePicker = _chipPickerWant && !_chipSwapTarget;
                    _chipSwapTarget = null;
                    _chipPickerSet(!samePicker);
                    if (_chipPickerWant && e.detail === 0) { var f = card.querySelector('.chip-tile'); if (f) f.focus({ preventScroll: true }); }
                } else if (act === 'swap') {
                    var slot = b.closest ? b.closest('.chip-slot') : null;
                    _chipSwapTarget = slot ? slot.getAttribute('data-chip') : null;
                    _chipPickerSet(true);
                    if (_chipPickerWant && e.detail === 0) { var f = card.querySelector('.chip-tile'); if (f) f.focus({ preventScroll: true }); }
                } else if (act === 'close') {
                    _chipSwapTarget = null;
                    _chipPickerSet(false);
                }
                else if (act === 'pick') chipEquip(id);
                else if (act === 'remove') chipEquip(id);
                else if (act === 'opt') chipSetOpt(id, b.getAttribute('data-opt'), b.getAttribute('data-val'));
            });
            card.addEventListener('input', function (e) { if (e.target && e.target.id === 'chipSearch') _chipRenderGrid(); });
            card.addEventListener('keydown', function (e) {
                if (e.key !== 'Escape' || !_chipPickerWant) return;
                _chipPickerSet(false);
                var t = card.querySelector('[data-act="open"], [data-act="swap"]');
                if (t) t.focus({ preventScroll: true });
            });
        }
        document.addEventListener('pv-lang', function () { renderChips(true); });

        /* ---------- 摘要 / 分享链接编码（后端接入时用） ---------- */
        window.__chipSummary = function () {      // 手机端卡片收起时标题旁的摘要（v4.js 的 CARDS 读它）
            if (!_chipsOn.length) return [_('未装备', 'None'), false];
            return [_chipsOn.map(function (i) { var d = _chipDef(i.id); return d ? _chipTxt(d.name) : ''; }).join(' + '), true];
        };
        function chipSerialize() {                // 'hunter.loopMode=peak' / '0'（无芯片）；多枚用 - 连接
            if (!_chipsOn.length) return '0';
            return _chipsOn.map(function (inst) {
                var o = Object.keys(inst.opts || {}).map(function (k) { return k + '=' + inst.opts[k]; }).join(',');
                return inst.id + (o ? '.' + o : '');
            }).join('-');
        }
        function chipRestore(str, forceKeep) {
            _chipsOn = [];
            var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
            if (str && str !== '0') String(str).split('-').forEach(function (part) {
                var dot = part.indexOf('.'), id = dot < 0 ? part : part.slice(0, dot);
                var def = _chipDef(id);
                if (!def || _chipIndex(id) >= 0) return;
                var type = _chipSlotType(def);
                // 分享链接先恢复芯片、后恢复车辆；暂存 V 芯片后再按实际车辆裁剪。
                var limit = forceKeep && type === 'v' ? 7 : _chipCapacity(type);
                if (_chipCount(type) >= limit) return;
                if (!forceKeep && !_chipCanEquip(def, curCar)) return;
                var opts = _chipDefaultOpts(def);
                var odefs = _chipOptionDefs(def);
                if (dot >= 0) part.slice(dot + 1).split(',').forEach(function (kv) {
                    var p = kv.split('='), k = p[0], v = p[1];
                    if (!k || v === undefined) return;
                    for (var oi = 0; oi < odefs.length; oi++) {
                        if (odefs[oi].id === k) {
                            for (var ci = 0; ci < odefs[oi].choices.length; ci++) {
                                if (odefs[oi].choices[ci].v === v) { opts[k] = v; break; }
                            }
                            break;
                        }
                    }
                });
                _chipsOn.push({ id: id, opts: opts });
            });
            if (curCar) applyChipLimits(curCar);
            renderChips(true);
        }

       /* ---------- 增益装置（团魂获能专用，限装 1 个） ---------- */
       function getDevice() {
           for (var i = 0; i < DEVICE_TYPES.length; i++) {
               if (_mc('dev_chk_' + DEVICE_TYPES[i])) return DEVICE_TYPES[i];
           }
           return '';
       }
       function setEnvSliders(c, d) {
           var cr = document.getElementById('counterRange'), dr = document.getElementById('debuffRange');
           cr.value = c; dr.value = d;
           if (window._renderOdoValue) {
               window._renderOdoValue(document.getElementById('counterValue'), cr.value + '%');
               window._renderOdoValue(document.getElementById('debuffValue'), dr.value + '%');
           } else {
               document.getElementById('counterValue').innerText = cr.value + '%';
               document.getElementById('debuffValue').innerText = dr.value + '%';
           }
           [cr, dr].forEach(function (r) {           // 滑块填充色（平时由 view.js 在 input 事件里同步）
               var min = +r.min || 0, max = +r.max || 100;
               r.style.setProperty('--fill', ((+r.value - min) / (max - min) * 100).toFixed(2) + '%');
           });
       }
       // 赋能卡的勾选态 / 互斥置灰交给站内原来的 handleEmpowerChange 重算（借 isRestoringConfig 让它这次不触发计算）
       function _refreshEmpowerUI() {
           var boxes = document.querySelectorAll('.empower-card .empower-checkbox');
           if (!boxes.length || typeof handleEmpowerChange !== 'function') return;
           var prev = isRestoringConfig;
           isRestoringConfig = true;
           try { handleEmpowerChange(boxes[0]); } finally { isRestoringConfig = prev; }
       }
       // 团魂获能 + 装了装置 = 单人竞速 / 组队竞速 / 巅峰赛，这三种模式没有反制、也没有赋能：
       // 反制卡、赋能卡一起变灰锁住（反制归零、赋能全关）；条件不成立时解锁并还原成锁定前的样子
       function syncEnvLock() {
           var on = !!getDevice();
           var card = document.querySelector('.counter-card');
           var cr = document.getElementById('counterRange'), dr = document.getElementById('debuffRange');
           if (!card || !cr || !dr) return;
           if (on) {
               if (!_devSavedEnv) _devSavedEnv = { c: cr.value, d: dr.value };
               setEnvSliders(0, 0);
           } else if (_devSavedEnv) {
               if (_mv('counterRange') === 0 && _mv('debuffRange') === 0) setEnvSliders(_devSavedEnv.c, _devSavedEnv.d);
               _devSavedEnv = null;
           }
           cr.disabled = dr.disabled = on;
           card.classList.toggle('is-locked', on);
           slideShow(document.getElementById('devCounterNote'), on);

           var emp = document.querySelector('.empower-card');
           var boxes = [].slice.call(document.querySelectorAll('.empower-card .empower-checkbox'));
           if (emp && boxes.length) {
               if (on) {
                   if (!_devSavedEmp) {
                       _devSavedEmp = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.id; });
                       boxes.forEach(function (b) { b.checked = false; });
                       _refreshEmpowerUI();
                   }
                   boxes.forEach(function (b) { b.disabled = true; });
               } else if (_devSavedEmp) {
                   if (!boxes.some(function (b) { return b.checked; })) {
                       _devSavedEmp.forEach(function (id) { var b = document.getElementById(id); if (b) b.checked = true; });
                   }
                   _devSavedEmp = null;
                   _refreshEmpowerUI();
               }
               emp.classList.toggle('is-locked', on);
               slideShow(document.getElementById('devEmpowerNote'), on);
           }
           if (window.__pvRefreshCollapse) window.__pvRefreshCollapse(false);   // 手机上赋能卡标题旁的摘要（已锁定 / 未启用）
       }
       /* 主车定位与当前模式不符时，把该模式的调整区整卡变灰锁住 —— 做法与「装了增益装置锁反制 / 赋能」完全一致：
           团魂获能：辅助车吃不到队友给的团魂能量；辅助供能：非辅助车没有给队友的辅助充能。
           条件不成立时解锁，并把各控件还原成锁定前的禁用态（幂等，可反复调用）。 */
        function _lockCard(card, on) {
            if (!card) return;
            card.classList.toggle('is-locked', on);
            var fields = card.querySelectorAll('input, select, textarea, button');
            [].forEach.call(fields, function (f) {
                if (on) {
                    if (f.getAttribute('data-lock-prev') === null) f.setAttribute('data-lock-prev', f.disabled ? '1' : '0');
                    f.disabled = true;
                } else if (f.getAttribute('data-lock-prev') !== null) {
                    f.disabled = f.getAttribute('data-lock-prev') === '1';
                    f.removeAttribute('data-lock-prev');
                }
            });
        }
        function syncCarLock() {
            var car = (typeof _selectedCar !== 'undefined') ? _selectedCar : null;
            var isSup = !!car && car.position === '辅助位';
            var m = getCalcMode();
            if (m === 'team') {
                _lockCard(document.getElementById('cardTeamSrc'), isSup);
                _lockCard(document.getElementById('cardTeamIn'), isSup);
            }
            if (m === 'support') _lockCard(document.getElementById('cardSupportOut'), !!car && !isSup);
        }
        /* 装置开关：先把 checkbox 与数值一次算完，再让各块自己跑收放动画。
           别改成「让 .tm-stack 容器统一做高度动画」—— 子元素在容器内的位置是布局算出来的，
           容器高度动画管不住它：内部一瞬时切换，下方卡片就直接瞬移到新位置（实测 top 1328→1106 硬跳），
           比现在还糟。真正要处理的是收起动画「慢起步」，见 morph() 里 closing 用的缓动。 */
        function _deviceToggleFlow(el, deferRender) {
            _devState = el.checked ? el.value : '';
            for (var i = 0; i < DEVICE_TYPES.length; i++) {
                var cb = document.getElementById('dev_chk_' + DEVICE_TYPES[i]);
                if (cb) cb.checked = (DEVICE_TYPES[i] === _devState);
            }
            updateDeviceUI(false, deferRender);
        }
        function setDevice(type, fromRestore) {
           for (var i = 0; i < DEVICE_TYPES.length; i++) {
               var cb = document.getElementById('dev_chk_' + DEVICE_TYPES[i]);
               if (cb) cb.checked = (DEVICE_TYPES[i] === type);
           }
           _devState = getDevice();
           updateDeviceUI(!!fromRestore);
       }
       function onDeviceToggle(el) {
           _deviceToggleFlow(el, !isRestoringConfig && getCalcMode() === 'team');
           if (!isRestoringConfig) {
               window.__flipTeamCards = true;
               try {
                   if (getCalcMode() === 'team') {
                       calculate();
                   } else {
                       triggerAutoCalc(currentActiveField || 'xianji');
                       calculate();
                   }
               } finally {
                   window.__flipTeamCards = false;
               }
           }
       }
       function updateDeviceUI(instant, deferRender) {
           var t = getDevice();
           for (var i = 0; i < DEVICE_TYPES.length; i++) {
               var it = document.getElementById('dev_item_' + DEVICE_TYPES[i]);
               if (it) it.classList.toggle('active', DEVICE_TYPES[i] === t);
           }
           slideShow(document.getElementById('devChargeOpts'), !!DEVICE_CHARGE[t], instant);
           slideShow(document.getElementById('teamInOff'), !!t, instant);
            slideShow(document.getElementById('devAccNote'), t === 'acc', instant);
            slideShow(document.getElementById('teamInSum'), getCalcMode() === 'team' && t !== 'acc', instant || getCalcMode() !== 'team');   // 加速装置没有「实收能量」可展示
           slideShow(document.getElementById('cardTeamIn'), getCalcMode() === 'team' && !t, instant || getCalcMode() !== 'team');
           syncEnvLock();
           updateSoulHint(typeof deferRender !== 'undefined' ? deferRender : (!(typeof isInit !== 'undefined' && (isInit === true || (!_selectedCar && !_userInput))) && getCalcMode() === 'team'));
       }
       function updateSoulHint(deferRender) {
           var h = document.getElementById('soulHint');
           if (!h) return;
           var t = getDevice();
           var _sh = t === 'acc' ? _('当前装的是<b>加速装置</b>：它不提供充能，团魂对它无效；首个大招攒到 80% 就能放。', 'The <b>Accel Device</b> gives no charge, so Team Soul does nothing for it — the 1st ult fires at 80%.') : t === 'loop' ? _('当前装的是<b>循环装置</b>：固定值，团魂对它无效。', 'The <b>Loop Device</b> is a fixed value — Team Soul does not affect it.')
               : DEVICE_CHARGE[t] ? _('团魂放大<b>', 'Team Soul boosts the <b>') + deviceName(t) + _('</b>的辅助充能：每次 ', '</b> charge: ') + DEVICE_CHARGE[t] + '% × (1 + ' + _('团魂', 'Soul') + ')' + _('。', '.')
               : _('团魂放大<b>队友给你的辅助充能</b>：单次 × (1 + 团魂)。', 'Team Soul boosts the <b>assist charge allies give you</b>: per hit × (1 + Soul).');
           _morphInlineBox(h, _sh);
           if (!deferRender) _tmRender();   // 装置 / 队友给法变了，团魂可能变成「不适用」：锁、状态字、状态条跟着换
       }
       function updateDevLoopHint(ultDur) {
           var h = document.getElementById('devLoopHint');
           if (!h) return;
           var avg = ultDur > 0 ? ultDur / 13 : 0;
           _morphInlineBox(h, _('大招实机 ', 'Ult lasts ') + ultDur.toFixed(2) + _(' 秒 ÷ 13 秒 ≈ 平均每轮 ', 's ÷ 13s ≈ ') + avg.toFixed(2) + _(' 次，保底每轮 ', ' per loop on average, guaranteed ') + Math.floor(avg + 0.000001) + _(' 次；求稳按保底填。', ' — use that for a safe estimate.'));
       }
       function deviceName(t) {
           return t === 'acc' ? _('加速装置', 'Accel Device') : t === 'loop' ? _('循环装置', 'Loop Device') : t === 'chg' ? _('充能装置', 'Charge Device') : t === 'schg' ? _('超级充能装置', 'Super Charge Device') : _('无', 'None');
       }

       /* ---------- 辅助车数据（car-database 的 assist_* 字段，由 scripts/extract-cars.js 生成） ---------- */
       function assistHitsOf(car) {
           if (!car || !car.assist_charge) return 1;
           if (car.assist_hits) return car.assist_hits;
           if (car.assist_kind === 'per_sec') return car.ult_duration ? Math.floor(car.ult_duration + 0.000001) : 1;
           return 1;
       }
       function assistKindText(car) {
           var k = car.assist_kind, v = car.assist_charge;
           if (k === 'full') return _('大招直接为队友<b>补满一管</b>能量', 'the ult <b>refills an ally\'s whole bar</b>');
           if (k === 'per_sec') return _('大招期间每秒给队友 <b>' + v + '%</b>（大招 ' + (car.ult_duration || '?') + ' 秒，按 ' + assistHitsOf(car) + ' 次计）',
               '<b>' + v + '%</b> to allies every second during the ult (' + (car.ult_duration || '?') + 's → ' + assistHitsOf(car) + ' hits)');
           if (k === 'per_nitro') return _('大招状态下自己每用一次氮气给队友 <b>' + v + '%</b>（次数按大招内用氮次数填）',
               '<b>' + v + '%</b> to allies each time you use nitro during the ult (set hits to your nitro count)');
           var hits = assistHitsOf(car);
           return _('给非辅助位队友 <b>' + v + '%</b>' + (hits > 1 ? '，一次大招 ' + hits + ' 次' : '（大招开始时一次）'),
               '<b>' + v + '%</b> to non-support allies' + (hits > 1 ? ', ' + hits + ' hits per ult' : ' (once, when the ult starts)'));
       }
       function assistNote(car) {
           var n = currentLang === 'en' ? (car.assist_note_en || '') : (car.assist_note || '');
           return n ? '<span class="tm-src-note">' + n + '</span>' : '';
       }
       function _setLabel(id, zh, en) {
           var el = document.getElementById(id);
           if (el) el.innerHTML = '<span class="zh">' + zh + '</span><span class="lang-en">' + en + '</span>';
       }
       // 给法不同，输入框的含义也不同：标签跟着换
       function labelsForKind(kind, baseId, countId, mate) {
           var pre = mate ? '队友' : '', preEn = mate ? 'Ally ' : '';
           if (kind === 'per_sec') _setLabel(baseId, pre + '每秒辅助充能', preEn + 'assist charge per second');
           else if (kind === 'per_nitro') _setLabel(baseId, pre + '每次用氮辅助充能', preEn + 'assist charge per nitro');
           else if (kind === 'full') _setLabel(baseId, pre + '辅助充能（满管）', preEn + 'assist (full bar)');
           else _setLabel(baseId, pre + '单次辅助充能', preEn + 'assist charge per hit');
           if (countId) {
               if (kind === 'per_sec') _setLabel(countId, '一次大招持续秒数', 'Seconds per ult');
               else if (kind === 'per_nitro') _setLabel(countId, '大招内用氮次数', 'Nitros during ult');
               else _setLabel(countId, '一次大招给出次数', 'Hits per ult');
               if (countId === 'supCountLabel') {
                   if (kind === 'per_sec') _setLabel('supCountUnit', '秒', ' s');
                   else _setLabel('supCountUnit', '次', ' hits');
               }
           }
       }
       // 选车时读出这辆辅助车给队友的辅助充能，填进「辅助充能」
       function fillSupportFromCar(car) {
           if (car && car.assist_charge) {
               document.getElementById('supBase').value = car.assist_charge;
               document.getElementById('supCount').value = assistHitsOf(car);
               _supKind = car.assist_kind || 'once';
               if (getCalcMode() === 'support' && typeof flashSection === 'function') flashSection('cardSupportOut', ['supBase', 'supCount', 'supCore', 'supMateSoul', 'supMateEff']);
           } else {
               _supKind = 'once';
           }
           labelsForKind(_supKind, 'supBaseLabel', 'supCountLabel', false);
           renderSupportSource();
       }
       function renderSupportSource() {
            renderTeamCarWarn();   // 顺带刷新团魂获能的换车提示：两者调用点完全重合（重算 / 选车 / 切模式 / 切语言）
            syncCarLock();         // 主车定位与当前模式不符时，锁住该模式的调整区（变灰 + 禁用）
           var box = document.getElementById('supportSrc');
           if (!box) return;
           var car = (typeof _selectedCar !== 'undefined') ? _selectedCar : null;
           var _cls = '', _html = '';
           if (car && car.assist_charge) {
               _cls = 'is-ok';
               _html = _OK_ICO + _('已读取「', 'Read from "') + '<b>' + _n(car) + '</b>' + _('」：', '": ') + assistKindText(car) + _('。', '.') + assistNote(car);
           } else if (car) {
               _cls = 'is-warn';
               _html = _WARN_ICO2 + _('「', '"') + _n(car) + _('」是' + _pos(car.position) + '，没有给队友的辅助充能。请在上方选择一辆辅助车（列表已按辅助位筛选），或选择未上线车辆后手动填写。', '" is a ' + _pos(car.position) + ' car with no ally assist. Pick a support car above (the list is filtered to Support), or pick an unreleased car and fill in the values.');
           } else if (_selectedCarId === -1) {
               _html = _('未上线车辆：请按技能描述手填单次辅助充能。', 'Unreleased car: enter the assist charge from its skill text.');
           } else {
               _html = _('先在上方选择一辆辅助车，会自动读取它给队友的辅助充能。', 'Pick a support car above — its assist charge is filled in automatically.');
           }
           var _wHtml = '<span class="pv-box-in">' + _html + '</span>';
           if (box.__rawHtml === _wHtml && box.classList.contains('is-ok') === (_cls === 'is-ok') && box.classList.contains('is-warn') === (_cls === 'is-warn')) return;
           _morphInlineBox(box, _wHtml, function () { box.classList.remove('is-ok', 'is-warn'); if (_cls) box.classList.add(_cls); });
       }
       /* 团魂获能：辅助车吃不到队友给的团魂能量，主车选了辅助位就提示换掉。
           与「我的辅助输出」里那条反向提示（非辅助车选了辅助供能）共用同一套 .tm-src 样式与开合动画。 */
        function renderTeamCarWarn() {
            var box = document.getElementById('teamCarWarn');
            if (!box) return;
            var car = (typeof _selectedCar !== 'undefined') ? _selectedCar : null;
            var bad = getCalcMode() === 'team' && !!car && car.position === '辅助位';
            if (bad) {
                /* className handled in _morphInlineBox */
                _morphInlineBox(box, '<span class="pv-box-in">' + _WARN_ICO2 + _('「', '"') + _n(car) + _('」是辅助位，吃不到队友给的团魂能量。请换一辆非辅助位的车再测算。', '" is a Support car and cannot receive Team Soul energy from allies. Choose a non-Support car.') + '</span>', function () { box.className = 'tm-src is-warn' + (box.classList.contains('is-gone') ? ' is-gone' : ''); });
            }
            slideShow(box, bad);
        }
        function onSupBaseInput() {
           if (_supKind === 'full') { _supKind = 'once'; labelsForKind('once', 'supBaseLabel', 'supCountLabel', false); }
           calculate();
       }

       /* ---------- 团魂获能：队友辅助车 ----------
          复用站内选车框：同一个按钮样式（.car-list-btn）、同一套下拉（玻璃底、车图缩略图、吸顶品质筛选、选中品质色），
          手机上打开的也是同一个底部选车面板（v4.js 的 __pvSheet，列表换成这里的 #mateDropdown）。
          列表只放有辅助数据的车（新车在上），最上面一行是「手动填写」。 */
       var _mateQ = '', _mateQual = '';
       var _MATE_QUAL = [['', '全部', 'All'], ['传说', '传说', 'Legend'], ['史诗', '史诗', 'Epic'], ['稀有', '稀有', 'Rare'], ['普通', '普通', 'Common']];
       var _SEL_Q = { '普通': ' sel-common', '稀有': ' sel-rare', '史诗': ' sel-epic', '传说': ' sel-legend' };
       var _Q_ICO = '<svg class="ico pv-q" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17v.01"/></svg>';
       var _SEARCH_ICO = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></svg>';
       function mateId() { var e = document.getElementById('teamMateCar'); return e ? (parseInt(e.value, 10) || 0) : 0; }
       function _mateCars() {
           if (typeof CAR_DATABASE === 'undefined') return [];
           return (typeof sortCarsByAdded === 'function' ? sortCarsByAdded() : CAR_DATABASE.slice()).filter(function (c) { return c.assist_charge; });
       }
       function _assistTag(c) {
           return c.assist_kind === 'full' ? _('满管', 'full bar') : c.assist_kind === 'per_sec' ? c.assist_charge + _('%/秒', '%/s')
               : c.assist_kind === 'per_nitro' ? c.assist_charge + _('%/氮', '%/nitro') : c.assist_charge + '%';
       }
       function _carIcons(c, px, gap) {
           var p = getPosIcon(c.position), sp = getSpecIcon(c.specialization), h = '';
           if (p) h += '<img src="' + p + '" alt="" style="width:' + px + 'px;height:' + px + 'px;vertical-align:middle;margin-right:' + gap + 'px;">';
           if (sp) h += '<img src="' + sp + '" alt="" style="width:' + px + 'px;height:' + px + 'px;vertical-align:middle;margin-right:' + gap + 'px;">';
           return h;
       }
       function _thumbHtml(id) {
           var src = id > 0 ? (typeof _CAR_IMG !== 'undefined' && _CAR_IMG[id]) : ((typeof _ICONS !== 'undefined' && _ICONS['icon_mhyck_m.png']) || 'data/icon/icon_mhyck_m.png');
           return '<span class="pv-thumb">' + (src ? '<img loading="lazy" decoding="async" alt="" src="' + src + '">' : '') + '</span>';
       }
       function populateMateList() {
           var dd = document.getElementById('mateDropdown');
           if (!dd || typeof CAR_DATABASE === 'undefined') return;
           var list = _mateCars();
           var h = '<div class="mate-dd-head"><label class="mate-dd-search">' + _SEARCH_ICO
               + '<input type="search" id="mateSearch" autocomplete="off" enterkeyhint="search" placeholder="' + _('搜索辅助车 / 拼音首字母', 'Search support cars') + '"></label>'
               + '<div class="pv-dd-qual"></div></div>';
           h += '<div class="dropdown-option" data-id="0">' + _thumbHtml(-1)
               + '<span style="flex:1;"><span style="opacity:0.5;">' + _Q_ICO + '</span> ' + _('手动填写', 'Manual input') + '</span>'
               + '<span style="font-size:11px;color:var(--text-muted);">' + _('未上线车辆 / 自填数值', 'Unreleased / type it') + '</span></div>';
           for (var i = 0; i < list.length; i++) {
               var c = list[i];
               h += '<div class="dropdown-option" data-id="' + c.id + '" data-q="' + (c.quality || '') + '">' + _thumbHtml(c.id)
                   + '<span style="flex:1;">' + _carIcons(c, 18, 4) + ' ' + _n(c) + '</span>'
                   + '<span style="font-size:11px;color:var(--text-muted);">' + _assistTag(c) + '</span></div>';
           }
           h += '<div class="pv-dd-empty is-gone"></div>';
           dd.innerHTML = h;
           var s = document.getElementById('mateSearch');
           if (s) {
               s.value = _mateQ;
               s.addEventListener('input', function () { setMateQuery(this.value); });
           }
           if (!dd.__cspMateBound) {
               dd.__cspMateBound = true;
               dd.addEventListener('error', function (e) {
                   var img = e && e.target;
                   if (img && img.tagName === 'IMG' && img.parentNode && img.parentNode.classList && img.parentNode.classList.contains('pv-thumb')) {
                       img.remove();
                   }
               }, true);
               dd.addEventListener('click', function (e) {
                   var opt = e.target && e.target.closest ? e.target.closest('.dropdown-option[data-id]') : null;
                   if (!opt || !dd.contains(opt)) return;
                   var mid = parseInt(opt.getAttribute('data-id'), 10);
                   if (!isNaN(mid)) pickMateCar(mid);
               });
           }
           paintMateQual(dd.querySelector('.pv-dd-qual'));
           markMateSelected();
           filterMateList();
           renderMateLabel();
       }
       // 品质筛选按钮（桌面下拉顶部 / 手机选车面板共用）：数字按辅助车计
       function paintMateQual(host) {
           if (!host) return;
           var list = _mateCars(), counts = {};
           list.forEach(function (c) { counts[c.quality] = (counts[c.quality] || 0) + 1; });
           host.innerHTML = _MATE_QUAL.map(function (q) {
               var n = q[0] ? (counts[q[0]] || 0) : list.length;
               return '<button type="button" class="pv-qchip' + (q[0] === _mateQual ? ' on' : '') + '" data-q="' + q[0] + '">' + _(q[1], q[2]) + '<span>' + n + '</span></button>';
           }).join('');
       }
       function getMateQuery() { return _mateQ; }
       function setMateQuery(v) {
           _mateQ = String(v || '');
           var s = document.getElementById('mateSearch');
           if (s && s.value !== _mateQ) s.value = _mateQ;
           filterMateList();
       }
       function setMateQual(q) {
           _mateQual = q || '';
           paintMateQual(document.querySelector('#mateDropdown .pv-dd-qual'));
           filterMateList();
       }
       function resetMateFilter() { _mateQ = ''; _mateQual = ''; setMateQual(''); setMateQuery(''); }
       function filterMateList() {
           var dd = document.getElementById('mateDropdown');
           if (!dd) return;
           var q = _mateQ.trim().toLowerCase(), n = 0;
           [].forEach.call(dd.querySelectorAll('.dropdown-option'), function (o) {
               var id = parseInt(o.getAttribute('data-id'), 10) || 0;
               if (!id) { o.style.display = ''; return; }                 // 「手动填写」一直在
               var c = _carById(id), ok = !!c;
               if (ok && q) ok = c.name.toLowerCase().indexOf(q) >= 0 || (c.name_en && c.name_en.toLowerCase().indexOf(q) >= 0) || (c.search_text && c.search_text.indexOf(q) >= 0);
               if (ok && _mateQual) ok = c.quality === _mateQual;
               o.style.display = ok ? '' : 'none';
               if (ok) n++;
           });
           var empty = dd.querySelector('.pv-dd-empty');
           if (empty) { empty.textContent = _('没有符合条件的辅助车', 'No support cars match'); empty.classList.toggle('is-gone', n > 0); }
       }
       function markMateSelected() {
           var id = mateId(), manual = !id && _mv('teamInBase') > 0;
           [].forEach.call(document.querySelectorAll('#mateDropdown .dropdown-option'), function (o) {
               var oid = parseInt(o.getAttribute('data-id'), 10) || 0, c = oid ? _carById(oid) : null;
               var on = oid ? oid === id : manual;
               o.className = 'dropdown-option' + (on ? ' selected' + (c ? (_SEL_Q[c.quality] || '') : '') : '');
               o.setAttribute('aria-selected', on ? 'true' : 'false');
           });
       }
       // 按钮上的字：选了车 → 定位 / 专精图标 + 车名 + 给法；手填 → 「手动填写」；都没有 → 提示去选
       function renderMateLabel() {
           var lb = document.getElementById('mateListLabel');
           if (!lb) return;
           var c = mateId() ? _carById(mateId()) : null;
           if (c) lb.innerHTML = _carIcons(c, 14, 4) + '<span>' + _n(c) + '</span><span class="mate-lbl-v">' + _assistTag(c) + '</span>';
           else if (_mv('teamInBase') > 0) lb.innerHTML = '<span style="opacity:0.5;">' + _Q_ICO + '</span> ' + _('手动填写', 'Manual input');
           else lb.innerHTML = _('选择队友的辅助车', 'Pick the ally\'s support car');
           document.getElementById('mateListBtn').classList.toggle('is-empty', !c && !(_mv('teamInBase') > 0));
       }
       function _sheet() { return window.__pvSheet || null; }
       function closeMateDropdown() {
           var dd = document.getElementById('mateDropdown');
           if (dd && dd.classList.contains('show') && !dd.closest('.pv-sheet')) dd.classList.remove('show');
           var card = document.getElementById('cardTeamIn');
           if (card) card.classList.remove('mate-open');
       }
       function toggleMateDropdown() {
           var sh = _sheet();
           if (sh && sh.isMobile()) { sh.openMate(); return; }                // 手机：同一个底部选车面板
           ['filterPosMenu', 'filterSpecMenu', 'carDropdown'].forEach(function (id) { var m = document.getElementById(id); if (m) m.classList.remove('show'); });
           var dd = document.getElementById('mateDropdown');
           if (!dd) return;
           var open = !dd.classList.contains('show');
           if (!open) { closeMateDropdown(); return; }
           dd.classList.add('show');
           document.getElementById('cardTeamIn').classList.add('mate-open');
           filterMateList();
           // 和主选车下拉一样：打开时把已选的那辆滚到列表中间
           var sel = dd.querySelector('.dropdown-option.selected'), head = dd.querySelector('.mate-dd-head'), hh = head ? head.offsetHeight : 0;
           dd.scrollTop = sel && sel.style.display !== 'none' ? Math.max(0, sel.offsetTop - hh - (dd.clientHeight - hh - sel.offsetHeight) / 2) : 0;
           var s = document.getElementById('mateSearch');
           if (s && window.matchMedia('(hover: hover) and (pointer: fine)').matches) { try { s.focus({ preventScroll: true }); } catch (e) { s.focus(); } }
       }
       function pickMateCar(id) {
           document.getElementById('teamMateCar').value = String(id > 0 ? id : 0);
           closeMateDropdown();
           var sh = _sheet();
           if (sh) sh.close();
           onMateCarChange();
           if (!(id > 0)) {
               var b = document.getElementById('teamInBase');
               if (b && !(_isSheetMobile())) { try { b.focus({ preventScroll: true }); b.select(); } catch (e) {} }
           }
       }
       function _isSheetMobile() { var sh = _sheet(); return !!(sh && sh.isMobile()); }
       // 点到选车框外面、按 Esc：收起（和主选车下拉同一套行为）
       document.addEventListener('click', function (e) {
           if (!e.target.closest('.mate-list-box') && !e.target.closest('.pv-sheet')) closeMateDropdown();
       });
       document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeMateDropdown(); });
       document.addEventListener('click', function (e) {
           var b = e.target.closest('#mateDropdown .mate-dd-head .pv-qchip');
           if (!b) return;
           e.stopPropagation();
           setMateQual(b.getAttribute('data-q'));
           document.getElementById('mateDropdown').scrollTop = 0;
       }, true);

       function renderMateSource() {
           var box = document.getElementById('mateSrc');
           var id = mateId(), car = id ? _carById(id) : null;
           if (box) {
               if (car) _morphInlineBox(box, '<span class="pv-box-in">' + _OK_ICO + _('已读取「', 'Read from "') + '<b>' + _n(car) + '</b>' + _('」：', '": ') + assistKindText(car) + _('。', '.') + assistNote(car) + '</span>', function () { box.className = 'tm-src is-ok' + (box.classList.contains('is-gone') ? ' is-gone' : ''); });
               slideShow(box, !!car);
           }
       }
       function onMateCarChange(fromRestore) {
           var id = mateId(), car = id ? _carById(id) : null;
           if (!car) document.getElementById('teamMateCar').value = '0';
           if (car && !fromRestore) {
               document.getElementById('teamInBase').value = car.assist_charge;
               document.getElementById('teamInFirst').value = assistHitsOf(car);
               document.getElementById('teamInLoop').value = 0;
               if (typeof flashSection === 'function') flashSection('cardTeamIn', ['teamInBase', 'teamInFirst', 'teamInLoop', 'teamInCore', 'mateListBtn']);
           }
           _mateKind = car ? (car.assist_kind || 'once') : 'once';
           labelsForKind(_mateKind, 'teamInBaseLabel', null, true);
           renderMateSource();
           markMateSelected();
           renderMateLabel();
           if (!fromRestore && !isRestoringConfig) { triggerAutoCalc(currentActiveField); calculate(); }
       }
       function onMateBaseInput() {
           // 手动改了数值就不再算「某辆车」：选车框回到「手动填写」
           if (mateId()) { document.getElementById('teamMateCar').value = '0'; _mateKind = 'once'; labelsForKind('once', 'teamInBaseLabel', null, true); renderMateSource(); }
           markMateSelected();
           renderMateLabel();
           triggerAutoCalc(currentActiveField); calculate();
       }

       /* ---------- 额外能量：团魂获能的增益装置 / 队友辅助（首发与循环各一份） ---------- */
       // D = 1 − 反制，E = 充能效率

       /* ======================================================================
          团魂获能：团魂 / 先机 / 汇能 三值联动（先机汇能模式的「先机 ↔ 汇能」联动不受影响）
          - 默认：团魂自动算（首发所需的最低整数团魂，上限 200），先机 / 汇能 = 0
          - 三个值各有一把锁。锁 = 计算器不改它，手动照样能改；手动输入的值立刻上锁
            （所以「填完一个再填另一个，前一个自动锁定」天然成立）
          - 团魂没锁：只反算团魂，先机 / 汇能只当输入
          - 团魂锁了：反算没锁的先机 / 汇能
              · 两个都没锁：汇能取循环所需的最低值（先机对循环没用），先机补首发缺口；先机超过 30% 时再抬汇能
              · 只剩汇能：首发和循环都要满足；只剩先机：补首发缺口；都锁了：只做校验
          - 反算用的首发 / 循环总量是 calculate() 同一套公式的纯函数版（_tmFirst / _tmLoop），
            calculate() 每次都会对账，两边不一致会在控制台报出来
          ====================================================================== */
       var SOUL_MAX = 200;
       var _tm = { lock: { soul: false, xianji: false, huineng: false }, res: null, flashAll: false };
       var _chipStash = {};
       var _TM_KEYS = { soul: 'inputTuanhun', xianji: 'inputXianji', huineng: 'inputHuineng' };

       // calculate() 里除先机 / 汇能 / 团魂以外的全部条件（取值方式与 calculate() 一致）
       function _chipEnv() {
           var g = function (id) { var e = document.getElementById(id); return e ? (parseFloat(e.value) || 0) : 0; };
           var c = function (id) { var e = document.getElementById(id); return !!(e && e.checked); };
           var ot = parseFloat(document.getElementById('ultThreshold').value);
           if (isNaN(ot) || ot <= 0) ot = 100;
           var emp = [].map.call(document.querySelectorAll('.empower-checkbox:checked'), function (cb) { return cb.value; });
           var has = function (k) { return emp.indexOf(k) !== -1; };
           var T = has('weilai') ? Math.min(ot, 90) : ot;
           for (var ci = 0; ci < _chipsOn.length; ci++) {
               var cdef = _chipDef(_chipsOn[ci].id);
               if (cdef && typeof cdef.ultThreshold === 'function') {
                   var curCar = typeof _selectedCar !== 'undefined' ? _selectedCar : null;
                   var cth = cdef.ultThreshold(curCar);
                   if (cth && cth > 0) T = Math.min(T, cth);
               }
           }
           var dev = getDevice();
           var targetLoop = T;
           var targetFirst = (dev === 'acc') ? Math.min(targetLoop, 80) : targetLoop;
           var chipEff = typeof chipEffBonus === 'function' ? chipEffBonus() : 0;
           var E = (has('yichu') ? 1.05 : 1.00) + g('extraEfficiency') / 100 + chipEff - g('debuffRange') / 100;
           if (E < 0) E = 0;
           var exN = c('hasExtraNitro') ? g('valExtraNitro') : 0, exP = c('hasExtraPerSec') ? g('valExtraPerSec') : 0, exU = c('hasExtraUlt');
           var nrEl = document.querySelector('input[name="nitroRadio"]:checked'), nr = nrEl ? nrEl.value : '1x5';
           var nd = g('time_' + nr);
           var ratio = (nr === '2x2' || nr === '2x3' || nr === '2x25') ? 0.5 : nr === '3x2' ? 1 / 3 : 1.0;
           var chipDurMult = typeof chipUltDurMult === 'function' ? chipUltDurMult() : 1;
           var actualUlt = g('baseUltDuration') * chipDurMult * (T / 100);
           var npu;
           if (isManualNitroCount) { npu = parseInt(document.getElementById('inputNitroCount').value); if (isNaN(npu) || npu < 0) npu = 0; }
           else npu = nd > 0 ? Math.floor((actualUlt / nd) + 0.000001) : 0;
           var firstN = parseInt(document.getElementById('inputFirstNitroCount').value);
           if (isNaN(firstN) || firstN < 0) firstN = 0;
           var queyi = 0;
           if (has('queyi')) { if (c('queyi_sub_self')) queyi += 0.8; if (c('queyi_sub_enemy')) queyi += 1.2; }
           var chipResEnv = chipAgg(1 - (g('counterRange') / 100), E);
           var e = {
               T: T, targetFirst: targetFirst, targetLoop: targetLoop, D: 1 - (g('counterRange') / 100), E: E, chip: chipResEnv, start: g('startCharge'),
               baseNitro: g('baseNitro') * ratio, spec: c('isSpec') ? (10.0 * ratio) : 0,
               exNF: c('chkExtraNitroFirst') ? exN : 0, exNL: c('chkExtraNitroLoop') ? exN : 0,
               exUF: exU ? g('valExtraUltFirst') : 0, exUL: exU ? g('valExtraUltLoop') : 0,
               exPF: c('chkExtraPerSecFirst') ? exP : 0, exPL: c('chkExtraPerSecLoop') ? exP : 0,
               ctv: g('valCustomTrig'), ctF: parseInt(document.getElementById('customTrigFirstCount').value) || 0, ctL: parseInt(document.getElementById('customTrigLoopCount').value) || 0,
               nd: nd, actualUlt: actualUlt, npu: npu, firstN: firstN, queyi: queyi,
               hxF: has('huaxin') ? g('huaxin_sub_first') : 0, hxL: has('huaxin') ? g('huaxin_sub_loop') : 0,
               jzF: has('jiezou') ? g('jiezou_sub_first') : 0, jzL: has('jiezou') ? g('jiezou_sub_loop') : 0,
               fusu: has('fusu') ? (2.5 * 5.0) : 0, huishou: has('huishou') ? 10.0 : 0
           };
           // 装置 / 队友辅助那一项只随团魂变：按团魂值缓存，反算与建议值扫描时不用反复读页面
           var cache = {};
           e.tt = function (s) { var k = String(s); return cache[k] || (cache[k] = getTeamDeviceTerms(e.D, e.E, e.firstN, e.npu, s)); };
           var hn = document.getElementById('inputHuineng'), xn = document.getElementById('inputXianji');
           e.hMax = parseFloat(hn.dataset.baseMax) || parseFloat(hn.max) || 50;   // 反算按没增幅的基础上限封顶
           e.xMax = parseFloat(xn.max) || 30;
           e.na = _tmSoulNA();
           return e;
       }
       // 首发总量（与 calculate() 里 firstUltTotal 逐项同序相加，含三位小数截断）
       function _tmFirst(e, x, h, s) {
           var D = e.D, E = e.E;
           var single = (e.baseNitro * (1 + h / 100) + e.spec + e.exNF) * D * E;
           var dur = Math.floor(e.firstN * e.nd + 0.000001);
           var t = e.start + (x * D) + ((e.hxF * 7.0) * D * E) + (e.jzF * 4.0 * D) + (e.firstN * single) + (dur * e.exPF * D * E) + (dur * e.queyi * D);
           if (e.exUF > 0) t += e.exUF * D * E;
           if (e.ctF > 0) t += e.ctv * e.ctF * D * E;
           var tdx = e.tt(s);
           if (tdx.dev === 'loop') t += tdx.devLoopFirst;
           else if (tdx.devBase > 0) t += tdx.devFirst;
           else if (tdx.teamOn) t += tdx.teamFirst;
           var chipA = chipAgg(D, E);
           if (chipA.first > 0) t += chipA.first;
           return Math.floor(t * 1000 + 0.000001) / 1000;
       }
       // 每轮循环总量（与 calculate() 里 loopGrandTotal 同序）
       function _tmLoop(e, h, s) {
           var D = e.D, E = e.E, sec = Math.floor(e.actualUlt + 0.000001);
           var single = (e.baseNitro * (1 + h / 100) + e.spec + e.exNL) * D * E;
           var tdx = e.tt(s);
           var chipA = chipAgg(D, E);
           var t = ((e.queyi * sec + e.fusu + e.huishou + e.jzL * 4.0) * D) + ((e.hxL * 7.0) * D * E) + (e.npu * single)
               + (e.exUL * D * E) + (sec * e.exPL * D * E) + (e.ctv * e.ctL * D * E) + tdx.loop + (chipA.loop || 0);
           return Math.floor(t * 1000 + 0.000001) / 1000;
       }
       // 在 lo..hi 的 step 网格上找满足 ok 的最小值（ok 随取值单调：小的不满足、大的满足）；都不满足返回 null
       function _gridMin(lo, hi, step, ok) {
           var k = Math.round(1 / step), v = function (n) { return Math.round(n) / k; };
           var a = Math.round(lo * k), b = Math.round(hi * k);
           if (b < a || !ok(v(b))) return null;
           if (ok(v(a))) return v(a);
           while (b - a > 1) { var m = Math.floor((a + b) / 2); if (ok(v(m))) b = m; else a = m; }
           return v(b);
       }
       // 首发里吃不吃团魂：吃不到时给一句原因
       function _tmSoulReason(e) {
           var t = getTeamDeviceTerms(e.D, e.E, e.firstN, e.npu, 0);
           if (t.dev === 'acc') return _('加速装置没有可放大的充能项', 'the Accel Device has no charge to scale');
            if (t.dev === 'loop') return _('循环装置是固定值，不受团魂影响', 'the Loop Device is a fixed value');
           if (t.devBase > 0) return t.devFirstCount > 0 ? _('反制 / 充能效率把装置充能压成了 0', 'Counter / Efficiency zero the device charge') : _('首发前装置触发 0 次', 'the device triggers 0 times before the 1st ult');
           if (t.teamFull) return _('队友辅助是补满一管，不受团魂影响', 'the ally fills a whole bar, unaffected by Team Soul');
           if (t.teamBase <= 0) return _('还没有队友辅助充能，先选队友辅助车', 'no ally assist yet — pick the ally support car');
           if (t.teamFirstCount <= 0) return _('首发一大前收到 0 次队友辅助', '0 ally assists before the 1st ult');
           return _('反制 / 充能效率把队友辅助压成了 0', 'Counter / Efficiency zero the ally assist');
       }
       function _tmWrite(key, v) {
           var el = document.getElementById(_TM_KEYS[key]);
           var str = key === 'soul' ? String(Math.round(v)) : (v === 0 ? '0' : v.toFixed(1));
           var changed = parseFloat(el.value) !== parseFloat(str);
           if (el.value !== str) el.value = str;
           if ((changed || _tm.flashAll) && _motionOK() && document.activeElement !== el) {
               var sb = el.classList.contains('tm-solved');
               el.classList.remove(sb ? 'tm-solved' : 'tm-solved-b');
               el.classList.add(sb ? 'tm-solved-b' : 'tm-solved');
           }
       }
       function _tmCur() {
           var v = function (id) { return Math.max(0, parseFloat(document.getElementById(id).value) || 0); };
           return { x: v('inputXianji'), h: v('inputHuineng'), s: v('inputTuanhun') };
       }
       // 反算规则本体（纯函数）：给定三把锁和当前三个值，返回反算后的三个值 + 说明
       function _tmPlan(e, lock, x, h, s) {
            var T1 = e.targetFirst, T2 = e.targetLoop, notes = [], xMax = e.xMax, hMax = e.hMax;
            var F = function (a, b, c) { return _tmFirst(e, a, b, c); }, L = function (b, c) { return _tmLoop(e, b, c); };
            var gap1 = function (v) { return '<b>' + (Math.ceil((T1 - v) * 1000 - 0.000001) / 1000).toFixed(3) + '%</b>'; };
            var gap2 = function (v) { return '<b>' + (Math.ceil((T2 - v) * 1000 - 0.000001) / 1000).toFixed(3) + '%</b>'; };
            if (!e.na && !lock.soul) {
                // 团魂自动：没锁的先机 / 汇能不参与反算，按 0 计
                if (!lock.xianji) x = 0;
                if (!lock.huineng) h = 0;
                var f0 = F(x, h, 0), fM = F(x, h, SOUL_MAX);
                if (f0 >= T1) { s = 0; notes.push(['ok', _('不靠团魂也能首发，团魂取 0。', 'The 1st ult works without Team Soul, so it stays at 0.')]); }
                else if (fM >= T1) s = _gridMin(0, SOUL_MAX, 1, function (v) { return F(x, h, v) >= T1; });
                else if (fM > f0) { s = SOUL_MAX; notes.push(['warn', _('团魂拉到上限 ', 'Even the ') + SOUL_MAX + _('% 首发仍差 ', '% Team Soul cap leaves the 1st ult short by ') + gap1(fM) + _('，再加先机 / 汇能试试。', ' — add some Xianji / Huineng.')]); }
                else { s = 0; notes.push(['warn', _('团魂补不上首发缺口：', 'Team Soul can’t close the gap: ') + _tmSoulReason(e) + _('。首发还差 ', '. The 1st ult is short by ') + gap1(f0) + _('。', '.')]); }
            } else {
                var tX = !lock.xianji, tH = !lock.huineng, hL = 0;
                if (tH) {
                    // 循环所需的最低汇能；汇能拉满也不够时：若装备加速装置或未选车，不强行把汇能拉到上限，避免破坏首发80%阈值反算
                    hL = _gridMin(0, hMax, 0.1, function (v) { return L(v, s) >= T2; });
                    if (hL === null) {
                        if (e.na === 'acc' || typeof _selectedCar === 'undefined' || !_selectedCar) {
                            hL = 0;
                            if (L(hMax, s) > L(0, s)) notes.push(['warn', _('循环缺口较大（汇能拉满仍差 ', 'Loop gap is large (short by ') + gap2(L(hMax, s)) + _('），优先保首发。', ' even if maxed), prioritizing 1st ult.')]);
                        } else {
                            if (L(hMax, s) > L(0, s)) { hL = hMax; notes.push(['warn', _('汇能拉到上限 ', 'Even the ') + hMax + _('% 循环仍差 ', '% Huineng cap leaves the loop short by ') + gap2(L(hMax, s)) + _('。', '.')]); }
                            else hL = 0;
                        }
                    }
                }
                if (tX && tH) {
                    var nx = _gridMin(0, xMax, 0.1, function (v) { return F(v, hL, s) >= T1; }), nh = hL;
                    if (nx === null) {
                        nx = xMax;
                        nh = _gridMin(hL, hMax, 0.1, function (v) { return F(xMax, v, s) >= T1; });
                        if (nh === null) { nh = hMax; notes.push(['warn', _('先机、汇能都拉到上限，首发仍差 ', 'Even maxed Xianji and Huineng leave the 1st ult short by ') + gap1(F(xMax, hMax, s)) + _('。', '.')]); }
                    }
                    x = nx; h = nh;
                } else if (tH) {
                    var nh2 = _gridMin(hL, hMax, 0.1, function (v) { return F(x, v, s) >= T1; });
                    if (nh2 === null) { nh2 = hMax; notes.push(['warn', _('汇能拉到上限，首发仍差 ', 'Even maxed Huineng leaves the 1st ult short by ') + gap1(F(x, hMax, s)) + _('。', '.')]); }
                    h = nh2;
                } else if (tX) {
                    var nx2 = _gridMin(0, xMax, 0.1, function (v) { return F(v, h, s) >= T1; });
                    if (nx2 === null) { nx2 = xMax; notes.push(['warn', _('先机拉到上限 30%，首发仍差 ', 'Even 30% Xianji leaves the 1st ult short by ') + gap1(F(xMax, h, s)) + _('。', '.')]); }
                    x = nx2;
                }
            }
            return { x: x, h: h, s: s, notes: notes };
        }
        function _tmSolve() {
           var e = _chipEnv(), cur = _tmCur(), l = _tm.lock;
           var r = _tmPlan(e, l, cur.x, cur.h, cur.s);
           var soulAuto = !e.na && !l.soul;
           if (soulAuto) _tmWrite('soul', r.s);
           if (!l.xianji) _tmWrite('xianji', r.x);
           if (!l.huineng) _tmWrite('huineng', r.h);
           _tm.res = { notes: r.notes };
           _tm.flashAll = false;
           _tmRender();
       }
       // 「假如用户在页面上手填 key = v」之后三个值会变成什么（照搬页面自己的规则，好让给出的建议值填进去就成立）
       //  - 团魂获能：该格上锁，再按 _tmPlan 反算其余没锁的格；团魂从「自动」改成手填时，先机 / 汇能只会被补高，按现值算
       //  - 先机汇能：联动开着且这一项是联动源（或还没开始）→ 另一项按首发反算；否则另一项不动（联动会锁定）
       function _tmSim(e, key, v, cur) {
           var st = { x: cur.x, h: cur.h, s: cur.s };
           st[key === 'soul' ? 's' : key === 'xianji' ? 'x' : 'h'] = v;
           if (getCalcMode() === 'team') {
               if (key === 'soul' && !_tm.lock.soul && !e.na) return st;
               var lk = { soul: _tm.lock.soul, xianji: _tm.lock.xianji, huineng: _tm.lock.huineng };
               lk[key] = true;
               var r = _tmPlan(e, lk, st.x, st.h, st.s);
               return { x: r.x, h: r.h, s: r.s };
           }
           if (autoLinked && (currentActiveField === null || currentActiveField === key)) {
               if (key === 'xianji') { var hh = _gridMin(0, e.hMax, 0.1, function (u) { return _tmFirst(e, v, u, 0) >= e.targetFirst; }); st.h = hh === null ? e.hMax : hh; }
               else if (key === 'huineng') { var xx = _gridMin(0, e.xMax, 0.1, function (u) { return _tmFirst(e, u, v, 0) >= e.targetFirst; }); st.x = xx === null ? e.xMax : xx; }
           }
           return st;
       }
       // 建议值：key 取多少（在它的网格上）手填进去后 pred 成立；先粗扫再细扫，返回最小的那个，够不到返回 null
       function _tmSuggest(e, key, cur, pred) {
           var k = key === 'soul' ? 1 : 10, max = key === 'soul' ? SOUL_MAX : key === 'xianji' ? e.xMax : e.hMax;
           var N = Math.round(max * k), C = 10, prev = -1;
           var ok = function (n) { return pred(_tmSim(e, key, n / k, cur)); };
           for (var n = 0; ; n = Math.min(N, n + C)) {
               if (ok(n)) { for (var m = prev + 1; m < n; m++) if (ok(m)) return m / k; return n / k; }
               prev = n;
               if (n >= N) return null;
           }
       }
       // 团魂不起作用的能量来源：循环装置（固定 +13%）、队友补满一管 —— 这时改为反算先机 / 汇能
       function _tmSoulNA() { var d = getDevice(); return d === 'loop' ? 'loop' : d === 'acc' ? 'acc' : (!d && _mateKind === 'full') ? 'full' : ''; }
       // 当前谁在被反算
       function _tmTargets() {
           var l = _tm.lock;
           if (!_tmSoulNA() && !l.soul) return { soul: true };
           return { xianji: !l.xianji, huineng: !l.huineng };
       }
       function _tmRender() {
           if (typeof _tm === 'undefined' || getCalcMode() !== 'team') return;
           var I = function (k) { return window.__pvIcon ? __pvIcon(k, 'pv-mode-ico') : ''; };
           var l = _tm.lock, tg = _tmTargets(), na = _tmSoulNA(), lead, tail, col = 'var(--success)';
           var pre = na === 'loop' ? _('循环装置不吃团魂', 'Loop Device ignores Soul') : na === 'acc' ? _('加速装置不吃团魂', 'Accel Device ignores Soul') : na === 'full' ? _('补满一管不吃团魂', 'Full-bar assist ignores Soul') : _('团魂已锁', 'Soul locked');
           if (tg.soul) { lead = I('auto') + _('团魂自动反算', 'Team Soul auto-solved'); tail = _('取首发所需的最低值；先机、汇能填了才算，手改团魂即上锁', 'lowest value for the 1st ult; Xianji / Huineng count once filled; typing Soul locks it'); }
           else if (tg.xianji && tg.huineng) { lead = I('link') + pre + _(' · 反算先机与汇能', ' · solving Xianji & Huineng'); tail = _('汇能保循环，先机补首发', 'Huineng covers the loop, Xianji the opening gap'); }
           else if (tg.huineng) { lead = I('link') + pre + _(' · 反算汇能', ' · solving Huineng'); tail = _('首发与循环都要够', 'enough for both the 1st ult and the loop'); }
           else if (tg.xianji) { lead = I('link') + pre + _(' · 反算先机', ' · solving Xianji'); tail = _('补首发缺口', 'fills the 1st-ult gap'); }
           else { col = 'var(--warning)'; lead = I('lock') + (na ? _('先机、汇能都已锁定', 'Xianji & Huineng locked') : _('三项都已锁定', 'All three locked')); tail = _('按你填的数值校验；点重置恢复自动', 'checking your numbers; reset to go auto'); }
           var info = document.getElementById('autoCalcInfo');
           if (info) _morphInlineBox(info, '<span style="color:' + col + '; font-weight:bold;">' + lead + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + tail + ')</span>', null, info.parentElement);
           // 三个框：状态字 + 一把锁（三个框完全同一套）
           ['soul', 'xianji', 'huineng'].forEach(function (k) {
               var inp = document.getElementById(_TM_KEYS[k]), lab = inp && document.querySelector('label[for="' + _TM_KEYS[k] + '"]');
               if (!lab) return;
               var grp = inp.closest('.form-group'), tag = lab.querySelector('.tm-state'), b = grp && grp.querySelector('.tm-lock');
               if (!tag) { tag = document.createElement('span'); tag.className = 'tm-state'; lab.appendChild(tag); }
               if (!b) {
                   b = document.createElement('button');
                   b.type = 'button'; b.className = 'tm-lock'; b.setAttribute('data-k', k);
                   b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); toggleTmLock(k); });
                   (grp || lab).appendChild(b);
               }
               var st = k === 'soul' && na ? 'na' : l[k] ? 'locked' : tg[k] ? 'auto' : 'idle';
               var name = k === 'soul' ? _('团魂', 'Team Soul') : k === 'xianji' ? _('先机', 'Xianji') : _('汇能', 'Huineng');
               var txt = st === 'auto' ? _('自动', 'Auto') : st === 'na' ? _('不适用', 'N/A') : '';
               if (tag.textContent !== txt) tag.textContent = txt;
               tag.classList.toggle('is-na', st === 'na');
               inp.classList.toggle('tm-auto', st === 'auto');
               if (grp) grp.classList.toggle('tm-na', st === 'na');
               inp.disabled = st === 'na';
               var html = window.__pvIcon ? __pvIcon(st === 'locked' ? 'lock' : 'unlock') : '';
               var tip = st === 'locked' ? _('已锁定：计算器不会改它。点按解锁', 'Locked: the calculator won’t change it. Tap to unlock')
                   : st === 'auto' ? _('由计算器自动反算。点按锁定当前值', 'Solved by the calculator. Tap to lock this value')
                   : st === 'na' ? _('当前能量来源不吃团魂', 'The current energy source ignores Team Soul')
                   : _('未锁定，按 0 计算（团魂自动反算时不参与）。点按锁定，或直接输入数值', 'Unlocked, counted as 0 while Team Soul is auto-solved. Tap to lock, or just type a value');
               if (b.__st !== st || b.__html !== html || b.__tip !== tip) {
                   var pop = b.__st !== undefined && (b.__st === 'locked') !== (st === 'locked');
                   b.innerHTML = html; b.__html = html; b.__tip = tip;
                   b.classList.toggle('is-locked', st === 'locked'); b.classList.toggle('is-na', st === 'na');
                   b.setAttribute('aria-pressed', st === 'locked' ? 'true' : 'false');
                   b.tabIndex = st === 'na' ? -1 : 0;
                   b.title = name + ' · ' + tip; b.setAttribute('aria-label', name + ' · ' + tip);
                   if (pop && _motionOK()) { var pb = b.classList.contains('is-pop'); b.classList.remove(pb ? 'is-pop' : 'is-pop-b'); b.classList.add(pb ? 'is-pop-b' : 'is-pop'); }
                   b.__st = st;
               }
           });
           // 补充说明
           var box = document.getElementById('tmSolveNote');
           if (box) {
               var n = (_tm.res && _tm.res.notes[0]) || null;
               if (n) {
                   var nh = (window.__pvIcon ? __pvIcon(n[0] === 'warn' ? 'warn' : 'ok') : '') + '<span>' + n[1] + '</span>';
                   _morphInlineBox(box, nh, function () { box.classList.toggle('is-warn', n[0] === 'warn'); });
                   /* is-warn handled in _morphInlineBox */
               }
               slideShow(box, !!n);
           }
       }
       // 芯片上限徽标：团魂获能里多一项团魂上限
       function _chipBadge() {
           var b = document.getElementById('chipLimitBadge'), hn = document.getElementById('inputHuineng');
           if (!b || !hn) return;
           var hm = hn.dataset.baseMax || 50, t = getCalcMode() === 'team';
           var html = '<span class="zh">上限：' + (t ? '团魂' + SOUL_MAX + '% | ' : '') + '先机30% | 汇能' + hm + '%</span>'
               + '<span class="lang-en">Limit: ' + (t ? 'Soul ' + SOUL_MAX + '% | ' : '') + 'Xianji 30% | Huineng ' + hm + '%</span>';
           if (b.__html !== html) { b.innerHTML = html; b.__html = html; }
       }
       function toggleTmLock(k) {
           _tm.lock[k] = !_tm.lock[k];
           _userInput = true;
           _tmRender();
           calculate();
           if (!isRestoringConfig && window.CommunityPlans && typeof window.CommunityPlans.scheduleDraftSave === 'function') window.CommunityPlans.scheduleDraftSave();
       }
       // 手动输入：该值立刻上锁（团魂 / 先机 / 汇能 都一样）
       function _tmTyped(k) {
           if (!_tm.lock[k]) { _tm.lock[k] = true; _tmRender(); }
           if (!isRestoringConfig) calculate();
       }
       function onSoulInput() {
           clampInput('inputTuanhun');
           if (getCalcMode() === 'team') _tmTyped('soul');
           else if (!isRestoringConfig) calculate();
       }
       function _tmReset() {
           _tm.lock = { soul: false, xianji: false, huineng: false };
           document.getElementById('inputXianji').value = '0';
           document.getElementById('inputHuineng').value = '0';
           _tm.res = null;
           _tm.flashAll = true;
           _userInput = true;
           _tmRender();
           if (!isRestoringConfig) calculate();
           _tm.flashAll = false;
       }
       // 先机汇能 / 团魂获能 各用各的先机、汇能和联动状态（辅助供能没有芯片，算作先机汇能那一套）
       function _swapChipOwner(prev, m) {
           var a = prev === 'team' ? 'team' : 'solo', b = m === 'team' ? 'team' : 'solo';
           if (a === b || isRestoringConfig) return;
           var xe = document.getElementById('inputXianji'), he = document.getElementById('inputHuineng');
           _chipStash[a] = a === 'team' ? { x: xe.value, h: he.value, lock: _tm.lock, res: _tm.res } : { x: xe.value, h: he.value, linked: autoLinked, active: currentActiveField };
           var st = _chipStash[b];
           xe.value = st ? st.x : '0'; he.value = st ? st.h : '0';
           // 反算说明不在这里收起：离开团魂获能时它跟着整块组队区一起收，回来时按记下的结果原样出现，不会闪一下
           if (b === 'team') { _tm.lock = st ? st.lock : { soul: false, xianji: false, huineng: false }; _tm.res = st ? st.res : null; }
           else { autoLinked = st ? st.linked : true; currentActiveField = st ? st.active : null; }
       }
       function getTeamDeviceTerms(D, E, firstN, loopN, soulOverride) {
           var mode = getCalcMode(), dev = mode === 'team' ? getDevice() : '';
           var r = { mode: mode, dev: dev, soul: 0, soulMult: 1,
                     devLoopFirst: 0, devLoopLoop: 0,
                     devBase: 0, devHit: 0, devFirstCount: 0, devLoopCount: 0, devFirst: 0, devLoop: 0,
                     teamOn: false, teamFull: false, teamBase: 0, teamCore: 1, teamHit: 0, teamFirstCount: 0, teamLoopCount: 0, teamFirst: 0, teamLoop: 0 };
           if (mode === 'team') {
               r.soul = soulOverride !== undefined ? soulOverride : Math.max(0, _mv('inputTuanhun'));
               r.soulMult = 1 + r.soul / 100;
               if (dev === 'loop') {
                   r.devLoopFirst = DEVICE_LOOP_PER_NITRO * firstN;
                   r.devLoopLoop = DEVICE_LOOP_PER_NITRO * loopN;
               } else if (dev === 'acc') {
                    // 加速装置：不提供任何充能（只降首个大招阈值，由计算层处理），这里什么都不加
                } else if (DEVICE_CHARGE[dev]) {
                   r.devBase = DEVICE_CHARGE[dev];
                   r.devHit = r.devBase * r.soulMult * D * E;
                   r.devFirstCount = _mi('dev_sub_first');
                   r.devLoopCount = _mi('dev_sub_loop');
                   r.devFirst = r.devHit * r.devFirstCount;
                   r.devLoop = r.devHit * r.devLoopCount;
               } else {
                   r.teamOn = true;
                   r.teamFull = _mateKind === 'full';
                   r.teamBase = Math.max(0, _mv('teamInBase'));
                   r.teamCore = _mc('teamInCore') ? ASSIST_CORE_MULT : 1;
                   r.teamHit = r.teamFull ? 100 : r.teamBase * r.teamCore * r.soulMult * D * E;   // 补满一管：不吃任何加成
                   r.teamFirstCount = _mi('teamInFirst');
                   r.teamLoopCount = _mi('teamInLoop');
                   r.teamFirst = r.teamHit * r.teamFirstCount;
                   r.teamLoop = r.teamHit * r.teamLoopCount;
               }
           }
           r.first = r.devLoopFirst + r.devFirst + r.teamFirst;
           r.loop = r.devLoopLoop + r.devLoop + r.teamLoop;
           return r;
       }
       // 解析盒里的一行：「装置 / 队友辅助」单次 × 次数
       function assistFormulaLine(no, label, base, core, soul, D, E, count, total, full) {
           if (full) return no + label + _('：[补满一管 100%] × <b>', ': [full bar 100%] × <b>') + count + _('</b>次 = <b>', '</b> = <b>') + total.toFixed(3) + '</b><br>';
           return no + label + _('：[', ': [') + base + '%' + (core > 1 ? _(' × 辅助核心', ' × Core ') + core : '') + _(' × (1+团魂', ' × (1+Soul ') + soul + '%)] × (1-' + _('反制', 'Counter') + _('％', '%') + ')(' + _d(D) + ') × ' + _('充能效率', 'Eff') + '(' + (E * 100).toFixed(0) + '%) × <b>' + count + _('</b>次 = <b>', '</b> = <b>') + total.toFixed(3) + '</b><br>';
       }
       function bigPct(x) {
           if (!isFinite(x)) return '--';
           var s = _f3(x).toFixed(3).split('.');
           return s[0] + '<small>.' + s[1] + '%</small>';
       }
       function pctSmall(x) { return _f3(x).toFixed(3) + '<small>%</small>'; }
       // 结果卡仪表：和首发 / 循环结果卡同一个 270° 转速表（v4.js 的 __pvRingSvg / __pvRing），
       // 刻度、阈值标记的含义也一样 —— 标记 = 攒满一管大招能量；弧 = 按次数累计后的合计能量，弧下百分比 = 该合计占阈值的多少。
        // 别把「单次」喂给弧：单次跟次数无关，改次数时弧不动，看着就像动画坏了（首发卡喂的也是阶段合计）。
       function _tmGauge(id, value, target) {
           var g = document.getElementById(id);
           if (!g) return;
           var slot = g.querySelector('.tm-ring-slot');
           if (slot && window.__pvRingSvg) slot.outerHTML = window.__pvRingSvg();
           if (window.__pvRing) window.__pvRing(g, value, target);
           var card = g.closest('.tm-result');
           if (card) card.classList.toggle('is-idle', !isFinite(value));
       }
       // 攒满一管要几下（向上取整）
       function _hitsToFill(per, target) { return per > 0 ? Math.ceil(target / per - 1e-9) : 0; }

       /* ---------- 组队区两张结果卡 + 底部胶囊「供能」 ---------- */
       function renderTeamPanels(t, D, E, target) {
           target = target > 0 ? target : 100;
           // ---- 辅助供能：我给队友 ----
           var base = Math.max(0, _mv('supBase'));
           var full = _supKind === 'full';
           var core = _mc('supCore') ? ASSIST_CORE_MULT : 1;
           var mateSoul = Math.max(0, _mv('supMateSoul'));
           var effRaw = document.getElementById('supMateEff').value;
           var mateEff = effRaw === '' ? 1 : Math.max(0, parseFloat(effRaw) || 0) / 100;
           var cnt = _mi('supCount');
           var raw = full ? 100 : base * core;
           var hit = full ? 100 : raw * (1 + mateSoul / 100) * D * mateEff;
           var has = full || base > 0;
           document.getElementById('supCoreRow').classList.toggle('on', core > 1);
           _setVal('supportHitValue', has ? bigPct(hit * cnt) : '--');
           _tmGauge('supportGauge', has ? (hit * cnt) : NaN, 100);       // 队友的阈值未知：按满管 100% 计
           var supCar = (typeof _selectedCar !== 'undefined' && _selectedCar && _selectedCar.assist_charge) ? _selectedCar : null;
           document.getElementById('supportStatus').textContent = supCar ? _n(supCar) : _('辅助供能', 'Support supply');
           var supN = _hitsToFill(hit, 100);
           document.getElementById('supportHint').textContent = !has ? '' : full ? _('队友直接满管', 'Ally\'s bar is full at once')
               : _('队友攒满一管需 ', 'Ally fills a bar in ') + supN + _(' 次', supN === 1 ? ' hit' : ' hits');
           _setVal('supportRawValue', has ? (full ? _('满管', 'Full') : pctSmall(raw)) : '--');
           _setVal('supportRawSub', full ? _('直接补满一管', 'refills the bar') : _('单次 ', 'base ') + base + '%' + (core > 1 ? _(' × 辅助核心 1.3', ' × Core 1.3') : ''));
           document.getElementById('supportTotalLabel').textContent = cnt + _(' 次合计', ' hits total');
           _setVal('supportTotalValue', has ? (full ? (cnt > 0 ? _('满管', 'Full') : pctSmall(0)) : pctSmall(hit * cnt)) : '--');
           document.getElementById('supportTag').textContent = full ? _('补满一管 · 不吃加成', 'Full bar · no multipliers') : _('满管 100% · 队友团魂 ', 'Bar 100% · Ally soul ') + mateSoul + '%';
           var fs = '<b>' + _('【辅助供能运算解析盒】', '[Support Supply Breakdown]') + '</b><br>';
           if (full) {
               fs += _('① 这辆车的大招直接为队友补满一管能量，不受辅助核心、团魂、反制、充能效率影响。', '1. This ult refills the ally\'s whole bar — no Core, Team Soul, Counter or efficiency applies.') + '<br>';
               fs += '-------------------------<<br><b>' + _('队友实收：补满一管（100%）', 'Ally receives: full bar (100%)') + '</b>';
           } else {
               fs += _('① 辅助给出：[单次辅助充能(', '1. Support gives: [Assist per hit(') + base + '%)]' + (core > 1 ? _(' × 辅助核心(', ' × Core(') + core + ')' : '') + ' = <b>' + _f3(raw).toFixed(3) + '</b><br>';
               fs += _('② 队友实收：[辅助给出] × (1+队友团魂', '2. Ally receives: [Support gives] × (1+Ally soul ') + mateSoul + '%) × (1-' + _('反制', 'Counter') + _('％', '%') + ')(' + _d(D) + ') × ' + _('队友充能效率', 'Ally eff') + '(' + (mateEff * 100).toFixed(0) + '%) = <b>' + _f3(hit).toFixed(3) + '</b><br>';
               fs += '-------------------------<<br>';
               fs += '<b>' + _('合计：', 'Total: ') + _f3(hit).toFixed(3) + ' × ' + cnt + _('次 = ', ' = ') + _f3(hit * cnt).toFixed(3) + '%</b>';
               if (!has) fs += '<br>' + _('（先在上方选择一辆辅助车）', '(Pick a support car above first)');
           }
           document.getElementById('formulaSupport').innerHTML = fs;
           var dockV = document.getElementById('dockTeamValue');
           if (dockV) {
               var nextTeamSt = has ? 'info' : 'idle';
               var nextTeamTxt = has ? (full ? _('满管', 'Full') : _f3(hit).toFixed(1) + '%') : '--';
               if (window._setDockItem) window._setDockItem(dockV.parentNode, dockV, nextTeamTxt, nextTeamSt); else { dockV.parentNode.setAttribute('data-state', nextTeamSt); dockV.textContent = nextTeamTxt; }
           }
           // ---- 团魂获能：我获得的能量 ----（离开团魂获能时不刷：卡片正在收起，内容保持原样）
           if (t.mode !== 'team' || t.dev === 'acc') return;
           var src, perHit, firstSum, loopSum, firstN, loopN, any;
           if (t.dev === 'loop') {
               src = deviceName('loop'); perHit = DEVICE_LOOP_PER_NITRO; firstSum = t.devLoopFirst; loopSum = t.devLoopLoop; any = true;
               firstN = t.devLoopFirst / DEVICE_LOOP_PER_NITRO; loopN = t.devLoopLoop / DEVICE_LOOP_PER_NITRO;
           } else if (t.devBase) {
               src = deviceName(t.dev); perHit = t.devHit; firstSum = t.devFirst; loopSum = t.devLoop; firstN = t.devFirstCount; loopN = t.devLoopCount; any = true;
           } else {
               src = _('队友辅助', 'Ally assist'); perHit = t.teamHit; firstSum = t.teamFirst; loopSum = t.teamLoop; firstN = t.teamFirstCount; loopN = t.teamLoopCount; any = t.teamFull || t.teamBase > 0;
           }
           document.getElementById('teamInTitle').textContent = t.dev === 'loop' ? _('我合计用氮获得', 'My total from nitros') : _('我合计实收', 'My total received');
           document.getElementById('teamInStatus').textContent = src;
           document.getElementById('teamInTag').textContent = _('阈值 ', 'Target ') + target + '% · ' + (t.dev === 'loop' ? _('固定值', 'fixed') : (t.teamFull && !t.dev) ? _('补满一管', 'full bar') : _('团魂 ', 'Soul ') + t.soul + '%');
           _setVal('teamInHitValue', any ? bigPct(firstSum + loopSum) : '--');
           _tmGauge('teamInGauge', any ? (firstSum + loopSum) : NaN, target);
           var inN = _hitsToFill(perHit, target);
           document.getElementById('teamInHint').textContent = !any ? '' : (t.teamFull && !t.dev) ? _('一次直接满管', 'Fills the bar at once')
               : t.dev === 'loop' ? _('攒满大招需 ', 'Ult ready after ') + inN + _(' 次用氮', inN === 1 ? ' nitro' : ' nitros')
               : _('攒满大招需 ', 'Ult ready after ') + inN + _(' 次', inN === 1 ? ' hit' : ' hits');
           document.getElementById('teamInFirstLabel').textContent = (t.dev === 'loop' ? _('首发前（×' + firstN + ' 次氮气）', 'Before 1st Ult (×' + firstN + ' nitros)') : _('首发前合计（×' + firstN + '）', 'Before 1st Ult (×' + firstN + ')'));
           document.getElementById('teamInLoopLabel').textContent = (t.dev === 'loop' ? _('每轮循环（×' + loopN + ' 次氮气）', 'Per loop (×' + loopN + ' nitros)') : _('每轮循环合计（×' + loopN + '）', 'Per loop (×' + loopN + ')'));
           _setVal('teamInFirstValue', any ? pctSmall(firstSum) : '--');
           _setVal('teamInLoopValue', any ? pctSmall(loopSum) : '--');
           var ft = '<b>' + _('【团魂获能运算解析盒】', '[Team Soul Gain Breakdown]') + '</b><br>';
           if (t.dev === 'loop') {
               ft += _('① 循环装置：每次使用氮气固定 +13%，不受团魂、反制、充能效率影响', '1. Loop Device: +13% per nitro, fixed') + '<br>';
               ft += _('② 首发前：13% × ', '2. Before 1st Ult: 13% × ') + firstN + _('次氮气 = <b>', ' nitros = <b>') + _f3(firstSum).toFixed(3) + '</b><br>';
               ft += _('③ 每轮循环：13% × ', '3. Per loop: 13% × ') + loopN + _('次氮气 = <b>', ' nitros = <b>') + _f3(loopSum).toFixed(3) + '</b>';
           } else if (t.devBase) {
               ft += _('① 每次实收：[', '1. Per trigger: [') + t.devBase + _('% × (1+团魂', '% × (1+Soul ') + t.soul + '%)] × (1-' + _('反制', 'Counter') + _('％', '%') + ')(' + _d(D) + ') × ' + _('充能效率', 'Eff') + '(' + (E * 100).toFixed(0) + '%) = <b>' + _f3(t.devHit).toFixed(3) + '</b><br>';
               ft += _('② 首发前：× ', '2. Before 1st Ult: × ') + firstN + _('次 = <b>', ' = <b>') + _f3(firstSum).toFixed(3) + '</b><br>';
               ft += _('③ 每轮循环：× ', '3. Per loop: × ') + loopN + _('次 = <b>', ' = <b>') + _f3(loopSum).toFixed(3) + '</b>';
           } else if (t.teamFull) {
               ft += _('① 队友的大招直接为你补满一管能量（100%），不受任何加成影响', '1. The ally\'s ult refills your whole bar (100%), no multipliers') + '<br>';
               ft += _('② 首发前：× ', '2. Before 1st Ult: × ') + firstN + _('次 = <b>', ' = <b>') + _f3(firstSum).toFixed(3) + '</b><br>';
               ft += _('③ 每轮循环：× ', '3. Per loop: × ') + loopN + _('次 = <b>', ' = <b>') + _f3(loopSum).toFixed(3) + '</b>';
           } else {
               ft += _('① 每次实收：[队友辅助(', '1. Per hit: [Ally assist(') + t.teamBase + '%)]' + (t.teamCore > 1 ? _(' × 辅助核心(', ' × Core(') + t.teamCore + ')' : '') + _(' × (1+团魂', ' × (1+Soul ') + t.soul + '%) × (1-' + _('反制', 'Counter') + _('％', '%') + ')(' + _d(D) + ') × ' + _('充能效率', 'Eff') + '(' + (E * 100).toFixed(0) + '%) = <b>' + _f3(t.teamHit).toFixed(3) + '</b><br>';
               ft += _('② 首发前：× ', '2. Before 1st Ult: × ') + firstN + _('次 = <b>', ' = <b>') + _f3(firstSum).toFixed(3) + '</b><br>';
               ft += _('③ 每轮循环：× ', '3. Per loop: × ') + loopN + _('次 = <b>', ' = <b>') + _f3(loopSum).toFixed(3) + '</b>';
               if (!any) ft += '<br>' + _('（先选择队友辅助车，或手填单次辅助充能）', '(Pick the ally\'s support car, or type the value)');
           }
           document.getElementById('formulaTeamIn').innerHTML = ft;
       }

       initTheme();

        function initApp() {
            if (currentLang === 'en') document.body.classList.add('en-mode');

            var ctb = document.getElementById('closeTutorialBtn');
            if (ctb) ctb.title = currentLang === 'en' ? 'Dismiss' : '不再显示';

           updateAutoCalcUI();
           updateNitroCountUI();
           populateMateList();
           labelsForKind('once', 'supBaseLabel', 'supCountLabel', false);
           setCalcMode(getCalcMode(), true, true);
           updateDeviceUI(true);

           renderChips(true);
            var isLoadedFromLink = loadConfigFromUrl();
           syncSupportFilter('solo', getCalcMode());
           renderSupportSource();
           document.body.classList.remove('calc-boot');
           requestAnimationFrame(function () {
                placeModeThumb(true);
                if (typeof placeEmpowerThumb === 'function') placeEmpowerThumb(true);
            });
            if (window.ResizeObserver) {
                var modeSegEl = document.querySelector('.mode-seg');
                if (modeSegEl) {
                    var _lastModeW = modeSegEl.offsetWidth, _lastModeH = modeSegEl.offsetHeight;
                    new ResizeObserver(function () {
                        var w = modeSegEl.offsetWidth, h = modeSegEl.offsetHeight;
                        if (!w || (Math.abs(w - _lastModeW) < 0.5 && Math.abs(h - _lastModeH) < 0.5)) return;
                        _lastModeW = w;
                        _lastModeH = h;
                        var now = window.performance ? performance.now() : Date.now();
                        placeModeThumb(now > _modeAnimUntil);
                    }).observe(modeSegEl);
                }
                var empSegEl = document.querySelector('.empower-seg');
                if (empSegEl) {
                    var _lastEmpW = empSegEl.offsetWidth, _lastEmpH = empSegEl.offsetHeight;
                    new ResizeObserver(function () {
                        var w = empSegEl.offsetWidth, h = empSegEl.offsetHeight;
                        if (!w || (Math.abs(w - _lastEmpW) < 0.5 && Math.abs(h - _lastEmpH) < 0.5)) return;
                        _lastEmpW = w;
                        _lastEmpH = h;
                        var now = window.performance ? performance.now() : Date.now();
                        if (typeof placeEmpowerThumb === 'function') placeEmpowerThumb(now > _empowerAnimUntil);
                    }).observe(empSegEl);
                }
                var modeDescEl = document.querySelector('.mode-desc');
                if (modeDescEl) {
                    var _lastDescW = modeDescEl.clientWidth;
                    var _mdRo = new ResizeObserver(function () {
                        var w = modeDescEl.clientWidth;
                        if (!w || Math.abs(w - _lastDescW) < 0.5) return;
                        _lastDescW = w;
                        var now = window.performance ? performance.now() : Date.now();
                        syncModeDesc(now > _modeAnimUntil);
                    });
                    _mdRo.observe(modeDescEl);
                    [].forEach.call(modeDescEl.querySelectorAll('.md'), function (x) { _mdRo.observe(x); });   // 字体加载完 / 换行变化时重量高度
                }
           }
           syncModeDesc(true);
           document.addEventListener('pv-lang', function () { populateMateList(); renderMateSource(); renderSupportSource(); placeModeThumb(true); syncModeDesc(true); });
           
           handleNitroRadioChange(true);

           if (isLoadedFromLink) {
               setTimeout(function(){
                   showToast(_("✅ 已成功解析并加载车友分享的配置方案！", "✅ Successfully loaded shared config!"));
               }, 800);
               calculate();
           } else {
               calculate();   // 普通进入也算一次；是否真的渲染结果由 calculate 内部判断（没选车又没动过数值 → 保持「等待测算」）
           }
       }
       
        initApp();

        // 只有用户真的动过输入才算「开始测算」；初始化期间的程序化赋值（自动联动、默认填充）不算
        ['input', 'change'].forEach(function (t) {
            document.addEventListener(t, function () { if (!isRestoringConfig) _userInput = true; }, true);
        });

        // Re-sync checkbox layout on resize
        // Re-sync checkbox on resize
        var _resizeTimer;
        window.addEventListener('resize', function() {
            clearTimeout(_resizeTimer);
            _resizeTimer = setTimeout(function() { if (typeof _syncSpecLayout === 'function') _syncSpecLayout(); }, 100);
        });
        // Use ResizeObserver for reliable mobile layout detection
        if (window.ResizeObserver) {
            var _roTarget = document.getElementById('specGrid');
            if (_roTarget) {
                var _ro = new ResizeObserver(function() { if (typeof _syncSpecLayout === 'function') _syncSpecLayout(); });
                _ro.observe(_roTarget);
            }
        }

       if ('serviceWorker' in navigator) {
           // 不再等 window.load：等到 load 时页面资源早已下载完毕，SW 接管不到任何请求，
           // 第一次访问结束后缓存桶是空的，用户装完应用一断网打开就是白屏。
           navigator.serviceWorker.register('sw.js').catch(function() {});
       }

        function toggleLanguage() {
            currentLang = currentLang === 'zh' ? 'en' : 'zh';
            document.body.classList.toggle('en-mode', currentLang === 'en');
            document.documentElement.lang = currentLang === 'en' ? 'en' : 'zh-CN';
            document.title = currentLang === 'en' ? 'Ace Racer Chip Calculator' : '王牌竞速芯片计算器';
            let metaAppTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
            if (metaAppTitle) {
                metaAppTitle.content = currentLang === 'en' ? 'Ace Calc' : '王牌计算器';
            }
            document.getElementById('langBtnText').textContent = currentLang === 'en' ? '中文 / English' : 'English / 中文';
            var ctb = document.getElementById('closeTutorialBtn');
            if (ctb) ctb.title = currentLang === 'en' ? 'Dismiss' : '不再显示';
            // Sync checkbox height on init
            setTimeout(function(){
                var _si = document.getElementById('baseUltDuration');
                var _sc = document.getElementById('isSpec');
                if (_si && _sc) { var _el = document.getElementById('specLabel'); if (_el && _el.parentElement) _el.parentElement.style.minHeight = _si.offsetHeight + 'px'; }
            }, 50);
            
            // Refresh UI for language switch
            document.getElementById('carSearch').placeholder = currentLang === 'en' ? 'Search car name...' : '搜索赛车名称...';
            if (typeof populateFilters === 'function') populateFilters();
            if (typeof populateCarGrid === 'function') populateCarGrid();
            if (typeof filterCarList === 'function') filterCarList();
            if (_selectedCar && typeof updateCarPreview === 'function') updateCarPreview(_selectedCar);
           
           updateAutoCalcUI();
           updateNitroCountUI();
           if (typeof window.calculate === 'function') {
               var isInitial = document.getElementById('resultValueFirst').innerText.includes('--');
               window.calculate(isInitial);
           }
       }
   
