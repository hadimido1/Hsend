const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add splash state
const splashImport = `import { motion, AnimatePresence } from 'motion/react';\nimport { MessageCircle } from 'lucide-react';`;
code = code.replace("import { motion, AnimatePresence } from 'motion/react';", splashImport);

const stateHook = `  const [showSplash, setShowSplash] = React.useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2000);
    return () => clearTimeout(timer);
  }, []);
`;
code = code.replace("const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);", "const [isMobile, setIsMobile] = React.useState(window.innerWidth < 768);\n" + stateHook);

const splashComponent = `
  if (showSplash) {
    return (
      <div className="flex flex-col h-screen w-full bg-[#0b141a] text-white overflow-hidden items-center justify-between py-12 relative" dir="ltr">
        <div className="flex-1 flex items-center justify-center">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <img src="/HSEND_LOGO.png" alt="HiSEND Logo" className="w-24 h-24 object-contain brightness-200" />
          </motion.div>
        </div>
        <div className="flex flex-col items-center mb-6">
          <span className="text-gray-400 text-sm font-medium mb-1">from</span>
          <span className="text-white text-xl font-bold tracking-wide flex items-center gap-1.5">
            <span className="w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center shadow-lg shadow-[#00a884]/20"><MessageCircle size={14} className="text-white" fill="currentColor" /></span>
            HiSEND
          </span>
        </div>
      </div>
    );
  }
`;

code = code.replace("if (!currentUser) {\n    return <Auth />;\n  }", splashComponent + "\n  if (!currentUser) {\n    return <Auth />;\n  }");

fs.writeFileSync('src/App.tsx', code);
