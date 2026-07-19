const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(/import Database from "better-sqlite3";/g, '');
code = code.replace(/\/\/ Initialize SQLite database[\s\S]*?(?=async function startServer)/, '');
fs.writeFileSync('server.ts', code);
