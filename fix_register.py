import re

with open('src/components/Auth.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

match = re.search(r"  const handleRegister = async \(e: React.FormEvent\) => \{.*?setCurrentUser\(userData, privKeyPem\);\s*\} catch \(err: any\) \{.*?\}\s*\};", code, re.DOTALL)
if match:
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
    code = code[:match.start()] + handle_register_new + code[match.end():]

with open('src/components/Auth.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
