const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add imports
if (!content.includes('import VibeCheckAlert')) {
  content = content.replace(
    "import SwipeCuratorModal from '@/components/SwipeCuratorModal';",
    "import SwipeCuratorModal from '@/components/SwipeCuratorModal';\nimport VibeCheckAlert, { playVibeCheckAudio } from '@/components/VibeCheckAlert';\nimport VibeCheckShowcase from '@/components/VibeCheckShowcase';"
  );
}

// 2. Update parsePhotoUploader to handle __VC: tags
const oldParse = `function parsePhotoUploader(rawUploader: string) {
  if (!rawUploader) return { nick: 'Anonim', city: null, device: null, display: 'Anonim' };
  const parts = rawUploader.split('__DEV:');
  const uploaderStr = parts[0].trim();
  const device = parts[1]?.trim() || null;

  let nick = uploaderStr;
  let city: string | null = null;
  if (uploaderStr.includes(' · ')) {
    const subParts = uploaderStr.split(' · ');
    nick = subParts[0].trim();
    city = subParts[1]?.trim() || null;
  }
  const cleanNick = nick.startsWith('@') ? nick.slice(1) : nick;

  return {
    nick: cleanNick || 'Anonim',
    city,
    device,
    display: city ? \`@\${cleanNick} · \${city}\` : \`@\${cleanNick}\`,
  };
}`;

const newParse = `function parsePhotoUploader(rawUploader: string) {
  if (!rawUploader) return { nick: 'Anonim', city: null, device: null, display: 'Anonim', vibeCheckId: null, isLate: false };
  
  let cleanRaw = rawUploader;
  let vibeCheckId: string | null = null;
  let isLate = false;

  if (cleanRaw.includes('__VC:')) {
    const vcParts = cleanRaw.split('__VC:');
    cleanRaw = vcParts[0];
    const vcInfo = vcParts[1] || '';
    const [vcId, vcStatus] = vcInfo.split(':');
    vibeCheckId = vcId || null;
    isLate = vcStatus === 'LATE';
  }

  const parts = cleanRaw.split('__DEV:');
  const uploaderStr = parts[0].trim();
  const device = parts[1]?.trim() || null;

  let nick = uploaderStr;
  let city: string | null = null;
  if (uploaderStr.includes(' · ')) {
    const subParts = uploaderStr.split(' · ');
    nick = subParts[0].trim();
    city = subParts[1]?.trim() || null;
  }
  const cleanNick = nick.startsWith('@') ? nick.slice(1) : nick;

  return {
    nick: cleanNick || 'Anonim',
    city,
    device,
    display: city ? \`@\${cleanNick} · \${city}\` : \`@\${cleanNick}\`,
    vibeCheckId,
    isLate,
  };
}`;

content = content.replace(oldParse, newParse);

// 3. Add state declarations
const oldStateAnchor = "const [isSelectMode, setIsSelectMode] = useState(false);";
const newStateAdditions = `const [isSelectMode, setIsSelectMode] = useState(false);

  // Vibe Check (Senkronize Fotoğraf Ruleti) Durumları
  const [activeVibeCheck, setActiveVibeCheck] = useState<any>(null);
  const [latestVibeCheck, setLatestVibeCheck] = useState<any>(null);
  const [showVibeAlert, setShowVibeAlert] = useState(false);
  const [isTriggeringVibe, setIsTriggeringVibe] = useState(false);
  const vibeCameraInputRef = useRef<HTMLInputElement>(null);`;

content = content.replace(oldStateAnchor, newStateAdditions);

// 4. Add Realtime listener for vibe_check_alert
const oldListener = `.on('broadcast', { event: 'polls_updated' }, ({ payload }) => {
        window.dispatchEvent(new CustomEvent('polls_updated', { detail: payload }));
      })`;

const newListener = `.on('broadcast', { event: 'polls_updated' }, ({ payload }) => {
        window.dispatchEvent(new CustomEvent('polls_updated', { detail: payload }));
      })
      .on('broadcast', { event: 'vibe_check_alert' }, ({ payload }) => {
        if (payload) {
          setActiveVibeCheck(payload);
          setLatestVibeCheck(payload);
          setShowVibeAlert(true);
          playVibeCheckAudio();
        }
      })`;

content = content.replace(oldListener, newListener);

// 5. Add fetchVibeCheckStatus and call it inside fetchData
const oldFetchDataStart = `const fetchData = async () => {
    const { data: roomData, error } = await supabase`;

const newFetchDataStart = `const fetchVibeCheckStatus = async (roomId: string) => {
    try {
      const res = await fetch(\`/api/vibe-check?roomId=\${roomId}&_t=\${Date.now()}\`);
      if (res.ok) {
        const data = await res.json();
        if (data.activeVibeCheck) {
          setActiveVibeCheck(data.activeVibeCheck);
          setShowVibeAlert(true);
        } else {
          setActiveVibeCheck(null);
        }
        if (data.latestVibeCheck) {
          setLatestVibeCheck(data.latestVibeCheck);
        }
      }
    } catch {}
  };

  const fetchData = async () => {
    const { data: roomData, error } = await supabase`;

content = content.replace(oldFetchDataStart, newFetchDataStart);

content = content.replace(
  `if (roomData) {
      setRoom(roomData);`,
  `if (roomData) {
      setRoom(roomData);
      fetchVibeCheckStatus(roomData.id);`
);

// 6. Add vibePhotos memo and Vibe Check handlers
const handlersCode = `
  // Vibe Check Fotoğrafları Listesi
  const vibePhotos = useMemo(() => {
    if (!latestVibeCheck) return [];
    const targetId = latestVibeCheck.id;
    return photos
      .filter((p) => {
        if (p.vibe_check_id === targetId) return true;
        if (p.uploaded_by && p.uploaded_by.includes(\`__VC:\${targetId}\`)) return true;
        const startMs = new Date(latestVibeCheck.started_at).getTime();
        const endMs = new Date(latestVibeCheck.expires_at).getTime() + 15 * 60 * 1000;
        const photoMs = new Date(p.created_at || p.taken_at).getTime();
        return photoMs >= startMs && photoMs <= endMs;
      })
      .map((p) => {
        const parsed = parsePhotoUploader(p.uploaded_by);
        const isLate = p.is_late !== undefined ? p.is_late : (
          parsed.isLate || new Date(p.created_at || p.taken_at).getTime() > new Date(latestVibeCheck.expires_at).getTime()
        );
        return {
          ...p,
          is_late: isLate,
        };
      });
  }, [photos, latestVibeCheck]);

  // Vibe Check Tetikleme Fonksiyonu
  const handleTriggerVibeCheck = async () => {
    if (!room?.id) return;
    setIsTriggeringVibe(true);

    try {
      const res = await fetch('/api/vibe-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger',
          roomId: room.id,
          initiatedBy: currentNickname || localStorage.getItem('snaproom_nickname') || 'Biri',
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || 'Vibe Check tetiklenemedi!');
        return;
      }

      if (resData.vibeCheck) {
        setActiveVibeCheck(resData.vibeCheck);
        setLatestVibeCheck(resData.vibeCheck);
        setShowVibeAlert(true);
        playVibeCheckAudio();

        // Realtime kanalı ile herkese anında fırlat
        channelRef.current?.send?.({
          type: 'broadcast',
          event: 'vibe_check_alert',
          payload: resData.vibeCheck,
        });

        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#FF2E93', '#CCFF00', '#FFFFFF', '#FFAA00'],
        });
      }
    } catch (e: any) {
      alert(\`Bağlantı hatası: \${e?.message || 'Bilinmeyen hata'}\`);
    } finally {
      setIsTriggeringVibe(false);
    }
  };

  const handleVibePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileUpload(e.target.files);
    }
  };
`;

content = content.replace("  const handleQuotaExceeded = (msg: string) => {", handlersCode + "\n  const handleQuotaExceeded = (msg: string) => {");

// 7. Update handleFileUpload to attach vibe check tag and fields
content = content.replace(
  `        const finalUploader = deviceModel ? \`\${uploaderTag}__DEV:\${deviceModel}\` : uploaderTag;
        const { data: newPhoto } = await supabase.from('photos').insert({
          room_id: room.id,
          r2_file_key: fileKey,
          original_name: file.name,
          uploaded_by: finalUploader,
          taken_at: takenAt,
        }).select().single();`,
  `        let vibeTag = '';
        let isLate = false;
        if (activeVibeCheck) {
          isLate = Date.now() > new Date(activeVibeCheck.expires_at).getTime();
          vibeTag = \`__VC:\${activeVibeCheck.id}:\${isLate ? 'LATE' : 'FAST'}\`;
        }

        const finalUploader = (deviceModel ? \`\${uploaderTag}__DEV:\${deviceModel}\` : uploaderTag) + vibeTag;

        let insertData: any = {
          room_id: room.id,
          r2_file_key: fileKey,
          original_name: file.name,
          uploaded_by: finalUploader,
          taken_at: takenAt,
        };
        if (activeVibeCheck?.id) {
          insertData.vibe_check_id = activeVibeCheck.id;
          insertData.is_late = isLate;
        }

        let newPhoto: any = null;
        try {
          const res = await supabase.from('photos').insert(insertData).select().single();
          if (res.error) throw res.error;
          newPhoto = res.data;
        } catch (dbErr) {
          delete insertData.vibe_check_id;
          delete insertData.is_late;
          const retryRes = await supabase.from('photos').insert(insertData).select().single();
          newPhoto = retryRes.data;
        }`
);

// 8. In JSX: Render VibeCheckAlert right after main tag opens
content = content.replace(
  `<main className="relative z-10 max-w-5xl mx-auto px-3 sm:px-6 pt-2 sm:pt-4 space-y-6 sm:space-y-8">`,
  `<main className="relative z-10 max-w-5xl mx-auto px-3 sm:px-6 pt-2 sm:pt-4 space-y-6 sm:space-y-8">
      {/* 🚨 ANLIK VIBE CHECK ALERTI (3 DAKİKALIK PANİK) */}
      <AnimatePresence>
        {showVibeAlert && activeVibeCheck && (
          <VibeCheckAlert
            vibeCheck={activeVibeCheck}
            onClose={() => setShowVibeAlert(false)}
            onTakePhoto={() => vibeCameraInputRef.current?.click()}
            shareUrl={typeof window !== 'undefined' ? window.location.href : ''}
          />
        )}
      </AnimatePresence>

      <input
        ref={vibeCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleVibePhotoSelected}
      />`
);

// 9. Mount VibeCheckShowcase above empty state / photo grid
content = content.replace(
  `{/* BOŞ DURUM (EMPTY STATE) */}`,
  `{/* ⚡ O ANIN VİTRİNİ (VIBE CHECK SPLIT BENTO SHOWCASE) */}
          {latestVibeCheck && (
            <VibeCheckShowcase
              vibeCheck={latestVibeCheck}
              photos={vibePhotos}
              capsuleName={capsuleName}
              getMediaUrl={getMediaUrl}
              onTakePhoto={() => vibeCameraInputRef.current?.click()}
              isActive={Boolean(activeVibeCheck && new Date(activeVibeCheck.expires_at).getTime() > Date.now())}
            />
          )}

          {/* BOŞ DURUM (EMPTY STATE) */}`
);

// 10. Add Vibe Check badge on individual photo cards
content = content.replace(
  `{/* GÜNÜN KAPAĞI TAÇ ROZETİ */}`,
  `{/* VIBE CHECK ROZETİ */}
                      {(() => {
                        const parsed = parsePhotoUploader(photo.uploaded_by);
                        if (photo.vibe_check_id || parsed.vibeCheckId) {
                          const isLate = photo.is_late ?? parsed.isLate;
                          return (
                            <div className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[9px] font-mono font-black shadow-lg pointer-events-none flex items-center gap-1 bg-black/75 backdrop-blur-sm border border-white/20">
                              {isLate ? (
                                <span className="text-amber-400">🐢 Geç Kaldı</span>
                              ) : (
                                <span className="text-[#CCFF00]">⚡ Zamanında</span>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* GÜNÜN KAPAĞI TAÇ ROZETİ */}`
);

// 11. Add Vibe Check button to bottom floating dock
content = content.replace(
  `{/* TINDER SWIPE MODU BUTONU */}`,
  `{/* VIBE CHECK TETİKLEME BUTONU */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTriggerVibeCheck}
              disabled={isTriggeringVibe}
              title="🚨 Anlık Vibe Check Patlat (3 Dk Rulet)"
              className="flex items-center gap-1 px-3 py-2.5 sm:px-3.5 sm:py-2.5 rounded-full bg-gradient-to-r from-red-600/30 to-amber-500/30 hover:from-red-600/50 hover:to-amber-500/50 border border-red-500/50 text-red-300 hover:text-white font-black text-xs sm:text-sm transition cursor-pointer shadow-sm shrink-0"
            >
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
              <span className="inline">Vibe</span>
            </motion.button>

            {/* TINDER SWIPE MODU BUTONU */}`
);

fs.writeFileSync(file, content);
console.log('Successfully integrated Vibe Check into app/room/[short_id]/page.tsx!');
