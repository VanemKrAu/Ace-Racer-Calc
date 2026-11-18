
function __tok(n, d) { var v = getComputedStyle(document.body).getPropertyValue(n).trim(); return v || d; }

       document.addEventListener('wheel', function(e) {
           if (document.activeElement && document.activeElement.type === 'number') {
               document.activeElement.blur();
           }
       }, { passive: true });

       var isRestoringConfig = false;

       function toggleThemeMenu() {
           var menu = document.getElementById('themeMenu');
           document.getElementById('authorMenu').classList.remove('show');
           menu.classList.toggle('show');
       }

       function toggleAuthorMenu() {
           var menu = document.getElementById('authorMenu');
           document.getElementById('themeMenu').classList.remove('show');
           menu.classList.toggle('show');
       }

       window.onclick = function(event) {
           if (!event.target.closest('#themeBtn') && !event.target.closest('#themeMenu')) {
               var themeMenu = document.getElementById('themeMenu');
               if (themeMenu && themeMenu.classList.contains('show')) {
                   themeMenu.classList.remove('show');
               }
           }
           if (!event.target.closest('#authorBtn') && !event.target.closest('#authorMenu')) {
               var authorMenu = document.getElementById('authorMenu');
               if (authorMenu && authorMenu.classList.contains('show')) {
                   authorMenu.classList.remove('show');
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
           if (mode === 'light') {
               icon.innerText = '☀️';
           } else if (mode === 'dark') {
               icon.innerText = '🌙';
           } else {
               icon.innerText = '💻';
           }
       }

       var systemThemeMql = null;

       function initTheme() {
           var savedTheme = localStorage.getItem('theme');
           var isSystemDark = false;

           if (window.matchMedia) {
               systemThemeMql = window.matchMedia('(prefers-color-scheme: dark)');
               isSystemDark = systemThemeMql.matches;
               
               var themeChangeHandler = function(e) {
                   if (!localStorage.getItem('theme') || localStorage.getItem('theme') === 'system') {
                       applyThemeMode(!e.matches);
                   }
               };

               if (systemThemeMql.addEventListener) {
                   systemThemeMql.addEventListener('change', themeChangeHandler);
               } else if (systemThemeMql.addListener) {
                   systemThemeMql.addListener(themeChangeHandler);
               }
           }

            if (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system') {
                applyThemeMode(savedTheme === 'system' ? !isSystemDark : savedTheme === 'light');
                updateThemeIcon(savedTheme);
            } else {
                applyThemeMode(false);
                updateThemeIcon('dark');
                localStorage.setItem('theme', 'dark');
            }
       }

       function selectTheme(mode) {
           if (mode === 'system') {
               localStorage.setItem('theme', 'system');
               var isSystemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
               applyThemeMode(!isSystemDark);
           } else {
               localStorage.setItem('theme', mode);
               applyThemeMode(mode === 'light');
           }
           updateThemeIcon(mode);
           document.getElementById('themeMenu').classList.remove('show');
       }

       function showToast(message) {
           var toast = document.getElementById("copyToast");
           toast.innerHTML = message;
           toast.className = "copy-toast show";
           setTimeout(function() {
               toast.className = toast.className.replace("show", "");
           }, 2500);
       }

       function copyToClipboard(text, successMsg) {
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
                   showToast(successMsg);
               }).catch(function(err) {
                   fallbackCopy();
               });
           } else {
               fallbackCopy();
           }
       }

       function exportConfigText() {
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
           
           var valCustomTrig = document.getElementById('valCustomTrig').value || "0";
           var customTrigFirstCount = document.getElementById('customTrigFirstCount').value || "0";
           var customTrigLoopCount = document.getElementById('customTrigLoopCount').value || "0";

           if (parseFloat(valExtraNitro) > 0 || isExtraUltActive || parseFloat(valExtraPerSec) > 0 || parseFloat(extraEfficiency) !== 0 || parseFloat(valCustomTrig) > 0) {
               text += _("🔹 附加充能：额外氮气(", "🔹 Extra Charge: Nitro Bonus(") + valExtraNitro + _("%) | 额外大招(", "%) | Ult Bonus(") + valExtraUltStr + _("%) | 持续每秒(", "%) | Per sec(") + valExtraPerSec + _("%) | 充能效率提升(", "%) | Eff Boost(") + extraEfficiency + "%)\n";
           }
           if (parseFloat(valCustomTrig) > 0) {
               text += _("🔹 自定义触发自充：每次(", "🔹 Custom Trig: ") + valCustomTrig + _("% × 首发", "% × 1st ") + customTrigFirstCount + _("次 / 循环", " trigs / Loop ") + customTrigLoopCount + _("次\n", " trigs\n");
           }

           text += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
           text += _("▶ 首发：需氮", "▶ 1st Ult: Needs ") + firstNitroCount + _("个 | 先机", " Nitros | Xianji ") + xianji + _("% | 汇能", "% | Huineng ") + huineng + "%\n";
           text += _("▶ 状态：", "▶ Status: ") + (resFirst || _("计算中...", "Calculating...")) + "\n";
           text += "┈┈┈┈┈┈┈┈┈┈┈┈┈┈\n";
           text += _("▶ 循环：大招内含 ", "▶ Loop: Ult contains ") + loopNitroCount + _(" 个氮气\n", " Nitros\n");
           text += _("▶ 状态：", "▶ Status: ") + (resLoop || _("计算中...", "Calculating...")) + "\n";
           text += _("🔗 by Vanem - 王牌芯片计算器 - aceracercalc.top", "🔗 by Vanem - Ace Racer Calculator - aceracercalc.top");

           copyToClipboard(text, _("✅ 文本已复制，快去分享吧！", "✅ Text copied, ready to share!"));
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
           loaderOverlay.innerHTML = '<div style="width:38px;height:38px;margin-bottom:16px;border-radius:50%;border:3px solid rgba(142,154,175,.35);border-top-color:var(--export-accent,#00f2fe);animation:dsSpin .9s linear infinite;"></div><div style="font-size:18px; font-weight:bold; color:'+__tok('--export-accent', isLight?'#007bb5':'#00f2fe')+';">' + _("正在生成超清长图...", "Generating HD screenshot...") + '</div><div style="font-size:12px; color:#8e9aaf; margin-top:8px;">' + _("(极速渲染引擎运转中，请稍候)", "(Rendering engine running, please wait...)") + '</div>';
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
               cloneElements[i].style.setProperty('font-family', 'Arial, "Helvetica Neue", Helvetica, sans-serif', 'important');
               cloneElements[i].style.setProperty('letter-spacing', 'normal', 'important');
           }
           clone.style.setProperty('font-family', 'Arial, "Helvetica Neue", Helvetica, sans-serif', 'important');

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
           
           var loopInClone = clone.querySelector('#resultCardLoop');
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
                   ctx.font = 'bold ' + (22 * scaleMultiplier) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
                   ctx.textAlign = 'center';
                   ctx.textBaseline = 'middle';
                   ctx.fillText('aceracercalc.top', newCanvas.width / 2, canvas.height + (30 * scaleMultiplier));
                   
                   ctx.fillStyle = isLight ? '#4a5568' : '#8e9aaf';
                   ctx.font = (13 * scaleMultiplier) + 'px -apple-system, BlinkMacSystemFont, sans-serif';
                   ctx.fillText(_('王牌竞速芯片计算器', 'Ace Racer Chip Calculator'), newCanvas.width / 2, canvas.height + (52 * scaleMultiplier));
                   
                   var link = document.createElement('a');
                   var dateStr = new Date().toISOString().slice(0,10).replace(/-/g,"");
                   link.download = _('王牌计算器_', 'Ace_Calc_') + dateStr + '.png';
                   link.href = newCanvas.toDataURL('image/png', 1.0);
                   link.click();
                   
                   showToast(_("✅ 高清长图已保存到您的设备！", "✅ HD image saved to your device!"));
               }).catch(function(err) {
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

       function exportConfigLink() {
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
               document.getElementById('customTrigLoopCount').value        
           ];

           var cfgStr = encodeURIComponent(btoa(compactArr.join('|')));
            var baseUrl = window.location.origin + window.location.pathname;
             var shareUrl = baseUrl + '?s=' + cfgStr;
             if (_selectedCarId && _selectedCarId > 0) {
                 shareUrl += '&car=' + _selectedCarId;
             }

            copyToClipboard(shareUrl, _("🔗 短链接已复制，分享给车友可直接打开！", "🔗 Short link copied, share to open directly!"));
       }
       
       function loadConfigFromUrl() {
           var urlParams = new URLSearchParams(window.location.search);
           if (!urlParams.has('s') && !urlParams.has('cfg')) return false;

           isRestoringConfig = true;
           var result = false;

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
                       
                       var nr = arr[3];
                       
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

                       document.getElementById('counterRange').value = arr[7 + offset];
                       document.getElementById('counterValue').innerText = arr[7 + offset] + '%';
                       document.getElementById('debuffRange').value = arr[8 + offset];
                       document.getElementById('debuffValue').innerText = arr[8 + offset] + '%';

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
                       
                       result = true;
                   }
               } catch (e) {
               }
           } else if (urlParams.has('cfg')) {
               try {
                   var safeCfgB64 = urlParams.get('cfg').replace(/ /g, '+');
                   var config = JSON.parse(decodeURIComponent(atob(safeCfgB64)));

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
                       document.getElementById('counterRange').value = config.cr;
                       document.getElementById('counterValue').innerText = config.cr + '%';
                   }
                   if(config.dr !== undefined) {
                       document.getElementById('debuffRange').value = config.dr;
                       document.getElementById('debuffValue').innerText = config.dr + '%';
                   }

                   var allCbs = document.querySelectorAll('.empower-checkbox');
                   for (var k = 0; k < allCbs.length; k++) { allCbs[k].checked = false; }
                   if(config.emps) {
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
                         if (urlParams.has('s')) {
                             // Config exists: only update preview, don't overwrite values
                             updateCarPreview(found);
                             filterCarList();
                         } else {
                            // No config: auto-fill everything
                            setTimeout(function() { if (typeof pickCar === 'function') pickCar(carId); }, 300);
                        }
                    }
                }
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
           document.getElementById('counterValue').innerText = document.getElementById('counterRange').value + '%';
           if (!isRestoringConfig) { triggerAutoCalc(currentActiveField); calculate(); }
       }

       function updateDebuffSlider() {
           document.getElementById('debuffValue').innerText = document.getElementById('debuffRange').value + '%';
           if (!isRestoringConfig) { triggerAutoCalc(currentActiveField); calculate(); }
       }

       function toggleExtraUI() {
           var nitroCb = document.getElementById('hasExtraNitro');
           if (nitroCb.checked) {
               nitroCb.parentElement.parentElement.classList.add('extra-active-nitro');
           } else {
               nitroCb.parentElement.parentElement.classList.remove('extra-active-nitro');
           }
           
           var ultCb = document.getElementById('hasExtraUlt');
           if (ultCb.checked) {
               ultCb.parentElement.parentElement.classList.add('extra-active-ult');
           } else {
               ultCb.parentElement.parentElement.classList.remove('extra-active-ult');
           }
           
           var persecCb = document.getElementById('hasExtraPerSec');
           if (persecCb) {
               if (persecCb.checked) {
                   persecCb.parentElement.parentElement.classList.add('extra-active-persec');
               } else {
                   persecCb.parentElement.parentElement.classList.remove('extra-active-persec');
               }
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

       function handleEmpowerChange(element) {
           var primaryVals = ['fusu', 'yichu'];
           var secondaryVals = ['jiezou', 'huishou', 'weilai', 'queyi', 'huaxin'];

           var checkboxes = document.querySelectorAll('.empower-checkbox');
           var primaryCount = 0;
           var secondaryCount = 0;

           for (var i = 0; i < checkboxes.length; i++) {
               if (checkboxes[i].checked) {
                   if (primaryVals.indexOf(checkboxes[i].value) !== -1) primaryCount++;
                   else if (secondaryVals.indexOf(checkboxes[i].value) !== -1) secondaryCount++;
               }
           }

           var tip = document.getElementById('empowerTip');

           if (primaryCount > 1 || secondaryCount > 1) {
               element.checked = false;
               tip.style.display = 'block';
               
               primaryCount = 0;
               secondaryCount = 0;
               for (var i = 0; i < checkboxes.length; i++) {
                   if (checkboxes[i].checked) {
                       if (primaryVals.indexOf(checkboxes[i].value) !== -1) primaryCount++;
                       else if (secondaryVals.indexOf(checkboxes[i].value) !== -1) secondaryCount++;
                   }
               }
           } else {
               tip.style.display = 'none';
           }

           for (var j = 0; j < checkboxes.length; j++) {
               var cb = checkboxes[j];
               var val = cb.value;
               var isPrimary = (primaryVals.indexOf(val) !== -1);
               
               var item = cb.parentElement;
               while (item && !item.classList.contains('empower-item')) item = item.parentElement;
               
               if (cb.checked) {
                   if (item) item.classList.add('active');
               } else {
                   if (item) item.classList.remove('active');
               }

               if (!cb.checked) {
                   if ((isPrimary && primaryCount >= 1) || (!isPrimary && secondaryCount >= 1)) {
                       cb.disabled = true;
                       if (item) item.style.opacity = '0.4';
                   } else {
                       cb.disabled = false;
                       if (item) item.style.opacity = '1';
                   }
               } else {
                   cb.disabled = false;
                   if (item) item.style.opacity = '1';
               }
           }

           if (!isRestoringConfig) {
               triggerAutoCalc(currentActiveField);
               calculate();
           }
       }

       function onNitroCountInput() {
           isManualNitroCount = true;
           updateNitroCountUI();
           if (!isRestoringConfig) calculate();
       }

       function resetAutoNitroCount() {
           isManualNitroCount = false;
           updateNitroCountUI();
           if (!isRestoringConfig) calculate();
       }

       function updateNitroCountUI() {
           var info = document.getElementById('nitroCountModeInfo');
           if (!isManualNitroCount) {
               info.innerHTML = '<span style="color:var(--success); font-weight:bold;">▶ ' + _("自动计算就绪", "Auto-calc Ready") + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + _("根据大招时长和氮时计算氮气个数", "Calc nitros by Ult & nitro duration") + ')</span>';
           } else {
               info.innerHTML = '<span style="color:var(--warning); font-weight:bold;">▶ ' + _("手动覆盖中", "Manual Override") + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + _("当前为自由微调，需点重置恢复", "Manual override, click reset to restore") + ')</span>';
           }
       }

       var autoLinked = true;
       var currentActiveField = null;

       function onFieldInput(field) {
           if (autoLinked) {
               if (currentActiveField === null) currentActiveField = field;
               if (currentActiveField === field) triggerAutoCalc(field);
               else { autoLinked = false; updateAutoCalcUI(); }
           }
           if (!isRestoringConfig) calculate();
       }

       function resetAutoCalc() {
           autoLinked = true;
           currentActiveField = null;
           document.getElementById('inputXianji').value = "0";
           document.getElementById('inputHuineng').value = "0";
           updateAutoCalcUI();
           if (!isRestoringConfig) calculate();
       }

       function updateAutoCalcUI() {
           var info = document.getElementById('autoCalcInfo');
           if (autoLinked) info.innerHTML = '<span style="color:var(--success); font-weight:bold;">▶ ' + _("联动就绪", "Linkage Ready") + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + _("修改一项自动算另一项", "Modify one to auto-calc the other") + ')</span>';
           else info.innerHTML = '<span style="color:var(--warning); font-weight:bold;">▶ ' + _("联动锁定", "Linkage Locked") + '</span> <span style="color: var(--text-muted); font-weight: normal;">(' + _("当前为自由微调，需点重置恢复", "Manual override, click reset to restore") + ')</span>';
       }

       function triggerAutoCalc(sourceField) {
           if (isRestoringConfig || !autoLinked || !sourceField) return;
           
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

           var extraNitroBase = (document.getElementById('hasExtraNitro') && document.getElementById('hasExtraNitro').checked) ? (parseFloat(document.getElementById('valExtraNitro').value) || 0) : 0;
           var extraNitroFirstVal = (document.getElementById('chkExtraNitroFirst') && document.getElementById('chkExtraNitroFirst').checked) ? extraNitroBase : 0;

           var hasExtraUlt = (document.getElementById('hasExtraUlt') && document.getElementById('hasExtraUlt').checked);
           var extraUltFirstVal = hasExtraUlt ? (parseFloat(document.getElementById('valExtraUltFirst').value) || 0) : 0;
           
           var extraPerSecBase = (document.getElementById('hasExtraPerSec') && document.getElementById('hasExtraPerSec').checked) ? (parseFloat(document.getElementById('valExtraPerSec').value) || 0) : 0;
           var extraPerSecFirstVal = (document.getElementById('chkExtraPerSecFirst') && document.getElementById('chkExtraPerSecFirst').checked) ? extraPerSecBase : 0;

           var extraEfficiency = (parseFloat(document.getElementById('extraEfficiency').value) || 0) / 100;
           
           var efficiencyReduce = (parseFloat(document.getElementById('debuffRange').value) || 0) / 100;
           var efficiencyMult = ((activeEmpowers.indexOf('yichu') !== -1) ? 1.05 : 1.00) + extraEfficiency - efficiencyReduce;

           if (efficiencyMult < 0) efficiencyMult = 0;

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
            var _maxHuineng = parseFloat(document.getElementById('inputHuineng').max) || 50;

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

           if (sourceField === 'xianji') {
               var xianji = parseFloat(document.getElementById('inputXianji').value) || 0;
               var netFirstUltRemain = target - initFixedBase - initMultBase - (extraUltFirstVal * defenseMult * efficiencyMult) - firstPerSecOutput - firstCustomTrigOutput - (xianji * defenseMult) - firstQueyiOutput;
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
               var netRemainForXianjiFirst = target - initFixedBase - initMultBase - (extraUltFirstVal * defenseMult * efficiencyMult) - firstPerSecOutput - firstCustomTrigOutput - firstNitroTotalOutput - firstQueyiOutput;
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

           var originalTarget = parseFloat(document.getElementById('ultThreshold').value);
           if (isNaN(originalTarget) || originalTarget <= 0) originalTarget = 100;
           var target = originalTarget;

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
           
           var efficiencyReduce = (parseFloat(document.getElementById('debuffRange').value) || 0) / 100;
           var efficiencyMult = ((activeEmpowers.indexOf('yichu') !== -1) ? 1.05 : 1.00) + extraEfficiency - efficiencyReduce;

           if (efficiencyMult < 0) efficiencyMult = 0;

           var customTrigVal = parseFloat(document.getElementById('valCustomTrig').value) || 0;
           var customTrigFirstCount = parseInt(document.getElementById('customTrigFirstCount').value) || 0;
           var customTrigLoopCount = parseInt(document.getElementById('customTrigLoopCount').value) || 0;

           var baseUltDuration = parseFloat(document.getElementById('baseUltDuration').value) || 0;
           var actualUltDuration = baseUltDuration * (target / 100);
           
           var ultLabel = document.getElementById('actualUltTimeSpan');
           if (activeEmpowers.indexOf('weilai') !== -1) {
               if (originalTarget > 90) ultLabel.innerText = _("(未来视界触发：门槛降至 90%，实机时长缩放为: ", " (Future Vision: Threshold 90%, actual scaled to: ") + actualUltDuration.toFixed(2) + _(" 秒)", " s)");
               else ultLabel.innerText = _("(未来视界未叠加：当前阈值已达标，时长缩放为: ", " (Future Vision inactive: Threshold met, scaled to: ") + actualUltDuration.toFixed(2) + _(" 秒)", " s)");
           } else {
               if (target !== 100) ultLabel.innerText = _("(当前阈值 ", " (Current threshold ") + target + _("%，实机时长缩放为: ", "%, scaled to: ") + actualUltDuration.toFixed(2) + _(" 秒)", " s)");
               else ultLabel.innerText = '';
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

           if (isInit === true) return;

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

           var initFixedBase = startCharge + (jiezouFirstCount * 4.0 * defenseMult);
           var initMultBase = (huaxinFirstCount * 7.0) * defenseMult * efficiencyMult;

           var xianji = parseFloat(document.getElementById('inputXianji').value) || 0;
           var huineng = parseFloat(document.getElementById('inputHuineng').value) || 0;

           var netSingleNitroOutputFirst = (currentBaseNitro * (1 + huineng / 100) + specBonus + extraNitroFirstVal) * defenseMult * efficiencyMult;
           var firstNitroTotalOutput = firstNitrosCount * netSingleNitroOutputFirst;
           
           var firstDuration = firstNitrosCount * currentNitroDuration;
           var firstPerSecOutput = Math.floor(firstDuration + 0.000001) * extraPerSecFirstVal * defenseMult * efficiencyMult;
           var firstQueyiOutput = Math.floor(firstDuration + 0.000001) * queyiPerSecond * defenseMult;
           
           var firstUltTotal = startCharge + (xianji * defenseMult) + initMultBase + (jiezouFirstCount * 4.0 * defenseMult) + firstNitroTotalOutput + firstPerSecOutput + firstQueyiOutput;

           var step1_Start = startCharge.toFixed(3);
           var step2_Xianji = (xianji * defenseMult).toFixed(3);
           var step3_MultBase = initMultBase.toFixed(3);
           var step4_Jiezou = (jiezouFirstCount * 4.0 * defenseMult).toFixed(3);
           var step5_Nitro = firstNitroTotalOutput.toFixed(3);

           var formulaFirstStr = "<b>" + _("【首发大招运算解析盒】", "[First Ult Calc Breakdown]") + "</b><br>";
           formulaFirstStr += _("及格线目标：", "Passing Target: ") + "<b>" + target + "%</b><br><br>";
           formulaFirstStr += _("① 起步充能 = ", "1. Start Charge = ") + "<b>" + step1_Start + "</b><br>";
           formulaFirstStr += _("② 先机收益：[先机(", "2. Xianji Gain: [Xianji(") + xianji + _(")] × (1-反制％)(", ")] * (1-Counter%)(") + defenseMult + ") = <b>" + step2_Xianji + "</b><br>";
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

           firstUltTotal = Math.floor(firstUltTotal * 1000 + 0.000001) / 1000;

           formulaFirstStr += "-------------------------<<br>";
           formulaFirstStr += "<b>" + _("首发核算：", "First Ult Calc: ") + step1_Start + " + " + step2_Xianji + " + " + step3_MultBase + " + " + step4_Jiezou + " + " + step5_Nitro + (firstQueyiOutput > 0 ? " + " + firstQueyiOutput.toFixed(3) : "") + (extraUltFirstVal > 0 ? " + " + step7_ExtraUlt : "") + (extraPerSecFirstVal > 0 ? " + " + step8_ExtraPerSec : "") + (customTrigFirstCount > 0 ? " + " + step9_CustomTrig : "") + " = " + firstUltTotal.toFixed(3) + "%</b>";
           formulaFirst.innerHTML = formulaFirstStr;

           if (firstUltTotal >= target) {
               resValFirst.innerHTML = "<span class='emoji-fix'>✅</span> " + _("首发达成 (", "1st Ult Achieved (") + firstUltTotal.toFixed(3) + "%)";
               resDetFirst.innerHTML = "✨ <b>" + _("完美起步", "Perfect Start") + "</b>" + _("：总充能已超越目标！", ": Charge exceeds target!");
           } else {
               resCardFirst.classList.add('error-state');
               resValFirst.innerHTML = "<span class='emoji-fix'>❌</span> " + _("首发失败 (", "1st Ult Failed (") + firstUltTotal.toFixed(3) + "%)";
               
               var firstDiff = Math.floor((target - firstUltTotal) * 1000 + 0.000001) / 1000;
               resDetFirst.innerHTML = "⚠️ <b>" + _("开局卡壳", "Start Stalled") + "</b>" + _("：距离及格还差 ", ": Short of passing by ") + "<b>" + firstDiff.toFixed(3) + "%</b>。";
           }

           var loopFixedEmpowerBase = (queyiPerSecond * Math.floor(actualUltDuration + 0.000001) + fusuTotalBonus + huishouBonus + jiezouLoopCount * 4.0);
           var loopFixedEmpower = loopFixedEmpowerBase * defenseMult;
           var loopHuaxinOutput = (huaxinLoopCount * 7.0) * defenseMult * efficiencyMult;
           var netSingleNitroOutputLoop = (currentBaseNitro * (1 + huineng / 100) + specBonus + extraNitroLoopVal) * defenseMult * efficiencyMult;
           var loopNitroTotalOutput = nitrosPerUlt * netSingleNitroOutputLoop;
           var loopExtraUltOutput = extraUltLoopVal * defenseMult * efficiencyMult;
           var loopPerSecOutput = Math.floor(actualUltDuration + 0.000001) * extraPerSecLoopVal * defenseMult * efficiencyMult;
           var loopCustomTrigOutput = customTrigVal * customTrigLoopCount * defenseMult * efficiencyMult;
           
           var loopGrandTotal = loopFixedEmpower + loopHuaxinOutput + loopNitroTotalOutput + loopExtraUltOutput + loopPerSecOutput + loopCustomTrigOutput;

           loopGrandTotal = Math.floor(loopGrandTotal * 1000 + 0.000001) / 1000;

           var reqHuinengLoop = 0;
           if (nitrosPerUlt > 0 && efficiencyMult > 0) {
               var remainForLoopUlt = target - loopFixedEmpower - loopHuaxinOutput - loopExtraUltOutput - loopPerSecOutput - loopCustomTrigOutput;
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
           formulaLoopStr += _("大招实机时长 = ", "Actual Ult = ") + actualUltDuration.toFixed(2) + _("秒 (容纳 <b>", "s (fits <b>") + nitrosPerUlt + _("</b> 个单次氮气)<br><br>", "</b> single nitros)<br><br>");
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
           formulaLoopStr += "-------------------------<<br>";
           formulaLoopStr += "<b>" + _("循环总产出：", "Loop Total Output: ") + stepLoop_Empower + " + " + stepLoop_Huaxin + " + " + stepLoop_Nitro + (extraUltLoopVal > 0 ? " + " + stepLoop_ExtraUlt : "") + (extraPerSecLoopVal > 0 ? " + " + stepLoop_ExtraPerSec : "") + (customTrigLoopCount > 0 ? " + " + stepLoop_CustomTrig : "") + " = " + loopGrandTotal.toFixed(3) + "%</b><br>";
           formulaLoopStr += "<b>" + _("及格线判定：当前产出(", "Passing Check: Output(") + loopGrandTotal.toFixed(3) + _(")  vs  大招阀门(", ") vs Ult Valve(") + target + "%)</b>";
           formulaLoop.innerHTML = formulaLoopStr;

           if (loopGrandTotal >= target) {
               resValLoop.innerHTML = "<span class='emoji-fix'>✅</span> " + _("循环跑通 (产出: ", "Loop Completed (Output: ") + loopGrandTotal.toFixed(3) + "%)";
               var diff = huineng - reqHuinengLoop;
               if (diff >= 0) {
                   resDetLoop.innerHTML = "<span style='color:var(--success);'><span class='emoji-fix'>✅</span> <b>" + _("全盘跑通", "Fully Completed") + "</b>" + _("：当前输入的汇能（", ": Current Huineng input (") + huineng.toFixed(1) + _("%）超过循环底线（底线：", "%) exceeds loop baseline (Baseline: ") + Math.max(0, reqHuinengLoop).toFixed(3) + _("%），火力倾泻不断档！", "%), continuous firepower!") + "</span>";
               } else {
                   resDetLoop.innerHTML = "<span style='color:var(--warning);'>⚠️ <b>" + _("逻辑异常", "Logic Anomaly") + "</b>" + _("：虽然满足了阈值，但这应该是极端情况的浮点漂移。", ": Met threshold, likely float drift.") + "</span>";
               }
           } else {
               resCardLoop.classList.add('error-state');
               if (nitrosPerUlt === 0) {
                   resValLoop.innerHTML = "<span class='emoji-fix'>❌</span> " + _("循环崩塌 (容纳氮气数为0)", "Loop Collapsed (0 nitros fit)");
                   resDetLoop.innerHTML = "⚠️ <b>" + _("致命断层", "Fatal Gap") + "</b>" + _("：缩减后的大招期间", ": Reduced Ult fits ") + "<b>" + _("可放氮气数为 0 个", "0 nitros") + "</b>" + _("。接力必然溃败！", ". Relay will fail!");
               } else {
                   var loopDiff = Math.floor((target - loopGrandTotal) * 1000 + 0.000001) / 1000;
                   resValLoop.innerHTML = "<span class='emoji-fix'>❌</span> " + _("循环失败 (缺口: ", "Loop Failed (Gap: ") + loopDiff.toFixed(3) + "%)";
                   resDetLoop.innerHTML = "⚠️ <b>" + _("循环断档", "Loop Disconnected") + "</b>" + _("：产出未达及格线！要实现连发，汇能至少需要被拉升至 ", ": Output missed! Needs Huineng >= ") + "<strong>" + reqHuinengLoop.toFixed(3) + "%</strong>。";
               }
           }
       }

       initTheme();

        function initApp() {
            if (currentLang === 'en') document.body.classList.add('en-mode');

            var ctb = document.getElementById('closeTutorialBtn');
            if (ctb) ctb.title = currentLang === 'en' ? 'Dismiss' : '不再显示';

           updateAutoCalcUI();
           updateNitroCountUI();
           
           var isLoadedFromLink = loadConfigFromUrl();
           
           handleNitroRadioChange(true);

           if (isLoadedFromLink) {
               setTimeout(function(){
                   showToast(_("✅ 已成功解析并加载车友分享的配置方案！", "✅ Successfully loaded shared config!"));
               }, 800);
               calculate();
           } else {
               calculate(true);
           }
       }
       
        initApp();

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
           window.addEventListener('load', function() {
               navigator.serviceWorker.register('sw.js').then(function(registration) {
               }, function(err) {
               });
           });
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
   
