import { useStore } from './store';

const translations = {
  ar: {
    'chat.secure': 'محادثة آمنة',
    'chat.mic_error_alert': 'تم رفض الوصول للميكروفون.',
    'chat.secure.desc': 'تواصل بأمان وسرية تامة مع تشفير من طرف إلى طرف.',
    'login.google': 'المتابعة باستخدام Google',
    'error.login': 'فشل تسجيل الدخول',
    'error.register': 'فشل التسجيل',
    'username.choose': 'اختر اسم مستخدم (Username)',
    'username.placeholder': 'مثال: shadow_ninja',
    'username.rules': 'يمكنك استخدام الأحرف الإنجليزية والأرقام والشرطة السفلية فقط.',
    'btn.continue': 'متابعة',
    'profile.name': 'الاسم المستعار (اختياري)',
    'profile.name.placeholder': 'الاسم الذي يظهر للآخرين',
    'profile.age': 'العمر (اختياري)',
    'profile.age.placeholder': 'مثال: 25',
    'profile.country': 'البلد (اختياري)',
    'profile.country.select': 'اختر البلد...',
    'btn.create': 'إنشاء الحساب المشفر',
    'register.notice': 'سيتم إنشاء مفاتيح التشفير محلياً. خصوصيتك في أمان تام.',
    
    'sidebar.chats': 'المحادثات',
    'sidebar.search.placeholder': 'ابحث عن مستخدمين...',
    'sidebar.search.results': 'نتائج البحث',
    'sidebar.search.no_results': 'لا يوجد نتائج لـ',
    'sidebar.search.empty': 'ابحث بواسطة اسم المستخدم للبدء',
    'sidebar.click_to_chat': 'اضغط للتواصل',
    'sidebar.empty.title': 'قائمة فارغة',
    'sidebar.empty.desc': 'قم بإضافة أشخاص للتواصل معهم بشكل مشفر',
    'sidebar.add_contact': 'إضافة جهة اتصال',
    'sidebar.incognito': 'وضع التخفي',
    'sidebar.incognito.desc': 'لا تحفظ الرسائل محلياً',
    'sidebar.settings': 'الإعدادات',
    'sidebar.profile': 'الملف الشخصي',
    'sidebar.logout': 'تسجيل الخروج',
    
    'chat.e2e.title': 'تشفير من طرف إلى طرف',
    'chat.e2e.desc': 'قم باختيار مستخدم لبدء محادثة آمنة. جميع رسائلك مشفرة ولا يمكن لأحد قراءتها.',
    'chat.e2e.badge': 'مشفر كلياً (E2EE)',
    'chat.e2e.notice': 'الرسائل والمكالمات مشفرة من طرف إلى طرف. لا يستطيع أحد قراءتها أو الاستماع إليها.',
    'chat.audio_call': 'مكالمة صوتية',
    'chat.ringing': 'يرن...',
    'chat.video_call': 'مكالمة فيديو',
    'chat.input.timer': 'مؤقت:',
    'chat.input.timer.off': 'إيقاف',
    'chat.input.timer.min': 'دقيقة',
    'chat.input.timer.hour': 'ساعة',
    'chat.input.timer.day': 'يوم',
    'chat.input.placeholder': 'اكتب رسالة مشفرة...',
    
    'settings.title': 'الإعدادات',
    'settings.theme': 'المظهر',
    'settings.theme.light': 'فاتح',
    'settings.theme.dark': 'داكن',
    'settings.lang': 'اللغة',
    'settings.save': 'حفظ والتراجع',
    
    'profile.title': 'الملف الشخصي',
  },
  en: {
    'chat.secure': 'Secure Chat',
    'chat.mic_error_alert': 'Microphone access denied.',
    'chat.secure.desc': 'Communicate securely with end-to-end encryption.',
    'login.google': 'Continue with Google',
    'error.login': 'Login failed',
    'error.register': 'Registration failed',
    'username.choose': 'Choose a Username',
    'username.placeholder': 'e.g. shadow_ninja',
    'username.rules': 'Only English letters, numbers, and underscores allowed.',
    'btn.continue': 'Continue',
    'profile.name': 'Display Name (Optional)',
    'profile.name.placeholder': 'Name shown to others',
    'profile.age': 'Age (Optional)',
    'profile.age.placeholder': 'e.g. 25',
    'profile.country': 'Country (Optional)',
    'profile.country.select': 'Select country...',
    'btn.create': 'Create Secure Account',
    'register.notice': 'Encryption keys generated locally. Your privacy is safe.',
    
    'sidebar.chats': 'Chats',
    'sidebar.search.placeholder': 'Search users...',
    'sidebar.search.results': 'Search Results',
    'sidebar.search.no_results': 'No results for',
    'sidebar.search.empty': 'Search by username to start',
    'sidebar.click_to_chat': 'Click to chat',
    'sidebar.empty.title': 'Empty List',
    'sidebar.empty.desc': 'Add people to chat with them securely',
    'sidebar.add_contact': 'Add Contact',
    'sidebar.incognito': 'Incognito Mode',
    'sidebar.incognito.desc': 'Do not save messages locally',
    'sidebar.settings': 'Settings',
    'sidebar.profile': 'Profile',
    'sidebar.logout': 'Logout',
    
    'chat.e2e.title': 'End-to-End Encrypted',
    'chat.e2e.desc': 'Select a user to start a secure conversation. Your messages are encrypted.',
    'chat.e2e.badge': 'E2EE Encrypted',
    'chat.e2e.notice': 'Messages and calls are end-to-end encrypted. No one can read or listen to them.',
    'chat.audio_call': 'Audio Call',
    'chat.ringing': 'Ringing...',
    'chat.video_call': 'Video Call',
    'chat.input.timer': 'Timer:',
    'chat.input.timer.off': 'Off',
    'chat.input.timer.min': '1 Min',
    'chat.input.timer.hour': '1 Hour',
    'chat.input.timer.day': '1 Day',
    'chat.input.placeholder': 'Type encrypted message...',
    
    'settings.title': 'Settings',
    'settings.theme': 'Appearance',
    'settings.theme.light': 'Light',
    'settings.theme.dark': 'Dark',
    'settings.lang': 'Language',
    'settings.save': 'Save & Close',
    
    'profile.title': 'Profile',
  }
};

type TranslationKeys = keyof typeof translations['en'];

export function useTranslation() {
  const lang = useStore(state => state.language) || 'ar';
  
  const t = (key: TranslationKeys) => {
    return translations[lang][key] || key;
  };
  
  return { t, lang };
}
