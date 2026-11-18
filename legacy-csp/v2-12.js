

(function() {
    var frameCount = 0;
    var lastTime = 0; 
    var lowFpsCount = 0;
    
    var FPS_THRESHOLD = 25; 
    var TOLERANCE = 3;
    var isActive = true;

    function checkFPS() { 
        if (!isActive) return;

        var now = performance.now(); 
        if (lastTime === 0) lastTime = now; 

        frameCount++;
        var elapsed = now - lastTime;

        if (elapsed >= 1000) {
            var fps = Math.round((frameCount * 1000) / elapsed);
            
            if (fps > 0 && fps < FPS_THRESHOLD && !document.hidden) {
                lowFpsCount++;
                if (lowFpsCount >= TOLERANCE) {
                    document.body.classList.add('performance-mode');
                    if (typeof showToast === 'function') {
                        showToast(_("⚠️ 检测到设备持续卡顿，已自动切换至【无动画性能模式】", "⚠️ Device lag detected, auto-switched to [Performance Mode]"));
                    }
                    isActive = false; 
                    return; 
                }
            } else {
                lowFpsCount = 0; 
            }

            frameCount = 0;
            lastTime = now;
        }
        
        if (isActive) {
            requestAnimationFrame(checkFPS);
        }
    }

    setTimeout(function() {
        requestAnimationFrame(checkFPS);
    }, 3000);

    document.addEventListener('visibilitychange', function() {
        lowFpsCount = 0;
        frameCount = 0;
        lastTime = 0; 
    });
})();

