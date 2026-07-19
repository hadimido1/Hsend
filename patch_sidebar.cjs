const fs = require('fs');

let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

// Insert new state
if (!code.includes('isEditingProfile')) {
  code = code.replace(
    'const [viewProfile, setViewProfile] = useState(false);',
    'const [viewProfile, setViewProfile] = useState(false);\n  const [isEditingProfile, setIsEditingProfile] = useState(false);\n  const [editName, setEditName] = useState(currentUser?.name || \'\');\n  const [editAge, setEditAge] = useState(currentUser?.age?.toString() || \'\');\n  const [editCountry, setEditCountry] = useState(currentUser?.country || \'\');\n  const [editAvatar, setEditAvatar] = useState(currentUser?.avatar_url || \'\');\n  const [updatingProfile, setUpdatingProfile] = useState(false);\n\n  const handleUpdateProfile = async (e) => {\n    e.preventDefault();\n    if (!currentUser) return;\n    setUpdatingProfile(true);\n    try {\n      const res = await fetch(`/api/users/${currentUser.id}/update`, {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({\n          name: editName,\n          age: parseInt(editAge) || null,\n          country: editCountry,\n          avatar_url: editAvatar || null\n        })\n      });\n      if (res.ok) {\n        useStore.getState().setCurrentUser({ ...currentUser, name: editName, age: parseInt(editAge) || null, country: editCountry, avatar_url: editAvatar || null }, useStore.getState().privateKeyPem);\n        setIsEditingProfile(false);\n      }\n    } catch(err) {}\n    setUpdatingProfile(false);\n  };\n\n  const handleAvatarChange = (e) => {\n    const file = e.target.files?.[0];\n    if (file) {\n      const reader = new FileReader();\n      reader.onload = (event) => {\n        const img = new Image();\n        img.onload = () => {\n           const canvas = document.createElement(\'canvas\');\n           const MAX_WIDTH = 256; const MAX_HEIGHT = 256;\n           let width = img.width; let height = img.height;\n           if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }\n           canvas.width = width; canvas.height = height;\n           const ctx = canvas.getContext(\'2d\');\n           ctx?.drawImage(img, 0, 0, width, height);\n           setEditAvatar(canvas.toDataURL(\'image/jpeg\', 0.7));\n        };\n        img.src = event.target?.result;\n      };\n      reader.readAsDataURL(file);\n    }\n  };'
  );
}

const profileView = `
           <div className="flex-1 flex flex-col items-center pt-10 px-4 text-center">
              <div className="w-32 h-32 rounded-full bg-accent-primary flex items-center justify-center text-white text-5xl font-bold uppercase mb-4 shadow-lg overflow-hidden border-4 border-bg-secondary">
                {currentUser?.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  currentUser?.username.charAt(0)
                )}
              </div>
              <h2 className="text-2xl font-bold text-text-primary mb-1">{currentUser?.name || currentUser?.username}</h2>
              <p className="text-text-muted text-sm mb-6">@{currentUser?.username}</p>
              
              <div className="w-full bg-bg-tertiary rounded-xl border border-border-primary overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border-primary">
                  <span className="text-text-secondary font-medium">{t('profile.country')}</span>
                  <span className="text-text-primary">{currentUser?.country || 'غير محدد'}</span>
                </div>
                <div className="flex items-center justify-between p-4 border-b border-border-primary">
                  <span className="text-text-secondary font-medium">{t('profile.age')}</span>
                  <span className="text-text-primary">{currentUser?.age ? currentUser.age : 'غير محدد'}</span>
                </div>
                <div className="flex flex-col items-start p-4">
                  <span className="text-text-secondary font-medium mb-1">المفتاح العام (E2EE)</span>
                  <span className="text-text-primary text-xs font-mono break-all text-left bg-bg-secondary p-2 rounded w-full" dir="ltr">
                    {currentUser?.public_key.slice(0, 80)}...
                  </span>
                </div>
              </div>
           </div>`;

const newProfileView = `
           <div className="flex-1 flex flex-col items-center py-6 px-4 text-center overflow-y-auto w-full">
             {isEditingProfile ? (
               <form onSubmit={handleUpdateProfile} className="w-full flex flex-col items-center">
                  <div className="relative group cursor-pointer mb-6">
                    <div className="w-32 h-32 rounded-full bg-bg-tertiary border-2 border-dashed border-border-primary flex items-center justify-center overflow-hidden">
                      {editAvatar ? (
                        <img src={editAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <Camera className="w-10 h-10 text-text-muted" />
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleAvatarChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  
                  <div className="w-full space-y-4 text-right">
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">الاسم</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-4 py-2 bg-bg-tertiary border-none rounded-xl text-text-primary" />
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">العمر</label>
                      <input type="number" value={editAge} onChange={e => setEditAge(e.target.value)} className="w-full px-4 py-2 bg-bg-tertiary border-none rounded-xl text-text-primary" />
                    </div>
                    <div>
                      <label className="block text-sm text-text-secondary mb-1">البلد</label>
                      <select value={editCountry} onChange={e => setEditCountry(e.target.value)} className="w-full px-4 py-2 bg-bg-tertiary border-none rounded-xl text-text-primary">
                        <option value="">غير محدد</option>
                        <option value="SY">سوريا (SY)</option>
                        <option value="EG">مصر (EG)</option>
                        <option value="SA">السعودية (SA)</option>
                        <option value="AE">الإمارات (AE)</option>
                        <option value="LB">لبنان (LB)</option>
                        <option value="US">الولايات المتحدة (US)</option>
                        <option value="UK">بريطانيا (UK)</option>
                        <option value="Other">أخرى</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 w-full mt-6">
                    <button type="submit" disabled={updatingProfile} className="flex-1 py-3 bg-accent-primary text-white rounded-xl font-medium">حفظ</button>
                    <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 py-3 bg-bg-tertiary text-text-primary rounded-xl font-medium">إلغاء</button>
                  </div>
               </form>
             ) : (
               <>
                  <div className="w-32 h-32 rounded-full bg-accent-primary flex items-center justify-center text-white text-5xl font-bold uppercase mb-4 shadow-lg overflow-hidden border-4 border-bg-secondary relative group">
                    {currentUser?.avatar_url ? (
                      <img src={currentUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      currentUser?.username.charAt(0)
                    )}
                    <div onClick={() => setIsEditingProfile(true)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                       <Camera className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-text-primary mb-1">{currentUser?.name || currentUser?.username}</h2>
                  <p className="text-text-muted text-sm mb-4">@{currentUser?.username}</p>
                  
                  <button onClick={() => setIsEditingProfile(true)} className="mb-6 px-6 py-2 bg-bg-tertiary border border-border-primary rounded-full text-text-primary text-sm font-medium hover:bg-bg-hover transition-colors">
                    تعديل الملف الشخصي
                  </button>
                  
                  <div className="w-full bg-bg-tertiary rounded-xl border border-border-primary overflow-hidden text-right">
                    <div className="flex items-center justify-between p-4 border-b border-border-primary">
                      <span className="text-text-secondary font-medium">البلد</span>
                      <span className="text-text-primary">{currentUser?.country || 'غير محدد'}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b border-border-primary">
                      <span className="text-text-secondary font-medium">العمر</span>
                      <span className="text-text-primary">{currentUser?.age ? currentUser.age : 'غير محدد'}</span>
                    </div>
                    <div className="flex flex-col items-start p-4">
                      <span className="text-text-secondary font-medium mb-1">المفتاح العام (E2EE)</span>
                      <span className="text-text-primary text-xs font-mono break-all text-left bg-bg-secondary p-2 rounded w-full" dir="ltr">
                        {currentUser?.public_key.slice(0, 80)}...
                      </span>
                    </div>
                  </div>
               </>
             )}
           </div>`;

code = code.replace(profileView, newProfileView);
fs.writeFileSync('src/components/Sidebar.tsx', code);
