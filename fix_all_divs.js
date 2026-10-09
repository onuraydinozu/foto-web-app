const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace line 253 motion.div
content = content.replace(
  `<motion.div
        initial={{ y: -40, rotate: -18 }}
        animate={{ y: 0, opacity: 0.85, rotate: -12 }}
        whileHover={{ scale: 1.05, rotate: -8, opacity: 1, zIndex: 30 }}
        transition={{ type: 'spring', damping: 15 }}
        className="hidden lg:block absolute top-12 left-12 z-0 w-44 bg-white p-2.5 pb-5 rounded-2xl shadow-2xl border border-white/40 cursor-pointer select-none"
      >`,
  `<div className="hidden lg:block absolute top-12 left-12 z-0 w-44 bg-white p-2.5 pb-5 rounded-2xl shadow-2xl border border-white/40 cursor-pointer select-none -rotate-12 hover:rotate-[-8deg] hover:scale-105 transition duration-300">`
);

// Replace line 275 motion.div
content = content.replace(
  `<motion.div
        initial={{ y: -40, rotate: 16 }}
        animate={{ y: 0, opacity: 0.85, rotate: 9 }}
        whileHover={{ scale: 1.05, rotate: 4, opacity: 1, zIndex: 30 }}
        transition={{ type: 'spring', damping: 15, delay: 0.1 }}
        className="hidden lg:block absolute top-14 right-12 z-0 w-44 bg-white p-2.5 pb-5 rounded-2xl shadow-2xl border border-white/40 cursor-pointer select-none"
      >`,
  `<div className="hidden lg:block absolute top-14 right-12 z-0 w-44 bg-white p-2.5 pb-5 rounded-2xl shadow-2xl border border-white/40 cursor-pointer select-none rotate-9 hover:rotate-4 hover:scale-105 transition duration-300">`
);

// Replace line 609 errorMsg motion.div
content = content.replace(
  `<motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs font-bold text-[#FF2E93] bg-[#FF2E93]/15 border border-[#FF2E93]/30 rounded-2xl p-3 text-center"
              >`,
  `<div className="text-xs font-bold text-[#FF2E93] bg-[#FF2E93]/15 border border-[#FF2E93]/30 rounded-2xl p-3 text-center">`
);

fs.writeFileSync(file, content);
console.log('Fixed all JSX tags in app/page.tsx!');
