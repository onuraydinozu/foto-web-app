'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldAlert, HardDrive, Trash2, Key, RefreshCw, 
  Clock, MapPin, Eye, Lock, CheckCircle2, AlertTriangle, ArrowRight, Camera,
  Flame, Sparkles, X, Check
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Tüm Depoyu Silme (Purge) Modalı
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('snaproom_admin_token');
    if (saved) {
      setToken(saved);
      fetchAdminData(saved);
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${password.trim()}` },
      });

      if (!res.ok) {
        throw new Error('Hatalı Admin Şifresi! Lütfen ADMIN_SECRET_KEY değerini kontrol edin.');
      }

      const resData = await res.json();
      localStorage.setItem('snaproom_admin_token', password.trim());
      setToken(password.trim());
      setData(resData);
      setAuthenticated(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async (authToken = token) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const resData = await res.json();
        setData(resData);
        setAuthenticated(true);
      } else {
        localStorage.removeItem('snaproom_admin_token');
        setAuthenticated(false);
      }
    } catch (err) {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  // Tek Bir Odayı Silme
  const handleNukeRoom = async (roomId: string, shortId: string) => {
    if (!confirm(`"${shortId}" odasını ve Cloudflare R2'deki tüm dosyalarını kalıcı olarak silmek istediğinize emin misiniz?`)) {
      return;
    }

    setActionLoading(roomId);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'delete_room', roomId }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Oda silinemedi');
      }

      alert(`Oda (${shortId}) ve Cloudflare R2'deki tüm dosyaları kalıcı olarak silindi.`);
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız');
    } finally {
      setActionLoading(null);
    }
  };

  // TÜM DEPOYU SİL / BOŞALT (PURGE ALL STORAGE)
  const handlePurgeAllStorage = async () => {
    if (purgeConfirmText.trim().toUpperCase() !== 'SIFIRLA') {
      alert('Lütfen onay kutusuna SIFIRLA yazın!');
      return;
    }

    setIsPurging(true);
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'purge_all_storage' }),
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Depo temizlenirken bir hata oluştu');
      }

      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#CCFF00', '#FF2E93', '#FFFFFF'],
      });

      setPurgeResult(resJson.message || 'Tüm depo başarıyla sıfırlandı!');
      setShowPurgeModal(false);
      setPurgeConfirmText('');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'İşlem başarısız');
    } finally {
      setIsPurging(false);
    }
  };

  // 1. ŞİFRE GİRİŞ EKRANI
  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#08090E] text-white flex flex-col items-center justify-center p-4 selection:bg-[#CCFF00] selection:text-black">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm bg-[#12151F] border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 text-[#CCFF00] flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(204,255,0,0.2)]">
            <Lock className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-black">SnapRoom Admin</h1>
            <p className="text-xs text-neutral-400 mt-1 font-mono">
              Yönetici paneline erişmek için anahtar şifreyi girin.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="ADMIN_SECRET_KEY..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-black/50 border border-white/15 text-white placeholder:text-neutral-600 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[#CCFF00] transition"
            />

            {errorMsg && (
              <p className="text-xs font-bold text-[#FF2E93] bg-[#FF2E93]/10 p-2.5 rounded-xl border border-[#FF2E93]/20">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-sm flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-[0_0_20px_rgba(204,255,0,0.3)]"
            >
              {loading ? 'Doğrulanıyor...' : <>Giriş Yap <ArrowRight className="w-4 h-4 stroke-[3]" /></>}
            </button>
          </form>

          <p className="text-[11px] text-neutral-500 font-mono">
            Varsayılan Şifre: <span className="text-[#CCFF00]">snapadmin2026</span>
          </p>
        </motion.div>
      </main>
    );
  }

  // 2. YÖNETİCİ KONSOLU
  const metrics = data?.metrics || {};
  const rooms = data?.rooms || [];

  const usedMB = (metrics.usedBytes / (1024 * 1024)).toFixed(1);
  const usedGB = (metrics.usedBytes / (1024 * 1024 * 1024)).toFixed(2);
  const usedPercent = Math.min(100, (metrics.usedBytes / (metrics.maxSafeBytes || 1)) * 100);

  return (
    <main className="min-h-screen bg-[#08090E] text-white p-4 sm:p-8 pb-28 selection:bg-[#CCFF00] selection:text-black">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* BİLDİRİM (TOAST / ALERT) */}
        {purgeResult && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/40 text-[#CCFF00] flex items-center justify-between text-xs font-bold font-mono"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{purgeResult}</span>
            </div>
            <button onClick={() => setPurgeResult(null)} className="text-neutral-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* HEADER */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#12151F] border border-white/10 p-5 sm:p-6 rounded-3xl shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#CCFF00] animate-pulse" />
              <h1 className="text-2xl font-black">SnapRoom // Admin Console</h1>
            </div>
            <p className="text-xs text-neutral-400 font-mono mt-1">
              CLOUDFLARE R2 & SUPABASE GOD MODE
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* TÜM DEPOYU SİL BUTONU */}
            <button
              onClick={() => {
                setPurgeConfirmText('');
                setShowPurgeModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.4)]"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Tüm Depoyu Temizle 💥</span>
            </button>

            <button
              onClick={() => fetchAdminData()}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-neutral-300 flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Yenile</span>
            </button>

            <button
              onClick={() => {
                localStorage.removeItem('snaproom_admin_token');
                setAuthenticated(false);
              }}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-red-950/60 border border-white/10 hover:border-red-500/30 text-xs font-bold text-neutral-400 hover:text-red-400 transition cursor-pointer"
            >
              Çıkış
            </button>
          </div>
        </header>

        {/* METRİK KARTLARI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* R2 Depolama Kullanımı */}
          <div className="md:col-span-2 bg-[#12151F] border border-white/10 p-5 sm:p-6 rounded-3xl space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-xl bg-[#CCFF00]/10 text-[#CCFF00] border border-[#CCFF00]/20">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Cloudflare R2 Depolama Alanı</h3>
                  <p className="text-xs text-neutral-400 font-mono">10 GB Ücretsiz Kota Koruması</p>
                </div>
              </div>

              <span className="font-mono text-sm font-black text-[#CCFF00]">
                {Number(usedGB) >= 0.1 ? `${usedGB} GB` : `${usedMB} MB`} / 9.5 GB
              </span>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="w-full h-3.5 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(2, usedPercent)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    usedPercent >= 90 ? 'bg-[#FF2E93]' : usedPercent >= 75 ? 'bg-[#FFD600]' : 'bg-[#CCFF00]'
                  }`}
                />
              </div>
              <div className="flex justify-between text-[11px] text-neutral-400 font-mono">
                <span>%{usedPercent.toFixed(1)} Kullanıldı</span>
                <span>Emniyet Sınırı: 9.5 GB (Aşarsa yükleme otomatik kilitlenir)</span>
              </div>
            </div>
          </div>

          {/* Dosya & Oda Sayısı */}
          <div className="bg-[#12151F] border border-white/10 p-5 sm:p-6 rounded-3xl flex flex-col justify-between shadow-xl">
            <div className="flex items-center gap-2">
              <div className="p-2.5 rounded-xl bg-[#7928CA]/20 text-violet-300 border border-[#7928CA]/30">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Bulut Verisi</h3>
                <p className="text-xs text-neutral-400 font-mono">Cloudflare R2 & DB</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-end">
              <div>
                <p className="text-3xl font-black text-white">{metrics.fileCount || 0}</p>
                <p className="text-[11px] text-neutral-400 font-mono">FOTO / VİDEO</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-neutral-300">{rooms.length}</p>
                <p className="text-[11px] text-neutral-500 font-mono">AKTİF KAPSÜL</p>
              </div>
            </div>
          </div>

        </div>

        {/* AKTİF ODALAR LİSTESİ */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Aktif Odalar ({rooms.length})</h2>
            <span className="text-xs text-neutral-400 font-mono">48 SAAT TTL YÖNETİMİ</span>
          </div>

          {rooms.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-[#12151F]/40 border border-dashed border-white/10 text-neutral-500">
              Henüz açılmış oda bulunmuyor veya depo tamamen temizlendi.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rooms.map((room: any) => {
                const createdDate = new Date(room.created_at);
                const expiresDate = new Date(createdDate.getTime() + 48 * 60 * 60 * 1000);
                const hoursLeft = Math.max(0, Math.round((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60)));

                return (
                  <div
                    key={room.id}
                    className="p-5 rounded-3xl bg-[#12151F] border border-white/10 hover:border-white/20 transition space-y-4 shadow-lg flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-black text-white">
                              Kapsül: {room.short_id}
                            </span>
                            <span className="text-xs font-mono font-bold bg-[#CCFF00]/10 text-[#CCFF00] px-2 py-0.5 rounded border border-[#CCFF00]/30">
                              PIN: {room.pin_hash}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{room.location || 'Konum Belirtilmedi'}</span>
                          </p>
                        </div>

                        <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
                          {room.photo_count} Medya
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs font-mono text-neutral-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-[#FF2E93]" />
                          <span>{hoursLeft}s sonra silinecek</span>
                        </span>
                        <span>{createdDate.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    {/* AKSİYON BUTONLARI */}
                    <div className="pt-2 flex items-center gap-2">
                      <a
                        href={`/room/${room.short_id}?pin=${room.pin_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Odaya Git</span>
                      </a>

                      <button
                        onClick={() => handleNukeRoom(room.id, room.short_id)}
                        disabled={actionLoading === room.id}
                        className="py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-400 hover:text-red-300 font-bold text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                        title="Odayı ve R2 dosyalarını kalıcı olarak temizle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{actionLoading === room.id ? 'Siliniyor...' : 'Odayı Uçur 💥'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

      </div>

      {/* ========================================================
          TÜM DEPOYU SİLME (PURGE ALL STORAGE) ONAY MODALI
         ======================================================== */}
      <AnimatePresence>
        {showPurgeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => !isPurging && setShowPurgeModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border border-red-500/40 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-[0_0_60px_rgba(239,68,68,0.3)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-500">
                  <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                  <h3 className="text-lg font-black text-white">Tüm Depoyu Temizle</h3>
                </div>
                {!isPurging && (
                  <button
                    onClick={() => setShowPurgeModal(false)}
                    className="p-1 text-neutral-400 hover:text-white rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/20 text-xs text-red-200 space-y-2">
                <p className="font-bold">⚠️ BU İŞLEM GERİ ALINAMAZ!</p>
                <p>
                  Cloudflare R2 depolama alanındaki <b>TÜM fotoğraflar, ses kayıtları ve videolar</b> anında ve kalıcı olarak silinecek.
                </p>
                <p>
                  Kullanılan depolama alanı <b>0 Byte</b>&apos;a düşürülecek ve tüm kota tamamen serbest kalacaktır.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-mono text-neutral-300 block">
                  Onaylamak için aşağıdaki kutuya <span className="text-red-400 font-bold">SIFIRLA</span> yazın:
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="SIFIRLA"
                  value={purgeConfirmText}
                  onChange={(e) => setPurgeConfirmText(e.target.value)}
                  className="w-full bg-black/60 border border-red-500/40 text-white placeholder:text-neutral-600 rounded-xl px-4 py-3 text-sm font-mono text-center uppercase tracking-widest font-black focus:outline-none focus:border-red-500"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isPurging}
                  onClick={() => setShowPurgeModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="button"
                  disabled={isPurging || purgeConfirmText.trim().toUpperCase() !== 'SIFIRLA'}
                  onClick={handlePurgeAllStorage}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center justify-center gap-2 transition disabled:opacity-40 cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.5)]"
                >
                  {isPurging ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Siliniyor...
                    </span>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Depoyu Sıfırla 💥</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
