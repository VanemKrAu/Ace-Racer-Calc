

       (function() {
           var details = document.querySelector('.tutorial-details');
           if(!details) return;
           var summary = details.querySelector('summary');
           var detailsTimeout;
           summary.addEventListener('click', function(e) {
               if(e.target.closest('button')) return; 
               if (details.open && !details.classList.contains('closing')) {
                   e.preventDefault(); 
                   details.classList.add('closing');
                   clearTimeout(detailsTimeout);
                   detailsTimeout = setTimeout(function() {
                       details.open = false;
                       details.classList.remove('closing');
                   }, 350);
               } 
               else if (details.open && details.classList.contains('closing')) {
                   e.preventDefault();
                   details.classList.remove('closing');
                   clearTimeout(detailsTimeout);
               }
               else {
                   details.classList.remove('closing');
                   clearTimeout(detailsTimeout);
               }
           });
       })();
   
