const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add ArrowLeft to imports
content = content.replace(
  'Mic, MicOff, Play, Pause, Radio, Volume2, Globe, Heart, LogOut',
  'Mic, MicOff, Play, Pause, Radio, Volume2, Globe, Heart, LogOut, ArrowLeft'
);

// Replace the red exit button with a clear "Kapsüllerim" navigation button
const oldButton = `<motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/')}
                title="Kapsülden Çık / Ana Sayfaya Dön"
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-full bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-400/50 text-neutral-300 hover:text-red-300 transition shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0 rotate-180" />
                <span className="hidden sm:inline text-xs font-bold">Çıkış</span>
              </motion.button>`;

const newButton = `<button
                onClick={() => router.push('/')}
                title="Ana Sayfaya ve Kapsüllerime Dön"
                className="px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 hover:border-[#CCFF00]/40 text-neutral-200 hover:text-white transition shrink-0 flex items-center gap-1.5 cursor-pointer text-xs font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#CCFF00]" />
                <span>Kapsüllerim</span>
              </button>`;

content = content.replace(oldButton, newButton);

fs.writeFileSync(file, content);
console.log('Successfully updated room navigation button in app/room/[short_id]/page.tsx!');
