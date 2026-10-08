const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const anchor = `.on('broadcast', { event: 'spotify_updated' }, ({ payload }) => {
        if (payload?.spotify_url !== undefined) {
          setRoom((prev: any) => ({ ...prev, spotify_url: payload.spotify_url }));
        }
      })`;

const replacement = `.on('broadcast', { event: 'spotify_updated' }, ({ payload }) => {
        if (payload?.spotify_url !== undefined) {
          setRoom((prev: any) => ({ ...prev, spotify_url: payload.spotify_url }));
        }
      })
      .on('broadcast', { event: 'polls_updated' }, ({ payload }) => {
        window.dispatchEvent(new CustomEvent('polls_updated', { detail: payload }));
      })`;

content = content.replace(anchor, replacement);
fs.writeFileSync(file, content);
console.log('Fixed page.tsx');
