import re

with open('src/components/ChatArea.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

send_old = """  const sendAudioMessage = async (base64Audio: string) => {
    if (!partner || !currentUser || !privateKeyPem) return;
    try {
      const msgId = crypto.randomUUID();
      const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;
      if (partner.id === 'hbot-ai') {
        const msgData = { id: msgId, sender_id: currentUser.id, receiver_id: partner.id, content: base64Audio, type: 'audio', expires_at: expiresAt };
        socket.emit('send_message', msgData);
      } else {
        const partnerPubKey = await importPublicKey(partner.public_key);
        const encryptedForPartner = await encryptMessage(partnerPubKey, base64Audio);
        const myPubKey = await importPublicKey(currentUser.public_key);
        const encryptedForMe = await encryptMessage(myPubKey, base64Audio);
        const msgData = {
          id: msgId, sender_id: currentUser.id, receiver_id: partner.id,
          content: JSON.stringify({ forReceiver: encryptedForPartner, forSender: encryptedForMe }),
          type: 'audio', expires_at: expiresAt
        };
        socket.emit('send_message', msgData);
      }
      addMessage(partner.id, {"""

send_new = """  const sendAudioMessage = async (base64Audio: string) => {
    if (!partner || !currentUser || !privateKeyPem) return;
    try {
      const msgId = crypto.randomUUID();
      const expiresAt = ttl > 0 ? Date.now() + ttl * 60000 : null;
      const chatId = getChatId(currentUser.id, partner.id);
      
      if (partner.id === 'hbot-ai') {
        const msgData = { id: msgId, chatId, sender_id: currentUser.id, receiver_id: partner.id, content: base64Audio, type: 'audio', timestamp: Date.now(), expires_at: expiresAt };
        await setDoc(doc(db, 'messages', msgId), msgData);
        // AI does not support voice processing yet, so return text
        const aiId = crypto.randomUUID();
        const aiMsgData = {
          id: aiId,
          chatId,
          sender_id: 'hbot-ai',
          receiver_id: currentUser.id,
          content: "Sorry, I cannot process audio messages yet.", 
          type: 'text',
          timestamp: Date.now(),
          expires_at: expiresAt
        };
        await setDoc(doc(db, 'messages', aiId), aiMsgData);
      } else {
        const partnerPubKey = await importPublicKey(partner.public_key);
        const encryptedForPartner = await encryptMessage(partnerPubKey, base64Audio);
        const myPubKey = await importPublicKey(currentUser.public_key);
        const encryptedForMe = await encryptMessage(myPubKey, base64Audio);
        const msgData = {
          id: msgId, chatId, sender_id: currentUser.id, receiver_id: partner.id,
          content: JSON.stringify({ forReceiver: encryptedForPartner, forSender: encryptedForMe }),
          type: 'audio', timestamp: Date.now(), expires_at: expiresAt
        };
        await setDoc(doc(db, 'messages', msgId), msgData);
      }
      addMessage(partner.id, {"""
      
code = code.replace(send_old, send_new)

with open('src/components/ChatArea.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
