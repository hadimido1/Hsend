import React, { useMemo } from 'react';
import { useStore } from '../lib/store';
import { PhoneIncoming, Trash2 } from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Phone, PhoneOutgoing, PhoneMissed, Video, Phone as PhoneIcon } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { format } from 'date-fns';

export default function RecentCalls({ selectedCalls = [], setSelectedCalls = () => {} }: { selectedCalls?: string[], setSelectedCalls?: (calls: string[]) => void }) {
  const { messages, currentUser, users, contacts } = useStore();
  const { lang, t } = useTranslation();

  const callLogs = useMemo(() => {
    const logs: any[] = [];
    Object.values(messages).forEach(userMsgs => {
      userMsgs.forEach(msg => {
        if (msg.type === 'call_log' && msg.content) {
          if (msg.content.startsWith('call_log:')) {
             const parts = msg.content.split(':');
             const isCaller = msg.sender_id === currentUser?.id;
             const partnerId = isCaller ? msg.receiver_id : msg.sender_id;
             logs.push({
               id: msg.id,
               partnerId,
               direction: isCaller ? 'outgoing' : 'incoming',
               status: parts[1], // missed, answered, rejected
               duration: parseInt(parts[2] || '0'),
               callType: parts[3] || 'audio',
               timestamp: msg.timestamp
             });
          }
        }
      });
    });
    return logs.sort((a, b) => b.timestamp - a.timestamp);
  }, [messages, currentUser?.id]);

  return (
    <div className="flex-1 bg-bg-primary flex flex-col h-full relative overflow-hidden">
      <div className="flex-1 overflow-y-auto overscroll-none flex flex-col pb-20 scrollbar-none">
      
      
      
      {callLogs.length === 0 ? (
         <div className="flex-1 flex flex-col items-center justify-center p-8 text-text-muted">
             <PhoneIcon size={48} className="opacity-20 mb-4" />
             <p className="text-center">{lang === 'ar' ? 'لا توجد مكالمات حديثة' : 'No recent calls'}</p>
         </div>
      ) : (
         <div className="flex flex-col pb-20">
            {callLogs.map(log => {
               const partner = users[log.partnerId];
               if (!partner) return null;
               
               const isMissed = log.status === 'missed';
               
               return (
                 <div 
                    key={log.id} 
                    className={`flex items-center px-5 py-3 hover:bg-bg-hover gap-4 transition-colors cursor-pointer ${selectedCalls.includes(log.id) ? 'bg-bg-tertiary' : ''}`}
                    onClick={(e) => {
                       if (e.currentTarget.dataset.longPressed === 'true') {
                          e.currentTarget.dataset.longPressed = 'false';
                          return;
                       }
                       if (selectedCalls.length > 0) {
                          if (selectedCalls.includes(log.id)) {
                             setSelectedCalls(selectedCalls.filter(id => id !== log.id));
                          } else {
                             setSelectedCalls([...selectedCalls, log.id]);
                          }
                       }
                    }}
                    onContextMenu={(e) => {
                       e.preventDefault();
                       if (!selectedCalls.includes(log.id)) {
                          setSelectedCalls([...selectedCalls, log.id]);
                       }
                    }}
                    onTouchStart={(e) => {
                       const target = e.currentTarget;
                       target.dataset.touchTimer = setTimeout(() => {
                          target.dataset.longPressed = 'true';
                          if (!selectedCalls.includes(log.id)) {
                             setSelectedCalls([...selectedCalls, log.id]);
                          }
                       }, 500).toString();
                    }}
                    onTouchEnd={(e) => {
                       clearTimeout(parseInt(e.currentTarget.dataset.touchTimer || '0'));
                    }}
                    onTouchMove={(e) => {
                       clearTimeout(parseInt(e.currentTarget.dataset.touchTimer || '0'));
                    }}
                    onMouseDown={(e) => {
                       const target = e.currentTarget;
                       target.dataset.mouseTimer = setTimeout(() => {
                          target.dataset.longPressed = 'true';
                          if (!selectedCalls.includes(log.id)) {
                             setSelectedCalls([...selectedCalls, log.id]);
                          }
                       }, 500).toString();
                    }}
                    onMouseUp={(e) => {
                       clearTimeout(parseInt(e.currentTarget.dataset.mouseTimer || '0'));
                    }}
                    onMouseLeave={(e) => {
                       clearTimeout(parseInt(e.currentTarget.dataset.mouseTimer || '0'));
                    }}
                 >
                    <div className="relative w-12 h-12 shrink-0">
                      <div className="w-full h-full rounded-full flex items-center justify-center text-white text-lg font-bold uppercase shadow-sm overflow-hidden bg-accent-primary">
                        {partner.avatar_url ? (
                          <img src={partner.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          partner.name?.charAt(0) || partner.username.charAt(0)
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1 py-1 flex flex-col truncate border-b border-border-primary pb-3">
                       <div className="flex justify-between items-center mb-1">
                          <span className={`font-semibold text-base truncate ${isMissed ? 'text-red-500' : 'text-text-primary'}`}>
                             {contacts[partner.id]?.nickname || partner.name || partner.username}
                          </span>
                          
                          <div className="flex items-center gap-1">
                            
                            <button 
                               onClick={() => useStore.getState().setCallStatus('calling', partner, log.callType)}
                               className="text-[#00a884] hover:bg-[#00a884]/10 p-2 rounded-full transition-colors shrink-0"
                            >
                               {log.callType === 'video' ? <Video size={20} /> : <PhoneIcon size={20} />}
                            </button>
                          </div>
                       </div>
                       <div className="flex items-center gap-1.5 text-text-muted text-sm shrink-0">
                          {log.direction === 'outgoing' ? (
                             <PhoneOutgoing size={14} className={isMissed ? 'text-red-500' : 'text-[#00a884]'} />
                          ) : (
                             isMissed ? <PhoneMissed size={14} className="text-red-500" /> : <PhoneIncoming size={14} className="text-[#00a884]" />
                          )}
                          <span>
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                       </div>
                    </div>
                 </div>
               );
            })}
         </div>
      )}
      
      </div>
      
    </div>
  );
}
