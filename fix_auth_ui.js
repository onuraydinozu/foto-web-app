const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Delete Top Bar & Desktop My Capsules (from {/* AUTH TOP BAR */} to just before {/* AUTH MODALI */})
const topBarStart = content.indexOf('      {/* AUTH TOP BAR */}');
const authModalStart = content.indexOf('      {/* AUTH MODALI */}');
if (topBarStart !== -1 && authModalStart !== -1) {
  content = content.substring(0, topBarStart) + content.substring(authModalStart);
} else {
  console.log("Could not find top bar anchors");
}

// 2. Replace Mobile My Capsules with Unified Auth & My Capsules Block
const mobileStart = content.indexOf('      {/* KAPSÜLLERİM SEKMESİ (MOBİL İÇİN KARTIN ÜSTÜNDE) */}');
const mainCardStart = content.indexOf('      {/* 3. MERKEZİ KAPSÜL KARTI */}');

const unifiedBlock = `      {/* HESAP & KAPSÜLLERİM ALANI (BİRLEŞTİRİLMİŞ) */}
      <div className="w-full max-w-md mx-auto mb-6 relative z-10">
        {user ? (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#12151F]/90 backdrop-blur-xl rounded-[2rem] border border-[#CCFF00]/20 p-5 shadow-[0_0_30px_rgba(204,255,0,0.1)] relative"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#CCFF00]/20 flex items-center justify-center border border-[#CCFF00]/30">
                    <User className="w-4 h-4 text-[#CCFF00]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white text-xs font-bold truncate max-w-[150px] sm:max-w-[200px]">{user.email}</span>
                    <span className="text-[#CCFF00] text-[10px] font-black uppercase tracking-widest">Bağlı Hesap</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition flex items-center gap-1.5"
                  title="Çıkış Yap"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold hidden sm:inline">Çıkış</span>
                </button>
              </div>
              
              <div className="flex items-center gap-2 mb-3 text-white font-black text-sm">
                <History className="w-4 h-4 text-[#CCFF00]" />
                Geçmiş Kapsüllerim ({myCapsules.length})
              </div>
              
              {myCapsules.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                  {myCapsules.map((cap) => (
                    <button
                      key={cap.short_id}
                      onClick={() => { if (!nickname.trim() && !localStorage.getItem('snaproom_nickname')) { setErrorMsg('Lütfen önce sayfadaki kutucuğa bir Rumuz yaz!'); return; } if (nickname.trim()) localStorage.setItem('snaproom_nickname', nickname.trim()); router.push(\`/room/\${cap.short_id}\`); }}
                      className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#CCFF00]/40 transition group flex flex-col gap-1"
                    >
                      <span className="font-bold text-white text-xs truncate group-hover:text-[#CCFF00]">{cap.location || 'İsimsiz Kapsül'}</span>
                      <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                        <span>#{cap.short_id}</span>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-neutral-500 font-medium border border-dashed border-white/10 rounded-xl bg-white/[0.02]">
                  Henüz hiçbir kapsüle katılmadın.
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-[#12151F]/90 to-[#12151F]/80 backdrop-blur-xl rounded-[2rem] border border-white/15 p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-[#CCFF00] flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.4)]">
                <Lock className="w-5 h-5 text-black" />
              </div>
              <div className="flex flex-col">
                <span className="text-white text-sm font-black">Güvenli Giriş & Geçmiş</span>
                <span className="text-neutral-400 text-[11px] leading-tight mt-0.5">Kapsüllerini kaybetmemek için giriş yap, tüm odaların burada listelensin.</span>
              </div>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs transition whitespace-nowrap cursor-pointer"
            >
              Giriş Yap / Kayıt
            </button>
          </motion.div>
        )}
      </div>

`;

if (mobileStart !== -1 && mainCardStart !== -1) {
  content = content.substring(0, mobileStart) + unifiedBlock + content.substring(mainCardStart);
} else {
  console.log("Could not find mobile card anchors");
}

fs.writeFileSync(file, content);
console.log('Fixed UI layout!');
