const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the heavy blur divs with high-performance CSS radial-gradient
const oldGradients = `{/* 1. CANLI AMBIENT MESH GRADIENT */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-20 w-[480px] h-[480px] bg-gradient-to-tr from-[#7928CA]/40 to-[#4F46E5]/30 rounded-full blur-[60px] opacity-40" />

        <div className="absolute -bottom-28 -right-20 w-[520px] h-[520px] bg-gradient-to-bl from-[#FF2E93]/35 to-[#FF0055]/25 rounded-full blur-[60px] opacity-40" />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#CCFF00]/15 rounded-full blur-[80px] opacity-20" />

        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>`;

const newGradients = `{/* 1. CANLI AMBIENT MESH GRADIENT (GPU-ACCELERATED, SIFIR ISINMA & KASMA) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[radial-gradient(circle_at_20%_15%,rgba(121,40,202,0.18)_0%,transparent_50%),radial-gradient(circle_at_80%_85%,rgba(255,46,147,0.15)_0%,transparent_50%),radial-gradient(circle_at_50%_50%,rgba(204,255,0,0.06)_0%,transparent_60%)]" />`;

content = content.replace(oldGradients, newGradients);

// 2. Remove blur-2xl inside user card
content = content.replace(
  '<div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFF00]/5 rounded-full blur-2xl pointer-events-none" />',
  ''
);

// 3. Optimize backdrop-blur for mobile on user card and main card
content = content.replace(
  'className="bg-[#12151F]/95 backdrop-blur-md rounded-[2rem]',
  'className="bg-[#12151F] md:backdrop-blur-md rounded-[2rem]'
);

content = content.replace(
  'className="bg-[#12151F]/90 backdrop-blur-md rounded-[2rem]',
  'className="bg-[#12151F] md:backdrop-blur-md rounded-[2rem]'
);

content = content.replace(
  'className="relative bg-white/[0.04] backdrop-blur-sm border border-white/15 rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-5 overflow-hidden"',
  'className="relative bg-[#10121A] md:bg-[#12151F]/80 md:backdrop-blur-sm border border-white/15 rounded-[32px] p-5 sm:p-8 shadow-2xl space-y-5 overflow-hidden"'
);

fs.writeFileSync(file, content);
console.log('Successfully optimized app/page.tsx for mobile battery & performance!');
