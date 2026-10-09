const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Receipt to lucide-react import
content = content.replace(
  'ArrowLeft, Zap, MessageSquare\n} from \'lucide-react\';',
  'ArrowLeft, Zap, MessageSquare, Receipt\n} from \'lucide-react\';'
);

// 2. Add ReceiptModal import
if (!content.includes('import ReceiptModal')) {
  content = content.replace(
    "import ChatDrawer from '@/components/ChatDrawer';",
    "import ChatDrawer from '@/components/ChatDrawer';\nimport ReceiptModal from '@/components/ReceiptModal';"
  );
}

// 3. Add showReceiptModal state
content = content.replace(
  'const [showRecapModal, setShowRecapModal] = useState(false);',
  'const [showRecapModal, setShowRecapModal] = useState(false);\n  const [showReceiptModal, setShowReceiptModal] = useState(false);'
);

// 4. Add Receipt button to header action row
const oldRecapButton = `<button
                onClick={() => {
                  setShowRecapModal(true);
                  confetti({
                    particleCount: 40,
                    spread: 60,
                    origin: { y: 0.2 },
                    colors: ['#FFD700', '#CCFF00', '#FF2E93'],
                  });
                }}
                className={\`p-1.5 sm:px-2.5 sm:py-1 rounded-full border transition flex items-center gap-1 cursor-pointer \${
                  isClosingSoon
                    ? 'bg-amber-500/25 border-amber-400 text-amber-300 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                    : 'bg-white/5 hover:bg-white/15 border-white/10 text-neutral-300'
                }\`}
                title="Kapsül Recap"
              >
                <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline text-xs font-bold">Recap</span>
              </button>`;

const newHeaderReceipt = `${oldRecapButton}

              <button
                onClick={() => {
                  setShowReceiptModal(true);
                  confetti({
                    particleCount: 40,
                    spread: 60,
                    origin: { y: 0.2 },
                    colors: ['#000000', '#FFFFFF', '#CCFF00'],
                  });
                }}
                className="p-1.5 sm:px-2.5 sm:py-1 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 text-neutral-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                title="Günün Faturası (Receiptify Tarzı Fiş)"
              >
                <Receipt className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline text-xs font-bold">Fiş</span>
              </button>`;

content = content.replace(oldRecapButton, newHeaderReceipt);

// 5. In RecapModal, add button to open ReceiptModal
const oldRecapShare = `<div className="pt-2 relative z-10 space-y-2">
                <button
                  onClick={() => {
                    const c2 = recapData.card2 ? \`\${recapData.card2.icon} \${recapData.card2.title}: @\${recapData.card2.nick} (\${recapData.card2.tag})\\n\` : '';`;

const newRecapShare = `<div className="pt-2 relative z-10 space-y-2">
                <button
                  onClick={() => {
                    setShowRecapModal(false);
                    setShowReceiptModal(true);
                  }}
                  className="w-full py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <Receipt className="w-4 h-4 text-amber-300" />
                  <span>🧾 Günün Faturasını Kes (Receiptify)</span>
                </button>

                <button
                  onClick={() => {
                    const c2 = recapData.card2 ? \`\${recapData.card2.icon} \${recapData.card2.title}: @\${recapData.card2.nick} (\${recapData.card2.tag})\\n\` : '';`;

content = content.replace(oldRecapShare, newRecapShare);

// 6. Mount ReceiptModal right after ChatDrawer
const oldChatDrawerMount = `<ChatDrawer
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

const newReceiptMount = `${oldChatDrawerMount}

      {/* GÜNÜN FATURASI (RECEIPTIFY TARZI FİŞ MODALI) */}
      <ReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        capsuleName={capsuleName}
        roomShortId={room?.short_id || params.short_id}
        createdAt={room?.created_at || new Date().toISOString()}
        uploadLockedAt={room?.upload_locked_at}
        photos={photos}
        reactions={reactions}
        spotifyUrl={room?.spotify_url}
        parsePhotoUploader={parsePhotoUploader}
      />`;

content = content.replace(oldChatDrawerMount, newReceiptMount);

fs.writeFileSync(file, content);
console.log('Successfully connected ReceiptModal into app/room/[short_id]/page.tsx!');
