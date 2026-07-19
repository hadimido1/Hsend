const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// Replace the root wrapper of MessageItem
const oldWrapper = `    <div 
      id={\`msg-\${msg.id}\`}
      className={\`w-full flex relative transition-colors duration-200 \${isSelected ? 'bg-[#005c4b]/30' : ''} \${justifyClass} py-0.5 px-3 sm:px-6 group\`}
      onClick={() => {
         if (selectedMessages.length > 0) {
            playSound('click');
            setSelectedMessages((prev: string[]) => prev.includes(msg.id) ? prev.filter((id: string) => id !== msg.id) : [...prev, msg.id]);
         }
      }}
    >`;

const newWrapper = `    <motion.div 
      layout
      id={\`msg-\${msg.id}\`}
      className={\`w-full flex relative transition-colors duration-300 \${isSelected ? 'bg-[#005c4b]/40' : ''} \${justifyClass} py-0.5 px-3 sm:px-6 group\`}
      onClick={() => {
         if (selectedMessages.length > 0) {
            playSound('click');
            setSelectedMessages((prev: string[]) => prev.includes(msg.id) ? prev.filter((id: string) => id !== msg.id) : [...prev, msg.id]);
         }
      }}
    >
      <AnimatePresence>
        {isSelected && (
           <motion.div
             initial={{ scale: 0, opacity: 0 }}
             animate={{ scale: 1, opacity: 1 }}
             exit={{ scale: 0, opacity: 0 }}
             transition={{ type: 'spring', stiffness: 400, damping: 25 }}
             className={\`absolute top-1/2 -translate-y-1/2 \${lang === 'ar' ? 'right-2 sm:right-6' : 'left-2 sm:left-6'} w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center text-white shadow-md z-20 pointer-events-none\`}
           >
             <Check size={16} strokeWidth={3} />
           </motion.div>
        )}
      </AnimatePresence>`;

code = code.replace(oldWrapper, newWrapper);

// Change `scale-[1.02]` to just a smooth scale effect or none
code = code.replace(/\${isSelected \? 'scale-\[1\.02\]' : ''}/g, `\${isSelected ? 'scale-[0.98]' : ''}`);

fs.writeFileSync('src/components/ChatArea.tsx', code);
