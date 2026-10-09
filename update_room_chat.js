const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add MessageSquare to lucide-react import
content = content.replace(
  'ArrowLeft, Zap\n} from \'lucide-react\';',
  'ArrowLeft, Zap, MessageSquare\n} from \'lucide-react\';'
);

// 2. Add ChatDrawer import
if (!content.includes('import ChatDrawer')) {
  content = content.replace(
    "import SwipeCuratorModal from '@/components/SwipeCuratorModal';",
    "import SwipeCuratorModal from '@/components/SwipeCuratorModal';\nimport ChatDrawer from '@/components/ChatDrawer';"
  );
}

// 3. Add states for ChatDrawer
const chatStateCode = `  // Sohbet & DM Çekmecesi Durumları
  const [showChatDrawer, setShowChatDrawer] = useState(false);
  const [chatReplyPhoto, setChatReplyPhoto] = useState<any | null>(null);`;

content = content.replace(
  'const [isSelectMode, setIsSelectMode] = useState(false);',
  'const [isSelectMode, setIsSelectMode] = useState(false);\n' + chatStateCode
);

// 4. Calculate allRoomParticipants
const allParticipantsMemo = `
  // Odadaki Tüm Katılımcıların Listesi (Canlı + Fotoğraf Atanlar)
  const allRoomParticipants = useMemo(() => {
    const set = new Set<string>();
    if (currentNickname) set.add(currentNickname.replace(/^@/, ''));
    liveViewers.forEach((v) => set.add(v.replace(/^@/, '')));
    photos.forEach((p) => {
      const parsed = parsePhotoUploader(p.uploaded_by);
      if (parsed.nick) set.add(parsed.nick.replace(/^@/, ''));
    });
    return Array.from(set);
  }, [currentNickname, liveViewers, photos]);
`;

content = content.replace('const currentStoryPhoto = storyIndex !== null', allParticipantsMemo + '\n  const currentStoryPhoto = storyIndex !== null');

// 5. Add Chat button to header action row
const oldHeaderButtons = `<button
                onClick={() => setShowParticipantsModal(true)}
                className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-[#FF2E93]/30 border border-white/10 hover:border-[#FF2E93]/50 text-neutral-300 hover:text-[#FF2E93] transition cursor-pointer"
                title="Katılımcılar"
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF2E93]" />
              </button>`;

const newHeaderButtons = `<button
                onClick={() => setShowParticipantsModal(true)}
                className="p-1.5 sm:p-2 rounded-full bg-white/5 hover:bg-[#FF2E93]/30 border border-white/10 hover:border-[#FF2E93]/50 text-neutral-300 hover:text-[#FF2E93] transition cursor-pointer"
                title="Katılımcılar"
              >
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FF2E93]" />
              </button>

              <button
                onClick={() => setShowChatDrawer(true)}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-full bg-gradient-to-r from-violet-600/30 to-pink-500/30 hover:from-violet-600/50 hover:to-pink-500/50 border border-violet-500/50 text-violet-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Sohbet & DM İstasyonu"
              >
                <MessageSquare className="w-3.5 h-3.5 text-[#CCFF00]" />
                <span className="hidden sm:inline text-xs font-bold">Sohbet</span>
              </button>`;

content = content.replace(oldHeaderButtons, newHeaderButtons);

// 6. Add Chat button to bottom floating dock
const oldDockVibe = `<motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleTriggerVibeCheck}
              disabled={isTriggeringVibe}
              title="🚨 Anlık Vibe Check Patlat (3 Dk Rulet)"
              className="flex items-center gap-1 px-3 py-2.5 sm:px-3.5 sm:py-2.5 rounded-full bg-gradient-to-r from-red-600/30 to-amber-500/30 hover:from-red-600/50 hover:to-amber-500/50 border border-red-500/50 text-red-300 hover:text-white font-black text-xs sm:text-sm transition cursor-pointer shadow-sm shrink-0"
            >
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
              <span className="inline">Vibe</span>
            </motion.button>`;

const newDockWithChat = `<motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowChatDrawer(true)}
              title="Sohbet & DM Çekmecesi"
              className="flex items-center gap-1 px-3 py-2.5 sm:px-3.5 sm:py-2.5 rounded-full bg-gradient-to-r from-violet-600/30 to-pink-500/30 hover:from-violet-600/50 hover:to-pink-500/50 border border-violet-500/50 text-violet-200 hover:text-white font-black text-xs sm:text-sm transition cursor-pointer shadow-sm shrink-0"
            >
              <MessageSquare className="w-4 h-4 text-[#CCFF00]" />
              <span className="inline">Chat</span>
            </motion.button>

            ${oldDockVibe}`;

content = content.replace(oldDockVibe, newDockWithChat);

// 7. Add "Sohbette Alıntıla" button on photo action buttons row
const oldPhotoActions = `<button
                            onClick={(e) => downloadSingleFile(photo.r2_file_key, photo.original_name, e)}
                            title="Orijinal formatında indir"
                            className="p-1.5 rounded-full bg-black/70 hover:bg-black text-[#CCFF00] backdrop-blur-md transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>`;

const newPhotoActions = `<button
                            onClick={(e) => {
                              e.stopPropagation();
                              setChatReplyPhoto(photo);
                              setShowChatDrawer(true);
                            }}
                            title="Sohbette Alıntıla"
                            className="p-1.5 rounded-full bg-black/70 hover:bg-black text-pink-400 hover:text-pink-300 backdrop-blur-md transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          ${oldPhotoActions}`;

content = content.replace(oldPhotoActions, newPhotoActions);

// 8. Mount ChatDrawer at the end of the component
const oldModalEnd = `<SwipeCuratorModal
        isOpen={showSwipeModal}
        onClose={() => setShowSwipeModal(false)}
        photos={photos}
        roomShortId={room?.short_id || params.short_id}
      />`;

const newModalEnd = `${oldModalEnd}

      {/* SOHBET & DM ÇEKMECESİ */}
      <ChatDrawer
        isOpen={showChatDrawer}
        onClose={() => setShowChatDrawer(false)}
        roomId={room?.id || params.short_id}
        currentUserNick={currentNickname}
        participants={allRoomParticipants}
        roomPhotos={photos}
        channel={channelRef.current}
        getMediaUrl={getMediaUrl}
        replyPhoto={chatReplyPhoto}
        onClearReplyPhoto={() => setChatReplyPhoto(null)}
      />`;

content = content.replace(oldModalEnd, newModalEnd);

fs.writeFileSync(file, content);
console.log('Successfully connected ChatDrawer into app/room/[short_id]/page.tsx!');
