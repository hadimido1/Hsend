import re

with open('src/components/Auth.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add missing firestore imports if they are not there
if "doc," not in code:
    code = code.replace("import { googleSignIn } from '../lib/firebase';",
    "import { googleSignIn, db } from '../lib/firebase';\nimport { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';")

# Find handleGoogleLogin and replace it
match = re.search(r"  const handleGoogleLogin = async \(\) => \{.*?setLoading\(false\);\s*\}\s*\};", code, re.DOTALL)
if match:
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
    code = code[:match.start()] + google_login_new + code[match.end():]

with open('src/components/Auth.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
