'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  Trophy, ChevronRight, ChevronLeft, CheckCircle2, Sparkles, 
  Edit3, Plus, Trash2, Check, X, UserPlus, HelpCircle 
} from 'lucide-react';

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

export interface PollItem {
  id: string;
  question: string;
  options: PollOption[];
}

interface PollsCardProps {
  roomId?: string;
  channel?: any;
}

export default function PollsCard({ roomId = 'default', channel }: PollsCardProps) {
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [activePollIndex, setActivePollIndex] = useState(0);
  const [votedMap, setVotedMap] = useState<Record<string, string>>({}); // pollId -> optionId
  const [loading, setLoading] = useState(true);

  // Düzenleme ve Hızlı Ekleme Durumları
  const [isEditing, setIsEditing] = useState(false);
  const [newOptionText, setNewOptionText] = useState('');
  const [isAddingInline, setIsAddingInline] = useState(false);
  const [inlineNewName, setInlineNewName] = useState('');

  // Yeni Soru Ekleme Modalı
  const [showNewQuestionModal, setShowNewQuestionModal] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionInitialNames, setNewQuestionInitialNames] = useState('');

  const storageKey = `snaproom_polls_${roomId}`;
  const votedStorageKey = `snaproom_polls_voted_${roomId}`;

  // 1. ANKETLERİ YÜKLE (API + LocalStorage Fallback)
  useEffect(() => {
    let isMounted = true;

    // Önce oy durumunu yükle
    try {
      const savedVotes = localStorage.getItem(votedStorageKey);
      if (savedVotes) {
        setVotedMap(JSON.parse(savedVotes));
      }
    } catch (e) {}

    const loadPolls = async () => {
      let initialPolls: PollItem[] = [];

      // Eski sahte oyları veya 'Selin'/'Barış'/'Günün En İyisi Kimdi?' gibi sahte şablonları tespit et & temizle
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const hasLegacyDummy = parsed.some((p: any) =>
              p.options?.some((o: any) => o.text === 'Selin' || o.text === 'Barış' || o.votes > 10) ||
              (p.question === 'Günün En İyisi Kimdi? 🏆' && (!p.options || p.options.length === 0))
            );

            if (!hasLegacyDummy) {
              initialPolls = parsed;
            } else {
              localStorage.removeItem(storageKey);
            }
          }
        }
      } catch (e) {}

      // Sunucudan gerçek anketleri çek
      try {
        const res = await fetch(`/api/polls?roomId=${encodeURIComponent(roomId)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.polls) && data.polls.length > 0) {
            initialPolls = data.polls;
          }
        }
      } catch (e) {
        console.warn('Sunucudan anketler çekilemedi, local state kullanılıyor:', e);
      }

      if (isMounted) {
        setPolls(initialPolls);
        setLoading(false);
      }
    };

    loadPolls();

    return () => {
      isMounted = false;
    };
  }, [roomId, storageKey, votedStorageKey]);

  // 2. REALTIME KANAL DİNLEME (Başka biri soru/aday/oy eklediğinde anında güncelle)
  useEffect(() => {
    if (!channel) return;

    const subscription = channel.on('broadcast', { event: 'polls_updated' }, ({ payload }: any) => {
      if (payload && Array.isArray(payload.polls)) {
        setPolls(payload.polls);
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload.polls));
        } catch (e) {}
      }
    });

    return () => {
      // Cleanup if needed
    };
  }, [channel, storageKey]);

  // 3. ANKETLERİ KAYDET & REALTIME YAYINLA
  const savePolls = useCallback(
    async (updatedPolls: PollItem[]) => {
      setPolls(updatedPolls);

      // LocalStorage güncelle
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedPolls));
      } catch (e) {}

      // Sunucuya kaydet
      try {
        fetch('/api/polls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, polls: updatedPolls }),
        }).catch(() => {});
      } catch (e) {}

      // Realtime Broadcast fırlat
      try {
        channel?.send?.({
          type: 'broadcast',
          event: 'polls_updated',
          payload: { polls: updatedPolls },
        });
      } catch (e) {}
    },
    [channel, roomId, storageKey]
  );

  const currentPoll = polls[activePollIndex] || polls[0];
  const totalVotes = (currentPoll?.options || []).reduce((sum, opt) => sum + opt.votes, 0);

  // 4. OY KULLANMA
  const handleVote = (optionId: string) => {
    if (!currentPoll || votedMap[currentPoll.id]) return;

    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#CCFF00', '#FF2E93', '#7928CA', '#FFFFFF'],
    });

    const newVotedMap = { ...votedMap, [currentPoll.id]: optionId };
    setVotedMap(newVotedMap);
    try {
      localStorage.setItem(votedStorageKey, JSON.stringify(newVotedMap));
    } catch (e) {}

    const updated = polls.map((p, idx) => {
      if (idx !== activePollIndex) return p;
      return {
        ...p,
        options: p.options.map((opt) =>
          opt.id === optionId ? { ...opt, votes: opt.votes + 1 } : opt
        ),
      };
    });
    savePolls(updated);
  };

  const nextPoll = () => {
    if (!polls.length) return;
    setActivePollIndex((prev) => (prev + 1) % polls.length);
    setIsAddingInline(false);
  };

  const prevPoll = () => {
    if (!polls.length) return;
    setActivePollIndex((prev) => (prev - 1 + polls.length) % polls.length);
    setIsAddingInline(false);
  };

  // 5. YENİ ADAY / İSİM EKLEME
  const handleAddOption = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !currentPoll) return;

    const newOption: PollOption = {
      id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      text: trimmed,
      votes: 0,
    };

    const updated = polls.map((p, idx) => {
      if (idx !== activePollIndex) return p;
      return {
        ...p,
        options: [...p.options, newOption],
      };
    });

    savePolls(updated);
    setNewOptionText('');
    setInlineNewName('');
    setIsAddingInline(false);
  };

  // 6. İSİM / ADAY DÜZENLEME
  const handleUpdateOptionText = (optionId: string, newText: string) => {
    const updated = polls.map((p, idx) => {
      if (idx !== activePollIndex) return p;
      return {
        ...p,
        options: p.options.map((opt) =>
          opt.id === optionId ? { ...opt, text: newText } : opt
        ),
      };
    });
    savePolls(updated);
  };

  // 7. İSİM / ADAY SİLME
  const handleDeleteOption = (optionId: string) => {
    const updated = polls.map((p, idx) => {
      if (idx !== activePollIndex) return p;
      return {
        ...p,
        options: p.options.filter((opt) => opt.id !== optionId),
      };
    });
    savePolls(updated);
  };

  // 8. SORU BAŞLIĞINI GÜNCELLEME
  const handleUpdateQuestion = (newQuestion: string) => {
    const updated = polls.map((p, idx) => {
      if (idx !== activePollIndex) return p;
      return { ...p, question: newQuestion };
    });
    savePolls(updated);
  };

  // 9. ANKETİ / SORUYU TAMAMEN SİLME
  const handleDeletePoll = () => {
    if (!currentPoll) return;
    if (!confirm(`"${currentPoll.question}" anketini silmek istediğinize emin misiniz?`)) return;

    const updated = polls.filter((_, idx) => idx !== activePollIndex);
    savePolls(updated);
    setActivePollIndex(Math.max(0, activePollIndex - 1));
    if (updated.length === 0) {
      setIsEditing(false);
    }
  };

  // 10. YENİ SORU / ANKET OLUŞTURMA
  const handleCreateNewQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedQuestion = newQuestionText.trim();
    if (!trimmedQuestion) return;

    // Virgülle ayrılmış başlangıç adayları (opsiyonel)
    const initialOptions: PollOption[] = newQuestionInitialNames
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((name) => ({
        id: `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        text: name,
        votes: 0,
      }));

    const newPoll: PollItem = {
      id: `poll_${Date.now()}`,
      question: trimmedQuestion,
      options: initialOptions,
    };

    const updated = [...polls, newPoll];
    savePolls(updated);
    setActivePollIndex(updated.length - 1);
    setNewQuestionText('');
    setNewQuestionInitialNames('');
    setShowNewQuestionModal(false);
  };

  if (loading) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-[#12151F]/80 backdrop-blur-2xl border border-white/10 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl"
    >
      {/* ÜST BAŞLIK & KONTROLLER */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-[#FF2E93]/15 text-[#FF2E93] border border-[#FF2E93]/30">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-white flex items-center gap-1.5">
              Günün En&apos;leri <Sparkles className="w-3.5 h-3.5 text-[#CCFF00]" />
            </h3>
            <p className="text-[11px] text-neutral-400 font-mono">
              {polls.length > 0 ? `ANKET ${activePollIndex + 1}/${polls.length}` : 'ANKETLER'}
            </p>
          </div>
        </div>

        {/* Aksiyon Butonları (+ Yeni Soru / Düzenle / Sıradaki) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* + Yeni Soru Ekle */}
          <button
            onClick={() => setShowNewQuestionModal(true)}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-[#7928CA]/25 hover:bg-[#7928CA]/40 border border-[#7928CA]/50 text-violet-200 transition cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-[#CCFF00] stroke-[3]" />
            <span>Yeni Soru</span>
          </button>

          {/* Düzenle / Bitti (Sadece anket varsa) */}
          {polls.length > 0 && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl border transition cursor-pointer ${
                isEditing
                  ? 'bg-[#CCFF00] text-black border-[#CCFF00] shadow-[0_0_15px_rgba(204,255,0,0.4)]'
                  : 'bg-white/5 hover:bg-white/10 text-neutral-300 border-white/10'
              }`}
            >
              {isEditing ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Bitti</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5 text-[#CCFF00]" />
                  <span>Düzenle</span>
                </>
              )}
            </button>
          )}

          {/* Önceki / Sıradaki Geçiş */}
          {polls.length > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={prevPoll}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition border border-white/10 cursor-pointer"
                title="Önceki Soru"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={nextPoll}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white transition border border-white/10 cursor-pointer"
                title="Sıradaki Soru"
              >
                <ChevronRight className="w-3.5 h-3.5 text-[#CCFF00]" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ANKET ALANI */}
      {polls.length > 0 && currentPoll ? (
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPoll.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {/* SORU BAŞLIĞI */}
            {isEditing ? (
              <div className="space-y-1.5 bg-black/30 p-3 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider block">
                    Soru Başlığını Düzenle:
                  </label>
                  <button
                    onClick={handleDeletePoll}
                    className="text-red-400 hover:text-red-300 text-[11px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Bu Soruyu Sil</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={currentPoll.question}
                  onChange={(e) => handleUpdateQuestion(e.target.value)}
                  placeholder="Soruyu yazın..."
                  className="w-full bg-black/60 border border-[#CCFF00]/40 rounded-xl px-3.5 py-2 text-sm font-bold text-white focus:outline-none focus:border-[#CCFF00]"
                />
              </div>
            ) : (
              <p className="text-sm font-black text-white tracking-wide">
                {currentPoll.question}
              </p>
            )}

            {/* ADAY / İSİM LİSTESİ */}
            <div className="space-y-2">
              {currentPoll.options.length === 0 ? (
                /* HİÇ ADAY YOKSA BOŞ DURUM */
                <div className="p-5 rounded-2xl bg-white/[0.02] border border-dashed border-white/15 text-center space-y-1.5">
                  <p className="text-xs text-neutral-400">
                    Bu soruda henüz aday veya isim eklenmedi.
                  </p>
                  <p className="text-[11px] text-[#CCFF00] font-mono">
                    Aşağıdaki alandan kendini veya arkadaşlarını ekleyebilirsin 👇
                  </p>
                </div>
              ) : (
                currentPoll.options.map((option) => {
                  const hasVoted = Boolean(votedMap[currentPoll.id]);
                  const isSelected = votedMap[currentPoll.id] === option.id;
                  const percentage = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;

                  // 1. DÜZENLEME MODU GÖRÜNÜMÜ
                  if (isEditing) {
                    return (
                      <div
                        key={option.id}
                        className="flex items-center gap-2 p-2 rounded-2xl bg-white/[0.04] border border-white/15"
                      >
                        <input
                          type="text"
                          value={option.text}
                          onChange={(e) => handleUpdateOptionText(option.id, e.target.value)}
                          placeholder="İsim yazın..."
                          className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-[#CCFF00]"
                        />

                        <span className="text-[11px] font-mono text-neutral-400 px-1">
                          {option.votes} oy
                        </span>

                        <button
                          onClick={() => handleDeleteOption(option.id)}
                          title="Bu ismi sil"
                          className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-500/20 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  }

                  // 2. NORMAL OYLAMA MODU GÖRÜNÜMÜ
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleVote(option.id)}
                      disabled={hasVoted}
                      className={`relative w-full overflow-hidden text-left p-3 rounded-2xl border transition-all text-xs font-semibold ${
                        isSelected
                          ? 'border-[#CCFF00] bg-[#CCFF00]/10 text-white'
                          : hasVoted
                          ? 'border-white/5 bg-white/[0.02] text-neutral-400'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/20 text-neutral-200 hover:bg-white/[0.06] cursor-pointer'
                      }`}
                    >
                      {/* Oy doluluk çubuğu */}
                      {hasVoted && totalVotes > 0 && (
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className={`absolute inset-y-0 left-0 -z-10 ${
                            isSelected ? 'bg-[#CCFF00]/20' : 'bg-white/5'
                          }`}
                        />
                      )}

                      <div className="flex items-center justify-between relative z-10">
                        <span className="flex items-center gap-2">
                          {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#CCFF00]" />}
                          {option.text}
                        </span>
                        {hasVoted && (
                          <span className="font-mono text-[11px] font-bold text-neutral-300">
                            %{percentage} ({option.votes})
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* DÜZENLEME MODUNDA: YENİ İSİM EKLEME FORMU */}
            {isEditing && (
              <div className="pt-2 space-y-2 border-t border-white/10">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Yeni aday / kişi adı (Örn: Onur)..."
                    value={newOptionText}
                    onChange={(e) => setNewOptionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddOption(newOptionText);
                      }
                    }}
                    className="flex-1 bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#CCFF00]"
                  />
                  <button
                    onClick={() => handleAddOption(newOptionText)}
                    disabled={!newOptionText.trim()}
                    className="px-4 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Ekle</span>
                  </button>
                </div>
              </div>
            )}

            {/* NORMAL MODDA: HIZLI İSİM EKLE BUTONU / AÇILIR KUTU */}
            {!isEditing && (
              <div className="pt-1">
                {isAddingInline || currentPoll.options.length === 0 ? (
                  <div className="flex items-center gap-2 p-2 rounded-2xl bg-white/[0.03] border border-white/15">
                    <input
                      type="text"
                      autoFocus={isAddingInline}
                      placeholder="Eklenecek kişi adı (Örn: Onur)..."
                      value={inlineNewName}
                      onChange={(e) => setInlineNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddOption(inlineNewName);
                        }
                        if (e.key === 'Escape') setIsAddingInline(false);
                      }}
                      className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#CCFF00]"
                    />
                    <button
                      onClick={() => handleAddOption(inlineNewName)}
                      disabled={!inlineNewName.trim()}
                      className="px-3.5 py-2 rounded-xl bg-[#CCFF00] text-black font-black text-xs flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Ekle</span>
                    </button>
                    {currentPoll.options.length > 0 && (
                      <button
                        onClick={() => setIsAddingInline(false)}
                        className="p-2 text-neutral-400 hover:text-white rounded-xl"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingInline(true)}
                    className="w-full py-2.5 rounded-2xl bg-white/[0.02] hover:bg-white/[0.06] border border-dashed border-white/15 hover:border-[#CCFF00]/40 text-neutral-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-[#CCFF00]" />
                    <span>+ Kendini veya Birini Aday Ekle</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        /* HİÇ ANKET YOKSA (OTOMATİK TERTEMİZ BOŞ DURUM) */
        <div className="py-7 px-4 rounded-2xl bg-white/[0.02] border border-dashed border-white/15 text-center space-y-3.5">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-tr from-[#7928CA]/30 to-[#CCFF00]/20 border border-white/15 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-[#CCFF00]" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-white">Bu Kapsülde Henüz Anket Yok</h4>
            <p className="text-xs text-neutral-400 max-w-xs mx-auto">
              Gereksiz sahte isim veya oylar yok. Odaya özel ilk anket sorusunu ve adayları siz belirleyin!
            </p>
          </div>
          <button
            onClick={() => setShowNewQuestionModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs transition cursor-pointer shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>İlk Anketi Oluştur</span>
          </button>
        </div>
      )}

      {/* YENİ SORU / ANKET EKLEME MODALI */}
      <AnimatePresence>
        {showNewQuestionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setShowNewQuestionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#12151F] border border-white/20 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-base text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#CCFF00]" /> Yeni Anket Sorusu Ekle
                </h4>
                <button
                  onClick={() => setShowNewQuestionModal(false)}
                  className="p-1 text-neutral-400 hover:text-white rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateNewQuestion} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-mono text-neutral-300 block mb-1">
                    Soru Başlığı:
                  </label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="Örn: Masanın en enerjik kişisi kimdi? ⚡"
                    value={newQuestionText}
                    onChange={(e) => setNewQuestionText(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#CCFF00]"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-neutral-300 block mb-1">
                    Aday İsimleri (İsteğe bağlı, virgülle ayırabilirsiniz):
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Onur, Efe, Zeynep (veya boş bırakın)"
                    value={newQuestionInitialNames}
                    onChange={(e) => setNewQuestionInitialNames(e.target.value)}
                    className="w-full bg-black/50 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#CCFF00]"
                  />
                  <p className="text-[10px] text-neutral-400 mt-1">
                    İsim girmeseniz bile katılımcılar sonradan kendi isimlerini veya arkadaşlarını ekleyebilir.
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewQuestionModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-300 font-bold text-xs transition cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={!newQuestionText.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-[#CCFF00] hover:bg-[#b8e600] text-black font-black text-xs transition disabled:opacity-50 cursor-pointer shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                  >
                    Anketi Başlat 🚀
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
