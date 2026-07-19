import re

with open('src/components/ChatArea.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("import { socket } from '../lib/socket';",
"import { socket } from '../lib/socket';\nimport { collection, query, where, orderBy, onSnapshot, setDoc, doc } from 'firebase/firestore';\nimport { db } from '../lib/firebase';")

helper = """const getChatId = (user1: string, user2: string) => {
    return user1 < user2 ? `${user1}_${user2}` : `${user2}_${user1}`;
};"""
code = code.replace("export default function ChatArea() {", helper + "\nexport default function ChatArea() {")

effect_old = """  useEffect(() => {
    if (activeChat && currentUser && privateKeyPem) {
      // Fetch messages on mount
      fetch(`/api/messages/${currentUser.id}/${activeChat}`)
        .then(res => res.json())
        .then(async (data: any[]) => {
          if (activeChat === 'hbot-ai') { 
             // For HBOT, messages are not encrypted
             setMessages(activeChat, data);
             return;
          }
          const privKey = await importPrivateKey(privateKeyPem);
          const decryptedMsgs: Message[] = [];
          
          for (const msg of data) {
             try {
               let encryptedContent = msg.content;
               try {
                 const parsed = JSON.parse(msg.content);
                 if (parsed.forReceiver && parsed.forSender) {
                   encryptedContent = msg.sender_id === currentUser.id ? parsed.forSender : parsed.forReceiver;
                 }
               } catch (e) {
                 // Ignore
               }
               
               const content = await decryptMessage(privKey, encryptedContent);
               decryptedMsgs.push({ ...msg, content });
             } catch (e) {
               console.error("Failed to decrypt old msg", e);
             }
          }
          setMessages(activeChat, decryptedMsgs);
        });
    }
  }, [activeChat, currentUser, privateKeyPem]);"""

effect_new = """  useEffect(() => {
    if (activeChat && currentUser && privateKeyPem) {
      const chatId = getChatId(currentUser.id, activeChat);
      const q = query(collection(db, 'messages'), where('chatId', '==', chatId), orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
          if (activeChat === 'hbot-ai') {
              const msgs = snapshot.docs.map(d => d.data());
              setMessages(activeChat, msgs as any);
              return;
          }
          
          const privKey = await importPrivateKey(privateKeyPem);
          const decryptedMsgs: Message[] = [];
          
          for (const docSnap of snapshot.docs) {
             const msg = docSnap.data() as any;
             try {
               let encryptedContent = msg.content;
               try {
                 const parsed = JSON.parse(msg.content);
                 if (parsed.forReceiver && parsed.forSender) {
                   encryptedContent = msg.sender_id === currentUser.id ? parsed.forSender : parsed.forReceiver;
                 }
               } catch (e) {}
                              
               const content = await decryptMessage(privKey, encryptedContent);
               decryptedMsgs.push({ ...msg, content });
             } catch (e) {
               console.error("Failed to decrypt msg", e);
             }
          }
          setMessages(activeChat, decryptedMsgs);
      });
      return () => unsubscribe();
    }
  }, [activeChat, currentUser, privateKeyPem]);"""
  
code = code.replace(effect_old, effect_new)

send_old = """  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !partner || !currentUser || !privateKeyPem) return;
    
    const plainText = inputText.trim();
    setInputText('');
    
    try {
      const msgId = crypto.randomUUID();
      const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;
      if (partner.id === 'hbot-ai') {
        // AI messages are not E2E encrypted because server needs to read them
        const msgData = {
          id: msgId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: plainText, 
          type: 'text',
          expires_at: expiresAt
        };
        socket.emit('send_message', msgData);
      } else {
        const partnerPubKey = await importPublicKey(partner.public_key);
        const encryptedForPartner = await encryptMessage(partnerPubKey, plainText);
        
        const myPubKey = await importPublicKey(currentUser.public_key);
        const encryptedForMe = await encryptMessage(myPubKey, plainText);
        
        const msgData = {
          id: msgId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: JSON.stringify({
            forReceiver: encryptedForPartner,
            forSender: encryptedForMe
          }), 
          type: 'text',
          expires_at: expiresAt
        };
        
        socket.emit('send_message', msgData);
      }
    } catch (e) {
      console.error(e);
    }
  };"""

send_new = """  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !partner || !currentUser || !privateKeyPem) return;
    
    const plainText = inputText.trim();
    setInputText('');
    
    try {
      const msgId = crypto.randomUUID();
      const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;
      const chatId = getChatId(currentUser.id, partner.id);
      
      if (partner.id === 'hbot-ai') {
        const msgData = {
          id: msgId,
          chatId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: plainText, 
          type: 'text',
          timestamp: Date.now(),
          expires_at: expiresAt
        };
        await setDoc(doc(db, 'messages', msgId), msgData);
        
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: plainText })
        });
        const data = await res.json();
        const aiId = crypto.randomUUID();
        const aiMsgData = {
          id: aiId,
          chatId,
          sender_id: 'hbot-ai',
          receiver_id: currentUser.id,
          content: data.text, 
          type: 'ai',
          timestamp: Date.now(),
          expires_at: expiresAt
        };
        await setDoc(doc(db, 'messages', aiId), aiMsgData);
      } else {
        const partnerPubKey = await importPublicKey(partner.public_key);
        const encryptedForPartner = await encryptMessage(partnerPubKey, plainText);
        
        const myPubKey = await importPublicKey(currentUser.public_key);
        const encryptedForMe = await encryptMessage(myPubKey, plainText);
        
        const msgData = {
          id: msgId,
          chatId,
          sender_id: currentUser.id,
          receiver_id: partner.id,
          content: JSON.stringify({
            forReceiver: encryptedForPartner,
            forSender: encryptedForMe
          }), 
          type: 'text',
          timestamp: Date.now(),
          expires_at: expiresAt
        };
        
        await setDoc(doc(db, 'messages', msgId), msgData);
      }
    } catch (e) {
      console.error(e);
    }
  };"""

code = code.replace(send_old, send_new)

with open('src/components/ChatArea.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
