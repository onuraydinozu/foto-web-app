'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Car, Star, Navigation, Vote, Send, Sparkles, Bot, Compass, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PlaceRadarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  currentUserNick: string;
  channel: any;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  places?: any[];
}

// 6 Kategori Matrisi (Grup Modları)
const CATEGORIES = [
  { id: '☕ 3. Nesil Kahve & Tatlı', label: '3. Nesil Kahve', icon: '☕' },
  { id: '🍔 Hızlı / Sokak Lezzeti', label: 'Hızlı / Sokak', icon: '🍔' },
  { id: '🍝 Oturmalı Yemek (Dinner)', label: 'Oturmalı Yemek', icon: '🍝' },
  { id: '🍻 Pub / Bar & Gece', label: 'Pub / Gece', icon: '🍻' },
  { id: '🎯 Aktivite & Kaos', label: 'Aktivite & Kaos', icon: '🎯' },
  { id: '🥐 Kahvaltı & Brunch', label: 'Kahvaltı & Brunch', icon: '🥐' },
];

const DISTRICTS = ['Kadıköy', 'Moda', 'Beşiktaş', 'Karaköy', 'Cihangir', 'Bağdat Cad.'];

const FILTERS = [
  { id: 'parking', label: '🚗 Kolay Otopark / Vale' },
  { id: 'rating', label: '⭐ 4.3+ Üstü' },
  { id: 'open', label: '🟢 Açık' }
];

const QUICK_PROMPTS = [
  '🍗 Sınırsız Tavuk / Kanat',
  '💻 Prizli & Sessiz Kafe',
  '🌙 02:00 Sonrası Açık',
  '🚗 Parkı Kolay Mekan'
];

export default function PlaceRadarDrawer({ isOpen, onClose, roomId, currentUserNick, channel }: PlaceRadarDrawerProps) {
  // Tabs: 'categories' | 'ai'
  const [activeTab, setActiveTab] = useState<'categories' | 'ai'>('categories');

  // Kategori Radarı State'leri
  const [district, setDistrict] = useState('Kadıköy');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [activeFilters, setActiveFilters] = useState<string[]>(['rating']);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [votingFor, setVotingFor] = useState<string | null>(null);

  // AI Chat State'leri
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Selam! Nereye akıyoruz? Bana semti ve ne tarz bir yer aradığını söyle (Örn: Moda'da sakin kahveci, Kadıköy sınırsız tavuk)."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Mobil Scroll Kilidi & Popstate
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.history.pushState({ modal: 'radar' }, '');
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handlePopState = () => { if (isOpen) onClose(); };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen, onClose]);

  // Canlı Mekan Çekme Fonksiyonu
  const executeSearch = async (
    targetCat = category,
    targetDistrict = district,
    targetLoc = location,
    targetFilters = activeFilters
  ) => {
    setLoadingPlaces(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/places/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          district: targetDistrict,
          lat: targetLoc?.lat,
          lng: targetLoc?.lng,
          category: targetCat,
          filters: targetFilters
        })
      });

      const data = await res.json();
      if (data.success) {
        setPlaces(data.data || []);
        if ((!data.data || data.data.length === 0) && data.message) {
          setErrorMessage(data.message);
        }
      } else {
        setErrorMessage(data.error || 'Mekanlar taranırken bir hata oluştu.');
      }
    } catch (e: any) {
      console.error(e);
      setErrorMessage('Bağlantı hatası: Sunucuya ulaşılamadı.');
    } finally {
      setLoadingPlaces(false);
    }
  };

  // Açılışta veya sekme değişiminde ilk sorgu
  useEffect(() => {
    if (isOpen && activeTab === 'categories') {
      executeSearch(category, district, location, activeFilters);
    }
  }, [isOpen, activeTab]);

  // Gerçek GPS Konumunu Al
  const handleGetLocation = () => {
    if (!('geolocation' in navigator)) {
      alert('Cihazınızda veya tarayıcınızda GPS/Konum desteği bulunmuyor. Lütfen listeden semt seçin.');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLocation(coords);
        setDistrict('Anlık Konum');
        setGpsLoading(false);
        // Konum gelir gelmez anlık canlı arama yap
        executeSearch(category, 'Anlık Konum', coords, activeFilters);
      },
      err => {
        setGpsLoading(false);
        let errorMsg = 'Konum izni alınamadı.';
        if (err.code === 1) errorMsg = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından izin verin veya semt seçin.';
        else if (err.code === 2) errorMsg = 'GPS sinyali bulunamadı. Lütfen semt seçerek devam edin.';
        alert(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Kategori Tıklandığında Anında Canlı Yenile
  const handleSelectCategory = (catId: string) => {
    setCategory(catId);
    executeSearch(catId, district, location, activeFilters);
  };

  // Semt Değiştiğinde Anında Canlı Yenile
  const handleSelectDistrict = (d: string) => {
    setDistrict(d);
    setLocation(null); // GPS modundan çıkıp semt moduna geç
    executeSearch(category, d, null, activeFilters);
  };

  // Filtre Değiştiğinde Canlı Yenile
  const toggleFilter = (fId: string) => {
    const updated = activeFilters.includes(fId)
      ? activeFilters.filter(x => x !== fId)
      : [...activeFilters, fId];
    setActiveFilters(updated);
    executeSearch(category, district, location, updated);
  };

  // AI Chat Mesaj Gönder
  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoadingAi) return;
    const userText = textToSend.trim();
    setInput('');
    const userMsg: MessageItem = {
      id: Date.now().toString(),
      role: 'user',
      content: userText
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsLoadingAi(true);

    try {
      const res = await fetch('/api/places/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          userCoords: location ? { lat: location.lat, lng: location.lng } : null
        })
      });

      if (!res.ok) throw new Error('Sunucu yanıt vermedi');
      const data = await res.json();

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.content || '',
          places: data.places || []
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Ufak bir bağlantı aksaması oldu. Tekrar dener misin?',
          places: []
        }
      ]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleVote = async (place: any) => {
    setVotingFor(place.place_id);
    if (channel) {
      channel.send({
        type: 'broadcast',
        event: 'place_vote_start',
        payload: {
          place: place,
          started_by: currentUserNick,
          expires_at: Date.now() + 60000
        }
      });
    }
    try {
      await supabase.from('place_votes').insert({
        room_id: roomId,
        place_name: place.name,
        place_address: place.district || place.address,
        voters: [currentUserNick],
        votes_count: 1
      });
    } catch (e) {}

    setTimeout(() => {
      setVotingFor(null);
      alert('Oylama masaya gönderildi! (60s)');
    }, 1000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => window.history.back()}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
              if (offset.y > 100 || velocity.y > 500) window.history.back();
            }}
            className="relative h-[88vh] w-full bg-[#090A0F] border-t border-white/10 rounded-t-[32px] flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
          >
            {/* Tutamaç */}
            <div className="w-full flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>

            {/* Header & Segmented Switcher */}
            <div className="px-5 pb-3 border-b border-white/5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-white flex items-center gap-2">
                  <span className="text-[#CCFF00]">📍</span> NEREYE AKSAK?
                </h2>
                <button onClick={() => window.history.back()} className="p-1.5 rounded-full bg-white/5 text-neutral-400 hover:text-white transition">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Segmented Switcher */}
              <div className="grid grid-cols-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                <button
                  onClick={() => setActiveTab('categories')}
                  className={`py-1.5 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'categories'
                      ? 'bg-[#CCFF00] text-black shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5" />
                  Kategori Radarı (6 Mod)
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`py-1.5 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    activeTab === 'ai'
                      ? 'bg-[#CCFF00] text-black shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Masa Gurmesi (AI)
                </button>
              </div>
            </div>

            {/* TAB 1: KATEGORİ RADARI */}
            {activeTab === 'categories' && (
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-4 custom-scrollbar pb-24">
                {/* Semt / GPS Seçimi */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono font-bold text-neutral-400">📍 LOKASYON BELİRLE:</label>
                    <button 
                      onClick={handleGetLocation} 
                      disabled={gpsLoading}
                      className="text-[11px] text-[#CCFF00] font-black flex items-center gap-1 hover:underline cursor-pointer disabled:opacity-50"
                    >
                      <Navigation className={`w-3.5 h-3.5 ${gpsLoading ? 'animate-spin' : ''}`} />
                      {gpsLoading ? 'GPS Alınıyor...' : '⚡ Anlık Konumumu Kullan'}
                    </button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {location && (
                      <span className="px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap bg-[#CCFF00] text-black flex items-center gap-1">
                        <Navigation className="w-3 h-3" /> GPS Aktif
                      </span>
                    )}
                    {DISTRICTS.map(d => (
                      <button
                        key={d}
                        onClick={() => handleSelectDistrict(d)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition border cursor-pointer ${
                          district === d && !location
                          ? 'bg-white text-black border-white' 
                          : 'bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6 Kategori Matrisi */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold text-neutral-400">🎯 VIBE / 6 KATEGORİ MODU:</label>
                  <div className="grid grid-cols-2 xs:grid-cols-3 gap-2">
                    {CATEGORIES.map(c => (
                      <button
                        key={c.id}
                        onClick={() => handleSelectCategory(c.id)}
                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition border flex flex-col items-center gap-1 cursor-pointer active:scale-95 ${
                          category === c.id 
                          ? 'bg-[#CCFF00]/15 text-[#CCFF00] border-[#CCFF00]/60 shadow-[0_0_15px_rgba(204,255,0,0.15)] ring-1 ring-[#CCFF00]/50' 
                          : 'bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        <span className="text-xl">{c.icon}</span>
                        <span className="truncate w-full text-center text-[11px] font-bold">{c.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Filtreler */}
                <div className="space-y-2">
                  <label className="text-[10px] font-mono font-bold text-neutral-400">⚡ KRİTİK FİLTRELER:</label>
                  <div className="flex flex-wrap gap-2">
                    {FILTERS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => toggleFilter(f.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition border cursor-pointer ${
                          activeFilters.includes(f.id)
                          ? 'bg-violet-500/20 text-violet-300 border-violet-500/50 ring-1 ring-violet-500/40' 
                          : 'bg-white/5 text-neutral-400 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <hr className="border-white/5" />
                
                {/* Mekan Sonuçları */}
                <div className="space-y-3 pb-6">
                  <h3 className="text-xs font-black text-neutral-300 flex items-center justify-between">
                    <span>CANLI MEKAN SONUÇLARI</span>
                    {!loadingPlaces && (
                      <span className="text-[10px] text-neutral-500 font-normal">
                        {district === 'Anlık Konum' ? '📍 GPS Çevresi' : district} · {places.length} mekan
                      </span>
                    )}
                  </h3>

                  {/* SKELETON LOADING (Canlı sorgu atılırken yanıp sönen gri kutular) */}
                  {loadingPlaces ? (
                    <div className="flex flex-col gap-3">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="h-36 bg-white/5 animate-pulse rounded-2xl border border-white/10 flex flex-col justify-end p-3 gap-2">
                          <div className="w-1/3 h-4 bg-white/10 rounded-md" />
                          <div className="w-2/3 h-3 bg-white/5 rounded-md" />
                          <div className="w-1/2 h-6 bg-white/10 rounded-xl mt-2" />
                        </div>
                      ))}
                    </div>
                  ) : errorMessage ? (
                    <div className="text-center py-8 px-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex flex-col items-center gap-2">
                      <AlertCircle className="w-5 h-5" />
                      <span>{errorMessage}</span>
                    </div>
                  ) : places.length === 0 ? (
                    <div className="text-center py-8 text-neutral-500 text-sm">
                      Bu kriterlere uygun mekan bulunamadı. Lütfen semt veya filtreleri değiştirin.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {places.map((place, idx) => (
                        <div key={place.place_id || idx} className="bg-[#12151F] border border-white/10 rounded-2xl overflow-hidden flex flex-col glass-panel shadow-md">
                          <div className="h-28 relative bg-neutral-900">
                            {place.photo_url || place.photoUrl ? (
                              <img src={place.photo_url || place.photoUrl} alt={place.name} className="w-full h-full object-cover opacity-80" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-neutral-600 text-xs">Fotoğraf Yok</div>
                            )}
                            <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold text-white border border-white/10">
                              {place.price_level || '$$'}
                            </div>
                            <div className="absolute bottom-2 left-2 flex gap-1.5">
                              <div className="bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg text-xs font-bold text-amber-300 border border-amber-300/20 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-amber-300" />
                                {place.rating} ({place.review_count || 0})
                              </div>
                            </div>
                          </div>
                          
                          <div className="p-3 space-y-2">
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-white text-sm line-clamp-1 flex-1">{place.name}</h4>
                            </div>
                            
                            <div className="flex flex-wrap gap-2 text-[10px] font-mono text-neutral-400">
                              {place.distance_km !== null && place.distance_km !== undefined && (
                                <span className="flex items-center gap-1 bg-white/5 text-[#CCFF00] px-2 py-0.5 rounded-full border border-[#CCFF00]/20 font-bold">
                                  <MapPin className="w-3 h-3" />
                                  {place.distance_km.toFixed(1)} km
                                </span>
                              )}
                              <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                                📍 {place.district}
                              </span>
                              {place.parking_info?.valet && (
                                <span className="flex items-center gap-1 bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">
                                  <Car className="w-3 h-3" /> Vale
                                </span>
                              )}
                              {!place.parking_info?.valet && place.parking_info?.street && (
                                <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                                  <Car className="w-3 h-3" /> Otopark / Sokak
                                </span>
                              )}
                            </div>
                            
                            <div className="flex gap-2 pt-1 mt-1 border-t border-white/5">
                              <button 
                                onClick={() => {
                                  const query = place.lat && place.lng
                                    ? `${place.lat},${place.lng}`
                                    : encodeURIComponent(`${place.name} ${place.district}`);
                                  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                }}
                                className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer"
                              >
                                <Navigation className="w-3 h-3" />
                                Harita
                              </button>
                              <button 
                                onClick={() => handleVote(place)}
                                disabled={votingFor === place.place_id}
                                className="flex-[1.5] py-1.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer active:scale-95"
                              >
                                {votingFor === place.place_id ? (
                                  <span className="animate-pulse">Gönderiliyor...</span>
                                ) : (
                                  <>
                                    <Vote className="w-3 h-3" />
                                    Masaya Oylat
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: MASA GURMESİ AI SOHBET */}
            {activeTab === 'ai' && (
              <>
                <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 custom-scrollbar pb-32">
                  {messages.map(m => (
                    <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {m.content && (
                        <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                          m.role === 'user' 
                            ? 'bg-[#CCFF00] text-black font-medium rounded-tr-sm' 
                            : 'bg-white/10 text-neutral-200 border border-white/10 rounded-tl-sm'
                        }`}>
                          {m.role === 'assistant' && (
                            <div className="flex items-center gap-1.5 mb-1 opacity-70">
                              <Bot className="w-3 h-3" />
                              <span className="text-[10px] font-bold">Gurme</span>
                            </div>
                          )}
                          {m.content}
                        </div>
                      )}

                      {/* Render Places */}
                      {m.places && m.places.length > 0 && (
                        <div className="w-full mt-3 space-y-3">
                          {m.places.map((place: any, idx: number) => (
                            <div key={place.place_id || idx} className="bg-[#12151F] border border-white/10 rounded-2xl overflow-hidden flex flex-col shadow-md w-full max-w-[90%]">
                              <div className="p-3 space-y-2">
                                <div className="flex justify-between items-start">
                                  <h4 className="font-bold text-white text-sm line-clamp-1 flex-1 flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-[#CCFF00]" />
                                    {place.name}
                                  </h4>
                                  <div className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-300 border border-amber-300/20 flex items-center gap-1 shrink-0">
                                    <Star className="w-3 h-3 fill-amber-300" />
                                    {place.rating}
                                  </div>
                                </div>
                                
                                <p className="text-xs text-neutral-400 italic">"{place.reason}"</p>
                                
                                <div className="flex flex-wrap gap-2 text-[10px] font-mono text-neutral-400">
                                  <span className="flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full">
                                    📍 {place.district}
                                  </span>
                                  {place.parking_note && (
                                    <span className="flex items-center gap-1 bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">
                                      <Car className="w-3 h-3" /> {place.parking_note}
                                    </span>
                                  )}
                                </div>
                                
                                <div className="flex gap-2 pt-1 mt-1 border-t border-white/5">
                                  <button 
                                    onClick={() => window.open(place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name + ' ' + (place.address || place.district || ''))}`, '_blank')}
                                    className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-white/10 cursor-pointer"
                                  >
                                    <Navigation className="w-3 h-3" /> Harita
                                  </button>
                                  <button 
                                    onClick={() => handleVote(place)}
                                    disabled={votingFor === place.place_id}
                                    className="flex-[1.5] py-1.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer active:scale-95"
                                  >
                                    {votingFor === place.place_id ? (
                                      <span className="animate-pulse">Gönderiliyor...</span>
                                    ) : (
                                      <>
                                        <Vote className="w-3 h-3" /> Masaya Oylat
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {isLoadingAi && (
                    <div className="text-neutral-500 text-xs flex items-center gap-1.5 animate-pulse">
                      <Bot className="w-3 h-3" /> Gurme düşünüyor...
                    </div>
                  )}
                </div>

                {/* Input Alanı Sabit Alt Kısım */}
                <div className="absolute bottom-0 left-0 right-0 bg-[#090A0F] border-t border-white/10 p-4 pb-8">
                  {messages.length <= 1 && (
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-1">
                      {QUICK_PROMPTS.map((qp, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(qp)}
                          className="shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-neutral-300 hover:bg-[#CCFF00]/10 hover:text-[#CCFF00] transition cursor-pointer"
                        >
                          {qp}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage(input);
                    }} 
                    className="relative flex items-center"
                  >
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Örn: Sınırsız tavukçu, sessiz teras kafe..."
                      className="w-full bg-black/50 border border-white/15 rounded-2xl pl-4 pr-12 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#CCFF00] transition"
                      disabled={isLoadingAi}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isLoadingAi}
                      className="absolute right-2 p-2 rounded-xl bg-[#CCFF00] text-black disabled:opacity-30 transition cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
