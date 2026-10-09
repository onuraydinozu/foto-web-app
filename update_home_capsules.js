const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update initial state of user & myCapsules to use localStorage cache (instant hydration, zero flicker)
content = content.replace(
  `  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [myCapsules, setMyCapsules] = useState<any[]>([]);`,
  `  const [user, setUser] = useState<any>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('snaproom_cached_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [myCapsules, setMyCapsules] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const cached = localStorage.getItem('snaproom_cached_capsules');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });`
);

// 2. Add relative date formatting function
const helperFunc = `
function formatCapsuleTime(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600));
    if (diffHours < 1) return 'Az önce';
    if (diffHours < 24) return \`\${diffHours}s önce\`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return \`\${diffDays} gün önce\`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
`;

if (!content.includes('function formatCapsuleTime')) {
  content = content.replace('export default function Home() {', helperFunc + '\nexport default function Home() {');
}

// 3. Update useEffect and fetchMyCapsules to cache user & capsules and auto-fill nickname
const oldAuthBlock = `    // Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      if (session?.user) fetchMyCapsules(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchMyCapsules(session.user);
        setShowAuthModal(false);
      } else {
        setMyCapsules([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMyCapsules = async (currentUser: any) => {
    const capsules = currentUser.user_metadata?.capsules || [];
    if (capsules.length === 0) {
      setMyCapsules([]);
      return;
    }
    const { data } = await supabase
      .from('rooms')
      .select('short_id, location, created_at')
      .in('short_id', capsules)
      .order('created_at', { ascending: false });
    if (data) setMyCapsules(data);
  };`;

const newAuthBlock = `    // Supabase Auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        try { localStorage.setItem('snaproom_cached_user', JSON.stringify(u)); } catch {}
        fetchMyCapsules(u);
        const uname = u.user_metadata?.username || u.email?.split('@')[0];
        if (uname) {
          setNickname(uname);
          try { localStorage.setItem('snaproom_nickname', uname); } catch {}
        }
      } else {
        try {
          localStorage.removeItem('snaproom_cached_user');
          localStorage.removeItem('snaproom_cached_capsules');
        } catch {}
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user || null;
      setUser(u);
      if (u) {
        try { localStorage.setItem('snaproom_cached_user', JSON.stringify(u)); } catch {}
        fetchMyCapsules(u);
        setShowAuthModal(false);
        const uname = u.user_metadata?.username || u.email?.split('@')[0];
        if (uname) {
          setNickname(uname);
          try { localStorage.setItem('snaproom_nickname', uname); } catch {}
        }
      } else {
        setMyCapsules([]);
        try {
          localStorage.removeItem('snaproom_cached_user');
          localStorage.removeItem('snaproom_cached_capsules');
        } catch {}
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMyCapsules = async (currentUser: any) => {
    const capsules = currentUser.user_metadata?.capsules || [];
    if (capsules.length === 0) {
      setMyCapsules([]);
      try { localStorage.setItem('snaproom_cached_capsules', JSON.stringify([])); } catch {}
      return;
    }
    const { data } = await supabase
      .from('rooms')
      .select('short_id, location, created_at, upload_locked_at')
      .in('short_id', capsules)
      .order('created_at', { ascending: false });
    if (data) {
      setMyCapsules(data);
      try { localStorage.setItem('snaproom_cached_capsules', JSON.stringify(data)); } catch {}
    }
  };

  const handleOpenCapsule = (shortId: string) => {
    const targetNick = nickname.trim() || user?.user_metadata?.username || user?.email?.split('@')[0] || (typeof window !== 'undefined' ? localStorage.getItem('snaproom_nickname') : '') || 'Misafir';
    try {
      localStorage.setItem('snaproom_nickname', targetNick);
    } catch {}
    router.push(\`/room/\${shortId}\`);
  };`;

content = content.replace(oldAuthBlock, newAuthBlock);

// 4. Update handleLogout to clear caches
content = content.replace(
  `  const handleLogout = async () => {
    await supabase.auth.signOut();
  };`,
  `  const handleLogout = async () => {
    try {
      localStorage.removeItem('snaproom_cached_user');
      localStorage.removeItem('snaproom_cached_capsules');
    } catch {}
    setUser(null);
    setMyCapsules([]);
    await supabase.auth.signOut();
  };`
);

// 5. Replace the "HESAP & KAPSÜLLERİM ALANI" UI with a modern, stylish, high-usability design
const oldUiStart = content.indexOf('{/* HESAP & KAPSÜLLERİM ALANI (BİRLEŞTİRİLMİŞ) */}');
const oldUiEnd = content.indexOf('{/* 3. MERKEZİ KAPSÜL KARTI */}');

if (oldUiStart !== -1 && oldUiEnd !== -1) {
  const newUi = `{/* HESAP & KAPSÜLLERİM ALANI (MODERN & KULLANIŞLI) */}
      <div className="w-full max-w-[460px] mx-auto mb-5 relative z-10">
        {user ? (
          <div className="bg-[#12151F]/95 backdrop-blur-md rounded-[2rem] border border-white/10 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
            {/* Arka plan hafif neon ışıması */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#CCFF00]/5 rounded-full blur-2xl pointer-events-none" />

            {/* ÜST PROFİL BAR */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#CCFF00] to-[#99cc00] flex items-center justify-center shadow-[0_0_15px_rgba(204,255,0,0.3)]">
                  <span className="text-black font-black text-sm uppercase">
                    {(user?.user_metadata?.username || user?.email?.split('@')[0] || 'K')[0]}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white text-sm font-black tracking-tight truncate max-w-[150px] sm:max-w-[200px]">
                    @{user?.user_metadata?.username || user?.email?.split('@')[0] || 'Kullanıcı'}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#CCFF00] animate-pulse" />
                    <span className="text-[#CCFF00] text-[10px] font-bold uppercase tracking-wider">Giriş Yapıldı</span>
                  </div>
                </div>
              </div>

              {/* HESAPTAN ÇIKIŞ BUTONU (SADECE HESAP İÇİN) */}
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 hover:border-red-500/30 text-neutral-400 hover:text-red-300 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                title="Hesabından Tamamen Çıkış Yap"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="text-[11px]">Hesaptan Çık</span>
              </button>
            </div>

            {/* BAŞLIK & SAYI */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2 text-white font-extrabold text-xs sm:text-sm">
                <History className="w-4 h-4 text-[#CCFF00]" />
                <span>Geçmiş Kapsüllerim</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 font-mono text-[10px] font-bold">
                {myCapsules.length} Kapsül
              </span>
            </div>

            {/* KAPSÜL LİSTESİ */}
            {myCapsules.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                {myCapsules.map((cap) => {
                  const isLocked = cap.upload_locked_at && new Date() > new Date(cap.upload_locked_at);
                  const timeText = formatCapsuleTime(cap.created_at);

                  return (
                    <div
                      key={cap.short_id}
                      onClick={() => handleOpenCapsule(cap.short_id)}
                      className="group w-full p-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-[#CCFF00]/50 transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 shadow-sm hover:shadow-[0_4px_20px_rgba(204,255,0,0.08)]"
                    >
                      {/* Sol: İkon & İsim */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:border-[#CCFF00]/40 transition">
                          <Camera className="w-4 h-4 text-[#CCFF00]" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-white text-xs truncate group-hover:text-[#CCFF00] transition">
                            {cap.location || "Günün Ortak Dump'ı ✨"}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 font-mono text-[10px] text-neutral-400">
                            <span className="text-[#CCFF00] font-bold">#{cap.short_id}</span>
                            {timeText && <span>&bull; {timeText}</span>}
                            {isLocked && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 text-[9px]">Kilitli</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Sağ: Giriş Oku */}
                      <div className="shrink-0 flex items-center gap-1 text-xs font-bold text-neutral-400 group-hover:text-black group-hover:bg-[#CCFF00] px-2.5 py-1.5 rounded-xl bg-white/5 transition-all">
                        <span className="hidden sm:inline text-[11px]">Aç</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-5 px-3 rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-neutral-400 text-xs">
                <p className="font-medium text-neutral-300">Henüz bir kapsüle katılmadın</p>
                <p className="text-[11px] text-neutral-500 mt-1">Aşağıdan yeni bir ortak kapsül başlat veya arkadaşının kodunu gir!</p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[#12151F]/90 backdrop-blur-md rounded-[2rem] border border-white/15 p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-[#CCFF00] flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                <Lock className="w-5 h-5 text-black" />
              </div>
              <div className="flex flex-col">
                <span className="text-white text-sm font-black">Güvenli Giriş & Geçmiş Kapsüller</span>
                <span className="text-neutral-400 text-[11px] leading-tight mt-0.5">Kapsüllerini kaybetmemek için giriş yap, tüm odaların burada listelensin.</span>
              </div>
            </div>
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs transition shadow-sm whitespace-nowrap cursor-pointer"
            >
              Giriş Yap / Kayıt
            </button>
          </div>
        )}
      </div>\n\n      `;

  content = content.substring(0, oldUiStart) + newUi + content.substring(oldUiEnd);
}

fs.writeFileSync(file, content);
console.log('Successfully modernized past capsules section in app/page.tsx!');
