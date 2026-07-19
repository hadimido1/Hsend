const fs = require('fs');
let code = fs.readFileSync('src/components/ChatArea.tsx', 'utf8');

code = code.replace(/<motion\.div \n      id=\{\`msg-\$\{msg.id\}\`\}/, `<motion.div 
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      id={\`msg-\${msg.id}\`}`);

fs.writeFileSync('src/components/ChatArea.tsx', code);
