import re

with open('src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

pin_old = """  const pinUser = (user: User) => {
    useStore.getState().addUser(user);
    setActiveChat(user.id);
    setSearchMode(false);
    setSearchQuery('');
  };"""

pin_new = """  const pinUser = async (user: User) => {
    useStore.getState().addUser(user);
    setActiveChat(user.id);
    setSearchMode(false);
    setSearchQuery('');
    
    if (currentUser) {
       try {
         const docRef = doc(db, 'users', currentUser.id);
         const currentContacts = currentUser.contacts || [];
         if (!currentContacts.includes(user.id)) {
            const newContacts = [...currentContacts, user.id];
            await updateDoc(docRef, { contacts: newContacts });
            useStore.getState().setCurrentUser({ ...currentUser, contacts: newContacts }, useStore.getState().privateKeyPem!);
         }
       } catch (e) { console.error(e); }
    }
  };"""

code = code.replace(pin_old, pin_new)

effect_old = """  const pinnedUsers = Object.values(users);

  useEffect(() => {"""

effect_new = """  const pinnedUsers = Object.values(users);

  useEffect(() => {
    if (currentUser && currentUser.contacts && currentUser.contacts.length > 0) {
       // Fetch contacts from firestore to keep them fresh
       const fetchContacts = async () => {
          for (const cid of currentUser.contacts!) {
             if (!users[cid] && cid !== 'hbot-ai') {
                try {
                  const docSnap = await getDoc(doc(db, 'users', cid));
                  if (docSnap.exists()) {
                     useStore.getState().addUser(docSnap.data() as User);
                  }
                } catch (e) {}
             }
          }
       };
       fetchContacts();
    }
  }, [currentUser?.contacts]);

  useEffect(() => {"""

code = code.replace(effect_old, effect_new)

code = code.replace("import { collection, query, where, limit, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore';", "import { collection, query, where, limit, getDocs, updateDoc, doc, onSnapshot, getDoc } from 'firebase/firestore';")

with open('src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
