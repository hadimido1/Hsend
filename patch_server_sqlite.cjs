const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(/insertMessage\.run\([\s\S]*?\);/g, '// insertMessage removed');
fs.writeFileSync('server.ts', code);
