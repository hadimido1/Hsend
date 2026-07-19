const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const audioMatch = "          ) : msg.type === 'audio' ? (";
const callBlock = `          ) : msg.type === 'call' || msg.type === 'call_missed' ? (
            <div className="flex items-center gap-3 pr-4">
              <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center shrink-0">
                <Phone size={20} className={msg.type === 'call_missed' ? 'text-red-500' : 'text-[#00a884]'} />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold">{msg.type === 'call_missed' ? (lang === 'ar' ? 'مكالمة فائتة' : 'Missed call') : (lang === 'ar' ? 'مكالمة صوتية' : 'Voice call')}</span>
                <span className="text-xs text-text-muted mt-0.5 flex items-center gap-1">
                   {msg.type === 'call_missed' ? (
                     <>
                        <PhoneMissed size={12} className="text-red-500" />
                        {lang === 'ar' ? 'لم يتم الرد' : 'No answer'}
                     </>
                   ) : (
                     <>
                        <Phone size={12} className="text-text-muted" />
                        {lang === 'ar' ? 'تم الرد' : 'Answered'}
                     </>
                   )}
                </span>
              </div>
            </div>
`;
code = code.replace(audioMatch, callBlock + audioMatch);

if (!code.includes('PhoneMissed')) {
  code = code.replace(/import \{ (.*?) \} from 'lucide-react';/, "import { $1, PhoneMissed } from 'lucide-react';");
}

fs.writeFileSync('src/components/ChatArea.tsx', code);
