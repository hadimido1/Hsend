import re

with open('src/components/ChatArea.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

match = re.search(r"  useEffect\(\(\) => \{\s+if \(activeChat && currentUser && privateKeyPem\) \{.*?\}\s*\}, \[activeChat, currentUser, privateKeyPem\]\);", code, re.DOTALL)
if match:
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
    code = code[:match.start()] + effect_new + code[match.end():]

with open('src/components/ChatArea.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
