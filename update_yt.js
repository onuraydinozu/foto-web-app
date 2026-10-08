const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
const importAnchor = "import PollsCard from '@/components/PollsCard';";
if (!content.includes('import YoutubePlayer')) {
  content = content.replace(importAnchor, importAnchor + "\nimport YoutubePlayer from '@/components/YoutubePlayer';");
}

const startAnchor = `          return (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden border border-[#FF2E93]/30 bg-black/40 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between p-2.5 sm:p-3 gap-3 shadow-[0_0_25px_rgba(255,46,147,0.15)]"
            >`;
const endAnchor = `            </motion.div>
          );`;

const startIndex = content.indexOf(startAnchor);
const endIndex = content.indexOf(endAnchor, startIndex) + endAnchor.length;

if (startIndex !== -1 && endIndex > startIndex) {
  content = content.substring(0, startIndex) + `          return <YoutubePlayer videoId={videoId} onOpenModal={() => setShowYoutubeModal(true)} />;` + content.substring(endIndex);
  fs.writeFileSync(file, content);
  console.log("Updated YT player");
} else {
  console.log("Could not find YT block!");
}
