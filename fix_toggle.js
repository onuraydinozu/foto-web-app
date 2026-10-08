const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetFunction = `  const toggleDisposableMode = async () => {
    if (!room) return;
    const newUnlocked = !room.is_unlocked;
    await supabase.from('rooms').update({ is_unlocked: newUnlocked }).eq('id', room.id);
    setRoom({ ...room, is_unlocked: newUnlocked });
  };`;

const replacement = `  const toggleDisposableMode = async () => {
    if (!room) return;
    const newUnlocked = !room.is_unlocked;
    // Optimistic update
    setRoom({ ...room, is_unlocked: newUnlocked });
    
    try {
      await fetch('/api/update-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: room.id, is_unlocked: newUnlocked }),
      });
    } catch (err) {
      console.error('Failed to toggle lock', err);
      // Revert on failure
      setRoom({ ...room, is_unlocked: !newUnlocked });
    }
  };`;

if (content.includes(targetFunction)) {
  content = content.replace(targetFunction, replacement);
  fs.writeFileSync(file, content);
  console.log('Fixed toggleDisposableMode!');
} else {
  console.log('Could not find toggleDisposableMode function.');
}
