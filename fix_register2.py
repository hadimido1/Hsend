import re

with open('src/components/Auth.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

handle_register_old = """  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !googleUser) return;
    
    setLoading(true);
    setError('');
    
    try {
      // 1. Generate keys
      const keyPair = await generateKeyPair();
      const pubKeyPem = await exportPublicKey(keyPair.publicKey);
      const privKeyPem = await exportPrivateKey(keyPair.privateKey);
      
      // 2. Register on server
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
           username, 
           publicKey: pubKeyPem, 
           googleUid: googleUser.uid,
          name,
          age: parseInt(age) || null,
          country,
          avatar_url: avatarBase64 || null
        })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registration failed');
      }
      
      const userData = await res.json();
      
      // 3. Save to store
      setCurrentUser({
        id: userData.id,
        username: userData.username,
        public_key: pubKeyPem,
        name: userData.name,
        age: userData.age,
        country: userData.country,
        avatar_url: userData.avatar_url
      }, privKeyPem);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };"""

handle_register_new = """  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !googleUser) return;
    
    setLoading(true);
    setError('');
    try {
      const q = query(collection(db, 'users'), where('username', '==', username));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        throw new Error(t('error.register') + ": Username taken");
      }

      const keyPair = await generateKeyPair();
      const pubKeyPem = await exportPublicKey(keyPair.publicKey);
      const privKeyPem = await exportPrivateKey(keyPair.privateKey);

      const newUser = {
          id: googleUser.uid,
          username,
          public_key: pubKeyPem,
          name,
          age: age ? parseInt(age) : null,
          country,
          avatar_url: avatarBase64,
          last_seen: Date.now()
      };
      
      await setDoc(doc(db, 'users', googleUser.uid), newUser);

      setCurrentUser(newUser, privKeyPem);
    } catch (err: any) {
      setError(err.message || t('error.register'));
    } finally {
      setLoading(false);
    }
  };"""

code = code.replace(handle_register_old, handle_register_new)

with open('src/components/Auth.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
