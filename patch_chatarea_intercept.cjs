const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

// The block we just added:
const oldBlock = `          ) : msg.type === 'call' || msg.type === 'call_missed' ? (`;

const newBlock = `          ) : msg.type === 'call' || msg.type === 'call_missed' || msg.content === 'Voice call' || msg.content === 'مكالمة فائتة' || msg.content === 'مكالمة صوتية' || msg.content === 'Missed call' || msg.content === 'No answer' ? (
            <div className="flex items-center gap-3 pr-4">
              <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center shrink-0">
                {isMe ? (
                   <Phone size={20} className="text-gray-400" />
                ) : (
                   <PhoneMissed size={20} className="text-red-500" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-white/90">
                  {isMe ? (lang === 'ar' ? 'مكالمة صوتية' : 'Voice call') : (lang === 'ar' ? 'مكالمة فائتة' : 'Missed call')}
                </span>
                <span className="text-[13px] text-white/60 mt-0.5 flex items-center gap-1 font-medium">
                   {isMe ? (
                     <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path><polyline points="14 2 22 2 22 10"></polyline><line x1="22" y1="2" x2="16" y2="8"></line></svg>
                        {lang === 'ar' ? 'لم يتم الرد' : 'No answer'}
                     </>
                   ) : (
                     <>
                        <PhoneMissed size={12} className="text-red-500" />
                        {lang === 'ar' ? 'لم يتم الرد' : 'No answer'}
                     </>
                   )}
                </span>
              </div>
            </div>
`;
code = code.replace(oldBlock, newBlock);

fs.writeFileSync('src/components/ChatArea.tsx', code);
