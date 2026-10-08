const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchor = '      {/* 3. MERKEZİ KAPSÜL KARTI */}';
const str = `      {/* KAPSÜLLERİM SEKMESİ (MOBİL İÇİN KARTIN ÜSTÜNDE) */}
      <AnimatePresence>
        {user && myCapsules.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#12151F]/90 backdrop-blur-xl rounded-[2rem] border border-white/10 p-5 shadow-2xl relative z-10 mx-4 mb-4 lg:hidden"
          >
            <div className="flex items-center gap-2 mb-3 text-[#CCFF00] font-black text-sm">
              <History className="w-4 h-4" />
              Girdiğim Kapsüller ({myCapsules.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. MERKEZİ KAPSÜL KARTI */}`;

content = content.replace(anchor, str);
fs.writeFileSync(file, content);
console.log('injected');
