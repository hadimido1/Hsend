import re

with open('src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Add firestore imports
code = code.replace("import { logoutGoogle } from '../lib/firebase';",
"import { logoutGoogle, db } from '../lib/firebase';\nimport { collection, query, where, limit, getDocs, updateDoc, doc, onSnapshot } from 'firebase/firestore';")

search_old = """    const timeout = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&exclude=${currentUser?.username}`)
        .then(res => res.json())
        .then(data => setSearchResults(data))
        .catch(console.error);
    }, 300);
    
    return () => clearTimeout(timeout);"""

search_new = """    let unsubscribe: (() => void) | undefined;
    const timeout = setTimeout(() => {
      try {
        const q = query(
          collection(db, 'users'), 
          where('username', '>=', searchQuery), 
          where('username', '<=', searchQuery + '\\uf8ff'), 
          limit(20)
        );
        unsubscribe = onSnapshot(q, (querySnapshot) => {
           const results: User[] = [];
           querySnapshot.forEach((docSnap) => {
             const data = docSnap.data() as User;
             if (data.username !== currentUser?.username) {
               results.push(data);
             }
           });
           setSearchResults(results);
        });
      } catch (err) {
        console.error(err);
      }
    }, 300);
    
    return () => {
      clearTimeout(timeout);
      if (unsubscribe) unsubscribe();
    };"""

code = code.replace(search_old, search_new)

update_old = """      const res = await fetch(`/api/users/${currentUser.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          age: parseInt(editAge) || null,
          country: editCountry,
          avatar_url: editAvatar || null
        })
      });
      if (res.ok) {"""

update_new = """      const docRef = doc(db, 'users', currentUser.id);
      await updateDoc(docRef, {
          name: editName,
          age: parseInt(editAge) || null,
          country: editCountry,
          avatar_url: editAvatar || null
      });
      if (true) {"""

code = code.replace(update_old, update_new)

with open('src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
