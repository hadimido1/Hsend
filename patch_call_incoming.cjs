const fs = require('fs');
let code = fs.readFileSync('src/components/CallOverlay.tsx', 'utf8');

const incomingMatch = code.match(/\{callStatus === 'incoming' && incomingCallData && \(\(\) => \{[\s\S]*?\}\)\(\)\}/);
if (incomingMatch) {
  const newIncoming = `{callStatus === 'incoming' && incomingCallData && (() => {
        const callerUser = incomingCallData.callerInfo || (incomingCallData.from ? users[incomingCallData.from] : null);
        const callerName = callerUser?.name || callerUser?.username || 'Unknown Caller';
        const callerAvatar = callerUser?.avatar_url;
        const callerInitial = (callerUser?.name || callerUser?.username || '?').charAt(0).toUpperCase();

        return (
          <div className="w-full flex-1 flex flex-col items-center justify-between relative z-10 pt-16 pb-12 bg-[#0b141a]">
            {/* WhatsApp-style doodle background */}
            <div className="absolute inset-0 opacity-10 bg-[url('https://i.ibb.co/6H9nB39/whatsapp-bg.png')] bg-repeat mix-blend-overlay pointer-events-none" />
            
            <div className="flex flex-col items-center mt-4 z-10">
               <h2 className="text-4xl text-white font-bold text-center px-6 tracking-wide drop-shadow-md" dir="auto">
                 {callerName}
               </h2>
               <p className="text-gray-400 text-sm mt-2 flex items-center justify-center gap-1.5 font-medium">
                  <span className="w-3 h-3 rounded-full bg-[#00a884] animate-pulse shadow-[0_0_8px_#00a884]" />
                  HiSEND {incomingCallData.callerInfo?.call_type === 'video' ? 'Video' : 'Audio'} Call
               </p>
            </div>
            
            <div className="flex-1 flex items-center justify-center w-full my-8 z-10">
               <div className="w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-[#128c7e]/20 flex items-center justify-center text-7xl text-white font-bold uppercase shadow-2xl overflow-hidden relative">
                 {callerAvatar ? (
                    <img src={callerAvatar} alt={callerName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                 ) : (
                    <span className="text-white drop-shadow-md">{callerInitial}</span>
                 )}
               </div>
            </div>
            
            <div className="w-full px-8 flex justify-between items-end pb-8 max-w-sm z-10">
              <div className="flex flex-col items-center gap-2.5">
                <button 
                  onClick={rejectCall}
                  className="w-16 h-16 bg-[#eb5545] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#d44032] transition-colors active:scale-95"
                >
                  <PhoneDown size={30} fill="currentColor" />
                </button>
                <span className="text-gray-300 text-[13px] font-medium mt-1 tracking-wide">{lang === 'ar' ? 'رفض' : 'Decline'}</span>
              </div>

              <div className="flex flex-col items-center gap-1 relative -top-6">
                <motion.div 
                  animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }} 
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  className="flex flex-col items-center mb-1 text-gray-300"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="-mt-4"><polyline points="18 15 12 9 6 15"></polyline></svg>
                </motion.div>
                <motion.div 
                  drag="y"
                  dragConstraints={{ top: -120, bottom: 0 }}
                  dragElastic={0.2}
                  onDragEnd={(e, info) => {
                     if (info.offset.y < -50) answerCall();
                  }}
                  className="w-18 h-18 bg-[#4cd964] text-white rounded-full flex items-center justify-center shadow-lg cursor-grab active:cursor-grabbing relative p-4"
                  title={lang === 'ar' ? 'اسحب للأعلى للرد' : 'Swipe up to accept'}
                >
                  {incomingCallData.callerInfo?.call_type === 'video' ? <Video size={32} fill="currentColor" /> : <Phone size={32} fill="currentColor" />}
                </motion.div>
                <span className="text-gray-300 text-[13px] font-medium mt-3 tracking-wide">{lang === 'ar' ? 'اسحب للقبول' : 'Swipe up to accept'}</span>
              </div>
              
              <div className="flex flex-col items-center gap-2.5">
                <button 
                  onClick={rejectCall}
                  className="w-16 h-16 bg-[#ffffff20] backdrop-blur-md text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#ffffff30] transition-colors active:scale-95"
                >
                  <MessageSquare size={26} fill="currentColor" />
                </button>
                <span className="text-gray-300 text-[13px] font-medium mt-1 tracking-wide">{lang === 'ar' ? 'رسالة' : 'Message'}</span>
              </div>
            </div>
          </div>
        );
      })()}`;
  
  code = code.replace(incomingMatch[0], newIncoming);
  
  // Need to import PhoneDown, MessageSquare
  if (!code.includes('PhoneDown')) {
    code = code.replace(/import \{ (.*?) \} from 'lucide-react';/, "import { $1, PhoneDown, MessageSquare } from 'lucide-react';");
  }
  
  fs.writeFileSync('src/components/CallOverlay.tsx', code);
} else {
  console.log("Could not match incoming call section.");
}
