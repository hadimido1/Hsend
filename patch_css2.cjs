const fs = require('fs');
let code = fs.readFileSync('src/index.css', 'utf8');

code = code.replace(/body \{\n  font-family: var\(--font-sans\);\n  background-color: var\(--bg-primary\);\n  color: var\(--text-primary\);\n\}/, `body {
  font-family: var(--font-sans);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overscroll-behavior-y: none;
}`);

fs.writeFileSync('src/index.css', code);
