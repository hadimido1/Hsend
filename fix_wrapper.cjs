const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const target1 = `      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 py-4 overflow-y-auto flex flex-col gap-1 sm:gap-2 scrollbar-none relative" 
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >`;

const replace1 = `      {/* Messages */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 py-4 overflow-y-auto flex flex-col gap-1 sm:gap-2 scrollbar-none relative" 
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >`;

code = code.replace(target1, replace1);

fs.writeFileSync('src/components/ChatArea.tsx', code);
