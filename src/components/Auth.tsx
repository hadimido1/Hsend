import React, { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { generateKeyPair, exportPublicKey, exportPrivateKey } from '../lib/crypto';
import { ShieldAlert, Loader2, ArrowRight, Camera } from 'lucide-react';
import { googleSignIn, db } from '../lib/firebase';
import { doc, getDoc, setDoc, query, collection, where, getDocs, updateDoc } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';
import { useTranslation } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';

export default function Auth() {
  const { t, lang } = useTranslation();
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  
  // Form steps: 0 = Google login, 1 = Username, 2 = Profile details
  const [step, setStep] = useState(0);
  
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [country, setCountry] = useState('');
  const [avatarBase64, setAvatarBase64] = useState('');
  const [isImageLoading, setIsImageLoading] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const setCurrentUser = useStore(s => s.setCurrentUser);

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn();
      setLoading(true);
      setError('');
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
              avatar_url: existingUser.avatar_url,
              contacts: existingUser.contacts || []
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
  };

  const handleUsernameNext = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      setError(t('username.rules'));
      return;
    }
    setError('');
    setStep(2); // move to profile step
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsImageLoading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawBase64 = event.target?.result as string;
        
        const img = new Image();
        img.onload = () => {
           const canvas = document.createElement('canvas');
           const MAX_WIDTH = 256;
           const MAX_HEIGHT = 256;
           let width = img.width;
           let height = img.height;
           
           if (width > height) {
             if (width > MAX_WIDTH) {
               height *= MAX_WIDTH / width;
               width = MAX_WIDTH;
             }
           } else {
             if (height > MAX_HEIGHT) {
               width *= MAX_HEIGHT / height;
               height = MAX_HEIGHT;
             }
           }
           canvas.width = width;
           canvas.height = height;
           const ctx = canvas.getContext('2d');
           if (ctx) {
             ctx.drawImage(img, 0, 0, width, height);
             const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
             setAvatarBase64(dataUrl);
           } else {
             setAvatarBase64(rawBase64);
           }
           setIsImageLoading(false);
        };
        img.onerror = () => {
          setAvatarBase64(rawBase64);
          setIsImageLoading(false);
        }
        img.src = rawBase64;
      };
      reader.onerror = () => setIsImageLoading(false);
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
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
          contacts: [],
          last_seen: Date.now()
      };
      
      await setDoc(doc(db, 'users', googleUser.uid), newUser);

      setCurrentUser(newUser, privKeyPem);
    } catch (err: any) {
      setError(err.message || t('error.register'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary flex flex-col items-center justify-center p-4 transition-colors duration-300" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full bg-bg-secondary rounded-2xl shadow-xl overflow-hidden border border-border-primary"
      >
        <div className="p-8">
          <motion.div 
            initial={{ y: -10 }}
            animate={{ y: 0 }}
            className="flex justify-center mb-6"
          >
            <div className="w-16 h-16 bg-accent-primary/20 text-accent-primary rounded-full flex items-center justify-center border border-accent-primary/30">
              <ShieldAlert size={32} />
            </div>
          </motion.div>
          
          <h2 className="text-2xl font-semibold text-text-primary text-center mb-2">{t('chat.secure')}</h2>
          <p className="text-text-secondary text-center text-sm mb-8 leading-relaxed">
            {t('chat.secure.desc')}
          </p>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4"
            >
              <p className="text-red-500 text-sm text-center">{error}</p>
            </motion.div>
          )}

          <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div 
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-4"
            >
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3 px-4 bg-white border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-50 rounded-xl font-medium transition-colors flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    {t('login.google')}
                  </>
                )}
              </button>
            </motion.div>
          )}

          {step === 1 && (
            <motion.form 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleUsernameNext} 
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('username.choose')}
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('username.placeholder')}
                  className="w-full px-4 py-3 bg-bg-tertiary border-none rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary transition-shadow"
                  required
                  maxLength={30}
                  dir="ltr"
                />
                <p className="text-xs text-text-muted mt-2">{t('username.rules')}</p>
              </div>
              
              <button
                type="submit"
                disabled={!username.trim()}
                className="w-full py-3 px-4 bg-accent-primary hover:bg-opacity-90 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                {t('btn.continue')} <ArrowRight size={18} className={`transform ${lang === 'ar' ? 'rotate-180' : ''}`} />
              </button>
            </motion.form>
          )}

          {step === 2 && (
            <motion.form 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleRegister} 
              className="space-y-4"
            >
              <div className="flex flex-col items-center mb-6">
                <div className="relative group cursor-pointer">
                  <div className="w-24 h-24 aspect-square shrink-0 rounded-full bg-bg-tertiary border-2 border-dashed border-border-primary flex items-center justify-center overflow-hidden">
                    {isImageLoading ? (
                      <div className="animate-spin w-8 h-8 border-4 border-accent-primary border-t-transparent rounded-full" />
                    ) : avatarBase64 ? (
                      <img src={avatarBase64} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-text-muted" />
                    )}
                  </div>
                  <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <input type="file" accept="image/*" onChange={handleImageChange} disabled={isImageLoading} className="absolute inset-0 opacity-0 cursor-pointer z-10" title=" " />
                </div>
                <span className="text-xs text-text-muted mt-2">صورة الحساب (اختياري)</span>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  {t('profile.name')}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('profile.name.placeholder')}
                  className="w-full px-4 py-3 bg-bg-tertiary border-none rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary transition-shadow"
                  maxLength={50}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('profile.age')}
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder={t('profile.age.placeholder')}
                    className="w-full px-4 py-3 bg-bg-tertiary border-none rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-accent-primary transition-shadow"
                    min={13}
                    max={120}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    {t('profile.country')}
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-3 bg-bg-tertiary border-none rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary transition-shadow appearance-none cursor-pointer"
                  >
                    <option value="">{t('profile.country.select')}</option>
                    <option value="SA">السعودية (SA)</option>
                    <option value="EG">مصر (EG)</option>
                    <option value="AE">الإمارات (AE)</option>
                    <option value="KW">الكويت (KW)</option>
                    <option value="QA">قطر (QA)</option>
                    <option value="BH">البحرين (BH)</option>
                    <option value="OM">عمان (OM)</option>
                    <option value="JO">الأردن (JO)</option>
                    <option value="LB">لبنان (LB)</option>
                    <option value="US">الولايات المتحدة (US)</option>
                    <option value="UK">بريطانيا (UK)</option>
                    <option value="Other">أخرى (Other)</option>
                  </select>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-accent-primary hover:bg-opacity-90 disabled:opacity-50 text-white rounded-xl font-medium transition-colors flex items-center justify-center mt-6 shadow-lg"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : t('btn.create')}
              </button>
              <p className="text-xs text-text-muted text-center mt-4 leading-relaxed">
                {t('register.notice')}
              </p>
            </motion.form>
          )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
