const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the heavy 140-160px blurs with GPU-accelerated CSS radial gradients
const oldRoomGradients = `{/* 1. CANLI AMBIENT MESH GRADIENT */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[350px] bg-[#7928CA]/20 rounded-full blur-[140px]" />
        <div className="absolute top-1/3 right-10 w-[450px] h-[400px] bg-[#FF2E93]/15 rounded-full blur-[150px]" />
        <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-[#CCFF00]/10 rounded-full blur-[160px]" />
      </div>`;

const newRoomGradients = `{/* 1. CANLI AMBIENT MESH GRADIENT (GPU-ACCELERATED, SIFIR ISINMA) */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-[radial-gradient(circle_at_30%_10%,rgba(121,40,202,0.14)_0%,transparent_50%),radial-gradient(circle_at_85%_40%,rgba(255,46,147,0.12)_0%,transparent_50%),radial-gradient(circle_at_15%_90%,rgba(204,255,0,0.06)_0%,transparent_60%)]" />`;

content = content.replace(oldRoomGradients, newRoomGradients);

// 2. Hide ambient blurred cover photo on mobile to save GPU composition
content = content.replace(
  '<div className="absolute top-0 inset-x-0 h-[480px] overflow-hidden pointer-events-none z-0 opacity-25">',
  '<div className="hidden md:block absolute top-0 inset-x-0 h-[480px] overflow-hidden pointer-events-none z-0 opacity-25">'
);

// 3. Optimize floating dock backdrop-blur on mobile
content = content.replace(
  'className="max-w-md mx-auto pointer-events-auto bg-[#12151F]/95 backdrop-blur-sm border border-white/20 rounded-full px-3 py-2.5 shadow-[0_15px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-2"',
  'className="max-w-md mx-auto pointer-events-auto bg-[#12151F] md:bg-[#12151F]/95 md:backdrop-blur-sm border border-white/20 rounded-full px-3 py-2.5 shadow-[0_15px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-2"'
);

// 4. Optimize header backdrop-blur on mobile
content = content.replace(
  'className="rounded-[1.5rem] bg-[#12151F]/90 backdrop-blur-sm border border-white/15 px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col gap-2.5"',
  'className="rounded-[1.5rem] bg-[#12151F] md:bg-[#12151F]/90 md:backdrop-blur-sm border border-white/15 px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col gap-2.5"'
);

fs.writeFileSync(file, content);
console.log('Successfully optimized app/room/[short_id]/page.tsx for mobile battery & performance!');
