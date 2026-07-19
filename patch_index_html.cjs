const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(/html, body \{\n  -webkit-user-select: none;\n  user-select: none;\n  \}/, `html, body {
  -webkit-user-select: none;
  user-select: none;
  overscroll-behavior: none;
  touch-action: pan-x pan-y;
}`);

fs.writeFileSync('src/index.css', code);
