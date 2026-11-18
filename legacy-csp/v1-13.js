
/* 归档条固定定位后的占位同步：保证内容不被遮住，尺寸变化（语言切换/横竖屏）时自动重算 */
(function () {
    var bar = document.getElementById('archiveBar');
    var sp = document.getElementById('archiveSpacer');
    if (!bar || !sp) return;
    function sync() { sp.style.height = bar.offsetHeight + 'px'; }
    sync();
    window.addEventListener('load', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', function () { setTimeout(sync, 150); });
    if (window.ResizeObserver) { try { new ResizeObserver(sync).observe(bar); } catch (e) {} }
})();
