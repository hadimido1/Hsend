import re

with open('src/components/Auth.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace("avatar_url: existingUser.avatar_url", "avatar_url: existingUser.avatar_url,\n              contacts: existingUser.contacts || []")
code = code.replace("avatar_url: avatarBase64,", "avatar_url: avatarBase64,\n          contacts: [],")

with open('src/components/Auth.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
