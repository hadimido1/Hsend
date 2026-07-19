/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from './lib/store';
import { socket } from './lib/socket';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import CallOverlay from './components/CallOverlay';
import { initAuth, logoutGoogle } from './lib/firebase';
import { useTranslation } from './lib/i18n';

import { collection, query, where, onSnapshot, getDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, messaging } from './lib/firebase';
import { getToken } from 'firebase/messaging';
import { importPrivateKey, decryptMessage } from './lib/crypto';
import { Message } from './lib/store';
import { playSound } from './lib/sounds';

export default function App() {
  const currentUser = useStore(state => state.currentUser);
  const activeChat = useStore(state => state.activeChat);
  const privateKeyPem = useStore(state => state.privateKeyPem);
  const { addUser, addMessage, users } = useStore();
  const { lang } = useTranslation();
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (!hash || hash === '') {
        if (useStore.getState().activeChat) {
           useStore.getState().setActiveChat(null);
        }
      }
    };
    window.addEventListener('hashchange', handleHash);
    
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
     if (activeChat && window.location.hash !== '#chat') {
        window.history.pushState(null, '', '#chat');
     } else if (!activeChat && window.location.hash === '#chat') {
        window.history.back();
     }
  }, [activeChat]);

  useEffect(() => {
    if (currentUser && privateKeyPem) {
      // Global listener for messages where the current user is the receiver
      const q = query(
        collection(db, 'messages'), 
        where('receiver_id', '==', currentUser.id)
      );
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const privKey = await importPrivateKey(privateKeyPem);
        
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const data = change.doc.data() as any;
            if (data.status === 'read') return;

            if (data.type === 'call_signal') {
              deleteDoc(change.doc.ref).catch(() => {});
              window.dispatchEvent(new CustomEvent('call_signal_received', { detail: data }));
              return;
            }

            const partnerId = data.sender_id;
            if (useStore.getState().blocked.includes(partnerId)) return;
            
            // Skip if it's already in the active chat (handled by ChatArea)
            const currentActiveChat = useStore.getState().activeChat;
            if (partnerId === currentActiveChat) return;

            // Fetch user info if missing
            const currentUsers = useStore.getState().users;
            if (!currentUsers[partnerId]) {
              try {
                const userDoc = await getDoc(doc(db, 'users', partnerId));
                if (userDoc.exists()) {
                  useStore.getState().addUser(userDoc.data() as any);
                }
              } catch (e) { console.error("Error fetching sender info:", e); }
            }

            // Decrypt and add message to store
            try {
              let encryptedContent = data.content;
              try {
                const parsed = JSON.parse(data.content);
                if (parsed.forReceiver) encryptedContent = parsed.forReceiver;
              } catch (e) {}
              
              const content = await decryptMessage(privKey, encryptedContent);
              
              let ts = Date.now();
              if (data.timestamp) {
                if (typeof data.timestamp === 'number') ts = data.timestamp;
                else if (typeof data.timestamp.toMillis === 'function') ts = data.timestamp.toMillis();
              }
              
              addMessage(partnerId, { ...data, content, timestamp: ts });
              
              if (data.sender_id !== currentUser?.id) {
                const prefs = useStore.getState().friendPreferences[partnerId];
                playSound('receive', prefs?.notificationSound);
              }
              
              // Automatically add back to main list (home screen) on received message
              if (currentUser && partnerId !== 'hbot-ai') {
                const activeContacts = currentUser.contacts || [];
                if (!activeContacts.includes(partnerId)) {
                  const newContacts = [...activeContacts, partnerId];
                  updateDoc(doc(db, 'users', currentUser.id), { contacts: newContacts }).catch(console.error);
                }
              }
            } catch (e) {
              console.error("Global listener failed to decrypt", e);
            }
          }
        });
      });
      
      return () => unsubscribe();
    }
  }, [currentUser, privateKeyPem]);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Initialize Firebase Auth listener
    const unsubscribe = initAuth(
      (user) => {
        // We will handle successful Google auth in the Auth component, 
        // but this keeps token fresh if needed.
      },
      () => {
        // Logged out of Google
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const unsubscribe = onSnapshot(doc(db, 'users', currentUser.id), (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as any;
          const state = useStore.getState();
          state.setCurrentUser({ ...state.currentUser, ...userData }, state.privateKeyPem!);
        } else {
          console.log("User record not found in Firestore. Logging out...");
          logoutGoogle().then(() => {
             useStore.getState().logout();
          });
        }
      }, (err) => {
         console.error("Error listening to user document:", err);
      });

      // Request push notifications token
        if (messaging && typeof window !== 'undefined' && 'Notification' in window) {
          Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
              getToken(messaging, { vapidKey: 'BOGUS_OR_OMITTED_VAPID_IF_NOT_CONFIGURED_BUT_IT_WORKS_ON_ANDROID' })
                .then((currentToken) => {
                  if (currentToken) {
                     updateDoc(doc(db, 'users', currentUser.id), { fcmToken: currentToken }).catch(console.error);
                  }
                }).catch(console.error);
            }
          });
        }

      socket.connect();
      const onConnect = () => socket.emit("auth", currentUser.id);
      socket.on('connect', onConnect);
      if (socket.connected) socket.emit("auth", currentUser.id);
      
      return () => {
        unsubscribe();
        socket.off('connect', onConnect);
        socket.disconnect();
      };
    } else {
      socket.disconnect();
    }
  }, [currentUser?.id]);

  if (!currentUser) {
    return <Auth />;
  }


  return (
    <div className="flex h-screen w-full bg-bg-primary text-text-primary overflow-hidden font-sans relative transition-colors duration-300" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <AnimatePresence initial={false}>
         {!isMobile ? (
            <>
               <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 h-full flex z-20 border-r border-border-primary">
                 <Sidebar />
               </div>
               <div className="flex-1 h-full min-w-0 flex relative">
                 <ChatArea />
               </div>
            </>
         ) : (
            <>
               {!activeChat && (
                  <motion.div 
                     key="sidebar"
                     initial={{ x: lang === 'ar' ? 50 : -50, opacity: 0 }}
                     animate={{ x: 0, opacity: 1 }}
                     exit={{ x: lang === 'ar' ? 50 : -50, opacity: 0 }}
                     transition={{ duration: 0.2, ease: "easeOut" }}
                     className="w-full h-full flex absolute inset-0 z-10"
                  >
                     <Sidebar />
                  </motion.div>
               )}
               {activeChat && (
                  <motion.div 
                     key="chat"
                     initial={{ x: lang === 'ar' ? -50 : 50, opacity: 0 }}
                     animate={{ x: 0, opacity: 1 }}
                     exit={{ x: lang === 'ar' ? -50 : 50, opacity: 0 }}
                     transition={{ duration: 0.2, ease: "easeOut" }}
                     className="w-full h-full flex absolute inset-0 z-20 bg-bg-primary"
                  >
                     <ChatArea />
                  </motion.div>
               )}
            </>
         )}
      </AnimatePresence>
      <CallOverlay />
    </div>
  );
}

