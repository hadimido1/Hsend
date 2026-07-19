const fs = require('fs');

let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf-8');

if (!code.includes('motion')) {
  code = code.replace("import { Search, LogOut, ArrowRight as ArrowIcon, ShieldAlert, Users, Clock, Check, Camera, User } from 'lucide-react';", "import { Search, LogOut, ArrowRight as ArrowIcon, ShieldAlert, Users, Clock, Check, Camera, User } from 'lucide-react';\nimport { motion } from 'motion/react';");
}

code = code.replace(
  '<button\n                key={user.id}\n                onClick={() => setActiveChat(user.id)}',
  '<motion.button\n                initial={{ opacity: 0, x: -10 }}\n                animate={{ opacity: 1, x: 0 }}\n                key={user.id}\n                onClick={() => setActiveChat(user.id)}'
).replace(
  '</div>\n              </button>\n            ))}',
  '</div>\n              </motion.button>\n            ))}'
);

code = code.replace(
  '<button\n                  key={user.id}\n                  onClick={() => pinUser(user)}',
  '<motion.button\n                  initial={{ opacity: 0, y: 10 }}\n                  animate={{ opacity: 1, y: 0 }}\n                  key={user.id}\n                  onClick={() => pinUser(user)}'
).replace(
  '</div>\n                </button>\n              ))}',
  '</div>\n                </motion.button>\n              ))}'
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
