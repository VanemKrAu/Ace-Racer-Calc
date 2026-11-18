

   function generateHash(str) {
       var hash = 0;
       for (var i = 0; i < str.length; i++) {
           var char = str.charCodeAt(i);
           hash = ((hash << 5) - hash) + char;
           hash = hash & hash;
       }
       return hash.toString();
   }

   var notesElement = document.getElementById('notesContent');
   var currentNotesHash = generateHash(notesElement.innerHTML.trim());

   var savedHash = localStorage.getItem('notesHash');
   var isHidden = localStorage.getItem('hideTutorial') === 'true';
   var tutorialWrapper = document.getElementById('tutorialWrapper');
   var updateBadge = document.getElementById('updateBadge');
   
   var detailsElement = document.querySelector('.tutorial-details');
   var seenUpdateHash = localStorage.getItem('seenUpdateHash');

   if (savedHash !== currentNotesHash) {
       tutorialWrapper.style.display = 'block';
       if (savedHash && seenUpdateHash !== currentNotesHash) {
           updateBadge.style.display = 'inline-block';
       }
   } else {
       if (isHidden) {
           tutorialWrapper.style.display = 'none';
       }
   }

   if (detailsElement) {
       detailsElement.addEventListener('toggle', function() {
           if (this.open) {
               if (updateBadge.style.display !== 'none') {
                   updateBadge.style.display = 'none';
                   localStorage.setItem('seenUpdateHash', currentNotesHash);
               }
           }
       });
   }

   function closeTutorial() {
       localStorage.setItem('hideTutorial', 'true');
       localStorage.setItem('notesHash', currentNotesHash);
       localStorage.setItem('seenUpdateHash', currentNotesHash);
       if (window.__pvMorph && typeof _motionOK === 'function' && _motionOK()) {
           window.__pvMorph(tutorialWrapper, false, ['height', 'marginBottom'], [tutorialWrapper], function() { return {}; }, function() {
               tutorialWrapper.style.display = 'none';
           });
       } else {
           tutorialWrapper.style.display = 'none';
       }
   }

   function resetTutorial() {
       localStorage.removeItem('hideTutorial');
       localStorage.removeItem('notesHash');
       localStorage.removeItem('seenUpdateHash');
       var am = document.getElementById('authorMenu');
       if (typeof _closeDropdown === 'function') _closeDropdown(am);
       else if (am) am.classList.remove('show');
       var wasHidden = tutorialWrapper.style.display === 'none' || tutorialWrapper.getClientRects().length === 0;
       if (wasHidden && window.__pvMorph && typeof _motionOK === 'function' && _motionOK()) {
           window.__pvMorph(tutorialWrapper, true, ['height', 'marginBottom'], [tutorialWrapper], function() {
               tutorialWrapper.style.display = 'block';
               var cs = getComputedStyle(tutorialWrapper);
               return { height: tutorialWrapper.getBoundingClientRect().height, marginBottom: parseFloat(cs.marginBottom) || 0 };
           }, null, true);
       } else {
           tutorialWrapper.style.display = 'block';
       }
       if(typeof showToast === 'function') {
           showToast(_("✅ 教程按钮已恢复显示！", "✅ Tutorial button restored!"));
       }
   }

   var tutBtn = document.getElementById('tutorialBtnInner');
   if(tutBtn) {
       tutBtn.onmouseover = function() {
           this.style.transform = 'translateY(-2px)';
           this.style.boxShadow = '0 4px 15px var(--hover-glow-warning)';
       };
       tutBtn.onmouseout = function() {
           this.style.transform = 'translateY(0)';
           this.style.boxShadow = 'var(--btn-shadow)';
       };
    }
            
