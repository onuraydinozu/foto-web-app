const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldInsertPattern = /try \{\s*const \{ data: room, error \} = await supabase\s*\.from\('rooms'\)\s*\.insert\(\{[\s\S]*?\}\)\s*\.select\(\)\s*\.single\(\);[\s\S]*?if \(error \|\| \!room\) \{\s*setErrorMsg\(`Ortak kapsül oluşturulurken hata: \$\{error\?\.message \|\| 'Bilinmeyen hata'\}`\);\s*return;\s*\}/;

const newInsertCode = `try {
      const res = await fetch('/api/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          short_id: shortId,
          pin_hash: generatedPin,
          is_disposable_mode: false,
          is_unlocked: true,
          location: finalTitle,
          spotify_url: '',
          upload_locked_at: uploadLockedAt,
        }),
      });

      const resData = await res.json();
      setLoading(false);

      if (!res.ok || !resData.success || !resData.room) {
        setErrorMsg(\`Ortak kapsül oluşturulurken hata: \${resData.error || 'Bilinmeyen hata'}\`);
        return;
      }

      const room = resData.room;`;

content = content.replace(oldInsertPattern, newInsertCode);

fs.writeFileSync(file, content);
console.log('Successfully updated createCapsule to use /api/create-room!');
