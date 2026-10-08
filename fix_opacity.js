const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix main card
content = content.replace(
  `        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, delay: 0.1 }}
          className="bg-[#12151F]/90 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden"
        >`,
  `        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', damping: 20, delay: 0.1 }}
          className="bg-[#12151F]/90 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden"
        >`
);

// Fix auth block un-logged
content = content.replace(
  `        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}`,
  `        ) : (
          <motion.div
            initial={{ y: 10 }}
            animate={{ y: 0 }}
            style={{ opacity: 1 }}`
);

fs.writeFileSync(file, content);
console.log('Fixed opacity issue!');
