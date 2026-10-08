const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `      if (!room) {
        setErrorMsg(\`"\${fullCode}" koduna sahip aktif bir ortak kapsül bulunamadı!\`);
        return;
      }

      router.push(\`/room/\${room.short_id}?token=\${room.pin_hash || room.short_id}\`);`;

const replacement = `      if (!room) {
        setErrorMsg(\`"\${fullCode}" koduna sahip aktif bir ortak kapsül bulunamadı!\`);
        return;
      }

      await addCapsuleToUser(room.short_id);
      router.push(\`/room/\${room.short_id}?token=\${room.pin_hash || room.short_id}\`);`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log("Fixed handleJoinWithCode");
} else {
  console.log("Could not find target block in handleJoinWithCode");
}
