const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `      {/* ========================================================
          ALT YÜZEN DOCK (Fotoğraf Bas, Ses Kaydet, ZIP İndir)
         ======================================================== */}
      <div className="fixed bottom-4 sm:bottom-6 bottom-[calc(1rem+env(safe-area-inset-bottom))] inset-x-0 z-40 px-4 pointer-events-none">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="max-w-md mx-auto pointer-events-auto bg-[#12151F]/90 backdrop-blur-2xl border border-white/20 rounded-full px-4 py-2.5 shadow-[0_15px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-3"
        >
          {/* Sol: İstatistikler */}
          <div className="pl-2">
            <p className="text-xs font-black text-white">
              {photos.length} Anı
            </p>
            <p className="text-[10px] font-mono text-neutral-400">
              ORTAK KAPSÜL
            </p>
          </div>

          {/* Orta Butonlar: Tinder Ayıkla + Ses Kaydet + Dev Fotoğraf Bas */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* TINDER SWIPE MODU BUTONU */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowSwipeModal(true)}
              disabled={photos.length === 0}
              title="Tinder Modunda Ayıkla (Swipe Kuratörü)"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-orange-500/25 to-pink-500/25 hover:from-orange-500/40 hover:to-pink-500/40 border border-orange-500/40 text-orange-400 flex items-center justify-center transition cursor-pointer shadow-sm disabled:opacity-30"
            >
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-orange-400" />
            </motion.button>

            {/* SES KAYDET BUTONU */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowVoiceModal(true)}
              title="5-10 Saniyelik Sesli Anı Bırak"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#7928CA]/30 hover:bg-[#7928CA]/50 border border-[#7928CA]/50 text-violet-300 flex items-center justify-center transition cursor-pointer"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5 text-[#FF2E93]" />
            </motion.button>

            {/* DEV FOTOĞRAF BAS BUTONU */}
            <motion.button
              whileHover={{ scale: storageStats.isExceeded ? 1 : 1.12 }}
              whileTap={{ scale: storageStats.isExceeded ? 1 : 0.92 }}
              onClick={() => {
                if (storageStats.isExceeded) {
                  handleQuotaExceeded('Kasa şu an dolu, fotoğraf yüklenemiyor 🛑');
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={storageStats.isExceeded}
              title="Fotoğraf Fırlat"
              className={\`w-14 h-14 -my-4 rounded-full flex items-center justify-center font-black transition-all cursor-pointer \${
                storageStats.isExceeded
                  ? 'bg-[#FF2E93]/30 text-[#FF2E93] border border-[#FF2E93]/50 cursor-not-allowed shadow-none'
                : 'bg-[#CCFF00] text-black shadow-[0_0_25px_rgba(204,255,0,0.5)] hover:shadow-[0_0_35px_rgba(204,255,0,0.8)]'
              }\`}
            >
              {storageStats.isExceeded ? (
                <Lock className="w-6 h-6" />
              ) : (
                <Plus className="w-8 h-8 stroke-[3]" />
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>`;

const replacement = `      {/* ========================================================
          ALT YÜZEN DOCK (Fotoğraf Bas, Ses Kaydet, ZIP İndir)
         ======================================================== */}
      <div className="fixed bottom-4 sm:bottom-6 bottom-[calc(1rem+env(safe-area-inset-bottom))] inset-x-0 z-40 px-2 sm:px-4 pointer-events-none">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="max-w-md mx-auto pointer-events-auto bg-[#12151F]/95 backdrop-blur-2xl border border-white/20 rounded-full px-3 py-2.5 shadow-[0_15px_50px_rgba(0,0,0,0.85)] flex items-center justify-between gap-2"
        >
          {/* Sol: İstatistikler */}
          <div className="pl-1 hidden xs:block shrink-0">
            <p className="text-[11px] sm:text-xs font-black text-white">
              {photos.length} Anı
            </p>
            <p className="text-[9px] sm:text-[10px] font-mono text-neutral-400">
              KAPSÜL
            </p>
          </div>

          {/* Orta Butonlar: Tinder Ayıkla + Ses Kaydet + Dev Fotoğraf Bas */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end xs:justify-start">
            {/* TINDER SWIPE MODU BUTONU */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSwipeModal(true)}
              disabled={photos.length === 0}
              title="Tinder Modunda Ayıkla (Swipe Kuratörü)"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-orange-500/25 to-pink-500/25 hover:from-orange-500/40 hover:to-pink-500/40 border border-orange-500/40 text-orange-400 flex items-center justify-center transition cursor-pointer shadow-sm disabled:opacity-30 shrink-0"
            >
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-orange-400" />
            </motion.button>

            {/* SES KAYDET BUTONU */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowVoiceModal(true)}
              title="10 Saniyelik Sesli Anı Bırak"
              className="flex items-center gap-1.5 px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-full bg-[#7928CA]/30 hover:bg-[#7928CA]/50 border border-[#7928CA]/50 text-violet-300 font-bold text-xs transition cursor-pointer shadow-sm shrink-0"
            >
              <Mic className="w-4 h-4 text-[#FF2E93]" />
              <span className="inline">Ses</span>
            </motion.button>

            {/* FOTOĞRAF BAS BUTONU */}
            <motion.button
              whileHover={{ scale: storageStats.isExceeded ? 1 : 1.05 }}
              whileTap={{ scale: storageStats.isExceeded ? 1 : 0.95 }}
              onClick={() => {
                if (storageStats.isExceeded) {
                  handleQuotaExceeded('Kasa şu an dolu, fotoğraf yüklenemiyor 🛑');
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={storageStats.isExceeded}
              title="Fotoğraf Fırlat"
              className={\`flex items-center gap-1.5 px-3 py-2.5 sm:px-4 sm:py-2.5 rounded-full font-black text-xs sm:text-sm transition-all cursor-pointer shrink-0 \${
                storageStats.isExceeded
                  ? 'bg-[#FF2E93]/30 text-[#FF2E93] border border-[#FF2E93]/50 cursor-not-allowed shadow-none'
                : 'bg-[#CCFF00] text-black shadow-[0_0_20px_rgba(204,255,0,0.4)] hover:shadow-[0_0_25px_rgba(204,255,0,0.6)]'
              }\`}
            >
              {storageStats.isExceeded ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span className="hidden sm:inline">Dolu</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 stroke-[3]" />
                  <span className="inline">Foto</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>`;

if (content.includes(target)) {
  fs.writeFileSync(file, content.replace(target, replacement));
  console.log("Replaced successfully!");
} else {
  console.log("Target not found!");
}
