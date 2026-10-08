const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix polaroid 1
content = content.replace(
  `initial={{ y: -40, opacity: 0, rotate: -18 }}`,
  `initial={{ y: -40, rotate: -18 }}`
);
content = content.replace(
  `animate={{ y: 0, opacity: 0.85, rotate: -12 }}`,
  `animate={{ y: 0, opacity: 0.85, rotate: -12 }}` // this is fine
);

// 2. Fix polaroid 2
content = content.replace(
  `initial={{ y: -40, opacity: 0, rotate: 16 }}`,
  `initial={{ y: -40, rotate: 16 }}`
);

// 3. Fix main glass card
content = content.replace(
  `initial={{ scale: 0.95, opacity: 0, y: 20 }}`,
  `initial={{ scale: 0.95, y: 20 }}`
);

// 4. Also fix the myCapsules block if it has opacity: 0
content = content.replace(
  `initial={{ opacity: 0, scale: 0.95 }}`,
  `initial={{ scale: 0.95 }}`
);

fs.writeFileSync(file, content);
console.log('Fixed opacity carefully!');
