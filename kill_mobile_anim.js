const fs = require('fs');
const file = 'components/BackgroundAnimations.tsx';
let content = fs.readFileSync(file, 'utf8');

// Hide the background animations entirely on small screens
content = content.replace(
  '<div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.10]">',
  '<div className="hidden md:block fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-[0.10]">'
);

fs.writeFileSync(file, content);
console.log('Disabled background animations on mobile!');
