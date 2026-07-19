const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(/html, body \{\n  -webkit-user-select: none;\n  user-select: none;\n\}/g, `html, body {
  -webkit-user-select: none;
  user-select: none;
  overscroll-behavior-y: none;
}`);

code = code.replace(/\.overflow-y-auto \{\n  transform: translateZ\(0\);\n  will-change: scroll-position;\n\}/g, `.overflow-y-auto {
  transform: translateZ(0);
  will-change: scroll-position;
  overscroll-behavior-y: auto;
}`);

fs.writeFileSync('src/index.css', code);
