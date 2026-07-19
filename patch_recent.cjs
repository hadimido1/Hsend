const fs = require('fs');
let code = fs.readFileSync('src/components/RecentCalls.tsx', 'utf8');

code = code.replace('<div className="flex-1 overflow-y-auto bg-bg-primary flex flex-col h-full">', 
'<div className="flex-1 bg-bg-primary flex flex-col h-full relative">\n      <div className="flex-1 overflow-y-auto flex flex-col">');

code = code.replace('            {/* Floating Action Button for Calls */}', 
'      </div>\n      {/* Floating Action Button for Calls */}');

fs.writeFileSync('src/components/RecentCalls.tsx', code);
