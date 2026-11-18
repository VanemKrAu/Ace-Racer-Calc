
       let userLangs = navigator.languages || [navigator.language || navigator.userLanguage || 'zh'];
       let currentLang = 'zh';
       
       for (let i = 0; i < userLangs.length; i++) {
           let lang = userLangs[i].toLowerCase();
           if (lang.startsWith('en')) {
               currentLang = 'en';
               break;
           }
           if (lang.startsWith('zh')) {
               currentLang = 'zh';
               break;
           }
       }
        
         const _ = (zh, en) => currentLang === 'en' ? en : zh;
        
        if (currentLang === 'en') {
           document.documentElement.lang = 'en';
           document.title = 'Ace Racer Chip Calculator';
           let metaAppTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
           if (metaAppTitle) metaAppTitle.content = 'Ace Calc';
       }
   