const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    if (roomData) {
      setRoom(roomData);
      setIsLocked(new Date() > new Date(roomData.upload_locked_at));`;

const replacement = `    if (roomData) {
      setRoom(roomData);
      setIsLocked(new Date() > new Date(roomData.upload_locked_at));

      // Oturum açmışsa bu odayı otomatik olarak kullanıcının geçmişine ekle (direkt linkten geldiyse diye)
      try {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            const currentCapsules = user.user_metadata?.capsules || [];
            if (!currentCapsules.includes(params.short_id)) {
              const newCapsules = [params.short_id, ...currentCapsules];
              supabase.auth.updateUser({ data: { capsules: newCapsules } });
            }
          }
        });
      } catch (e) {}
`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(file, content);
  console.log("Fixed direct link history addition!");
} else {
  console.log("Could not find target in fetchData");
}
