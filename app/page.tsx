'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, Camera, Zap, Flame, Bomb, MapPin, Globe, Radio, Lock } from 'lucide-react';

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
  const [selectedDuration, setSelectedDuration] = useState<number>(48);
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    const savedNick = localStorage.getItem('snaproom_nickname');
    if (savedNick) setNickname(savedNick);

    const savedCity = localStorage.getItem('snaproom_city');
    if (savedCity) setUserCity(savedCity);
  }, []);

  const handleDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!cleaned) {
      const newDigits = [...codeDigits];
      newDigits[index] = '';
      setCodeDigits(newDigits);
      return;
    }
    const lastChar = cleaned.slice(-1);
    const newDigits = [...codeDigits];
    newDigits[index] = lastChar;
    setCodeDigits(newDigits);
    setErrorMsg('');

    if (lastChar && index < 5) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  // Yapıştırma (Paste) Desteği: kullanıcı "I56XBR" veya direkt oda linki yapıştırdığında otomatik doldurur
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').trim();
    let cleanCode = pasted;
    const match = pasted.match(/room\/([a-zA-Z0-9]{4,8})/i);
    if (match) {
      cleanCode = match[1];
    } else {
      cleanCode = pasted.replace(/[^a-zA-Z0-9]/g, '');
    }
    cleanCode = cleanCode.toUpperCase().slice(0, 6);
    if (!cleanCode) return;

    const newDigits = ['', '', '', '', '', ''];
    for (let i = 0; i < cleanCode.length; i++) {
      newDigits[i] = cleanCode[i];
    }
    setCodeDigits(newDigits);
    setErrorMsg('');

    const nextIndex = Math.min(cleanCode.length, 5);
    inputRefs[nextIndex].current?.focus();
  };

  const fullCode = codeDigits.join('').trim().toUpperCase();

  // Kapsül Kodu veya Eski PIN ile Katıl
  const handleJoinWithCode = async () => {
    if (!nickname.trim()) {
      setErrorMsg('Lütfen önce bir rumuz belirle!');
      return;
    }
    if (fullCode.length < 4) {
      setErrorMsg('Lütfen en az 4 veya 6 haneli Kapsül Kodunu eksiksiz gir.');
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
      const { data: room, error } = await supabase
        .from('rooms')
        .insert({
          short_id: shortId,
          pin_hash: generatedPin,
          is_disposable_mode: false,
          is_unlocked: true,
          location: finalTitle,
          spotify_url: '',
          upload_locked_at: uploadLockedAt,
        })
        .select()
        .single();

      setLoading(false);

      if (error || !room) {
        setErrorMsg(`Ortak kapsül oluşturulurken hata: ${error?.message || 'Bilinmeyen hata'}`);
        return;
      }

      localStorage.setItem('snaproom_nickname', nickname.trim());
      if (userCity.trim()) localStorage.setItem('snaproom_city', userCity.trim());

      router.push(`/room/${shortId}?token=${generatedPin}`);
    } catch (e: any) {
      setLoading(false);
      setErrorMsg(`Sunucu hatası: ${e.message || 'Bilinmeyen hata'}`);
    }
  };

  return (
    <main className="relative min-h-screen w-full text-[#F3F4F6] flex flex-col justify-center items-center p-4 sm:p-6 overflow-hidden selection:bg-[#CCFF00] selection:text-black">
      
      {/* 1. CANLI AMBIENT MESH GRADIENT */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            x: [0, 80, -40, 0],
            y: [0, -60, 40, 0],
            scale: [1, 1.25, 0.9, 1],
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-24 -left-20 w-[480px] h-[480px] bg-gradient-to-tr from-[#7928CA]/40 to-[#4F46E5]/30 rounded-full blur-[130px]"
        />

        <motion.div
          animate={{
            x: [0, -70, 50, 0],
            y: [0, 80, -50, 0],
            scale: [1, 1.15, 1.05, 1],
          }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-28 -right-20 w-[520px] h-[520px] bg-gradient-to-bl from-[#FF2E93]/35 to-[#FF0055]/25 rounded-full blur-[140px]"
        />

        <motion.div
          animate={{
            scale: [0.9, 1.15, 0.95, 0.9],
            opacity: [0.2, 0.35, 0.25, 0.2],
          }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#CCFF00]/15 rounded-full blur-[160px]"
        />

        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* 2. UÇUŞAN UZAKTAN DUMP POLAROID'LERİ */}
      <motion.div
        initial={{ y: -40, opacity: 0, rotate: -18 }}
        animate={{ y: 0, opacity: 0.85, rotate: -12 }}
        whileHover={{ scale: 1.05, rotate: -8, opacity: 1, zIndex: 30 }}
        transition={{ type: 'spring', damping: 15 }}
        className="hidden lg:block absolute top-12 left-12 z-0 w-44 bg-white p-2.5 pb-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-white/40 cursor-pointer select-none"
      >
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
      </motion.div>

      <motion.div
        initial={{ y: -40, opacity: 0, rotate: 16 }}
        animate={{ y: 0, opacity: 0.85, rotate: 9 }}
        whileHover={{ scale: 1.05, rotate: 4, opacity: 1, zIndex: 30 }}
        transition={{ type: 'spring', damping: 15, delay: 0.1 }}
        className="hidden lg:block absolute top-14 right-12 z-0 w-44 bg-white p-2.5 pb-5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] border border-white/40 cursor-pointer select-none"
      >
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
      </motion.div>

      {/* 3. MERKEZİ KAPSÜL KARTI */}
      <div className="relative z-20 w-full max-w-[460px] my-auto">
        
        {/* KARTA YAPIŞIK ROZETLER */}
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: -7 }}
          whileHover={{ scale: 1.1, rotate: 0 }}
          className="absolute -top-4 -left-3 sm:-left-6 z-30 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#CCFF00] text-black font-black text-[11px] tracking-wider uppercase shadow-[0_8px_20px_rgba(204,255,0,0.4)] border-2 border-black select-none cursor-default"
        >
          <Radio className="w-3.5 h-3.5 shrink-0 fill-black animate-pulse" />
          <span>UZAKTAN ORTAK DUMP</span>
        </motion.div>

        <motion.div
          initial={{ scale: 0, rotate: 18 }}
          animate={{ scale: 1, rotate: 6 }}
          whileHover={{ scale: 1.1, rotate: 0 }}
          className="absolute -top-4 -right-3 sm:-right-6 z-30 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FF2E93] text-white font-black text-[11px] tracking-wider uppercase shadow-[0_8px_20px_rgba(255,46,147,0.4)] border-2 border-white/20 select-none cursor-default"
        >
          <Bomb className="w-3.5 h-3.5 shrink-0" />
          <span>
            {selectedDuration === 24
              ? '24H HIZLI DUMP ⚡'
              : selectedDuration === 168
              ? '7 GÜN SEYAHAT 🗓️'
              : '48H CLOUD CAPSULE 💣'}
          </span>
        </motion.div>

        {/* ANA GLASS KART */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 140 }}
          className="relative bg-white/[0.04] backdrop-blur-2xl border border-white/15 rounded-[32px] p-6 sm:p-8 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.9)] space-y-5 overflow-hidden"
        >
          <div className="flex flex-col items-center text-center space-y-2 pt-2">
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7928CA]/40 via-[#FF2E93]/30 to-[#CCFF00]/30 border border-white/20 flex items-center justify-center mb-1 shadow-lg"
            >
              <Globe className="w-8 h-8 text-[#CCFF00] shrink-0 drop-shadow-[0_0_10px_rgba(204,255,0,0.5)]" />
            </motion.div>
            
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center justify-center gap-1">
              Ortak Kapsül<span className="text-[#CCFF00] drop-shadow-[0_0_15px_rgba(204,255,0,0.8)]">.</span>
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
          <div className="grid grid-cols-2 gap-2.5">
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
                className="w-full bg-black/40 border border-white/15 text-white placeholder:text-neutral-500 rounded-2xl px-3.5 py-3 text-sm font-semibold focus:outline-none focus:border-[#CCFF00] transition"
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
                className="w-full bg-black/40 border border-white/15 text-white placeholder:text-neutral-500 rounded-2xl px-3.5 py-3 text-sm font-semibold focus:outline-none focus:border-[#CCFF00] transition"
              />
            </div>
          </div>

          {/* Kapsülün Ömrü / Süresi */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-neutral-300 uppercase tracking-wider block">
                Kapsülün Süresi ⏳
              </label>
              <span className="text-[10px] text-neutral-400 font-mono">Süre bitince fotoğraflar uçar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
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
                      ? 'bg-[#CCFF00]/15 border-[#CCFF00] text-white shadow-[0_0_15px_rgba(204,255,0,0.25)]'
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
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={createCapsule}
            disabled={loading}
            className="w-full py-4 px-6 rounded-2xl bg-[#CCFF00] text-black font-black text-base flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.5)] hover:shadow-[0_0_45px_rgba(204,255,0,0.8)] transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <span className="font-extrabold">Kapsül Oluşturuluyor...</span>
            ) : (
              <>
                <Sparkles className="w-5 h-5 text-black shrink-0" />
                <span>Ortak Kapsülü Başlat 🚀</span>
              </>
            )}
          </motion.button>

          {/* Kapsül Kodu ile Doğrudan Bağlanma Bölümü */}
          <div className="pt-2 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-neutral-400">
              <span className="font-bold">Bir Arkadaşının Kapsülüne Gir:</span>
              <span className="font-mono text-[10px] text-[#CCFF00] font-black tracking-wider">6 HANELİ KAPSÜL KODU</span>
            </div>

            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
              {codeDigits.map((digit, idx) => (
                <input
                  key={idx}
                  ref={inputRefs[idx]}
                  type="text"
                  maxLength={1}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={digit}
                  onPaste={handlePaste}
                  onChange={(e) => handleDigitChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  placeholder="•"
                  className={`w-full h-12 text-center font-mono text-lg sm:text-xl font-black rounded-xl bg-black/50 border transition-all outline-none uppercase ${
                    digit 
                      ? 'border-[#CCFF00] text-[#CCFF00] bg-[#CCFF00]/10 shadow-[0_0_12px_rgba(204,255,0,0.25)]' 
                      : 'border-white/15 text-white focus:border-[#CCFF00] focus:bg-white/5'
                  }`}
                />
              ))}
            </div>

            <p className="text-[11px] text-neutral-400 text-center font-mono">
              Arkadaşından aldığın 6 haneli Kapsül Kodunu yaz (örn: <span className="text-[#CCFF00] font-bold">I56XBR</span>) veya yapıştır.
            </p>

            {fullCode.length >= 4 && (
              <button
                onClick={handleJoinWithCode}
                disabled={joinLoading}
                className="w-full py-3 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(204,255,0,0.4)] transition cursor-pointer"
              >
                {joinLoading ? 'Bağlanılıyor...' : <>Kapsüle Katıl <ArrowRight className="w-3.5 h-3.5 text-black" /></>}
              </button>
            )}
          </div>

          {/* Hata Bildirimi */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs font-bold text-[#FF2E93] bg-[#FF2E93]/15 border border-[#FF2E93]/30 rounded-2xl p-3 text-center"
              >
                {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
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
