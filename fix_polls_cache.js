const fs = require('fs');
const file = 'components/PollsCard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add cache busting to GET
content = content.replace(
  /fetch\(\`\/api\/polls\?roomId=\$\{encodeURIComponent\(roomId\)\}\`\)/g,
  "fetch(`/api/polls?roomId=${encodeURIComponent(roomId)}&_t=${Date.now()}`, { cache: 'no-store' })"
);

fs.writeFileSync(file, content);
console.log('Fixed GET cache busting!');
