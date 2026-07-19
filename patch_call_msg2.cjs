const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const callMsgOld2 = `              <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center shrink-0">
                {isMe ? (
                   <Phone size={20} className="text-gray-400" />
                ) : (
                   <PhoneMissed size={20} className={isMissed ? 'text-red-500' : 'text-[#00a884]'} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-white/90">
                  {isMe ? (lang === 'ar' ? 'مكالمة صوتية' : 'Voice call') : (isMissed ? (lang === 'ar' ? 'مكالمة فائتة' : 'Missed call') : (lang === 'ar' ? 'مكالمة صوتية' : 'Voice call'))}
                </span>`;

const callMsgNew2 = `              <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center shrink-0">
                {isVideo ? (
                   <Video size={20} className={isMissed && !isMe ? 'text-red-500' : 'text-gray-400'} />
                ) : isMe ? (
                   <Phone size={20} className="text-gray-400" />
                ) : (
                   <PhoneMissed size={20} className={isMissed ? 'text-red-500' : 'text-[#00a884]'} />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-white/90">
                  {isMe ? (isVideo ? (lang === 'ar' ? 'مكالمة فيديو' : 'Video call') : (lang === 'ar' ? 'مكالمة صوتية' : 'Voice call')) : (isMissed ? (lang === 'ar' ? 'مكالمة فائتة' : 'Missed call') : (isVideo ? (lang === 'ar' ? 'مكالمة فيديو' : 'Video call') : (lang === 'ar' ? 'مكالمة صوتية' : 'Voice call')))}
                </span>`;

code = code.replace(callMsgOld2, callMsgNew2);
fs.writeFileSync('src/components/ChatArea.tsx', code);
