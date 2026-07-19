const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

const callMsgOld = `          ) : msg.type === 'call_log' || msg.type === 'call' || msg.type === 'call_missed' || msg.content === 'Voice call' || msg.content === 'مكالمة فائتة' || msg.content === 'مكالمة صوتية' || msg.content === 'Missed call' || msg.content === 'No answer' ? (() => {
             const isMissed = msg.type === 'call_missed' || msg.content?.includes('missed') || msg.content?.includes('فائتة') || msg.content?.includes('No answer');
             return (
            <div className="flex items-center gap-3 pr-4">`;

const callMsgNew = `          ) : msg.type === 'call_log' || msg.type === 'call' || msg.type === 'call_missed' || msg.content === 'Voice call' || msg.content === 'مكالمة فائتة' || msg.content === 'مكالمة صوتية' || msg.content === 'Missed call' || msg.content === 'No answer' ? (() => {
             const isMissed = msg.type === 'call_missed' || msg.content?.includes('missed') || msg.content?.includes('فائتة') || msg.content?.includes('No answer');
             const isVideo = msg.content?.includes('video') || msg.content?.includes('Video');
             return (
            <div 
              className="flex items-center gap-3 pr-4 cursor-pointer hover:opacity-80 active:scale-95 transition-all"
              onClick={(e) => {
                 e.stopPropagation();
                 const useStore = require('../lib/store').useStore;
                 useStore.getState().setCallStatus('calling', partner, isVideo ? 'video' : 'audio');
              }}
            >`;

code = code.replace(callMsgOld, callMsgNew);
fs.writeFileSync('src/components/ChatArea.tsx', code);
