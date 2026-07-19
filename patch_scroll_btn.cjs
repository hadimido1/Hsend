const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const oldCode = `      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 sm:space-y-4 flex flex-col pt-6 z-0 pb-12"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="self-center bg-bg-tertiary text-text-muted text-[11px] px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 max-w-[85%] text-center leading-relaxed border border-border-primary my-2">`;

const newCode = `      <div className="flex-1 flex flex-col relative overflow-hidden">
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-2 sm:space-y-4 flex flex-col pt-6 z-0 pb-12"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <div className="self-center bg-bg-tertiary text-text-muted text-[11px] px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-2 max-w-[85%] text-center leading-relaxed border border-border-primary my-2">`;

code = code.replace(oldCode, newCode);

const scrollBtnOld = `        <div ref={chatEndRef} />

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={scrollToBottom}
              className="fixed bottom-24 right-4 sm:absolute sm:bottom-4 sm:right-6 z-40 bg-[var(--bg-tertiary)] text-[#00a884] p-2 rounded-full shadow-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title={lang === 'ar' ? 'الذهاب للأسفل' : 'Scroll to bottom'}
            >
              <ChevronDown size={24} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>`;

const scrollBtnNew = `        <div ref={chatEndRef} />
      </div>

        {/* Scroll to Bottom Button */}
        <AnimatePresence>
          {showScrollBottom && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 sm:right-6 z-40 bg-[var(--bg-tertiary)] text-[#00a884] p-2 rounded-full shadow-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] transition-colors"
              title={lang === 'ar' ? 'الذهاب للأسفل' : 'Scroll to bottom'}
            >
              <ChevronDown size={24} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>`;

code = code.replace(scrollBtnOld, scrollBtnNew);
fs.writeFileSync('src/components/ChatArea.tsx', code);
