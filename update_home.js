const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Imports
content = content.replace(
  "import { Sparkles, ArrowRight, Camera, Zap, Flame, Bomb, MapPin, Globe, Radio, Lock } from 'lucide-react';",
  "import { Sparkles, ArrowRight, Camera, Zap, Flame, Bomb, MapPin, Globe, Radio, Lock, User, LogIn, LogOut, LayoutList, X, History } from 'lucide-react';"
);

// 2. States
const stateAnchor = "  const [errorMsg, setErrorMsg] = useState('');";
const statesStr = `  const [errorMsg, setErrorMsg] = useState('');

  // AUTH & KAPSÜLLERİM STATES
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [myCapsules, setMyCapsules] = useState<any[]>([]);
`;
content = content.replace(stateAnchor, statesStr);

// 3. useEffect Auth Listener and fetch functions
const useEffectAnchor = "    const savedCity = localStorage.getItem('snaproom_city');\n    if (savedCity) setUserCity(savedCity);\n  }, []);";
const useEffectStr = `    const savedCity = localStorage.getItem('snaproom_city');
    if (savedCity) setUserCity(savedCity);

    // Supabase Auth
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
  };

  const addCapsuleToUser = async (shortId: string) => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    const currentCapsules = currentUser.user_metadata?.capsules || [];
    if (!currentCapsules.includes(shortId)) {
      const newCapsules = [shortId, ...currentCapsules];
      await supabase.auth.updateUser({ data: { capsules: newCapsules } });
      fetchMyCapsules({ ...currentUser, user_metadata: { ...currentUser.user_metadata, capsules: newCapsules } });
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'register') {
        const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (error) throw error;
        setAuthMode('login');
        setAuthError('Kayıt başarılı! Lütfen giriş yapın (E-posta doğrulaması kapalıysa anında girer).');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Bir hata oluştu.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };
`;
content = content.replace(useEffectAnchor, useEffectStr);

// 4. Update createCapsule and join with addCapsuleToUser
content = content.replace(
  "      router.push(`/room/${shortId}?token=${generatedPin}`);",
  "      await addCapsuleToUser(shortId);\n      router.push(`/room/${shortId}?token=${generatedPin}`);"
);
content = content.replace(
  "        router.push(`/room/${room.short_id}?token=${room.pin_hash}`);",
  "        await addCapsuleToUser(room.short_id);\n        router.push(`/room/${room.short_id}?token=${room.pin_hash}`);"
);
content = content.replace(
  "        router.push(`/room/${roomByPin.short_id}?token=${roomByPin.pin_hash}`);",
  "        await addCapsuleToUser(roomByPin.short_id);\n        router.push(`/room/${roomByPin.short_id}?token=${roomByPin.pin_hash}`);"
);

// 5. JSX - Auth Top Bar and My Capsules Section
const jsxAnchor = '<main className="relative min-h-screen w-full text-[#F3F4F6] flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden selection:bg-[#CCFF00] selection:text-black">';
const jsxStr = `<main className="relative min-h-screen w-full text-[#F3F4F6] flex flex-col justify-center items-center p-4 sm:p-6 pb-20 overflow-hidden selection:bg-[#CCFF00] selection:text-black">
      
      {/* AUTH TOP BAR */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-neutral-300 bg-black/40 px-3 py-1.5 rounded-full border border-white/10 hidden sm:block">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition flex items-center gap-1.5"
              title="Çıkış Yap"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-xs font-bold hidden sm:inline pr-1">Çıkış</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowAuthModal(true)}
            className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 border border-white/10 text-white font-bold text-xs transition flex items-center gap-2"
          >
            <User className="w-4 h-4 text-[#CCFF00]" />
            Giriş Yap / Kayıt Ol
          </button>
        )}
      </div>

      {/* KAPSÜLLERİM SEKMESİ (SADECE GİRİŞ YAPANLARA) */}
      <AnimatePresence>
        {user && myCapsules.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-20 right-4 sm:right-6 z-40 max-h-[300px] overflow-y-auto w-72 bg-[#12151F]/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 hidden lg:block"
          >
            <div className="flex items-center gap-2 mb-3 text-[#CCFF00] font-black text-sm">
              <History className="w-4 h-4" />
              Girdiğim Kapsüller ({myCapsules.length})
            </div>
            <div className="space-y-2">
              {myCapsules.map((cap) => (
                <button
                  key={cap.short_id}
                  onClick={() => router.push(\`/room/\${cap.short_id}\`)}
                  className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-[#CCFF00]/40 transition group flex flex-col gap-1"
                >
                  <span className="font-bold text-white text-xs truncate group-hover:text-[#CCFF00]">{cap.location || 'İsimsiz Kapsül'}</span>
                  <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                    <span>#{cap.short_id}</span>
                    <span>{new Date(cap.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUTH MODALI */}
      <AnimatePresence>
        {showAuthModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAuthModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border border-white/10 rounded-[2rem] p-6 max-w-sm w-full shadow-2xl relative"
            >
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-[#CCFF00] flex items-center justify-center">
                  <User className="w-4 h-4 text-black font-black" />
                </div>
                <h3 className="text-xl font-black text-white">SnapRoom <span className="text-[#CCFF00]">Hesabı</span></h3>
              </div>

              <div className="flex bg-black/40 rounded-xl p-1 mb-6 border border-white/10">
                <button
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
                  className={\`flex-1 py-2 text-xs font-bold rounded-lg transition \${authMode === 'login' ? 'bg-white/15 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}\`}
                >
                  Giriş Yap
                </button>
                <button
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
                  className={\`flex-1 py-2 text-xs font-bold rounded-lg transition \${authMode === 'register' ? 'bg-white/15 text-white shadow-sm' : 'text-neutral-400 hover:text-white'}\`}
                >
                  Kayıt Ol
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-neutral-400">E-Posta</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 text-white placeholder:text-neutral-600 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#CCFF00] transition"
                    placeholder="ornek@mail.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-neutral-400">Şifre</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="w-full bg-black/40 border border-white/15 text-white placeholder:text-neutral-600 rounded-xl px-3 py-2.5 text-sm font-semibold focus:outline-none focus:border-[#CCFF00] transition"
                    placeholder="••••••••"
                  />
                </div>
                
                {authError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold text-center">
                    {authError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-sm transition shadow-[0_0_20px_rgba(204,255,0,0.3)] disabled:opacity-50"
                >
                  {authLoading ? 'Bekleniyor...' : authMode === 'login' ? 'Giriş Yap 🚀' : 'Hesap Oluştur ✨'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
`;
content = content.replace(jsxAnchor, jsxStr);

// 6. Kapsüllerim Mobile view for when screen is small (Append it at the very bottom before closing main)
const bottomAnchor = '      {/* ANA MODÜL (KART) */}'
const bottomStr = `      {/* KAPSÜLLERİM SEKMESİ (MOBİL İÇİN KARTIN ÜSTÜNDE VEYA ALTINDA) */}
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
                  onClick={() => router.push(\`/room/\${cap.short_id}\`)}
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

      {/* ANA MODÜL (KART) */}`;
content = content.replace(bottomAnchor, bottomStr);


fs.writeFileSync(file, content);
console.log("Updated app/page.tsx with auth and user capsules!");
