const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `overflow-hidden selection:bg-[#CCFF00] selection:text-black"`,
  `overflow-x-hidden overflow-y-auto selection:bg-[#CCFF00] selection:text-black"`
);

// Also change justify-center to justify-start sm:justify-center on small phones to prevent top clipping
content = content.replace(
  `flex flex-col justify-center items-center`,
  `flex flex-col justify-start sm:justify-center items-center pt-24 sm:pt-6`
);

fs.writeFileSync(file, content);
console.log('Fixed mobile scroll issue!');
