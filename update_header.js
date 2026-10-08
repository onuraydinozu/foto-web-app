const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const startAnchor = '        <motion.header\n          initial={{ y: -20, opacity: 0 }}\n          animate={{ y: 0, opacity: 1 }}\n          transition={{ type: \'spring\', damping: 20 }}\n          className="rounded-full bg-[#12151F]/90 backdrop-blur-2xl border border-white/15 px-2 sm:px-4 py-1.5 sm:py-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex items-center justify-between gap-1 sm:gap-2"\n        >';
const endAnchor = '        </motion.header>';

const startIndex = content.indexOf(startAnchor);
const endIndex = content.indexOf(endAnchor, startIndex) + endAnchor.length;

if (startIndex !== -1 && endIndex > startIndex) {
  const replacement = `        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="rounded-[1.5rem] bg-[#12151F]/90 backdrop-blur-2xl border border-white/15 px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] flex flex-col gap-2.5"
        >
          {/* ÜST SATIR: Çıkış, Başlık, Aksiyonlar */}
          <div className="flex items-center justify-between gap-2 w-full">
            {/* SOL: Çıkış ve Başlık */}
            <div className="flex items-center gap-2 min-w-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push('/')}
                title="Kapsülden Çık / Ana Sayfaya Dön"
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-full bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-400/50 text-neutral-300 hover:text-red-300 transition shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0 rotate-180" />
                <span className="hidden sm:inline text-xs font-bold">Çıkış</span>
              </motion.button>
              
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 min-w-0 shrink-0">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#CCFF00] animate-pulse shrink-0" />
                <span className="font-black text-[11px] sm:text-sm tracking-wide text-white truncate max-w-[80px] sm:max-w-[160px]">
                  {capsuleName}
                </span>
              </div>
            </div>

            {/* SAĞ: QR, Katılımcılar, Recap */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowQrModal(true)}
                className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-neutral-300 hover:text-white transition cursor-pointer"
                title="QR Kod"
              >
                <QrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#CCFF00]" />
              </button>
              
              <button
                onClick={() => setShowParticipantsModal(true)}
                className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-[#FF2E93]/30 border border-white/10 hover:border-[#FF2E93]/50 text-neutral-300 hover:text-[#FF2E93] transition cursor-pointer"
                title="Katılımcılar"
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF2E93]" />
              </button>

              <button
                onClick={() => {
                  setShowRecapModal(true);
                  confetti({
                    particleCount: 40,
                    spread: 60,
                    origin: { y: 0.2 },
                    colors: ['#FFD700', '#CCFF00', '#FF2E93'],
                  });
                }}
                className={\`p-1.5 sm:px-2.5 sm:py-1 rounded-full border transition flex items-center gap-1 cursor-pointer \${
                  isClosingSoon
                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-white/5 hover:bg-white/15 border-white/10 text-neutral-300'
                }\`}
                title="Kapsül Recap"
              >
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline text-xs font-bold">Recap</span>
              </button>
            </div>
          </div>

          {/* ALT SATIR: Kod, Süre, Paylaş */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5 w-full">
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  navigator.clipboard.writeText(room.short_id);
                  alert(\`Kapsül Kodu kopyalandı: \${room.short_id}\`);
                }}
                className="flex items-center gap-1.5 text-[11px] sm:text-xs px-2.5 py-1 rounded-full bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] font-mono font-bold transition cursor-pointer shrink-0"
              >
                <span className="text-[#CCFF00]/60">KOD:</span>
                <span>{room.short_id}</span>
              </motion.button>
              
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF2E93]/15 border border-[#FF2E93]/35 text-[#FF2E93] text-[10px] sm:text-xs font-mono font-black shrink-0">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>{timeLeft}</span>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const text = \`📸 "\${capsuleName}" Kapsül Kodu: \${room.short_id}\\nDoğrudan bağlanmak için tıkla:\\n\${shareInviteUrl}\`;
                navigator.clipboard.writeText(text);
                alert('Davet linki kopyalandı! WhatsApp grubuna atarak arkadaşlarını direkt odaya topla. ⚡');
              }}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-[10px] sm:text-xs flex items-center gap-1.5 transition shrink-0 cursor-pointer"
            >
              <Share2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              Paylaş
            </motion.button>
          </div>
        </motion.header>`;
  
  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync(file, content);
  console.log("Updated header layout");
} else {
  console.log("Could not find header anchor!");
}
