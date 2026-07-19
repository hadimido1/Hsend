import re

with open('src/lib/firebase.ts', 'r', encoding='utf-8') as f:
    code = f.read()

config_old = """const firebaseConfig = {
  apiKey: "AIzaSyAeKEusFY1tMW2aG-H6ARLcCVgDvM2C53g",
  authDomain: "hsend-b74f2.firebaseapp.com",
  projectId: "hsend-b74f2",
  storageBucket: "hsend-b74f2.firebasestorage.app",
  messagingSenderId: "242682879423",
  appId: "1:242682879423:web:019172f4d32630dea8550a",
  measurementId: "G-W1P3GR84JB"
};"""

config_new = """import firebaseConfigData from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigData.apiKey,
  authDomain: firebaseConfigData.authDomain,
  projectId: firebaseConfigData.projectId,
  storageBucket: firebaseConfigData.storageBucket,
  messagingSenderId: firebaseConfigData.messagingSenderId,
  appId: firebaseConfigData.appId
};"""

code = code.replace(config_old, config_new)

with open('src/lib/firebase.ts', 'w', encoding='utf-8') as f:
    f.write(code)
