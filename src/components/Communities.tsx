import React from 'react';
import { Users } from 'lucide-react';
import { useStore } from '../lib/store';
import { useTranslation } from '../lib/i18n';

export default function Communities() {
  const { lang } = useTranslation();
  
  return (
    <div className="flex-1 bg-bg-primary flex flex-col h-full overflow-hidden items-center px-6 py-12 relative text-center overflow-y-auto overscroll-none" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="w-64 h-64 mb-8 relative bg-[#d9fdd3] rounded-3xl p-6 flex flex-col items-center justify-center">
         {/* Using an abstract illustration since I can't generate the exact graphic */}
         <div className="w-full h-full relative">
           <svg viewBox="0 0 200 200" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
             <rect x="20" y="20" width="80" height="60" rx="15" fill="#fff" stroke="#111" strokeWidth="4" />
             <circle cx="50" cy="45" r="12" fill="#111" />
             <circle cx="80" cy="45" r="12" fill="#111" />
             <path d="M40 70 Q60 50 80 70" stroke="#111" strokeWidth="4" strokeLinecap="round" />
             
             <path d="M120 40 L170 80 L140 110 L90 70 Z" fill="#25D366" stroke="#111" strokeWidth="4" strokeLinejoin="round" />
             <path d="M110 50 L140 80" stroke="#111" strokeWidth="4" strokeLinecap="round" />
             
             <circle cx="60" cy="130" r="40" fill="#a5f3bc" stroke="#111" strokeWidth="4" />
             
             <rect x="110" y="120" width="70" height="70" rx="20" fill="#a5f3bc" stroke="#111" strokeWidth="4" />
             <line x1="125" y1="155" x2="165" y2="155" stroke="#111" strokeWidth="4" strokeLinecap="round" />
             <line x1="145" y1="135" x2="145" y2="175" stroke="#111" strokeWidth="4" strokeLinecap="round" />
           </svg>
         </div>
      </div>

      <h1 className="text-2xl font-bold text-text-primary mb-3">
        {lang === 'ar' ? 'ابق على اتصال مع مجتمعك' : 'Stay connected with a community'}
      </h1>
      
      <p className="text-text-muted text-[15px] leading-relaxed mb-8 max-w-sm">
        {lang === 'ar' 
          ? 'تجمع المجتمعات الأعضاء معاً في مجموعات حسب الموضوع، وتجعل من السهل الحصول على إعلانات المشرفين. أي مجتمع تتم إضافتك إليه سيظهر هنا.'
          : "Communities bring members together in topic-based groups, and make it easy to get admin announcements. Any community you're added to will appear here."}
      </p>
      
      <button className="text-[#00a884] text-sm font-semibold mb-12 hover:underline">
        {lang === 'ar' ? '< عرض أمثلة للمجتمعات' : 'See example communities >'}
      </button>

      <button className="w-full max-w-sm bg-[#00a884] text-white font-bold py-3.5 rounded-full hover:bg-opacity-90 transition-all active:scale-95 shadow-lg text-[15px]">
        {lang === 'ar' ? 'بدء مجتمعك' : 'Start your community'}
      </button>
    </div>
  );
}
