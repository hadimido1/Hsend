const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace('res.status(500).json({ error: "Deprecated" });\n    }\n  });', 'res.status(500).json({ error: "Deprecated" });\n  });');
fs.writeFileSync('server.ts', code);
