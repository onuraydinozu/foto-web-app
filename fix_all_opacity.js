const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace all instances of `opacity: 0` in motion.divs with `opacity: 1` (except inside Auth Modal, which is controlled by AnimatePresence)
// Actually, I'll just remove `opacity: 0` from the main card and badges.

content = content.replace(
  `initial={{ scale: 0.95, opacity: 0, y: 20 }}`,
  `initial={{ scale: 0.95, y: 20 }}`
);

// Any other opacity: 0?
content = content.replace(/opacity:\s*0/g, 'opacity: 1');

fs.writeFileSync(file, content);
console.log('Fixed ALL opacity: 0 issues!');
