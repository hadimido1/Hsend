import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAeKEusFY1tMW2aG-H6ARLcCVgDvM2C53g",
  authDomain: "hsend-b74f2.firebaseapp.com",
  projectId: "hsend-b74f2",
  storageBucket: "hsend-b74f2.firebasestorage.app",
  messagingSenderId: "242682879423",
  appId: "1:242682879423:web:019172f4d32630dea8550a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  try {
    const querySnapshot = await getDocs(collection(db, "users"));
    console.log("Users count:", querySnapshot.size);
    // try deleting one
    // if (querySnapshot.docs.length > 0) {
    //   await deleteDoc(doc(db, "users", querySnapshot.docs[0].id));
    //   console.log("Deleted successfully");
    // }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
check();
