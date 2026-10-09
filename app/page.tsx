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

  
  const handleLogout = async () => {
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
    <main className="relative min-h-screen w-full text-[#F3F4F6] flex flex-col justify-start sm:justify-center items-center pt-24 sm:pt-6 p-4 sm:p-6 pb-20 overflow-x-hidden selection:bg-[#CCFF00] selection:text-black">
      
      {/* AUTH MODALI */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={(newUser: any) => {
          setUser(newUser);
          fetchMyCapsules(newUser);
        }} 
      />

      {/* 1. CANLI AMBIENT MESH GRADIENT */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-20 w-[480px] h-[480px] bg-gradient-to-tr from-[#7928CA]/40 to-[#4F46E5]/30 rounded-full blur-[60px] opacity-40" />

        <div className="absolute -bottom-28 -right-20 w-[520px] h-[520px] bg-gradient-to-bl from-[#FF2E93]/35 to-[#FF0055]/25 rounded-full blur-[60px] opacity-40" />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#CCFF00]/15 rounded-full blur-[80px] opacity-20" />

        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

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

      {/* HESAP & KAPSÜLLERİM ALANI (BİRLEŞTİRİLMİŞ) */}
      <div className="w-full max-w-md mx-auto mb-6 relative z-10">
        {user ? (
          
            <div
              className="bg-[#12151F]/90 backdrop-blur-sm rounded-[2rem] border border-[#CCFF00]/20 p-5 shadow-md relative"
            >
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#CCFF00]/20 flex items-center justify-center border border-[#CCFF00]/30">
                    <User className="w-4 h-4 text-[#CCFF00]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white text-xs font-bold truncate max-w-[150px] sm:max-w-[200px]">{user?.user_metadata?.username || user?.email?.split("@")[0] || "Kullanıcı"}</span>
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
                      onClick={() => { if (!nickname.trim() && !localStorage.getItem('snaproom_nickname')) { setErrorMsg('Lütfen önce sayfadaki kutucuğa bir Rumuz yaz!'); return; } if (nickname.trim()) localStorage.setItem('snaproom_nickname', nickname.trim()); router.push(`/room/${cap.short_id}`); }}
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
            </div>
          
        ) : (
          <div
            className="bg-gradient-to-r from-[#12151F]/90 to-[#12151F]/80 backdrop-blur-sm rounded-[2rem] border border-white/15 p-5 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-2xl bg-[#CCFF00] flex items-center justify-center shadow-sm">
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
          className="relative bg-white/[0.04] backdrop-blur-sm border border-white/15 rounded-[32px] p-6 sm:p-8 shadow-2xl space-y-5 overflow-hidden"
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
