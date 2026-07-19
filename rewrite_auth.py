import re

with open('src/components/Auth.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add firestore imports
code = code.replace("import { googleSignIn } from '../lib/firebase';",
"import { googleSignIn, db } from '../lib/firebase';\nimport { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';")

# Replace handleGoogleLogin
google_login_old = """  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        
        // Check if user already exists
        const userRes = await fetch(`/api/auth/google/${res.user.uid}`);
        if (userRes.ok) {
           const existingUser = await userRes.json();
           
           // Generate new keys for this device
           const keyPair = await generateKeyPair();
           const pubKeyPem = await exportPublicKey(keyPair.publicKey);
           const privKeyPem = await exportPrivateKey(keyPair.privateKey);
           
           // Update user with new public key
           const updateRes = await fetch('/api/register', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                username: existingUser.username,
                publicKey: pubKeyPem,
                googleUid: res.user.uid,
               name: existingUser.name,
               age: existingUser.age,
               country: existingUser.country,
               avatar_url: existingUser.avatar_url
             })
           });
           
           if (!updateRes.ok) {
               throw new Error("Failed to update user keys");
           }
           
           setCurrentUser({
              id: existingUser.id,
              username: existingUser.username,
              public_key: pubKeyPem,
              name: existingUser.name,
              age: existingUser.age,
              country: existingUser.country,
              avatar_url: existingUser.avatar_url
           }, privKeyPem);
           return;
        }
        setStep(1); // Proceed to username
      }
    } catch (err: any) {
      setError(err.message || t('error.login'));
    } finally {
      setLoading(false);
    }
  };"""

google_login_new = """  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await googleSignIn();
      if (res) {
        setGoogleUser(res.user);
        
        const docRef = doc(db, 'users', res.user.uid);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
           const existingUser = docSnap.data();
           
           const keyPair = await generateKeyPair();
           const pubKeyPem = await exportPublicKey(keyPair.publicKey);
           const privKeyPem = await exportPrivateKey(keyPair.privateKey);
           
           await updateDoc(docRef, { public_key: pubKeyPem, last_seen: Date.now() });
           
           setCurrentUser({
              id: res.user.uid,
              username: existingUser.username,
              public_key: pubKeyPem,
              name: existingUser.name,
              age: existingUser.age,
              country: existingUser.country,
              avatar_url: existingUser.avatar_url
           }, privKeyPem);
           return;
        }
        setStep(1); 
      }
    } catch (err: any) {
      setError(err.message || t('error.login'));
    } finally {
      setLoading(false);
    }
  };"""

code = code.replace(google_login_old, google_login_new)

handle_register_old = """  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setLoading(true);
    setError('');
    try {
      const keyPair = await generateKeyPair();
      const pubKeyPem = await exportPublicKey(keyPair.publicKey);
      const privKeyPem = await exportPrivateKey(keyPair.privateKey);

      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          username, 
          publicKey: pubKeyPem, 
          googleUid: googleUser?.uid,
          name,
          age: age ? parseInt(age) : null,
          country,
          avatar_url: avatarBase64
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || t('error.register'));
      }

      const user = await res.json();
      setCurrentUser(user, privKeyPem);
    } catch (err: any) {
      setError(err.message || t('error.register'));
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
