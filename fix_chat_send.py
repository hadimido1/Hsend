import re

with open('src/components/ChatArea.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

match = re.search(r"  const handleSend = async \(e: React.FormEvent\) => \{.*?  \};", code, re.DOTALL)
if match:
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
    code = code[:match.start()] + send_new + code[match.end():]

with open('src/components/ChatArea.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
