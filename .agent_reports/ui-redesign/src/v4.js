/* v4.js：V4 交互层（由 build.mjs 放在业务脚本之前；需要包装的业务函数都在 DOMContentLoaded 之后再接管）
   - 270° 转速表式读数（量程 = 阈值 × 1.5，阈值刻度 + 达成率）
   - 手机端渐进披露：低频卡片默认收起，标题旁显示摘要
   - 芯片槽位：线性 SVG 图形，替代游戏截图位图
   - 提示条：去掉 emoji，换成同一套线性图标
   - 长截图：导出前把开关 / 单选 / 输入框换成能被 html2canvas 正确画出的元素
   - 整数输入：− / + 步进按钮
   - 手机选车：底部整屏面板（顶部固定搜索 + 筛选 + 品质切换，列表带车图）
   - 手机页面压缩：计算过程默认收起、页脚合并为一张卡 */
(function () {
  var MQ = window.matchMedia('(max-width: 849px)');
  function isMobile() { return MQ.matches; }
  function zh() { return typeof currentLang === 'undefined' || currentLang !== 'en'; }
  function L(a, b) { return zh() ? a : b; }
  function $(id) { return document.getElementById(id); }

  /* ---------- 线性图标（与全站 ICON 同一套笔画：24 视窗、1.8 线宽、圆角端点） ---------- */
  function svg(paths, cls) {
    return '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  var IC = {
    ok: '<circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16.2 9.4"/>',
    err: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    warn: '<path d="M12 3.5 2.8 19.5h18.4L12 3.5z"/><path d="M12 10v4.2M12 17v.01"/>',
    link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l2.8-2.8a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-2.8 2.8a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    minus: '<path d="M6 12h12"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>'
  };
  window.__pvIcon = function (k, cls) { return svg(IC[k], cls); };

  /* ---------- 270° 仪表 ---------- */
  var C = 2 * Math.PI * 42, A = C * 0.75;
  var TICKS = (function () {
    var d = '';
    for (var i = 0; i <= 30; i++) {
      var a = (135 + i * 9) * Math.PI / 180, r1 = (i % 5 === 0) ? 29.5 : 32, r2 = 34.5;
      d += 'M' + (50 + r1 * Math.cos(a)).toFixed(2) + ' ' + (50 + r1 * Math.sin(a)).toFixed(2) +
           'L' + (50 + r2 * Math.cos(a)).toFixed(2) + ' ' + (50 + r2 * Math.sin(a)).toFixed(2);
    }
    return d;
  })();
  window.__pvRingSvg = function () {
    return '<svg class="ds-ring pv-arc" viewBox="0 0 100 100" aria-hidden="true">' +
      '<path class="pv-ticks" d="' + TICKS + '"/>' +
      '<circle class="ds-ring-track" cx="50" cy="50" r="42" stroke-dasharray="' + A.toFixed(2) + ' ' + C.toFixed(2) + '"/>' +
      '<circle class="ds-ring-fill" data-r="ring" cx="50" cy="50" r="42" stroke-dasharray="0 ' + C.toFixed(2) + '"/>' +
      '<circle class="pv-mark" cx="50" cy="50" r="42" stroke-dasharray="1.8 ' + C.toFixed(2) + '" stroke-dashoffset="' + (-(A * 2 / 3 - 0.9)).toFixed(2) + '"/>' +
      '<text class="pv-arc-lbl" x="50" y="88" text-anchor="middle" data-r="pct"></text>' +
      '</svg>';
  };
  window.__pvRing = function (g, total, target) {
    var ring = g.querySelector('[data-r="ring"]'), lbl = g.querySelector('[data-r="pct"]');
    if (!ring) return;
    if (!isFinite(total) || !isFinite(target) || target <= 0) {
      ring.style.strokeDasharray = '0 ' + C.toFixed(2);
      if (lbl) lbl.textContent = '';
      return;
    }
    var f = Math.max(0, Math.min(1, total / (target * 1.5)));
    ring.style.strokeDasharray = (A * f).toFixed(2) + ' ' + C.toFixed(2);
    if (lbl) lbl.textContent = Math.round(total / target * 100) + '%';
  };

  /* ---------- 芯片槽位：游戏原版图标，去掉圆形底盘，只保留形状描边 + 内部填充 ----------
     由 data/icon/carport_new_skill_chip_none_icon_1~5.png 抠出（按灰度把底盘去掉，保留描边与半透明填充），
     各做一份浅色版（深色模式用）和深色版（浅色模式用），由 CSS 按主题显示其中一张。 */
  var CHIP_IMG = {"1d": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACb0lEQVR42u3YX2jNcRjH8deOWS4mN4iVPyvUJApjbrjwb6WkWEm2tAtFXFBCcqnk1oW0G4q1Oxe7QS1/w2SURIaLYVpacjHFrM3NszqddnJ+51+jPfV0zvec7++c9+/5Pd/n+3m+Fa/fD5jMljLJbQpwCvAvtgRH8RA/MBb+E49xBnWF/EFFnqu4GW34hEfoxkA41GAm6rEL89GC6xgtJWAD7uIBLmMwPh/OmFeZMV6EI1iHTbhfikd8LuCOx/vBBNf24URE8R7O5nphZY7z2rAZOzE0wY1ljkezfN+HHRH9lWgqRgQPBlxrwBVqQ5HDDThVaA7Wowt7MuBSBVaLFKrRidV4kW8Eu3AgDa6qiCVuKH77eb6PuDlqWX/a3JEiFfeR8A+xog/n84gHcQy9mFYEsFSWRTQP1zAjSQSXx2tv2rzRAtwE41T4V3zB0iSAu3GjjFvszcjHnAG3xMqaHl5sy4zwS2xPArgRH8soWgawLOkq/l5GwP4QF/+XHpxbRo45+JUEsAcLywi4GM+SAHZmS9oS2YqQYTkDdmBrGQEbcSUJ4NvoN2bHnlmK3B/3GtTiXdJF0hJ7camtGfvz1YNjOIRXSZudHPSgyPO2GI/lUwfX4lKIy2JbdcBtyAaXC2APTuIifqd5oXtvKm78NJ4U2pNcCND2KKiZSZ6Lj6vxqojc1VDr54vVdu6NprsjalY+Nhz98a2IXmspGvc1uBMnCe3ZSsMEtiD03jasCnlV1L44PSdnYV/I9M8hNrtD/XxLWwC1Ee3GqHXN2TRfKc5mxq0uotKE9Rk3/DSifBtvyn149M8cv00BTgEWan8A7a+nNrWdsXAAAAAASUVORK5CYII=", "1l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACbElEQVR42u3YS4jNcRTA8c8MZjWy8cgsjCkUyaNmPDaUd5GNlGSkWQixYINsbEQSCwsxG/LIimLjkTzzylA2YrLwTJKoIcYYNkfdbvO4//v/39uke+p0+9/f739/39+555zfOb+qKY3zDGSpNsClAlgB7EfGYQvu4Bv+hP7APezCxDQLDC7yvWa04g3u4gwO4kOM12EomnANo7EWp9GdZKGqhGlmFm7gNo7iU3zf2c/G67EZMzAXtwpdcNCouoZC5+7BMWzDOXzPGfvdj+t8xVVcx4Ww4q0s/+JWzMdydPQAkP/c3cv4KywN60/ByiyCZH3AtQRcWukIH56FHWkBm3AAG3rws7SyEXsxPQ3gNazLsVxNhoAd8duPiwVsjlz2LmduV0bJvSv0ZQTLpmIAD+FURtbqK/cdjhyaCHBSfL7ImdedQvXwXB36Ee8xPgngCpwv4xF7KfyxYMAFeIIhoVlLvoWfYnESwDl4Xcai5QMmJA2SL2UEfBfFxf9VD44sI8cI/EwC2IYxZQQci0dJAC/25rQlksm4mQTwLBaWEXAJjicBfB79xvA4M0vh+/+0Dg1oTxoka7G1DNZrxppiovhkJOxpJYSbgGXRdBVVDzbiCGpLAFcbrcTsaFWLAmzD9iiJfuVo2rO3Oja+E/fT9iT7A/RMJNR8Jy9E/1XjNWG5E1Gt78vqZmFVNN1nI2cVI53RH18O67VkfbOwOxL4dTwIi7YX+G591HuLMDXKq5JcfbRhGFZHO/A2is0HUf18zgmAhrD2ksh1zb3VfFlefeTLxLDKSszM2/DDsPIVPCt2garKFXAFsALYt/wF27OSYNlRVKIAAAAASUVORK5CYII=", "2d": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADQUlEQVR42u3YXYhVVRQH8N8dZbKylz5Qo4d6VMKHILG3yqfBUUFGiwIrRLAvI5M+EEHU8uPBCCIIRHSQkPAliCRJmJJ6GGugJtRASR+GJswxSGi8zky+rAOHwz5z7517zHmYBYezz177nPU/a6/PXTtzfth0pg7TnGYAzgCcAdiAZufGC/HAJOB/wUhFch/EosLceG78FwaLAOFbfIcruLvAewp34L8KAA7iAq7m5uq4H0uxOKXBsziBH3A8AX4e1uNAm+BexK/YVpi/C08E0MFsslbIJHNjG1cntvMRHAkt1qcIrhPX0YPLCYDHcV9edtHOruF9vJ74+BA+xdE2tNeLj8OEivQedhQVU0vk4ln4Fy/gUuHvhRk8jp9bBLcIP6ErnidyvIdxGLVmwsw4urEHY4nrXXyf+lgD6sf2kNkRNp5dO7G8lTh4Iu4rSwSdwRstgNuE8zid4HXH/avUi7VJyq35+AOrMJzb4syjj+FOjDYANydMZm2J7Z3EgpDRUiYZDrtYneD9iYNNOsxnEZpS4F7Gh2XgGmlQhJRRrMDfiZBxFE/Glpc5Rh+ezSkjc46HQgGThq1Gufg6XsKuBK8ejtQ3yft9sSYF4J2IFPV2i4VDkTuXlDjMRWxO8DYHrz/BWxoa7G0kvNZkT7IQAxHDxnJbXMe9+AL3RKDPMtI/4WAjsbYjp5Sv45vnqiq3zuLLCDudOXACwEcFbfRG1hnJ2V12bYgIcK4ZwbUWurosXDwXXlwv/Og3eCyeB/B0oazriDz7eUHblRWso3gLbyZ4E3g7gA3EOEU7IxNda1ZoqxX1/sib8xK8H8Mh+mNcpEfDMfZOtaJulpaHDT2f4O0reWcMH+TS2i3tSU5HNbwqwRspaQuewW8NYmZlGoQ10TecbMKe5uK1KOf/t67uSpTsrzaxdiN2l+TiSsOMknT3SnR8nQneYnwSDdiN29EXd2NLIhhnBcGWWHNjqgLaBZgVtl0JXldhTduN+1RpGX7HqVzxOgdboxO87UcfQ9Gprcvl6XVhe0PtfrxW0QnrrAjGPfF8LOYmqjybaYfGA1x2WtBTBbgqNZiPj6Jqqfx0qwpaciuP36qgC1UDnPYHmDcBJl7SkRCGok8AAAAASUVORK5CYII=", "2l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAADQ0lEQVR42u3YTYiVVRgH8N8dI610URpT0iKXigwtSgzcVKvJIUHsAyLGaFFRFJlWEEZg9LWoZZuIkooRJYggSRLGoqCZEnJiKmiwVk00MwVK6nVG2zwvHF7O/Zp7r97F/OHlPfc85z3nf5/zfJ1TGbj1Tr2MPj2OJYJLBJcINsAVSXs9rq9D/gTmOrTuWmwo9S0k7RlMlAnCMXyFWVxTkt2B5bjYAYITmMI/SV8Va7AZAzkN/owj+BaHM+T78QjebZPcTvyEvaX+q3F7EJ0oOiulTLIytnF7ZjvX4cPQYnWR5K7EOezA3xmCh7E6XXtZ/9p1SmruiwmOlSb4LyYfxoFFEvwIo/ghYyov4YMgqZYGYRnOBJE/Sv9emMFt+LFFchuC2GD8vpDIbg5ylWbCzAKG8DrmM88L+CY3WQOM4eVYsy9svHj2YWsrcfBIvO+psdAknm6B3FP4DeMZ2VC8P899WKlTbt2AP7EN08kWFx59CFfhbANyK8Jk7ovwVcZR3BhrtJRJpsMutmdkf+E9jDShvY8jNOXIPY63a5HLBeoyHg0NHcK/GY8cCeOfrOMYW/BAoozCOW6KaLG8nVx8Dg/jlYysGo40Wuf70RiTi5vPR6SotlssvB+5c1MNh/kduzKyXSEby8g2hwb3N1q80uSZZD2ORwybT+JiFdfhU6zC6SQjnQoHm4uxfYlSvog5f2m0cDmT1MIMbglvm4pgXmzNmSCzM8kwI1F0fFcoIt4Xw64n8U6r5VYjPBRkxsOLU3yCL7ExiW25rVkdjrGqGwXrWTyLZzKyC3guzOB4tHPYF5nodLcq6rcib/ZnZN+HQ4xFu4yN4RhvLLaibhZbIy4+mJG9WeObebyapLWunknGw1G2ZWRzNY4F9+PXBjGzYxqEe8OzjzZhTyvxZJTzl+xUNxsl+xNNjH0Mr9XIxV3ToEh/1QjSJ0rVTpEKB3B3aPyynIuHsDsJNekjZEM4f7kIFoXtYEY2WBrjUm9xgbtwEl8nxesKvBgnwbbQbC6uh1O4NiqUicjTw0H4YCevPtrBngjGn8Xv4SCqVwguRBFQ3BbsKB0rF41Kh++oZ5OqRS9psMCmbl6/dQJTnSbY8xeY/wOSRrvy8y87GgAAAABJRU5ErkJggg==", "3d": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACLklEQVR42u3YO2hUURAG4G9jsJCIoCBELbQQbUQLxVZRTGVQCyttIoitaAhamFKw0sJK8IGKlUQIIkh84QMMWKQwBAkKghBBgxi2SIwbm1lYlnVf995N0B04nHu55zI//8z558zJjU9OWcrWYYlbG2Ab4GJbZ4Pr1+NjE37mSp434Vu9P+YalJnXGMeLBgEWYt6LHdiVBcADGMZBzDcIsHT9Q/TgTdo5OIyzKaRVP14ilybAU5F775tgr+inOCYwhjNphbgTv3AU35tkrVD2vg530YV8UgZv4HoCcJWATmEI15IyuBZfsS8lYOXEPMFmTDarg68wUKZjEuRguV3ECDY2E+I92IDRYGAuwSiUbZSijaA7fDXEYA7P0NeCanY6fHVgoV4G+/Ecn1oAcCJ89de7SVbiJ3oxU1JL5xOAWB6j2vdHWBW+qzJ4B7dKwLXKhnDznzhuHQua77eYxcMR4poMzoT2XQh5KLQA3ADOl+dfrUqygOP4HBskq02yFVexrBIZ1XKwB5dbkKuDUUoLjVaSxzEfyRDc/pifNluLt0eIH6RQjyuF/Ry2JDlufcE9nMiAvZOhfR+SdnV9mMVt/EgJ3JqQla40jvxzAXIwRfauhKzk0+zqFiIsYzXq6t/yrWjbQh3qapoaadx3420cIvJ1sA4rKrSdl7Azi5uF0ejsDtXRuJdr2mzMvXG8epfVzcLqaJ5+11hX7Xs3prO6m5muN3f+m9utNsA2wMW2P+v0lvjLNzbhAAAAAElFTkSuQmCC", "3l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACOklEQVR42u3YO2hUQRQG4G+TmEIiFoKSKGoK0UbTJAhWvtAuqIVYCEIEsRUfQQuDVdBKa8H4RBAkgkVAoiI+wICFhSAiFoKgEEUMKbImq81ZWC7LZh93N0H3wDD3MjPMzz9nzjn/ZLb07rSYrcUitybAJsCFtrYK56/Gpyr2yRZ8d2OyXgDv4SaeVbguF/0OjKGvHgD3oBcXMFshwPz8WziEbXiVtg8+xKkU3Oo0niOTJsDj4XvvqmAvv0++vcdbnCxnYaaMVNeG3ziI71Wylkv8d+EOOjBdK4MjuFYDuGJAv2IUV2tlcCW+YVdKwJLEPMYGfKz2Fr/AYCKOqcEHkzaMcayv5oi3Yw0mgoFsDS2XuCh5G0dn7FURgxk8xUADstmJ2KsFf5KDrau6uostOoMleBD/c0X8qBJrjVbMJrEu/P1lOZdkGX6hH1MFuXS2BoDt0UqNj2F57F3SB2/jRgG4Rtkorv8T5dbhoPl+g1ncH0c8L4NTEfvOx8XINQDcIM4l/a/UEV+K0mptA8Btijh4sdJAvReXG+CrQ5FKc5UCfBT9gTqC2x39k2pzcQ8+R8DOpgyuHWexsZZy6wvu4mgd2DsWse9DrZpkADOhJ36mBG5FhJWONEr+bIAcSpG9KxFWptPSJCOhxHoSubWSlrfNUWINpy07t+J1FBHTZbAOSxOyszDGpq6LJ0LZ7StDuCdj2kz0/aHq3tTrZaEvxNOReebNlRjrrOfbzI9yBfd/87rVBNgEuND2F0SpfRqpBoaDAAAAAElFTkSuQmCC", "4d": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACCUlEQVR42u3YT6hMcRQH8M88UySl1Eti9WSJEgkLGyQ7ySP/kn/Pn/JnQcoCGwtbSSkbJUtJsmDBRhJF9DboZSGvp0QsvN48Y3OmbtO8mXtn7nizuN863e6ce8/v+zv3/M6fKQ1/HNXL6NPjKAgWBAuCBcGC4NS4ju8JqXZZfuJaPYlSk1I3E1+xJe7/1l2zbL4PlSb62biPhfid1oPjOIu9DQynkSzYgfP15NLE4C2sQX+dB9NIWizAetxo95AcwVDEyWSGmEqSnUjYq+n/hJzG/k5O8au4rsSMhJRaSD1qxJJYFYfj5VSLl1N+hkN4gcEcM8hcXMDaPPLgKO5ia3zmyRwIbsKdsK1TD8KlSDvP8a1B2miF5KbmRdwN5FlJxnEQh3Pw3rE4fBN5l7p7WBRpp10sDnnUrVq8D5c7IHgSB7rZLLzHJ6zLWDlmYTPG8CbtYuU2vXACr7GtjfeW/492awy3sSvDOzsTHZJuexAuYgTP8KXFs/3h7YGsi3TSsFZwHNsjBVUbbL4mp3A0TVrJu6N+gKVY1uSZJZiPh9PV8u/BuSb6M9HvTdtM8hbvsLGBbnXoPrRrvCwfDGEYTxO/zYnYW9ELU90vXI1UUsMgbuJHJ4bz8qBo2UfwOO43RM3VKwQrMWBdSYwK1V4iKGKwNjA9ycNg3gRhd57GukHwc/HfTEEwA/4B152SQQ39k8cAAAAASUVORK5CYII=", "4l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAACCUlEQVR42u3YT6hMcRQH8M88UySl1Eti9WTpKT0JCyUkO8kj/5J/z5/yZ0HKAhsLW0kpGyVLSbJgwUYSRWQjvSxET4lYeL15xuZM3aZ5M/fO3PFmcb91ut05957f93fu+Z0/UxocWqeX0afHURAsCBYEC4IFwalxDd8TUu2y/MTVehKlJqVuJr5gc9z/rbtm2XwfKk30s3EPC/E7rQfHcQZ7GhhOI1mwHefqyaWJwZtYhf46D6aRtFiAtbje7iE5jJGIk8kMMZUkO5GwV9P/CTmFfZ2c4pdxHcKMhJRaSD1qxJJYEYfjxVSLl1N+hoN4juEcM8hcnMfqPPLgV9zBlvjMkzkQ3IjbYVunHoSLkXae4VuDtNEKyU3Ni7gbyLOSjOMADuXgvaNx+CbyLnV3sSjSTrtYHPKwW7V4Ly51QPAE9nezWXiHj1iTsXLMwiaM4XXaxcpteuE4XmFrG+8t+x/t1hhuYWeGd3YkOiTd9iBcwCie4nOLZ/vD2wNZF+mkYa3gGLZFCqo22HxNTuJImrSSd0d9H0sx2OSZJZiPB9PV8u/G2Sb609HvTdtM8gZvsaGBbmXoPrRrvCwfjOA9niR+mxOxt7wXprpfuBKppIZh3MCPTgzn5UHRso/iUdyvj5qrVwhWYsC6nBgVqr1EUMRgbWB6nIfBvAnCrjyNdYPgp+K/mYJgBvwDwmiOVeV+yTkAAAAASUVORK5CYII=", "5d": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAB6UlEQVR42uWXz0rDQBCHP8uiBy9SxIfyIFUrFqWID+AT9WCttShtRTz4KJ58AAkSilTBIsXLBIaQ2PyZjQEHSnbZsP34zWT2t2vPL6/UORrUPP4l4DFwYrWZ8wB3q+ajOgFGcLsyf7KAdJ7gkHFpSGcEdwW0gXlsrQ3cyP8M/gIwUq4NBAnrAXAKTGQ+qBJQp3X+y3sBsAc8FoF0hjW3KgpBOuOaS4s5sAQOgPs8kM645pIOgqWah3khnYeaWxVhnnQ7jzVHTL1GkZrMArgvNdcqodx3DHCm+uRE1vpFAPeBoSgYejAWgYIkCdJlgGsBnx6tWQB0lMnoZwHUcFXEWxpkEuChnJ9HwLsnW9ZYAbmIDEbtHXWSMlN5jkXFoCKWbVHvXNuztNTFIcMK4fpZ7yRTsUqXsoFlLNVvS+C6eduMVvLOUy9syt5d6RqFTpKp2sgSMtrzIg0uT/voGSup4XpWbqYHfMgX1lHn6QJYz2EcmsADcGZtt/TtLPq6Zxnh4splgit6QoyATYHMk26dVq+Wv0hNZq45y1tdT1KcBLlQ4x1551S1rcruxWN5XqcouSPvFIKzciljYEM13FAULA1naaOGSsmutJTScNY+bwh8iZII6LTsptZGdJwyrg2gGVgWu1WLqD3gD188ku4wXrJ7AAAAAElFTkSuQmCC", "5l": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAB6klEQVR42uWXz0rDQBCHP8uiBy8i0sfw5BN49CBVKxaliA/gE/VgrVWUtCIefKggQaQKFileJjCExObPbAw4ULLLhu3Hbyazv13Z3tmlydGi4fEvAU+AU6vNnAe4ezW/axJgDLcn8xcLSOcJDhlXhnRGcNdAF5gl1rrArfzP6C8AY+W6QJiyHgJnwETmozoBdVpnv7wXAvvAcxlIZ1hzy6IUpDOuuayYAQvgEHgsAumMay7tIFioeVQU0nmouWURFUm381hzJNRrlanJPIAHUnOdCsp9JwDfVJ+cyNqwDOABMBYFIw/GIlSQpEG6HHAd4NOjNQuBnjIZwzyAGq6OeM2CTAM8kvPzGHj3ZMtaSyDnscFovKNOU2Yqz0BUDGti2RL1LrQ9y0pdEjKqEW6Y904yFat0JRtYxkL9NgSuX7TNaCUfPPXCTdm7L12j1EkyVRtZQsZ7XmbBFWkfA2MlNdzAys0MgA/5wnrqPJ0DqwWMwybwBJxb2y19O4u/7reccEnlcsGVPSHugHWBLJJunVavlr9MTeauOctb3UBSnAY5V+O2vHOm2lZt9+JAnjcZSrblnVJwVi4lANZUw41EwcpwljZqrJTsS0upDGft88bAlyiJgE6rbmptRIOMcWMAzcDy2K1GROMBfwAL15D4dBA4GwAAAABJRU5ErkJggg=="};
  var CHIP_NUM = { '\u25CB': '1', 'V': '2', 'v': '2', '\u25E3': '3', '\u25B3': '4', '\u25C7': '5' };
  var CHIP_NAME = { '\u25CB': '圆', '\u25B3': '三角', '\u25C7': '菱形', '\u25E3': '六边形', 'V': 'V', 'v': 'V' };
  window.__pvChip = function (sym) {
    var n = CHIP_NUM[sym] || '1';
    return '<span class="pv-chip" title="' + (CHIP_NAME[sym] || sym) + '">' +
      '<img class="pv-chip-d" src="' + CHIP_IMG[n + 'd'] + '" alt="">' +
      '<img class="pv-chip-l" src="' + CHIP_IMG[n + 'l'] + '" alt="">' +
      '</span>';
  };

  var SPEC_DARK = {"6b03fddcf523615f": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEY0lEQVR42u2ZTWxUVRSAvzedNmNLFNMpJdKFVkBAEoqEakJcWBpjYpq4MCGwwCgbjQsgbAyVlSVsS9zAhgWYmKjRmGgw4AIDCcak0cSa1qhJIQoI1WKZQunfuOBMPFzv67x5fx1m7kle3psz973c85177jn3Xq+n5yXqWTLUuTgADoAD4AA4AA6AA1C/kn1A+vgu8BYwJZet355F16SeOx9UAAAdwIp6HQGmfAvMGLqngStyNYpuFlgLPFFLAK4DzwNzhv4j4ATwlaHvBwbqYRKcAMZrNQS0t1cAx4CC0eZFmeSGDf0LltESCMA+YA9wrYKOfgkMRjDUA4oB2u0B5g3dLPA40LsIvIoAbAE2yhVUrqU4Km4CDQpEq08ILA8LYFzdtWErLcauBPJhY1B53wPagFVAC/AP8KNlEnwV+FmM/kv0nwCfAh8YfRwEdoQBkJf7TuBr9btf7vuVrgs4GzEVPyVx/CywBmgHvgf6LO3HBMR1A8ywOEE74qewI+CucS999I5llBRCGJwHuoHVwCbgGUu4/aKep+XeAPxt+ea0pTaINAfELctkpKwWbz8HbAVyYpRNbAblgINS8GjZALwmMLXsigrgz5AG58TYLunUOjE6HxFkiwCwyeY4R0Bpdn1fTTSI15CUg5SdHZb3jwCvqHZxyZRASG0tcA4YUfPBMnk+pTyyTbyrpSsB40ux/gbwu6EfAL6RkrhNdDeAd8qFgR+ABgXgotJvk/tppStI4ZQtszSN4qRG5YSzUvpquQGcF2eNKP2lck5Oai1QJDm5lWYIBClufk2xAnxIQuCKOG9BzUm9lvlhfVgApby7Vw2peRXrbxpFTFryKHDc57/uJEbA2z767TWyjPYFsFBFcT8H3FYhediSBQ4AQ8AFQ/+6lNixV4ILS7ihYlty7wBOAt8Z+lVxASga6S0TcpRUIq2WxVleJrtRS/tO4A9D92SSa4G4cv0E8Jvlm0PGc5c8f6gm6ZJ0iKcnLfpYAHgJAvgC2B1g2A/KCBjxMexhuWLNAjrmPWPrKi4A49zbuu4zhrvO/ZdkTXIGuBxiUTVj9L0iAEV1ZVRNUFQlahSZFOOPSul93jBwSmr6VuDltNKgX3rzEk577wkALbNi/M406wBbrHvKcG+RjYwocshSft8ql8rSAqB/J5X/PwM+VkvaUiHUDvQsFQA/CHFJRn1vGniE+7fD5kSfSwJ8tZwMzcr9qE8Gyllyf00BKE2ouTK7QbFLNRyOegFDKpsmgDBgGnyeg/QhkzCApko/eof/H3hkjNxv1gG3jeKlYAFStKwoJ2SiK5RpV5B2k/x3QGOrUbSuWUKn4Fe7+AE4DnweIAZ1zOrzwv3cO5jMynuZRbwyJoYNYz8MaVLZYFS+3RTQ882EPB4fI9pe32iId4KeLv+QRhbotXg8E2HnKOi7UdpR5t1zlQA4Te2JV61pcEnFAah3AH5zwNUasW8+LIDHXAg4AA6AA+AAOAAOgAPgANS4/AvM9OjMVYcPNAAAAABJRU5ErkJggg==", "7708febb380440f4": "data:image/png;base64,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", "1c3fdf64e6be6a83": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAETUlEQVR42u2ZXYhUZRjHf2d2cUcRNZySchUXthDcagTFMKVlHUyQoEiJaEVE6UMvUlQUFaFYKS3UQLrQIkVBuupCkAovhIryzotRsS79CGGCFfHb2eOF/4HXt3Nm5nzMztmZ88Bhd59595zz/N7n633GGRhYRjtLhjaXFEAKIAWQAkgBpABSALGLA+SBXv3edgDmAJuBDcDUJAPobMA9c8ABoGDoNrWTB9jGbwQG2wXAVh9jDwB9rQ7gLeDzGmGRa1UAc4FvgGyVNQWFQ9iq4iQVwIvA10CPpS/qMmU9MGBViznN9ICOnp7eqPfYB7zrYfz7wE3AnLiMB2YAvwELBWSpdvfCWCyDO4G1Hvq9glDwCZfvgGeBlw0vugWcHksA3gaGPPQHgRNV/u8ZKwwQiC+Bf3QlPgm+AvzgoT9uQbkDXK9yn7IFYfdoV4owAJ4DvgemWPrfgS+A/yI8f1BhFQTCDGAR0D1aAA4B8yzdFeAz4JKHu79Qo7zhAWEwAIRdwClgRZiQDgpgG7DSw/gh4IzH+udDniV21tk97hKsKcBqYHYjAawBtnvojwEnLd1U4EOVunrFtSAMqsJM9lm/CvgEmKC/84LQkD4gDxz1cMuDwFfAsPHiBR2FNwKzAgJwgIdAh3Q9wG3gL2vtSvUf0z3y0581Em/gMphXxp9m6c8Ae4CSDK/swJuq8WHkvmE8euZaPatotNSbfZJet96hCNyLC8AGGWfKDbW/Jb3QanV8UUqYC3TVWNNn5IZzwI/Ae8ACfZ7V+7wGnI0DwBFgnU+9N8/+UY+6ro/+mtFV5gzjr2rIcg543QCAEuFy4LwRmqGS4Dof428ou29RnMd1znesxug28K26SnPKVAL2y3iAP3y61HzUKrDCZ6cmAe8AS2Juylwr/n8CDhtnjsqg5WflpAwwTr2HvdO9QH9UAB0+u5RV6XFiMNi+zAS7V7ttjtSK0g8Dj+TuSzy60ooX9EfJAeUA3VsUCI4FvGTEvdkalxT3RRn8sWLdz9VfFYCzjTwORzG8LOMzFthN8oCCMUYrqeRW9B/JuFpV541aEDJNBODlBSd09fH0DPG8EQ4nlZ/qKbn9tcKgGQBGdHUYz3c1B9gPzNTApFJdbirvfKqZQdBe4wMlxcQAKHvkl7uK++uCYNb1LDBfJ9CuEM/r9qloTckBI8reJvgHitG7wA7+P1/sivjMLFUGr80A0GmV2AfAZWCxMnsjJJcEACPa+YxHIgw90Ykqowkg49NPTFSMN1LuJ60MNqqxSrQHVOsC6/nc9QHmRoHbmeCdd+pc78QZl6ZMoHUkG9QDHOBXnkx8ax2OkiwV+y6GCYEhy8VcWlAySc3OSagCOaNTG6tAhvXzJeDvIABc4Jc6ByRJFnPT5gX1gLntHgJxyqOk2tfZYqBjfbF/efrrpXJMsTja7XY2TCME1b/Xb4s+gBRACiAFkAJIAaQAUgApgFaWx2rnzAMhQc5TAAAAAElFTkSuQmCC", "new_carport_icon_city": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEY0lEQVR42u2ZTWxUVRSAvzedNmNLFNMpJdKFVkBAEoqEakJcWBpjYpq4MCGwwCgbjQsgbAyVlSVsS9zAhgWYmKjRmGgw4AIDCcak0cSa1qhJIQoI1WKZQunfuOBMPFzv67x5fx1m7kle3psz973c85177jn3Xq+n5yXqWTLUuTgADoAD4AA4AA6AA1C/kn1A+vgu8BYwJZet355F16SeOx9UAAAdwIp6HQGmfAvMGLqngStyNYpuFlgLPFFLAK4DzwNzhv4j4ATwlaHvBwbqYRKcAMZrNQS0t1cAx4CC0eZFmeSGDf0LltESCMA+YA9wrYKOfgkMRjDUA4oB2u0B5g3dLPA40LsIvIoAbAE2yhVUrqU4Km4CDQpEq08ILA8LYFzdtWErLcauBPJhY1B53wPagFVAC/AP8KNlEnwV+FmM/kv0nwCfAh8YfRwEdoQBkJf7TuBr9btf7vuVrgs4GzEVPyVx/CywBmgHvgf6LO3HBMR1A8ywOEE74qewI+CucS999I5llBRCGJwHuoHVwCbgGUu4/aKep+XeAPxt+ea0pTaINAfELctkpKwWbz8HbAVyYpRNbAblgINS8GjZALwmMLXsigrgz5AG58TYLunUOjE6HxFkiwCwyeY4R0Bpdn1fTTSI15CUg5SdHZb3jwCvqHZxyZRASG0tcA4YUfPBMnk+pTyyTbyrpSsB40ux/gbwu6EfAL6RkrhNdDeAd8qFgR+ABgXgotJvk/tppStI4ZQtszSN4qRG5YSzUvpquQGcF2eNKP2lck5Oai1QJDm5lWYIBClufk2xAnxIQuCKOG9BzUm9lvlhfVgApby7Vw2peRXrbxpFTFryKHDc57/uJEbA2z767TWyjPYFsFBFcT8H3FYhediSBQ4AQ8AFQ/+6lNixV4ILS7ihYlty7wBOAt8Z+lVxASga6S0TcpRUIq2WxVleJrtRS/tO4A9D92SSa4G4cv0E8Jvlm0PGc5c8f6gm6ZJ0iKcnLfpYAHgJAvgC2B1g2A/KCBjxMexhuWLNAjrmPWPrKi4A49zbuu4zhrvO/ZdkTXIGuBxiUTVj9L0iAEV1ZVRNUFQlahSZFOOPSul93jBwSmr6VuDltNKgX3rzEk577wkALbNi/M406wBbrHvKcG+RjYwocshSft8ql8rSAqB/J5X/PwM+VkvaUiHUDvQsFQA/CHFJRn1vGniE+7fD5kSfSwJ8tZwMzcr9qE8Gyllyf00BKE2ouTK7QbFLNRyOegFDKpsmgDBgGnyeg/QhkzCApko/eof/H3hkjNxv1gG3jeKlYAFStKwoJ2SiK5RpV5B2k/x3QGOrUbSuWUKn4Fe7+AE4DnweIAZ1zOrzwv3cO5jMynuZRbwyJoYNYz8MaVLZYFS+3RTQ882EPB4fI9pe32iId4KeLv+QRhbotXg8E2HnKOi7UdpR5t1zlQA4Te2JV61pcEnFAah3AH5zwNUasW8+LIDHXAg4AA6AA+AAOAAOgAPgANS4/AvM9OjMVYcPNAAAAABJRU5ErkJggg==", "new_carport_icon_court": "data:image/png;base64,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", "new_carport_icon_mountainroad": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAETUlEQVR42u2ZXYhUZRjHf2d2cUcRNZySchUXthDcagTFMKVlHUyQoEiJaEVE6UMvUlQUFaFYKS3UQLrQIkVBuupCkAovhIryzotRsS79CGGCFfHb2eOF/4HXt3Nm5nzMztmZ88Bhd59595zz/N7n633GGRhYRjtLhjaXFEAKIAWQAkgBpABSALGLA+SBXv3edgDmAJuBDcDUJAPobMA9c8ABoGDoNrWTB9jGbwQG2wXAVh9jDwB9rQ7gLeDzGmGRa1UAc4FvgGyVNQWFQ9iq4iQVwIvA10CPpS/qMmU9MGBViznN9ICOnp7eqPfYB7zrYfz7wE3AnLiMB2YAvwELBWSpdvfCWCyDO4G1Hvq9glDwCZfvgGeBlw0vugWcHksA3gaGPPQHgRNV/u8ZKwwQiC+Bf3QlPgm+AvzgoT9uQbkDXK9yn7IFYfdoV4owAJ4DvgemWPrfgS+A/yI8f1BhFQTCDGAR0D1aAA4B8yzdFeAz4JKHu79Qo7zhAWEwAIRdwClgRZiQDgpgG7DSw/gh4IzH+udDniV21tk97hKsKcBqYHYjAawBtnvojwEnLd1U4EOVunrFtSAMqsJM9lm/CvgEmKC/84LQkD4gDxz1cMuDwFfAsPHiBR2FNwKzAgJwgIdAh3Q9wG3gL2vtSvUf0z3y0581Em/gMphXxp9m6c8Ae4CSDK/swJuq8WHkvmE8euZaPatotNSbfZJet96hCNyLC8AGGWfKDbW/Jb3QanV8UUqYC3TVWNNn5IZzwI/Ae8ACfZ7V+7wGnI0DwBFgnU+9N8/+UY+6ro/+mtFV5gzjr2rIcg543QCAEuFy4LwRmqGS4Dof428ou29RnMd1znesxug28K26SnPKVAL2y3iAP3y61HzUKrDCZ6cmAe8AS2Juylwr/n8CDhtnjsqg5WflpAwwTr2HvdO9QH9UAB0+u5RV6XFiMNi+zAS7V7ttjtSK0g8Dj+TuSzy60ooX9EfJAeUA3VsUCI4FvGTEvdkalxT3RRn8sWLdz9VfFYCzjTwORzG8LOMzFthN8oCCMUYrqeRW9B/JuFpV541aEDJNBODlBSd09fH0DPG8EQ4nlZ/qKbn9tcKgGQBGdHUYz3c1B9gPzNTApFJdbirvfKqZQdBe4wMlxcQAKHvkl7uK++uCYNb1LDBfJ9CuEM/r9qloTckBI8reJvgHitG7wA7+P1/sivjMLFUGr80A0GmV2AfAZWCxMnsjJJcEACPa+YxHIgw90Ykqowkg49NPTFSMN1LuJ60MNqqxSrQHVOsC6/nc9QHmRoHbmeCdd+pc78QZl6ZMoHUkG9QDHOBXnkx8ax2OkiwV+y6GCYEhy8VcWlAySc3OSagCOaNTG6tAhvXzJeDvIABc4Jc6ByRJFnPT5gX1gLntHgJxyqOk2tfZYqBjfbF/efrrpXJMsTja7XY2TCME1b/Xb4s+gBRACiAFkAJIAaQAUgApgFaWx2rnzAMhQc5TAAAAAElFTkSuQmCC"};

  /* ---------- 长截图修正：html2canvas 无视 appearance:none，会把开关画成原生方框、输入框数字贴顶 ---------- */
  window.__pvExportFix = function (clone) {
    clone.classList.add('pv-export');
    // 原站导出逻辑会把「原元素的计算色」以 !important 写回克隆；V4 的玻璃表面用了 color-mix，
    // 计算结果是 oklab()，html2canvas 不认识会直接报错 —— 这里把这类行内色值清掉，交给 .pv-export 的纯 rgba 样式
    [clone].concat([].slice.call(clone.querySelectorAll('[style]'))).forEach(function (el) {
      var st = el.style;
      for (var i = st.length - 1; i >= 0; i--) {
        var k = st[i], v = st.getPropertyValue(k);
        if (/oklab|oklch|color\(/.test(v)) st.removeProperty(k);
      }
    });
    // 收起的计算过程在长图里全部展开
    [].forEach.call(clone.querySelectorAll('.pv-fold-closed'), function (e) { e.classList.remove('pv-fold-closed'); });
    // 浅色：专精图标原图是白色剪影，屏幕上靠 CSS filter 压暗，但 html2canvas 不认 filter → 导出图里白底白图看不见。换成预先压暗的版本
    if (document.body.classList.contains('light-mode')) {
      [].forEach.call(clone.querySelectorAll('img'), function (im) {
        var src = im.getAttribute('src') || '';
        for (var k in SPEC_DARK) if (src.indexOf(k) >= 0) { im.setAttribute('src', SPEC_DARK[k]); break; }
      });
    }
    [].forEach.call(clone.querySelectorAll('input'), function (inp) {
      var orig = inp.id ? document.getElementById(inp.id) : null;
      if (inp.type === 'checkbox' || inp.type === 'radio') {
        var isSwitch = inp.classList.contains('empower-checkbox') || inp.id === 'isSpec' || !!inp.closest('.extra-toggle');
        var s = document.createElement('span');
        s.className = (isSwitch ? 'pv-x-sw' : 'pv-x-ck') + (inp.checked ? ' on' : '');
        if (!isSwitch && orig && orig.offsetWidth) { s.style.width = s.style.height = orig.offsetWidth + 'px'; }
        s.appendChild(document.createElement('i'));
        inp.parentNode.replaceChild(s, inp);
      } else if (inp.type === 'text' || inp.type === 'number') {
        var d = document.createElement('div');
        d.className = inp.className + ' pv-x-val';
        var v = inp.value;
        if (v === '' && inp.placeholder) { d.textContent = inp.placeholder; d.classList.add('pv-x-ph'); } else d.textContent = v;
        d.style.setProperty('font-family', '"Noto Sans SC", Arial, "Helvetica Neue", Helvetica, sans-serif', 'important');
        inp.parentNode.replaceChild(d, inp);
      }
    });
  };

  /* ---------- 提示条：emoji → 线性图标 ---------- */
  function iconizeToast(msg) {
    var m = String(msg), k = null;
    var lead = m.match(/^\s*(✅|❌|⚠️|⚠|🔗)\s*/);
    if (lead) {
      k = { '✅': 'ok', '❌': 'err', '⚠️': 'warn', '⚠': 'warn', '🔗': 'link' }[lead[1]];
      m = m.slice(lead[0].length);
    }
    return k ? '<span class="pv-toast pv-toast-' + k + '">' + svg(IC[k]) + '<span>' + m + '</span></span>' : m;
  }

  /* ---------- 开合动画（折叠卡片 / 计算过程 / 上榜条件 / 使用须知 共用） ----------
     做法：先量出「起点」和「终点」的真实高度，再用 Web Animations 在两者之间过渡，
     结束后清掉所有内联样式，交还给 CSS。动画中途再点一次会从当前帧的高度接着反向走，不会跳。
     系统开了「减少动态效果」或站内性能模式时直接切换，不做动画。 */
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var BOX = ['height', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'];
  function motionOK(el) {
    return !!(el && el.animate) && !(RM && RM.matches) && !document.body.classList.contains('performance-mode');
  }
  function inView(el) {
    var r = el.getBoundingClientRect(), vh = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom > -60 && r.top < vh + 60;
  }
  function boxNow(el, keys) {
    var o = {}, shown = el.getClientRects().length > 0, cs = shown ? getComputedStyle(el) : null;
    keys.forEach(function (k) { o[k] = !shown ? 0 : k === 'height' ? el.getBoundingClientRect().height : (parseFloat(cs[k]) || 0); });
    return o;
  }
  function stopMorph(el) {
    if (el.__pvA) { el.__pvA.cancel(); el.__pvA = null; }
    if (el.__pvK) { el.__pvK.forEach(function (x) { x.cancel(); }); el.__pvK = null; }
    el.style.overflow = '';
  }
  // el：做高度过渡的元素；kids：同时淡入 / 淡出的子元素（可含 el 自己）；
  // prepare()：在取消旧动画之后调用，把 DOM 切到「终点」状态并返回终点尺寸（省略的键视为 0）；
  // finish()：动画自然结束（或不做动画）时调用
  // fromZero：起点按「完全收起」算（<details> 关着时内容可能仍有布局尺寸，不能直接量）
  function morph(el, opening, keys, kids, prepare, finish, fromZero) {
    var from = fromZero ? boxNow(document.createElement('i'), keys) : boxNow(el, keys);
    var op = kids.map(function (k) { return !fromZero && k.getClientRects().length ? parseFloat(getComputedStyle(k).opacity) : 0; });
    var animate = motionOK(el) && inView(el);
    stopMorph(el);
    var to = prepare() || {};
    keys.forEach(function (k) { if (to[k] == null) to[k] = 0; });
    if (!animate || Math.abs(to.height - from.height) < 2) { if (finish) finish(); return; }
    var dist = Math.abs(to.height - from.height);
    var dur = Math.round(Math.min(420, Math.max(240, 180 + dist * 0.4)));
    var k0 = {}, k1 = {};
    keys.forEach(function (k) { k0[k] = from[k] + 'px'; k1[k] = to[k] + 'px'; });
    el.style.overflow = 'hidden';
    var a = el.animate([k0, k1], { duration: dur, easing: opening ? 'cubic-bezier(.2,.8,.2,1)' : 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    el.__pvA = a;
    el.__pvK = kids.map(function (k, i) {
      return opening
        ? k.animate([{ opacity: op[i], translate: '0 -6px' }, { opacity: 1, translate: '0 0' }],
                    { duration: Math.round(dur * .85), delay: Math.round(dur * .12), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' })
        : k.animate([{ opacity: op[i] }, { opacity: 0 }], { duration: Math.round(dur * .55), easing: 'ease-out', fill: 'forwards' });
    });
    a.onfinish = function () {
      if (el.__pvA !== a) return;          // 已被新的一次开合打断
      if (finish) finish();
      stopMorph(el);
    };
  }
  window.__pvMorph = morph;

  /* ---------- 渐进披露（低频卡片） ---------- */
  function val(id) { var e = $(id); return e ? parseFloat(e.value) || 0 : 0; }
  function chk(id) { var e = $(id); return !!(e && e.checked); }
  var CARDS = [
    { sel: '.empower-card', sum: function () {
        var t = [].map.call(document.querySelectorAll('.empower-item.active .title'), function (x) { return (x.querySelector(zh() ? '.zh' : '.lang-en') || x).textContent.replace(/\s*[(（].*$/, ''); });
        return t.length ? [t.join(' + '), true] : [L('未启用', 'Off'), false]; } },
    { sel: '.extra-card', sum: function () {
        var n = ['hasExtraNitro', 'hasExtraUlt', 'hasExtraPerSec'].filter(chk).length;
        return n ? [L('已开启 ', 'On: ') + n, true] : [L('未启用', 'Off'), false]; } },
    { sel: '#extraCustomSection', sum: function () {
        var v = val('valCustomTrig');
        return v ? ['+' + v + '% · ' + val('customTrigFirstCount') + ' / ' + val('customTrigLoopCount'), true] : [L('未启用', 'Off'), false]; } },
    { sel: '.eff-card-mobile', sum: function () {
        var v = val('extraEfficiency'); return [(v ? '+' : '') + v + '%', !!v]; } }
  ];
  function setupCollapse() {
    if (!isMobile()) return;
    CARDS.forEach(function (c) {
      var card = document.querySelector('.ds-c ' + c.sel); if (!card) return;
      var title = card.querySelector('.card-title'); if (!title) return;
      card.classList.add('pv-collapsible');
      var s = document.createElement('span'); s.className = 'pv-sum'; title.insertBefore(s, title.querySelector('.limit-badge'));
      c.el = card; c.s = s; c.touched = false;
      title.addEventListener('click', function (e) {
        if (e.target.closest('input, a')) return;
        c.touched = true; setShut(c, !isShut(c), true);
      });
    });
    refreshCollapse(true, true);
    var soft = function () { refreshCollapse(false); };
    document.addEventListener('input', soft, true);
    document.addEventListener('change', soft, true);
    new MutationObserver(soft).observe($('resultValueFirst'), { childList: true, characterData: true, subtree: true });
  }
  // 收起规则：有值自动展开；只在首次加载 / 换车时自动收起空卡片 ——
  // 用户正在卡片里操作（例如关掉最后一个赋能）时不会突然收起；用户手动开合过的卡片以后都按用户的来
  function refreshCollapse(reset, instant) {
    CARDS.forEach(function (c) {
      if (!c.el) return;
      var r = c.sum(); c.s.textContent = r[0]; c.s.classList.toggle('on', r[1]);
      if (c.touched) return;
      if (r[1]) setShut(c, false, !instant);
      else if (reset === true) setShut(c, true, !instant);
    });
  }
  // 卡片当前「应处于」的开合状态：动画进行中以目标状态为准
  function isShut(c) { return c.el.__pvA ? !!c.want : c.el.classList.contains('pv-collapsed'); }
  // .pv-shut 管箭头朝向（立即生效）；.pv-collapsed 管内容隐藏（展开时立即去掉、收起时等动画走完再加）
  function setShut(c, shut, anim) {
    var card = c.el;
    if (isShut(c) === shut && card.classList.contains('pv-shut') === shut) return;
    c.want = shut;
    card.classList.toggle('pv-shut', shut);
    var kids = [].filter.call(card.children, function (k) { return !k.classList.contains('card-title'); });
    if (!anim) { stopMorph(card); card.classList.toggle('pv-collapsed', shut); return; }
    if (shut) {
      morph(card, false, ['height'], kids, function () {
        card.classList.add('pv-collapsed'); var h = card.getBoundingClientRect().height; card.classList.remove('pv-collapsed');
        return { height: h };
      }, function () { card.classList.add('pv-collapsed'); });
    } else {
      morph(card, true, ['height'], kids, function () {
        card.classList.remove('pv-collapsed'); return { height: card.getBoundingClientRect().height };
      }, null);
    }
  }
  window.__pvRefreshCollapse = refreshCollapse;

  /* ---------- 整数输入：− / + 步进 ---------- */
  var STEP_MAIN = ['inputFirstNitroCount', 'inputNitroCount', 'customTrigFirstCount', 'customTrigLoopCount'];
  var STEP_SUB = ['jiezou_sub_first', 'jiezou_sub_loop', 'huaxin_sub_first', 'huaxin_sub_loop'];
  function bump(inp, d) {
    var v = (parseFloat(inp.value) || 0) + d;
    var min = inp.min !== '' ? parseFloat(inp.min) : 0, max = inp.max !== '' ? parseFloat(inp.max) : Infinity;
    v = Math.max(min, Math.min(max, v));
    if (String(v) === inp.value) return;
    inp.value = String(v);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function stepBtn(d, cls) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.setAttribute('aria-label', d > 0 ? '加 1' : '减 1');
    b.innerHTML = svg(IC[d > 0 ? 'plus' : 'minus']);
    b.dataset.d = d;
    return b;
  }
  function setupSteppers() {
    STEP_MAIN.forEach(function (id) {
      var inp = $(id); if (!inp) return;
      var w = inp.closest('.input-wrapper'); if (!w) return;
      w.classList.add('pv-has-step');
      var g = document.createElement('span'); g.className = 'pv-step';
      g.appendChild(stepBtn(-1, 'pv-step-btn')); g.appendChild(stepBtn(1, 'pv-step-btn'));
      w.appendChild(g);
      g.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) bump(inp, +b.dataset.d); });
    });
    STEP_SUB.forEach(function (id) {
      var inp = $(id); if (!inp) return;
      var m = stepBtn(-1, 'pv-sub-btn'), p = stepBtn(1, 'pv-sub-btn');
      inp.parentNode.insertBefore(m, inp); inp.parentNode.insertBefore(p, inp.nextSibling);
      m.addEventListener('click', function () { bump(inp, -1); });
      p.addEventListener('click', function () { bump(inp, 1); });
    });
  }

  /* ---------- 手机端页面压缩：计算过程收起 / 页脚合一 ---------- */
  function setupFold() {
    if (!isMobile()) return;
    ['formulaDisplayFirst', 'formulaDisplayLoop'].forEach(function (id) {
      var box = $(id); if (!box) return;
      box.classList.add('pv-fold-closed');
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'pv-fold-btn';
      var paint = function (o) {
        var open = typeof o === 'boolean' ? o : box.__pvA ? !box.__pvShut : !box.classList.contains('pv-fold-closed');
        b.innerHTML = '<span>' + (open ? L('收起计算过程', 'Hide breakdown') : L('查看计算过程', 'Show breakdown')) + '</span>' + svg(IC.chevron);
        b.classList.toggle('open', open);
      };
      b.addEventListener('click', function () {
        var opening = box.__pvA ? !!box.__pvShut : box.classList.contains('pv-fold-closed');
        box.__pvShut = !opening;
        if (opening) {
          morph(box, true, BOX, [box], function () { box.classList.remove('pv-fold-closed'); return boxNow(box, BOX); }, null);
        } else {
          morph(box, false, BOX, [box], function () { return {}; }, function () { box.classList.add('pv-fold-closed'); });
        }
        b.classList.toggle('open', opening);
        paint(opening);
      });
      box.parentNode.insertBefore(b, box);
      paint();
      document.addEventListener('pv-lang', function () { paint(); });
    });
    // 页脚：鸣谢里的「上榜条件」长段落收进一个可展开项
    var tc = document.querySelector('.thanks-card .card-text');
    if (tc) {
      var det = document.createElement('details'); det.className = 'pv-mini-details';
      var sm = document.createElement('summary');
      sm.innerHTML = '<span class="zh">上榜条件</span><span class="lang-en">How to get listed</span>' + svg(IC.chevron);
      tc.parentNode.insertBefore(det, tc); det.appendChild(sm); det.appendChild(tc);
      animDetails(det, tc);
    }
  }
  // <details> 的开合动画：打开时先让浏览器展开再从 0 长到实际高度；关闭时先收到 0 再真正关上
  function animDetails(det, body) {
    det.addEventListener('click', function (e) {
      var sm = e.target.closest('summary');
      if (!sm || sm.parentNode !== det || e.target.closest('button')) return;
      e.preventDefault(); e.stopPropagation();
      var opening = body.__pvA ? det.classList.contains('pv-closing') : !det.open;
      if (opening) {
        det.classList.remove('pv-closing');
        var wasShut = !det.open;
        morph(body, true, BOX, [body], function () { det.open = true; return boxNow(body, BOX); }, null, wasShut);
      } else {
        det.classList.add('pv-closing');
        morph(body, false, BOX, [body], function () { return {}; }, function () { det.open = false; det.classList.remove('pv-closing'); });
      }
    }, true);
  }

  /* ---------- 手机选车：底部整屏面板 ---------- */
  var QUAL = [['', '全部', 'All'], ['传说', '传说', 'Legend'], ['史诗', '史诗', 'Epic'], ['稀有', '稀有', 'Rare'], ['普通', '普通', 'Common']];
  var qualFilter = '';
  var sheet, mask, proxy, listHost, toolsHost, qualRow, home = {};
  function carById(id) { for (var i = 0; i < CAR_DATABASE.length; i++) if (CAR_DATABASE[i].id === id) return CAR_DATABASE[i]; return null; }
  function decorateList() {
    [].forEach.call(document.querySelectorAll('#carDropdown .dropdown-option'), function (o) {
      var id = parseInt(o.getAttribute('data-id'), 10);
      if (o.querySelector('.pv-thumb')) return;
      var t = document.createElement('span'); t.className = 'pv-thumb';
      var src = id > 0 ? (typeof _CAR_IMG !== 'undefined' && _CAR_IMG[id]) : ((typeof _ICONS !== 'undefined' && _ICONS['icon_mhyck_m.png']) || 'data/icon/icon_mhyck_m.png');
      if (src) {
        var im = document.createElement('img'); im.loading = 'lazy'; im.decoding = 'async'; im.alt = '';
        im.src = src;
        im.onerror = function () { this.remove(); };
        t.appendChild(im);
      }
      o.insertBefore(t, o.firstChild);
    });
  }
  function applyQual() {
    if (!qualFilter) return;
    [].forEach.call(document.querySelectorAll('#carDropdown .dropdown-option'), function (o) {
      var id = parseInt(o.getAttribute('data-id'), 10);
      if (id > 0) { var c = carById(id); if (c && c.quality !== qualFilter) o.style.display = 'none'; }
    });
  }
  function paintQual() {
    if (!qualRow) return;
    var counts = {};
    CAR_DATABASE.forEach(function (c) { counts[c.quality] = (counts[c.quality] || 0) + 1; });
    qualRow.innerHTML = QUAL.map(function (q) {
      var n = q[0] ? (counts[q[0]] || 0) : CAR_DATABASE.length;
      return '<button type="button" class="pv-qchip' + (q[0] === qualFilter ? ' on' : '') + '" data-q="' + q[0] + '">' + L(q[1], q[2]) + '<span>' + n + '</span></button>';
    }).join('');
  }
  function openSheet() {
    if (!sheet || document.body.classList.contains('pv-sheet-open')) return;
    var dd = $('carDropdown'), filters = document.querySelector('.car-filters');
    home.dd = dd.parentNode; home.ddNext = dd.nextSibling;
    home.f = filters.parentNode; home.fNext = filters.nextSibling;
    toolsHost.appendChild(filters);
    listHost.appendChild(dd);
    dd.classList.add('show');
    proxy.value = $('carSearch').value;
    paintQual();
    filterCarList();
    document.body.classList.add('pv-sheet-open');
    var sel = dd.querySelector('.dropdown-option.selected');
    requestAnimationFrame(function () { if (sel) sel.scrollIntoView({ block: 'center' }); });
  }
  function closeSheet() {
    if (!document.body.classList.contains('pv-sheet-open')) return;
    document.body.classList.remove('pv-sheet-open');
    var dd = $('carDropdown'), filters = document.querySelector('.car-filters');
    ['filterPosMenu', 'filterSpecMenu'].forEach(function (m) { $(m).classList.remove('show'); });
    dd.classList.remove('show');
    home.dd.insertBefore(dd, home.ddNext);
    home.f.insertBefore(filters, home.fNext);
    qualFilter = '';
    filterCarList();
    if (document.activeElement === proxy) proxy.blur();
  }
  function setupSheet() {
    mask = document.createElement('div'); mask.className = 'pv-sheet-mask';
    sheet = document.createElement('div');
    sheet.className = 'pv-sheet dropdown-container';   // 带上 dropdown-container：原站的「点外面关下拉」逻辑不会把面板里的点击当成点外面
    sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true');
    sheet.innerHTML =
      '<div class="pv-sheet-grab"></div>' +
      '<div class="pv-sheet-head"><b><span class="zh">选择赛车</span><span class="lang-en">Select Car</span></b>' +
      '<button type="button" class="pv-sheet-done"><span class="zh">完成</span><span class="lang-en">Done</span></button></div>' +
      '<div class="pv-sheet-search">' + svg(IC.search) + '<input type="search" autocomplete="off" enterkeyhint="search"></div>' +
      '<div class="pv-sheet-tools"></div>' +
      '<div class="pv-sheet-qual"></div>' +
      '<div class="pv-sheet-list"></div>';
    document.body.appendChild(mask); document.body.appendChild(sheet);
    proxy = sheet.querySelector('.pv-sheet-search input');
    toolsHost = sheet.querySelector('.pv-sheet-tools');
    qualRow = sheet.querySelector('.pv-sheet-qual');
    listHost = sheet.querySelector('.pv-sheet-list');
    proxy.placeholder = L('搜索车名 / 拼音首字母', 'Search name / pinyin');
    proxy.addEventListener('input', function () { $('carSearch').value = proxy.value; filterCarList(); });
    mask.addEventListener('click', closeSheet);
    sheet.querySelector('.pv-sheet-done').addEventListener('click', closeSheet);
    qualRow.addEventListener('click', function (e) {
      var b = e.target.closest('.pv-qchip'); if (!b) return;
      qualFilter = b.dataset.q; paintQual(); filterCarList(); listHost.scrollTop = 0;
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });

    // 接管：手机上点「选择车辆」或聚焦卡片里的搜索框 → 打开面板
    var origToggle = window.toggleCarDropdown;
    window.toggleCarDropdown = function () {
      if (isMobile()) { openSheet(); return; }
      return origToggle.apply(this, arguments);
    };
    $('carSearch').addEventListener('focus', function () {
      if (!isMobile()) return;
      this.blur(); openSheet(); setTimeout(function () { proxy.focus(); }, 30);
    });
    // 选中一辆车后自动收起
    var origPick = window.pickCar;
    window.pickCar = function () { var r = origPick.apply(this, arguments); closeSheet(); refreshCollapse(true); return r; };
    // 列表重建时补车图、套品质筛选
    var origPop = window.populateCarGrid;
    window.populateCarGrid = function () { var r = origPop.apply(this, arguments); decorateList(); return r; };
    var origFilter = window.filterCarList;
    window.filterCarList = function () { var r = origFilter.apply(this, arguments); applyQual(); return r; };
    decorateList();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var st0 = window.showToast;
    if (typeof st0 === 'function') window.showToast = function (m) { return st0(iconizeToast(m)); };
    var tl = window.toggleLanguage;
    if (typeof tl === 'function') window.toggleLanguage = function () { var r = tl.apply(this, arguments); document.dispatchEvent(new Event('pv-lang')); if (proxy) proxy.placeholder = L('搜索车名 / 拼音首字母', 'Search name / pinyin'); paintQual(); return r; };
    setTimeout(function () {
      setupCollapse();
      setupSteppers();
      setupFold();
      setupSheet();
      var tut = document.querySelector('.tutorial-details'), tb = tut && tut.querySelector(':scope > div:last-child');
      if (tut && tb && tut.animate) { tut.classList.add('pv-js'); animDetails(tut, tb); }
    }, 0);
  });
})();
