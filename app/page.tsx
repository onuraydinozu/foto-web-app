'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Camera, Zap, Flame, Bomb, MapPin, Globe, Radio, Lock, User, LogIn, LogOut, LayoutList, X, History } from 'lucide-react';

const SUGGESTED_TITLES = [
  'Pazar Dump\'ı 🍕',
  'Hafta Sonu Neler Oldu? ✨',
  'Vizeler Bitti Dağıldık 💀',
  'Roadtrip Günlüğü 🚗',
  'Bugün Neler Yedik? 🍔',
];


function formatCapsuleTime(dateStr?: string) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffHours = Math.floor((now.getTime() - d.getTime()) / (1000 * 3600));
    if (diffHours < 1) return 'Az önce';
    if (diffHours < 24) return `${diffHours}s önce`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Dün';
    if (diffDays < 7) return `${diffDays} gün önce`;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

export default function Home() {
  const router = useRouter();
  const [capsuleTitle, setCapsuleTitle] = useState('Pazar Dump\'ı 🍕');
  const [nickname, setNickname] = useState('');
  const [userCity, setUserCity] = useState('');
  const [hasSavedProfile, setHasSavedProfile] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number>(48);
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // AUTH & KAPSÜLLERİM STATES
  const [user, setUser] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
            const [myCapsules, setMyCapsules] = useState<any[]>([]);


  

  useEffect(() => {
    const savedNick = localStorage.getItem('snaproom_nickname');
    if (savedNick) {
      setNickname(savedNick);
      setHasSavedProfile(true);
    }

    const savedCity = localStorage.getItem('snaproom_city');
    if (savedCity) setUserCity(savedCity);

    // Supabase Auth
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
    router.push(`/room/${shortId}`);
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

  
  const handleLogout = async () => {
    try {
      localStorage.removeItem('snaproom_cached_user');
      localStorage.removeItem('snaproom_cached_capsules');
    } catch {}
    setUser(null);
    setMyCapsules([]);
    await supabase.auth.signOut();
  };


  
  
  // Yapıştırma (Paste) Desteği: kullanıcı "I56XBR" veya direkt oda linki yapıştırdığında otomatik doldurur
  
  const fullCode = joinCode.trim().toUpperCase();

  // Kapsül Kodu veya Eski PIN ile Katıl
  const handleJoinWithCode = async () => {
    if (!nickname.trim()) {
      setErrorMsg('Lütfen önce bir rumuz belirle!');
      return;
    }
    if (fullCode.length < 3) {
      setErrorMsg('Lütfen geçerli bir Kapsül Kodu gir.');
      return;
    }
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase henüz yapılandırılmadı (.env.local kontrol edin).');
      return;
    }

    setJoinLoading(true);
    localStorage.setItem('snaproom_nickname', nickname.trim());
    if (userCity.trim()) localStorage.setItem('snaproom_city', userCity.trim());

    try {
      // 1. Önce 6 haneli Kapsül Kodu (short_id) olarak ara (büyük/küçük harf duyarsız)
      let { data: room, error } = await supabase
        .from('rooms')
        .select('short_id, pin_hash')
        .ilike('short_id', fullCode)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // 2. Bulunamadıysa eski 4 haneli PIN ile ara
      if (!room) {
        const { data: roomByPin } = await supabase
          .from('rooms')
          .select('short_id, pin_hash')
          .eq('pin_hash', fullCode)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        room = roomByPin;
      }

      setJoinLoading(false);

      if (!room) {
        setErrorMsg(`"${fullCode}" koduna sahip aktif bir ortak kapsül bulunamadı!`);
        return;
      }

      await addCapsuleToUser(room.short_id);
      router.push(`/room/${room.short_id}?token=${room.pin_hash || room.short_id}`);
    } catch (e: any) {
      setJoinLoading(false);
      setErrorMsg(`Bağlantı hatası: ${e.message || 'Bilinmeyen hata'}`);
    }
  };

  // Yeni Ortak Kapsül Başlat
  const createCapsule = async () => {
    if (!nickname.trim()) {
      setErrorMsg('Lütfen bir rumuz belirle!');
      return;
    }
    if (!isSupabaseConfigured) {
      setErrorMsg('Supabase henüz yapılandırılmadı (.env.local kontrol edin).');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    // 6 haneli tekil Kapsül Kodu
    const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
    // pin_hash'i de shortId ile aynı yapıyoruz, böylece tek bir 6 haneli kod her yerde geçerli!
    const generatedPin = shortId;

    // Kapsül başlığı location alanına yazılır
    const finalTitle = capsuleTitle.trim() || 'Günün Ortak Dump\'ı ✨';

    // Seçilen kapsül süresi (24h, 48h, 1 hafta, 0=süresiz)
    const durationHours = selectedDuration === 0 ? 0 : (selectedDuration || 48);
    let uploadLockedAt;
    if (durationHours === 0) {
      // 100 yıl = süresiz
      uploadLockedAt = new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000).toISOString();
    } else {
      uploadLockedAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
    }

    try {
      const res = await fetch('/api/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          short_id: shortId,
          pin_hash: generatedPin,
          is_disposable_mode: false,
          is_unlocked: true,
          location: finalTitle,
          spotify_url: '',
          upload_locked_at: uploadLockedAt,
        }),
      });

      const resData = await res.json();
      setLoading(false);

      if (!res.ok || !resData.success || !resData.room) {
        setErrorMsg(`Ortak kapsül oluşturulurken hata: ${resData.error || 'Bilinmeyen hata'}`);
        return;
      }

      const room = resData.room;

      localStorage.setItem('snaproom_nickname', nickname.trim());
      if (userCity.trim()) localStorage.setItem('snaproom_city', userCity.trim());

      await addCapsuleToUser(shortId);
      router.push(`/room/${shortId}?token=${generatedPin}`);
    } catch (e: any) {
      setLoading(false);
      setErrorMsg(`Sunucu hatası: ${e.message || 'Bilinmeyen hata'}`);
    }
  };

  return (
    <main 
      className="relative min-h-screen w-full text-[#F3F4F6] flex flex-col justify-start sm:justify-center items-center p-4 sm:p-6 overflow-x-hidden selection:bg-[#CCFF00] selection:text-black"
      style={{
        paddingTop: 'max(1.5rem, calc(env(safe-area-inset-top, 0px) + 1.25rem))',
        paddingBottom: 'max(5rem, calc(env(safe-area-inset-bottom, 0px) + 2rem))'
      }}
    >
      
      {/* AUTH MODALI */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={(newUser: any) => {
          setUser(newUser);
          fetchMyCapsules(newUser);
        }} 
      />

      {/* 1. CANLI AMBIENT MESH GRADIENT (GPU-ACCELERATED, SIFIR ISINMA & KASMA) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none bg-[radial-gradient(circle_at_20%_15%,rgba(121,40,202,0.18)_0%,transparent_50%),radial-gradient(circle_at_80%_85%,rgba(255,46,147,0.15)_0%,transparent_50%),radial-gradient(circle_at_50%_50%,rgba(204,255,0,0.06)_0%,transparent_60%)]" />

      {/* 2. UÇUŞAN UZAKTAN DUMP POLAROID'LERİ */}
      <div className="hidden lg:block absolute top-12 left-12 z-0 w-44 bg-white p-2.5 pb-5 rounded-2xl shadow-2xl border border-white/40 cursor-pointer select-none -rotate-12 hover:rotate-[-8deg] hover:scale-105 transition duration-300">
        <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-neutral-900">
          <img
            src="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&auto=format&fit=crop&q=80"
            alt="Kadıköy"
            className="w-full h-full object-cover"
          />
          <span className="absolute top-1.5 right-1.5 text-[10px] bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-white font-mono">
            18:24
          </span>
        </div>
        <p className="mt-2 text-center text-neutral-800 font-bold text-xs">
          ✨ Gün Batımı · 18:24
        </p>
      </div>

      <div className="hidden lg:block absolute top-14 right-12 z-0 w-44 bg-white p-2.5 pb-5 rounded-2xl shadow-2xl border border-white/40 cursor-pointer select-none rotate-9 hover:rotate-4 hover:scale-105 transition duration-300">
        <div className="relative aspect-[4/5] rounded-xl overflow-hidden bg-neutral-900">
          <img
            src="https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=500&auto=format&fit=crop&q=80"
            alt="İzmir"
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-[#CCFF00] text-black font-extrabold px-1.5 py-0.5 rounded">
            23:42
          </span>
        </div>
        <p className="mt-2 text-center text-neutral-800 font-bold text-xs">
          🌊 Sahil Dump&apos;ı · 23:42
        </p>
      </div>

      {/* HESAP & KAPSÜLLERİM ALANI (MODERN & KULLANIŞLI) */}
      <div className="w-full max-w-[460px] mx-auto mb-5 relative z-10">
        {user ? (
          <div className="bg-[#12151F] md:backdrop-blur-md rounded-[2rem] border border-white/10 p-4 sm:p-5 shadow-2xl relative overflow-hidden">
            {/* Arka plan hafif neon ışıması */}
            

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
          <div className="bg-[#12151F] md:backdrop-blur-md rounded-[2rem] border border-white/15 p-4 sm:p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3.5">
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
      </div>

      {/* 3. MERKEZİ KAPSÜL KARTI */}
      <div className="relative z-20 w-full max-w-[460px] my-auto">
        
        {/* KARTA YAPIŞIK ROZETLER */}
        <div
          className="absolute -top-4 -left-3 sm:-left-6 z-30 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#CCFF00] text-black font-black text-[11px] tracking-wider uppercase shadow-md border-2 border-black select-none cursor-default"
        >
          <Radio className="w-3.5 h-3.5 shrink-0 fill-black animate-pulse" />
          <span>UZAKTAN ORTAK DUMP</span>
        </div>

        <div
          className="absolute -top-4 -right-3 sm:-right-6 z-30 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FF2E93] text-white font-black text-[11px] tracking-wider uppercase shadow-md border-2 border-white/20 select-none cursor-default"
        >
          <Bomb className="w-3.5 h-3.5 shrink-0" />
          <span>
            {selectedDuration === 24
              ? '24H HIZLI DUMP ⚡'
              : selectedDuration === 168
              ? '7 GÜN SEYAHAT 🗓️'
              : '48H CLOUD CAPSULE 💣'}
          </span>
        </div>

        {/* ANA GLASS KART */}
        <div
          className="relative bg-[#10121A] md:bg-[#12151F]/80 md:backdrop-blur-sm border border-white/15 rounded-[32px] p-5 sm:p-8 shadow-2xl space-y-5 overflow-hidden"
        >
          <div className="flex flex-col items-center text-center space-y-2 pt-2">
            <div
              className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7928CA]/40 via-[#FF2E93]/30 to-[#CCFF00]/30 border border-white/20 flex items-center justify-center mb-1 shadow-lg"
            >
              <Globe className="w-8 h-8 text-[#CCFF00] shrink-0 " />
            </div>
            
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center justify-center gap-1">
              Ortak Kapsül<span className="text-[#CCFF00] ">.</span>
            </h1>
            
            <p className="text-neutral-300 text-xs sm:text-sm font-medium leading-relaxed max-w-sm">
              Farklı yerlerde olsanız bile günün tüm anılarını tek bir ortak zaman tünelinde birleştirin. 48 saat sonra uçar.
            </p>
          </div>

          {/* Kapsül Başlığı */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-neutral-300 uppercase tracking-wider block">
              Kapsül Başlığı
            </label>
            <input
              type="text"
              placeholder="Örn: Pazar Dump'ı 🍕"
              value={capsuleTitle}
              onChange={(e) => setCapsuleTitle(e.target.value)}
              className="w-full bg-black/40 border border-white/15 text-white placeholder:text-neutral-500 rounded-2xl px-4 py-3 font-semibold text-sm focus:outline-none focus:border-[#CCFF00] transition"
            />
            {/* Hızlı Öneriler */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUGGESTED_TITLES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCapsuleTitle(t)}
                  className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                    capsuleTitle === t
                      ? 'bg-[#CCFF00]/20 border-[#CCFF00] text-[#CCFF00]'
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Rumuz ve Şehir / Konum Bilgisi */}
          {hasSavedProfile ? (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase font-bold text-neutral-400">Kayıtlı Profilin</p>
                  <p className="text-base font-black text-white truncate max-w-[200px]">
                    {nickname} {userCity ? <span className="text-neutral-400 font-medium">({userCity})</span> : ''}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#CCFF00]/20 flex items-center justify-center border border-[#CCFF00]/30 text-lg">
                  😎
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => {
                  setHasSavedProfile(false);
                  setNickname('');
                  setUserCity('');
                }}
                className="text-[11px] font-bold text-neutral-400 hover:text-white transition text-left underline underline-offset-2 w-fit cursor-pointer"
              >
                Farklı bir isimle katıl
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-black text-neutral-300 uppercase tracking-wider block">
                  Rumuzun <span className="text-[#FF2E93]">*</span>
                </label>
                <input
                  type="text"
                  placeholder="@onur"
                  value={nickname}
                  maxLength={20}
                  onChange={(e) => {
                    setNickname(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full bg-black/40 border border-white/15 text-white placeholder:text-neutral-500 rounded-2xl px-3.5 py-3.5 sm:py-3 text-sm font-semibold focus:outline-none focus:border-[#CCFF00] transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-black text-neutral-300 uppercase tracking-wider block">
                  Neredesin? 📍
                </label>
                <input
                  type="text"
                  placeholder="Örn: Çekmeköy"
                  value={userCity}
                  maxLength={25}
                  onChange={(e) => setUserCity(e.target.value)}
                  className="w-full bg-black/40 border border-white/15 text-white placeholder:text-neutral-500 rounded-2xl px-3.5 py-3.5 sm:py-3 text-sm font-semibold focus:outline-none focus:border-[#CCFF00] transition"
                />
              </div>
            </div>
          )}

          {/* Kapsülün Ömrü / Süresi */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-neutral-300 uppercase tracking-wider block">
                Kapsülün Süresi ⏳
              </label>
              <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">Süre bitince uçar</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { hours: 24, label: '24 Saat', desc: '1 Günlük Hızlı', icon: '⚡' },
                { hours: 48, label: '48 Saat', desc: '2 Günlük Klasik', icon: '💣' },
                { hours: 168, label: '1 Hafta', desc: '7 Günlük Seyahat', icon: '🗓️' },
                { hours: 0, label: 'Süresiz', desc: 'Sonsuza Dek', icon: '♾️' },
              ].map((d) => (
                <button
                  key={d.hours}
                  type="button"
                  onClick={() => setSelectedDuration(d.hours)}
                  className={`p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    selectedDuration === d.hours
                      ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-white '
                      : 'bg-white/5 border-white/10 text-neutral-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="text-base">{d.icon}</span>
                  <span className={`font-black text-xs ${selectedDuration === d.hours ? 'text-[#CCFF00]' : 'text-neutral-200'}`}>
                    {d.label}
                  </span>
                  <span className="text-[9px] text-neutral-400 font-mono leading-tight">{d.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Başlat Butonu */}
          <button
            onClick={createCapsule}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-[#CCFF00] text-black font-black text-base flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="font-extrabold">Kapsül Oluşturuluyor...</span>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-black shrink-0" />
                <span>Ortak Kapsülü Başlat 🚀</span>
              </>
            )}
          </button>

          {/* Kapsül Kodu ile Doğrudan Bağlanma Bölümü */}
          <div className="pt-2 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-bold">Bir Arkadaşının Kapsülüne Gir:</span>
              <span className="font-mono text-[10px] text-[#CCFF00] font-black tracking-wider">KAPSÜL KODU</span>
            </div>

            
            <div className="relative">
              <input
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinWithCode()}
                placeholder="Kapsül kodunu buraya gir (Örn: I56XBR)..."
                className="w-full h-14 text-center font-mono text-lg font-black rounded-xl bg-black/50 border border-white/15 text-white placeholder:text-neutral-600 focus:border-[#CCFF00] focus:bg-white/5 transition-all outline-none uppercase"
              />
              {joinCode.length > 0 && (
                <button 
                  onClick={() => setJoinCode('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 text-center font-mono">
              Arkadaşından aldığın Kapsül Kodunu yaz (örn: <span className="text-[#CCFF00] font-bold">I56XBR</span>) veya yapıştır.
            </p>

            {fullCode.length >= 4 && (
              <button
                onClick={handleJoinWithCode}
                disabled={joinLoading}
                className="w-full py-3 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                {joinLoading ? 'Bağlanılıyor...' : <>Kapsüle Katıl <ArrowRight className="w-3.5 h-3.5 text-black" /></>}
              </button>
            )}
          </div>

          {/* Hata Bildirimi */}
          
            {errorMsg && (
              <div className="text-xs font-bold text-[#FF2E93] bg-[#FF2E93]/15 border border-[#FF2E93]/30 rounded-2xl p-3 text-center">
                {errorMsg}
              </div>
            )}
          
        </div>
      </div>

      <footer className="relative z-10 pt-6 text-neutral-500 text-[11px] font-mono tracking-wider select-none text-center flex items-center justify-center gap-3 flex-wrap">
        <span>SHARED VAULT // DISTANCE MELTER // 48H CLOUD CAPSULE</span>
        <span className="text-neutral-700 hidden sm:inline">&bull;</span>
        <a 
          href="/admin" 
          className="text-neutral-500 hover:text-[#CCFF00] transition flex items-center gap-1"
          title="Yönetici Paneli"
        >
          <Lock className="w-3 h-3" />
          <span>YÖNETİCİ</span>
        </a>
      </footer>
    </main>
  );
}
