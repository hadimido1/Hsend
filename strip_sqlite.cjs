const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(/import Database from "better-sqlite3";/g, '');
code = code.replace(/\/\/ Initialize SQLite database[\s\S]*?(?=async function startServer)/, '');

// Also remove insertMessage and getUser references in startServer since they are removed
code = code.replace(/try {\s*const existing = getUser\.get[\s\S]*?\} catch \(error: any\) \{[\s\S]*?\}/, 'res.status(500).json({ error: "Deprecated" });');
code = code.replace(/app\.get\("\/api\/auth\/google[\s\S]*?(?=app\.post\("\/api\/users)/, '');
code = code.replace(/app\.get\("\/api\/messages[\s\S]*?(?=app\.post\("\/api\/chat)/, '');

fs.writeFileSync('server.ts', code);
