import React, { useState, useEffect, useRef } from 'react';
import { useStore, User } from '../lib/store';
import { Search, LogOut, Edit2, User as UserIcon, Settings, Ghost, Menu, Plus, ArrowRight, X, Monitor, Type, Camera, Mic, MoreVertical, MessageSquare, Phone as PhoneIcon, Users, Bell, UserPlus, Trash2, Check, Smile, CheckCircle, Pin } from 'lucide-react';
import { logoutGoogle, db } from '../lib/firebase';
import { collection, query, where, limit, getDocs, updateDoc, doc, onSnapshot, getDoc, deleteDoc } from 'firebase/firestore';
import { useTranslation } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import RecentCalls from './RecentCalls';
import Updates from './Updates';
import Communities from './Communities';

export default function Sidebar() {
  const { t, lang } = useTranslation();
  const [searchMode, setSearchMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState<string[]>([]);
  const [selectedCalls, setSelectedCalls] = useState<string[]>([]);
  const [pinnedChats, setPinnedChats] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('pinnedChats') || '[]');
    } catch {
      return [];
    }
  });

  const [currentTab, setCurrentTab] = useState(() => {
    return localStorage.getItem('chat_current_tab') || 'Chats';
  });

  useEffect(() => {
    localStorage.setItem('chat_current_tab', currentTab);
  }, [currentTab]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  
  // Modals for Settings and Profile
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  
  const { currentUser, logout, activeChat, setActiveChat, incognitoMode, setIncognitoMode, users, theme, setTheme, language, setLanguage, messages, contacts, addContact, removeContact } = useStore();
  const [showRequests, setShowRequests] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [selectedUserToDelete, setSelectedUserToDelete] = useState<string | null>(null);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const registeredFriends = Object.values(users).filter(u => 
    !!contacts[u.id] && u.id !== 'hbot-ai' && u.id !== currentUser?.id
  );
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [cropperScale, setCropperScale] = useState(1);
  const [cropperPosition, setCropperPosition] = useState({ x: 0, y: 0 });
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [userToAdd, setUserToAdd] = useState<User | null>(null);
  const [friendNickname, setFriendNickname] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const isAnyModalOpen = searchMode || menuOpen || showSettings || showProfile || showRequests || showAddFriendModal;

  const handleTabSwitch = (tab: string) => {
    if (currentTab === tab) return;
    setCurrentTab(tab);
    if (tab === 'Chats') {
      window.history.pushState(null, '', ' ');
    } else {
      window.history.pushState(null, '', `#tab-${tab}`);
    }
  };

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      
      if (hash.startsWith('#tab-')) {
        setCurrentTab(hash.replace('#tab-', ''));
      } else if (hash === '' || hash === '#') {
        setCurrentTab('Chats');
      }

      if (hash !== '#modal') {
        setSearchMode(false);
        setMenuOpen(false);
        setShowSettings(false);
        setShowProfile(false);
        setShowRequests(false);
        setShowAddFriendModal(false);
      }
    };
    window.addEventListener('hashchange', handleHash);
    
    // Also run once on mount to read initial hash
    handleHash();

    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    if (isAnyModalOpen && window.location.hash !== '#modal') {
      window.history.pushState(null, '', '#modal');
    } else if (!isAnyModalOpen && window.location.hash === '#modal') {
      window.history.back();
    }
  }, [isAnyModalOpen]);

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.name || '');
      setEditAge(currentUser.age?.toString() || '');
      setEditCountry(currentUser.country || '');
      setEditAvatar(currentUser.avatar_url || '');
    }
  }, [currentUser, showProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setUpdatingProfile(true);
    try {
      const docRef = doc(db, 'users', currentUser.id);
      await updateDoc(docRef, {
          name: editName,
          age: parseInt(editAge) || null,
          country: editCountry,
          avatar_url: editAvatar || null
      });
      if (true) {
        useStore.getState().setCurrentUser({ 
          ...currentUser, 
          name: editName, 
          age: parseInt(editAge) || undefined, 
          country: editCountry, 
          avatar_url: editAvatar || undefined 
        }, useStore.getState().privateKeyPem!);
        setIsEditingProfile(false);
      }
    } catch(err) {}
    setUpdatingProfile(false);
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsImageLoading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawBase64 = event.target?.result as string;
        setCropperImage(rawBase64);
        setCropperScale(1);
        setCropperPosition({ x: 0, y: 0 });
        setIsImageLoading(false);
      };
      reader.onerror = () => setIsImageLoading(false);
      reader.readAsDataURL(file);
    }
  };

  const handleCropAvatar = () => {
    if (!cropperImage) return;
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'var(--bg-secondary)';
        ctx.fillRect(0, 0, size, size);
        
        const imgAspect = img.width / img.height;
        let drawWidth = size;
        let drawHeight = size;
        
        if (imgAspect > 1) {
          drawWidth = size * imgAspect;
        } else {
          drawHeight = size / imgAspect;
        }
        
        drawWidth *= cropperScale;
        drawHeight *= cropperScale;
        
        const x = (size - drawWidth) / 2 + cropperPosition.x;
        const y = (size - drawHeight) / 2 + cropperPosition.y;
        
        ctx.drawImage(img, x, y, drawWidth, drawHeight);
        
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setEditAvatar(dataUrl);
        setCropperImage(null);
      }
    };
    img.src = cropperImage;
  };

  const pinnedUsers = Object.values(users).sort((a, b) => {
    const aPinned = pinnedChats.includes(a.id) || a.id === 'hbot-ai';
    const bPinned = pinnedChats.includes(b.id) || b.id === 'hbot-ai';
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  useEffect(() => {
    if (currentUser && currentUser.contacts && currentUser.contacts.length > 0) {
       // Fetch contacts from firestore to keep them fresh
       const fetchContacts = async () => {
          for (const cid of currentUser.contacts!) {
             if (cid !== 'hbot-ai') {
                try {
                  const docSnap = await getDoc(doc(db, 'users', cid));
                  if (docSnap.exists()) {
                     useStore.getState().addUser(docSnap.data() as User);
                  }
                } catch (e) {}
             }
          }
       };
       fetchContacts();
    }
  }, [currentUser?.contacts]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    
    let unsubscribe: (() => void) | undefined;
    const timeout = setTimeout(() => {
      try {
        const q = query(
          collection(db, 'users'), 
          where('username', '>=', searchQuery), 
          where('username', '<=', searchQuery + '\uf8ff'), 
          limit(20)
        );
        unsubscribe = onSnapshot(q, (querySnapshot) => {
           const results: User[] = [];
           querySnapshot.forEach((docSnap) => {
             const data = docSnap.data() as User;
             if (data.username !== currentUser?.username) {
               results.push(data);
             }
           });
           setSearchResults(results);
        });
      } catch (err) {
        console.error(err);
      }
    }, 300);
    
    return () => {
      clearTimeout(timeout);
      if (unsubscribe) unsubscribe();
    };
  }, [searchQuery, currentUser]);

  
  const handleWipeData = async () => {
    const confirmMsg = lang === 'ar' 
      ? "هل أنت متأكد من مسح جميع الحسابات والرسائل؟ سيتم حذف كل شيء وسيضطر الجميع لإعادة تسجيل الدخول." 
      : "Are you sure you want to delete ALL accounts and messages? This will wipe the entire database and force everyone to re-login.";
      
    if (window.confirm(confirmMsg)) {
      try {
        // Delete all messages
        const msgs = await getDocs(collection(db, 'messages'));
        for (const d of msgs.docs) {
           await deleteDoc(d.ref);
        }
        
        // Delete all users
        const usersSnap = await getDocs(collection(db, 'users'));
        for (const d of usersSnap.docs) {
           await deleteDoc(d.ref);
        }
        
        localStorage.clear();
        const successMsg = lang === 'ar' 
          ? "تم مسح جميع البيانات والحسابات بنجاح! سيتم الآن إعادة تحميل الصفحة." 
          : "All data and accounts have been wiped successfully! The page will now reload.";
        alert(successMsg);
        window.location.reload();
      } catch(e: any) {
        alert("Error wiping data: " + e.message);
      }
    }
  };

  const handleLogout = async () => {
    await logoutGoogle();
    logout();
  };

  const pinUser = async (user: User) => {
    useStore.getState().addUser(user);
    setActiveChat(user.id);
    setSearchMode(false);
    setSearchQuery('');
    
    if (currentUser) {
       try {
         const docRef = doc(db, 'users', currentUser.id);
         const currentContacts = currentUser.contacts || [];
         if (!currentContacts.includes(user.id)) {
            const newContacts = [...currentContacts, user.id];
            await updateDoc(docRef, { contacts: newContacts });
            useStore.getState().setCurrentUser({ ...currentUser, contacts: newContacts }, useStore.getState().privateKeyPem!);
         }
       } catch (e) { console.error(e); }
    }
  };

  const ArrowIcon = ArrowRight;
  const rtlRotate = lang === 'ar' ? '' : 'rotate-180';

  const activeMessageUsers = Object.keys(messages || {});
  
  // People who messaged us but aren't in contacts
  const requests = activeMessageUsers.filter(uid => 
    uid !== 'hbot-ai' && 
    !contacts[uid] && 
    (messages[uid] || []).some(m => m.receiver_id === currentUser?.id)
  );

  const sortedUsers = Object.values(users).filter(u => {
    if (u.id === 'hbot-ai') return true;
    // Show in main list if they are in currentUser.contacts
    const activeContacts = currentUser?.contacts || [];
    return activeContacts.includes(u.id);
  }).sort((a, b) => {
     if (a.id === 'hbot-ai') return -1;
     if (b.id === 'hbot-ai') return 1;
     
     const aPinned = pinnedChats.includes(a.id);
     const bPinned = pinnedChats.includes(b.id);
     if (aPinned && !bPinned) return -1;
     if (!aPinned && bPinned) return 1;

     // Sort by last message timestamp if available
     const aMsgs = messages[a.id] || [];
     const bMsgs = messages[b.id] || [];
     const aLast = aMsgs[aMsgs.length - 1]?.timestamp || 0;
     const bLast = bMsgs[bMsgs.length - 1]?.timestamp || 0;
     return bLast - aLast;
  });

  return (
    <div className={`w-full h-full border-${lang === 'ar' ? 'l' : 'r'} border-border-primary flex flex-col bg-bg-primary relative transition-colors duration-300`}>
      
      {/* Header */}
      {(selectedChats.length > 0 || selectedCalls.length > 0) ? (
        <div className="h-14 flex items-center justify-between px-4 py-2 shrink-0 bg-bg-tertiary border-b border-border-primary animate-in fade-in z-20">
          <div className="flex items-center gap-4">
             <button onClick={() => { setSelectedChats([]); setSelectedCalls([]); }} className="p-2 text-text-secondary hover:bg-bg-hover rounded-full transition-colors focus:outline-none">
                <X size={20} />
             </button>
             <span className="text-lg font-medium text-text-primary">{selectedChats.length > 0 ? selectedChats.length : selectedCalls.length}</span>
          </div>
          <div className="flex items-center gap-4 text-text-primary">
             {selectedChats.length > 0 && (
               <button 
                  onClick={() => {
                     // Pin / Unpin
                     const pinStatus = selectedChats.map(id => pinnedChats.includes(id) ? 'unpin' : 'pin');
                     const shouldPin = pinStatus.includes('pin');
                     let newPinned = [...pinnedChats];
                     if (shouldPin) {
                        selectedChats.forEach(id => {
                           if (!newPinned.includes(id)) newPinned.push(id);
                        });
                     } else {
                        newPinned = newPinned.filter(id => !selectedChats.includes(id));
                     }
                     setPinnedChats(newPinned);
                     localStorage.setItem('pinnedChats', JSON.stringify(newPinned));
                     setSelectedChats([]);
                  }} 
                  className="p-2 hover:bg-bg-hover rounded-full transition-colors focus:outline-none"
               >
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
               </button>
             )}
             <button 
                onClick={() => {
                   if (selectedChats.length > 0) {
                     // Delete chats
                     const currentContacts = currentUser.contacts || [];
                     const newContacts = currentContacts.filter(id => !selectedChats.includes(id));
                     updateDoc(doc(db, 'users', currentUser.id), { contacts: newContacts }).catch(console.error);
                     
                     selectedChats.forEach(async (id) => {
                        const chatId = currentUser.id < id ? `${currentUser.id}_${id}` : `${id}_${currentUser.id}`;
                        try {
                           const q = query(collection(db, 'messages'), where('chatId', '==', chatId));
                           const snap = await getDocs(q);
                           for (const d of snap.docs) {
                              await deleteDoc(d.ref);
                           }
                        } catch (e) {
                           console.error("Error deleting messages for chatId:", chatId, e);
                        }
                     });
                     
                     const state = useStore.getState();
                     const newMessages = { ...state.messages };
                     selectedChats.forEach(id => {
                        delete newMessages[id];
                     });
                     useStore.setState({ messages: newMessages });
                     
                     if (selectedChats.includes(state.activeChat || '')) {
                        state.setActiveChat(null);
                     }
                     state.setCurrentUser({ ...currentUser, contacts: newContacts }, state.privateKeyPem!);
                     setSelectedChats([]);
                   } else if (selectedCalls.length > 0) {
                     // Delete calls
                     selectedCalls.forEach(async (id) => {
                        try {
                           await deleteDoc(doc(db, 'messages', id));
                        } catch (e) { console.error(e); }
                     });
                     setSelectedCalls([]);
                   }
                }} 
                className="p-2 hover:bg-bg-hover rounded-full transition-colors focus:outline-none"
             >
                <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
             </button>
          </div>
        </div>
      ) : (
        <div className="h-14 flex items-center justify-between px-4 py-2 shrink-0 bg-bg-primary">
          <h1 className="text-2xl font-bold tracking-tighter"><span className="text-white">Hi</span><span className="text-accent-primary">SEND</span></h1>
          <div className="flex items-center gap-5 text-text-primary">
            <button 
              onClick={() => setShowRequests(true)}
              className="hover:text-accent-primary transition-colors focus:outline-none relative"
              title={lang === 'ar' ? 'طلبات المراسلة' : 'Message Requests'}
            >
              <Bell size={24} />
              {requests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {requests.length}
                </span>
              )}
            </button>
            <button className="hover:text-text-muted transition-colors focus:outline-none">
              <Camera size={24} />
            </button>
            <button 
              onClick={() => setMenuOpen(!menuOpen)}
              className="hover:text-text-muted transition-colors focus:outline-none"
            >
              <MoreVertical size={24} />
            </button>
          </div>
        </div>
      )}
      
      {/* Search Bar (Always visible like WhatsApp) */}
      <div className="px-3 py-2 shrink-0 bg-bg-primary">
        <div 
          onClick={() => setSearchMode(true)}
          className="bg-bg-tertiary rounded-full flex items-center px-4 py-2.5 gap-3 cursor-text transition-colors"
        >
          <Search size={20} className="text-text-muted" />
          <span className="text-[15px] text-text-muted select-none flex-1">Ask HiSEND Ai or Search</span>
        </div>
      </div>

      {/* Search Mode Overlay */}
      {searchMode && (
        <div className="absolute inset-0 bg-bg-primary z-30 flex flex-col animate-in slide-in-from-top-2 duration-200">
          <div className="h-16 bg-bg-tertiary flex items-center px-4 py-2 shrink-0 gap-3 shadow-md border-b border-border-primary">
            <button 
              onClick={() => { setSearchMode(false); setSearchQuery(''); }}
              className="p-2 text-text-secondary hover:bg-bg-hover rounded-full transition-colors focus:outline-none"
            >
              <ArrowIcon size={24} className={`transform ${rtlRotate}`} />
            </button>
            <div className="flex-1 bg-bg-primary border border-border-primary rounded-lg flex items-center px-3 py-1.5 gap-2 focus-within:border-accent-primary focus-within:ring-1 focus-within:ring-accent-primary transition-all">
              <input
                type="text"
                autoFocus
                placeholder={t('sidebar.search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full text-text-primary placeholder-text-muted"
                dir="auto"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-text-muted hover:text-text-primary">
                   <X size={16} />
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto overscroll-none">
            {!searchQuery.trim() ? (
              <div className="flex flex-col pb-20">
                <h3 className="text-[12px] font-bold text-accent-primary uppercase mb-2 px-4 mt-4">
                  {lang === 'ar' ? 'الأصدقاء المسجلون' : 'Registered Friends'}
                </h3>
                {registeredFriends.length > 0 ? (
                  registeredFriends.map(user => {
                    return (
                      <button
                        key={user.id}
                        onClick={() => {
                          pinUser(user);
                        }}
                        className={`flex items-center px-4 py-3 hover:bg-bg-hover gap-4 cursor-pointer text-${lang === 'ar' ? 'right' : 'left'} w-full transition-colors`}
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      >
                        <div className="relative w-12 h-12 shrink-0">
                          <div className="w-full h-full rounded-full flex items-center justify-center text-white text-lg font-bold uppercase shadow-sm overflow-hidden bg-accent-primary">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              user.username.charAt(0)
                            )}
                          </div>
                        </div>
                        <div className="flex-1 py-2 flex flex-col border-b border-border-primary truncate">
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="font-semibold text-text-primary text-base truncate">
                              {contacts[user.id]?.nickname || user.name || user.username}
                            </span>
                            <span className="text-xs text-text-muted shrink-0">@{user.username}</span>
                          </div>
                          <div className="flex items-center justify-between">
                             <span className="text-sm text-text-muted truncate">
                               {lang === 'ar' ? 'صديق مسجل - انقر للمراسلة' : 'Registered Friend - Click to chat'}
                             </span>
                          </div>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-8 flex flex-col items-center justify-center text-text-muted">
                    <p className="text-sm text-center leading-relaxed">
                      {lang === 'ar' ? 'لا يوجد أصدقاء مسجلون حالياً. يمكنك البحث وإضافتهم.' : 'No registered friends yet. Search and add some!'}
                    </p>
                  </div>
                )}
              </div>
            ) : searchResults.length > 0 ? (
              <div className="flex flex-col">
                <h3 className="text-[11px] font-semibold text-text-muted uppercase mb-2 px-4 mt-4">{t('sidebar.search.results')}</h3>
                {searchResults.map(user => {
                  const isSelected = selectedChats.includes(user.id);
                  return (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={user.id}
                    onClick={(e) => {
                       if (e.currentTarget.dataset.longPressed === 'true') {
                          e.currentTarget.dataset.longPressed = 'false';
                          return;
                       }
                       if (selectedChats.length > 0) {
                          if (user.id !== 'hbot-ai') setSelectedChats(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]);
                       } else {
                          if (contacts[user.id] || user.id === 'hbot-ai') {
                             pinUser(user);
                          } else {
                             setUserToAdd(user);
                             setFriendNickname(user.name || user.username);
                             setShowAddFriendModal(true);
                          }
                       }
                    }}
                    onContextMenu={(e) => { 
                       e.preventDefault(); 
                       if(user.id !== 'hbot-ai') setSelectedChats(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]); 
                    }}
                    onTouchStart={(e) => {
                       const btn = e.currentTarget;
                       btn.dataset.longPressed = 'false';
                       const timer = setTimeout(() => {
                          if(user.id !== 'hbot-ai' && selectedChats.length === 0) {
                             setSelectedChats([user.id]);
                             btn.dataset.longPressed = 'true';
                             if (navigator.vibrate) navigator.vibrate(50);
                          }
                       }, 500);
                       btn.dataset.timer = timer.toString();
                    }}
                    onTouchEnd={(e) => {
                       const timer = e.currentTarget.dataset.timer;
                       if (timer) clearTimeout(parseInt(timer));
                    }}
                    onTouchMove={(e) => {
                       const timer = e.currentTarget.dataset.timer;
                       if (timer) clearTimeout(parseInt(timer));
                    }}
                    className={`flex items-center px-4 py-3 hover:bg-bg-hover gap-4 cursor-pointer text-${lang === 'ar' ? 'right' : 'left'} w-full transition-colors ${activeChat === user.id ? 'bg-bg-hover' : ''} ${isSelected ? 'bg-white/10' : ''}`}
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                  >
                    <div className="relative w-12 h-12 shrink-0">
                      <div className={`w-full h-full rounded-full flex items-center justify-center text-white text-lg font-bold uppercase shadow-sm overflow-hidden bg-accent-primary`}>
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          user.username.charAt(0)
                        )}
                      </div>
                    </div>
                    <div className="flex-1 py-2 flex flex-col border-b border-border-primary truncate">
                      <div className="flex justify-between items-baseline mb-1">
                        <span className="font-semibold text-text-primary text-base truncate">{user.name || user.username}</span>
                        <span className="text-xs text-text-muted shrink-0">{user.id === 'hbot-ai' ? 'AI' : ''}</span>
                      </div>
                      <div className="flex items-center justify-between">
                         <span className="text-sm text-text-muted truncate">{user.id === 'hbot-ai' ? (lang === 'ar' ? 'مدعوم بالذكاء الاصطناعي' : 'Powered by AI') : t('sidebar.click_to_chat')}</span>
                      </div>
                    </div>
                  </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 flex flex-col items-center justify-center h-full text-text-muted">
                <div className="w-24 h-24 rounded-full bg-bg-tertiary border border-border-primary flex flex-col items-center justify-center mb-6 shadow-inner">
                   <Search className="w-10 h-10 opacity-50" />
                </div>
                <h2 className="text-xl font-bold text-text-primary mb-2 text-center">No results found</h2>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Contact List */}
      {!searchMode && currentTab === 'Chats' && (
         <div className="flex-1 overflow-y-auto overscroll-none">
            {sortedUsers.length > 0 ? (
               <div className="flex flex-col pb-20">
                  {sortedUsers.map(user => {
                     const isSelected = selectedChats.includes(user.id);
                     return (
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={user.id}
                        onClick={(e) => {
                           if (e.currentTarget.dataset.longPressed === 'true') {
                              e.currentTarget.dataset.longPressed = 'false';
                              return;
                           }
                           if (selectedChats.length > 0) {
                              if (user.id !== 'hbot-ai') setSelectedChats(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]);
                           } else {
                              setActiveChat(user.id);
                           }
                        }}
                        onContextMenu={(e) => { 
                           e.preventDefault(); 
                           if(user.id !== 'hbot-ai') setSelectedChats(prev => prev.includes(user.id) ? prev.filter(id => id !== user.id) : [...prev, user.id]); 
                        }}
                        className={`flex items-center px-4 py-3 hover:bg-bg-hover gap-4 cursor-pointer text-${lang === 'ar' ? 'right' : 'left'} w-full transition-colors ${activeChat === user.id ? 'bg-bg-hover' : ''} ${isSelected ? 'bg-[#00a884]/20' : ''}`}
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      >
                        <div className="relative w-12 h-12 shrink-0">
                          <div className={`w-full h-full rounded-full flex items-center justify-center text-white text-lg font-bold uppercase shadow-sm overflow-hidden bg-accent-primary`}>
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              user.username.charAt(0)
                            )}
                          </div>
                          {isSelected && (
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#00a884] rounded-full flex items-center justify-center border-2 border-bg-primary">
                              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 py-2 flex flex-col border-b border-border-primary truncate">
                          <div className="flex justify-between items-baseline mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-text-primary text-base truncate">
                                {contacts[user.id]?.nickname || user.name || user.username}
                              </span>
                              {!contacts[user.id] && user.id !== 'hbot-ai' && (
                                <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                                  {lang === 'ar' ? 'طلب جديد' : 'NEW REQUEST'}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-text-muted shrink-0">
                              {(() => {
                                const msgs = messages[user.id] || [];
                                if (msgs.length === 0) return user.id === 'hbot-ai' ? 'AI' : '';
                                const lastTs = msgs[msgs.length - 1].timestamp;
                                const date = new Date(lastTs);
                                return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                             <span className="text-sm text-text-muted truncate flex items-center gap-1">
                               {(() => {
                                 const msgs = messages[user.id] || [];
                                 if (msgs.length === 0) return user.id === 'hbot-ai' ? (lang === 'ar' ? 'مدعوم بالذكاء الاصطناعي' : 'Powered by AI') : t('sidebar.click_to_chat');
                                 const last = msgs[msgs.length - 1];
                                 return last.type === 'image' ? <><Camera size={12}/> {lang === 'ar' ? 'صورة' : 'Image'}</> : last.type === 'audio' ? <><Mic size={12}/> {lang === 'ar' ? 'رسالة صوتية' : 'Audio'}</> : last.content;
                               })()}
                             </span>
                             <div className="flex items-center gap-2">
                               {(() => {
                                 const unreadCount = (messages[user.id] || []).filter(m => m.receiver_id === currentUser?.id && m.status !== 'read').length;
                                 if (unreadCount > 0) {
                                   return (
                                     <span className="bg-[#00a884] text-[var(--bg-primary)] text-[12px] font-bold min-w-[20px] h-5 flex items-center justify-center rounded-full px-1">
                                       {unreadCount}
                                     </span>
                                   );
                                 }
                                 return null;
                               })()}
                               {pinnedChats.includes(user.id) && (
                                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted opacity-60"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>
                               )}
                             </div>
                          </div>
                        </div>
                      </motion.button>
                     );
                  })}
               </div>
            ) : (
               <div className="p-8 flex flex-col items-center justify-center h-full text-text-muted">
                 <div className="w-24 h-24 rounded-full bg-bg-tertiary border border-border-primary flex flex-col items-center justify-center mb-6 shadow-inner">
                    <UserIcon className="w-10 h-10 opacity-50" />
                 </div>
                 <h2 className="text-xl font-bold text-text-primary mb-2 text-center">{t('sidebar.empty.title')}</h2>
                 <p className="text-sm text-center max-w-[200px] leading-relaxed">
                   {t('sidebar.empty.desc')}
                 </p>
                 <button 
                   onClick={() => setSearchMode(true)}
                   className="mt-6 px-6 py-2.5 bg-accent-primary text-white rounded-full font-medium hover:bg-opacity-90 transition-colors shadow-lg"
                 >
                   {t('sidebar.add_contact')}
                 </button>
               </div>
            )}
         </div>
      )}

      {!searchMode && currentTab === 'Calls' && (
         <RecentCalls selectedCalls={selectedCalls} setSelectedCalls={setSelectedCalls} />
      )}
      {!searchMode && currentTab === 'Updates' && (
         <Updates />
      )}
      {!searchMode && currentTab === 'Communities' && (
         <Communities />
      )}

      {/* Floating Action Buttons */}
      {currentTab === 'Chats' && (
        <button 
          onClick={() => setSearchMode(true)}
          className={`absolute bottom-20 ${lang === 'ar' ? 'left-4' : 'right-4'} w-14 h-14 bg-accent-primary rounded-[16px] flex items-center justify-center text-black shadow-lg hover:bg-opacity-90 transition-transform active:scale-95 z-20`}
          title={t('sidebar.add_contact')}
        >
          <MessageSquare size={24} fill="currentColor" />
        </button>
      )}

      {currentTab === 'Calls' && (
        <button 
          className={`absolute bottom-20 ${lang === 'ar' ? 'left-4' : 'right-4'} w-14 h-14 bg-accent-primary rounded-[16px] flex items-center justify-center text-black shadow-lg hover:bg-opacity-90 transition-transform active:scale-95 z-20`}
        >
          <PhoneIcon size={24} fill="currentColor" />
        </button>
      )}

      {currentTab === 'Updates' && (
        <div className={`absolute bottom-20 ${lang === 'ar' ? 'left-4' : 'right-4'} flex flex-col gap-4 items-center z-20`}>
          <button className="w-12 h-12 bg-bg-tertiary border border-border-primary rounded-[16px] flex items-center justify-center text-text-primary shadow-lg hover:bg-opacity-90 transition-transform active:scale-95">
            <Edit2 size={20} />
          </button>
          <button className="w-14 h-14 bg-accent-primary rounded-[16px] flex items-center justify-center text-black shadow-lg hover:bg-opacity-90 transition-transform active:scale-95">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="24" 
              height="24" 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="lucide lucide-camera"
            >
              <path 
                d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" 
                style={{ color: '#000000' }}
              />
              <circle 
                cx="12" 
                cy="13" 
                r="3" 
                style={{ color: '#00a884' }}
              />
            </svg>
          </button>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="h-16 bg-bg-primary border-t border-border-primary shrink-0 flex items-center justify-around px-2 pb-1">
        <button onClick={() => handleTabSwitch('Chats')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${currentTab === 'Chats' ? 'text-[#00a884]' : 'text-text-muted hover:text-text-primary'}`}>
          <MessageSquare size={24} className={currentTab === 'Chats' ? 'fill-current' : ''} />
          <span className="text-[10px] font-medium">{lang === 'ar' ? 'الدردشات' : 'Chats'}</span>
        </button>
        <button onClick={() => handleTabSwitch('Updates')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${currentTab === 'Updates' ? 'text-[#00a884]' : 'text-text-muted hover:text-text-primary'}`}>
          <div className="relative">
            <Settings size={24} className={currentTab === 'Updates' ? 'fill-current' : ''} />
          </div>
          <span className="text-[10px] font-medium">{lang === 'ar' ? 'المستجدات' : 'Updates'}</span>
        </button>
        <button onClick={() => handleTabSwitch('Communities')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${currentTab === 'Communities' ? 'text-[#00a884]' : 'text-text-muted hover:text-text-primary'}`}>
          <Users size={24} className={currentTab === 'Communities' ? 'fill-current' : ''} />
          <span className="text-[10px] font-medium">{lang === 'ar' ? 'المجتمعات' : 'Communities'}</span>
        </button>
        <button onClick={() => handleTabSwitch('Calls')} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${currentTab === 'Calls' ? 'text-[#00a884]' : 'text-text-muted hover:text-text-primary'}`}>
          <PhoneIcon size={24} className={currentTab === 'Calls' ? 'fill-current' : ''} />
          <span className="text-[10px] font-medium">{lang === 'ar' ? 'المكالمات' : 'Calls'}</span>
        </button>
      </div>

      {/* Slide-out Menu (Sidebar inside Sidebar) */}
      <div className={`absolute top-0 ${lang === 'ar' ? 'right-0' : 'left-0'} h-full w-3/4 max-w-xs bg-bg-primary border-${lang === 'ar' ? 'l' : 'r'} border-border-primary z-50 transition-transform duration-300 shadow-2xl ${menuOpen ? 'translate-x-0' : (lang === 'ar' ? 'translate-x-full' : '-translate-x-full')}`}>
        <div className="h-32 bg-bg-tertiary border-b border-border-primary flex flex-col justify-end px-4 py-4 relative">
          <button 
            onClick={() => setMenuOpen(false)}
            className={`absolute top-4 ${lang === 'ar' ? 'left-4' : 'right-4'} p-2 text-text-secondary hover:bg-bg-hover rounded-full transition-colors`}
          >
            <X size={20} />
          </button>
          <div className="w-16 h-16 rounded-full bg-accent-primary flex items-center justify-center text-white text-3xl font-bold uppercase mb-2 shadow-sm overflow-hidden">
            {currentUser?.avatar_url ? (
              <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              currentUser?.username.charAt(0)
            )}
          </div>
          <h2 className="text-lg font-bold text-text-primary truncate">{currentUser?.name || currentUser?.username}</h2>
        </div>
        
        <div className="flex flex-col py-2">
          <button onClick={() => {setIncognitoMode(!incognitoMode); setMenuOpen(false);}} className={`flex items-center gap-4 px-6 py-4 hover:bg-bg-hover text-${lang === 'ar' ? 'right' : 'left'} w-full transition-colors`}>
             <Ghost size={20} className={incognitoMode ? 'text-accent-primary' : 'text-text-secondary'} />
             <div className="flex flex-col items-start flex-1">
               <span className={`text-[15px] font-medium ${incognitoMode ? 'text-accent-primary' : 'text-text-primary'}`}>{t('sidebar.incognito')}</span>
               <span className="text-xs text-text-muted">{t('sidebar.incognito.desc')}</span>
             </div>
             {incognitoMode && <div className="w-2 h-2 rounded-full bg-accent-primary" />}
          </button>
          <button onClick={() => {setShowProfile(true); setMenuOpen(false);}} className={`flex items-center gap-4 px-6 py-4 hover:bg-bg-hover text-${lang === 'ar' ? 'right' : 'left'} w-full transition-colors`}>
             <UserIcon size={20} className="text-text-secondary" />
             <span className="text-[15px] font-medium text-text-primary">{t('sidebar.profile')}</span>
          </button>
          <button onClick={() => {setShowSettings(true); setMenuOpen(false);}} className={`flex items-center gap-4 px-6 py-4 hover:bg-bg-hover text-${lang === 'ar' ? 'right' : 'left'} w-full transition-colors`}>
             <Settings size={20} className="text-text-secondary" />
             <span className="text-[15px] font-medium text-text-primary">{t('sidebar.settings')}</span>
          </button>
          <div className="h-px bg-border-primary my-2 mx-6" />
          <button onClick={handleWipeData} className={`flex items-center gap-4 px-6 py-4 hover:bg-red-500/10 text-${lang === 'ar' ? 'right' : 'left'} w-full transition-colors`}>
             <Trash2 size={20} className="text-red-500" />
             <span className="text-[15px] font-medium text-red-500">{lang === 'ar' ? 'مسح جميع البيانات' : 'Wipe All Data'}</span>
          </button>
          <button onClick={handleLogout} className={`flex items-center gap-4 px-6 py-4 hover:bg-red-500/10 text-${lang === 'ar' ? 'right' : 'left'} w-full transition-colors`}>
             <LogOut size={20} className="text-red-500" />
             <span className="text-[15px] font-medium text-red-500">{t('sidebar.logout')}</span>
          </button>
        </div>
      </div>
      
      {/* Overlay to close menu */}
      {menuOpen && (
        <div 
          onClick={() => setMenuOpen(false)}
          className="absolute inset-0 bg-black/50 z-40 transition-opacity"
        />
      )}

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-secondary w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-full"
            >
              <div className="p-4 border-b border-border-primary flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">{t('sidebar.settings')}</h2>
                <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-bg-hover rounded-full transition-colors text-text-secondary">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto overscroll-none flex-1 flex flex-col gap-6">
                 {/* Theme */}
                 <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">{lang === 'ar' ? 'المظهر' : 'Theme'}</h3>
                    <div className="flex bg-bg-tertiary p-1 rounded-lg">
                       <button 
                          onClick={() => setTheme('light')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'light' ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                       >
                          Light
                       </button>
                       <button 
                          onClick={() => setTheme('dark')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${theme === 'dark' ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                       >
                          Dark
                       </button>
                    </div>
                 </div>

                 {/* Language */}
                 <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider">{lang === 'ar' ? 'اللغة' : 'Language'}</h3>
                    <div className="flex bg-bg-tertiary p-1 rounded-lg">
                       <button 
                          onClick={() => setLanguage('en')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${language === 'en' ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                       >
                          English
                       </button>
                       <button 
                          onClick={() => setLanguage('ar')}
                          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors ${language === 'ar' ? 'bg-bg-secondary text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
                       >
                          العربية
                       </button>
                    </div>
                 </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfile && currentUser && (
          <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-secondary w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-full"
            >
              <div className="p-4 border-b border-border-primary flex items-center justify-between">
                <h2 className="text-xl font-bold text-text-primary">{t('sidebar.profile')}</h2>
                <div className="flex items-center gap-2">
                   {!isEditingProfile ? (
                      <button onClick={() => setIsEditingProfile(true)} className="px-3 py-1.5 text-sm bg-accent-primary text-white rounded-lg hover:bg-opacity-90 transition-colors">
                         Edit
                      </button>
                   ) : (
                      <button onClick={async () => {
                         setUpdatingProfile(true);
                         try {
                           const newUserData = { ...currentUser, name: editName, age: parseInt(editAge) || undefined, country: editCountry, avatar_url: editAvatar };
                           await updateDoc(doc(db, 'users', currentUser.id), newUserData);
                           useStore.getState().setCurrentUser(newUserData, useStore.getState().privateKeyPem!);
                           setIsEditingProfile(false);
                         } catch(e) { console.error(e); }
                         setUpdatingProfile(false);
                      }} disabled={updatingProfile} className="px-3 py-1.5 text-sm bg-accent-primary text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50">
                         {updatingProfile ? 'Saving...' : 'Save'}
                      </button>
                   )}
                   <button onClick={() => { setShowProfile(false); setIsEditingProfile(false); }} className="p-2 hover:bg-bg-hover rounded-full transition-colors text-text-secondary">
                     <X size={20} />
                   </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto overscroll-none flex-1 flex flex-col items-center gap-6">
                 {/* Avatar */}
                 <div className="relative group">
                    <div 
                      onClick={() => {
                        if (isEditingProfile) {
                          avatarInputRef.current?.click();
                        } else if (editAvatar || currentUser.avatar_url) {
                          setSelectedImage(editAvatar || currentUser.avatar_url);
                        }
                      }} 
                      className={`w-32 h-32 rounded-full bg-accent-primary flex items-center justify-center text-5xl text-white font-bold uppercase shadow-md overflow-hidden relative transition-all ${isEditingProfile ? 'cursor-pointer hover:brightness-75' : 'cursor-zoom-in hover:brightness-90'}`}
                    >
                       {editAvatar || currentUser.avatar_url ? (
                         <img src={editAvatar || currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                       ) : (
                         currentUser.name?.charAt(0) || currentUser.username.charAt(0)
                       )}
                       {isEditingProfile && (
                         <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                           <Camera size={20} />
                           <span>{lang === 'ar' ? 'تغيير الصورة' : 'Change Avatar'}</span>
                         </div>
                       )}
                    </div>
                    <input type="file" accept="image/*" className="hidden" ref={avatarInputRef} onChange={handleAvatarChange} />
                 </div>

                 {/* Info */}
                 <div className="w-full flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                       <label className="text-sm font-medium text-text-secondary">Username (Unique ID)</label>
                       <input type="text" disabled value={currentUser.username} className="w-full px-3 py-2.5 bg-bg-tertiary border border-border-primary rounded-lg text-text-muted cursor-not-allowed" />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                       <label className="text-sm font-medium text-text-secondary">Name</label>
                       <input type="text" disabled={!isEditingProfile} value={editName} onChange={(e) => setEditName(e.target.value)} className={`w-full px-3 py-2.5 bg-bg-primary border border-border-primary rounded-lg text-text-primary ${!isEditingProfile && 'opacity-70'} focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all`} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                       <label className="text-sm font-medium text-text-secondary">Age</label>
                       <input type="number" disabled={!isEditingProfile} value={editAge} onChange={(e) => setEditAge(e.target.value)} className={`w-full px-3 py-2.5 bg-bg-primary border border-border-primary rounded-lg text-text-primary ${!isEditingProfile && 'opacity-70'} focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all`} />
                    </div>

                    <div className="flex flex-col gap-1.5">
                       <label className="text-sm font-medium text-text-secondary">Country</label>
                       <input type="text" disabled={!isEditingProfile} value={editCountry} onChange={(e) => setEditCountry(e.target.value)} className={`w-full px-3 py-2.5 bg-bg-primary border border-border-primary rounded-lg text-text-primary ${!isEditingProfile && 'opacity-70'} focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all`} />
                    </div>
                    
                    {isEditingProfile && (
                       <div className="flex flex-col gap-1.5">
                          <label className="text-sm font-medium text-text-secondary">Avatar URL</label>
                          <input type="text" value={editAvatar} onChange={(e) => setEditAvatar(e.target.value)} placeholder="https://example.com/avatar.jpg" className="w-full px-3 py-2.5 bg-bg-primary border border-border-primary rounded-lg text-text-primary focus:border-accent-primary focus:ring-1 focus:ring-accent-primary outline-none transition-all" />
                       </div>
                    )}
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Add Friend Modal */}
      {showAddFriendModal && userToAdd && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[var(--bg-tertiary)] w-full max-w-sm rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden"
          >
            <div className="p-6 flex flex-col items-center text-center gap-4">
              <div className="w-20 h-20 shrink-0 rounded-full bg-accent-primary flex items-center justify-center text-white text-3xl font-bold uppercase shadow-lg overflow-hidden">
                {userToAdd.avatar_url ? (
                  <img src={userToAdd.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  userToAdd.username.charAt(0)
                )}
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">{userToAdd.name || userToAdd.username}</h3>
                <p className="text-text-muted text-sm">@{userToAdd.username}</p>
              </div>
              
              <div className="w-full text-left space-y-2 mt-2">
                <label className="text-xs font-semibold text-text-muted uppercase px-1">
                  {lang === 'ar' ? 'تخصيص اسم (اختياري)' : 'Nickname (Optional)'}
                </label>
                <input 
                  type="text" 
                  value={friendNickname}
                  onChange={(e) => setFriendNickname(e.target.value)}
                  placeholder={lang === 'ar' ? 'أدخل اسم ليظهر لك فقط' : 'Enter a nickname for your view'}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-white outline-none focus:border-[#00a884] transition-all"
                  dir="auto"
                />
              </div>
            </div>

            <div className="p-4 bg-[var(--bg-secondary)] flex gap-3">
              <button 
                onClick={() => { setShowAddFriendModal(false); setUserToAdd(null); }}
                className="flex-1 py-3 rounded-xl bg-[var(--bg-hover)] text-white font-medium hover:bg-[var(--border-primary)] transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button 
                onClick={async () => {
                  addContact(userToAdd.id, friendNickname);
                  if (currentUser) {
                    try {
                      const docRef = doc(db, 'users', currentUser.id);
                      const currentContacts = currentUser.contacts || [];
                      if (!currentContacts.includes(userToAdd.id)) {
                        const newContacts = [...currentContacts, userToAdd.id];
                        await updateDoc(docRef, { contacts: newContacts });
                        useStore.getState().setCurrentUser({ ...currentUser, contacts: newContacts }, useStore.getState().privateKeyPem!);
                      }
                    } catch(e) { console.error("Error updating contacts in db", e); }
                  }
                  useStore.getState().addUser(userToAdd);
                  setActiveChat(userToAdd.id);
                  setShowAddFriendModal(false);
                  setSearchMode(false);
                  setSearchQuery('');
                  setUserToAdd(null);
                }}
                className="flex-1 py-3 rounded-xl bg-[#00a884] text-[var(--bg-primary)] font-bold hover:bg-[#008f6f] transition-all active:scale-95"
              >
                {lang === 'ar' ? 'إضافة' : 'Add Friend'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Chat Requests Modal */}
      <AnimatePresence>
        {showRequests && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-4 border-b border-[var(--border-primary)] flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <UserPlus className="text-[#00a884]" />
                  {lang === 'ar' ? 'طلبات مراسلة جديدة' : 'New Chat Requests'}
                </h2>
                <button onClick={() => setShowRequests(false)} className="p-2 hover:bg-[var(--bg-hover)] rounded-full transition-colors text-[#8696a0]">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-none bg-[var(--bg-secondary)]">
                {requests.length === 0 ? (
                  <div className="p-12 text-center text-[#8696a0]">
                    <Smile className="mx-auto mb-4 opacity-20" size={64} />
                    <p>{lang === 'ar' ? 'لا يوجد طلبات حالياً' : 'No requests at the moment'}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border-primary)]">
                    {requests.map(uid => {
                      const user = users[uid];
                      if (!user) return null;
                      const lastMsg = (messages[uid] || []).slice(-1)[0];
                      
                      return (
                        <div key={uid} className="p-4 flex items-center gap-4 hover:bg-[var(--bg-hover)] transition-colors">
                          <div className="w-12 h-12 rounded-full bg-[#00a884] flex items-center justify-center text-[var(--bg-primary)] font-bold uppercase overflow-hidden shrink-0">
                            {user.avatar_url ? <img src={user.avatar_url} className="w-full h-full object-cover" /> : user.username[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-white truncate">{user.name || user.username}</p>
                            <p className="text-sm text-[#8696a0] truncate italic">"{lastMsg?.content}"</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button 
                              onClick={() => {
                                setUserToAdd(user);
                                setFriendNickname('');
                                setShowAddFriendModal(true);
                                setShowRequests(false);
                              }}
                              className="bg-[#00a884] text-[var(--bg-primary)] px-4 py-1.5 rounded-full text-xs font-bold hover:brightness-110 active:scale-95 transition-all"
                            >
                              {lang === 'ar' ? 'قبول' : 'Accept'}
                            </button>
                            <button 
                              onClick={() => {
                                // Simple ignore: delete messages for this user locally
                                const newMessages = { ...messages };
                                delete newMessages[uid];
                                useStore.setState({ messages: newMessages });
                              }}
                              className="bg-[var(--bg-hover)] text-white px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[var(--border-primary)] active:scale-95 transition-all"
                            >
                              {lang === 'ar' ? 'تجاهل' : 'Ignore'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {requests.length > 0 && (
                <div className="p-3 bg-[var(--bg-primary)] text-center">
                  <p className="text-[11px] text-[#8696a0]">
                    {lang === 'ar' ? 'قبول الطلب سيسمح لهذا الشخص برؤية حالتك وإرسال رسائل إليك.' : 'Accepting will allow them to see your status and message you.'}
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full screen image viewer */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out"
          >
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-3 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-50 backdrop-blur-sm border border-white/10"
            >
              <X size={24} />
            </button>
            
            <motion.img 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              src={selectedImage} 
              alt="High Quality" 
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Image Cropper Modal */}
      <AnimatePresence>
        {cropperImage && (
          <div className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg-secondary w-full max-w-sm rounded-2xl shadow-2xl border border-border-primary overflow-hidden flex flex-col max-h-full"
            >
              <div className="p-4 border-b border-border-primary flex items-center justify-between">
                <h2 className="text-base font-bold text-text-primary">
                  {lang === 'ar' ? 'تعديل وقص صورة البروفايل' : 'Edit & Crop Profile Image'}
                </h2>
                <button 
                  onClick={() => setCropperImage(null)} 
                  className="p-1.5 hover:bg-bg-hover rounded-full transition-colors text-text-secondary"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-6 flex flex-col items-center gap-6 overflow-y-auto overscroll-none">
                {/* Crop Viewport */}
                <div className="relative w-48 h-48 rounded-full border-2 border-dashed border-accent-primary overflow-hidden bg-[var(--bg-secondary)] flex items-center justify-center shadow-inner">
                  {/* Draggable Image inside Circular Frame */}
                  <motion.img 
                    src={cropperImage} 
                    alt="Crop preview" 
                    drag
                    dragMomentum={false}
                    dragElastic={0.1}
                    onDrag={(_, info) => {
                      setCropperPosition(prev => ({
                        x: prev.x + info.delta.x,
                        y: prev.y + info.delta.y
                      }));
                    }}
                    style={{ 
                      scale: cropperScale,
                      x: cropperPosition.x,
                      y: cropperPosition.y
                    }}
                    className="max-w-none cursor-move object-contain select-none pointer-events-auto"
                    draggable="false"
                  />
                </div>
                
                {/* Scale Zoom Controls */}
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-xs text-text-secondary font-medium">
                    <span>{lang === 'ar' ? 'تصغير' : 'Zoom Out'}</span>
                    <span className="text-accent-primary font-bold">{Math.round(cropperScale * 100)}%</span>
                    <span>{lang === 'ar' ? 'تكبير' : 'Zoom In'}</span>
                  </div>
                  <input 
                    type="range" 
                    min="1" 
                    max="3" 
                    step="0.05" 
                    value={cropperScale} 
                    onChange={(e) => setCropperScale(parseFloat(e.target.value))}
                    className="w-full accent-accent-primary cursor-pointer bg-bg-tertiary rounded-lg h-2"
                  />
                  
                  {/* Reset/Control buttons */}
                  <div className="flex justify-center gap-2 pt-2">
                    <button 
                      onClick={() => { setCropperScale(1); setCropperPosition({ x: 0, y: 0 }); }}
                      className="px-3 py-1 text-xs bg-bg-tertiary text-text-secondary rounded-lg hover:text-text-primary transition-colors"
                    >
                      {lang === 'ar' ? 'إعادة ضبط' : 'Reset'}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="p-4 bg-bg-tertiary border-t border-border-primary flex gap-3">
                <button 
                  onClick={() => setCropperImage(null)}
                  className="flex-1 py-2 rounded-xl bg-bg-secondary text-text-secondary font-medium hover:text-text-primary border border-border-primary transition-colors text-sm"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button 
                  onClick={handleCropAvatar}
                  className="flex-1 py-2 rounded-xl bg-accent-primary text-white font-bold hover:brightness-110 active:scale-95 transition-all text-sm"
                >
                  {lang === 'ar' ? 'قص وحفظ' : 'Crop & Apply'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
