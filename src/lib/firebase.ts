import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyAeKEusFY1tMW2aG-H6ARLcCVgDvM2C53g",
  authDomain: "hsend-b74f2.firebaseapp.com",
  projectId: "hsend-b74f2",
  storageBucket: "hsend-b74f2.firebasestorage.app",
  messagingSenderId: "242682879423",
  appId: "1:242682879423:web:019172f4d32630dea8550a",
  measurementId: "G-W1P3GR84JB"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
provider.addScope('openid');
provider.addScope('email');
provider.addScope('profile');

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken && !credential?.idToken) {
      // Sometime we just use the ID token if accessToken isn't available
    }
    cachedAccessToken = credential?.accessToken || await result.user.getIdToken();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    if (error.code === 'auth/popup-blocked') {
      throw new Error('تم حظر النافذة المنبثقة. يرجى فتح التطبيق في علامة تبويب جديدة (اضغط على زر السهم في أعلى يمين الشاشة) أو السماح بالنوافذ المنبثقة.');
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && auth.currentUser) {
     cachedAccessToken = await auth.currentUser.getIdToken();
  }
  return cachedAccessToken;
};

export const logoutGoogle = async () => {
  await auth.signOut();
  cachedAccessToken = null;
};

export const db = getFirestore(app);

if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
    } else if (err.code == 'unimplemented') {
      console.warn('The current browser does not support persistence');
    }
  });
}

export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

