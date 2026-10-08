const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `<motion.div
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 40, 0],
            scale: [1, 1.25, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-24 -left-20 w-[480px] h-[480px] bg-gradient-to-tr from-[#7928CA]/40 to-[#4F46E5]/30 rounded-full blur-[130px]"
        />`;

const replacement1 = `<div className="absolute -top-24 -left-20 w-[480px] h-[480px] bg-gradient-to-tr from-[#7928CA]/40 to-[#4F46E5]/30 rounded-full blur-[130px] opacity-70" />`;

const target2 = `<motion.div
          animate={{
            x: [0, -70, 50, 0],
            y: [0, 80, -50, 0],
            scale: [1, 1.15, 1.05, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-28 -right-20 w-[520px] h-[520px] bg-gradient-to-bl from-[#FF2E93]/35 to-[#FF0055]/25 rounded-full blur-[140px]"
        />`;

const replacement2 = `<div className="absolute -bottom-28 -right-20 w-[520px] h-[520px] bg-gradient-to-bl from-[#FF2E93]/35 to-[#FF0055]/25 rounded-full blur-[140px] opacity-70" />`;

const target3 = `<motion.div
          animate={{
            scale: [0.9, 1.15, 0.95, 0.9],
            opacity: [0.2, 0.35, 0.25, 0.2],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#CCFF00]/15 rounded-full blur-[160px]"
        />`;

const replacement3 = `<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#CCFF00]/15 rounded-full blur-[160px] opacity-30" />`;

content = content.replace(target1, replacement1);
content = content.replace(target2, replacement2);
content = content.replace(target3, replacement3);

fs.writeFileSync(file, content);
console.log('Fixed mobile performance by making gradients static!');
