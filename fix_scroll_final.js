const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove `overflow-y-auto` which traps scrolling on iOS
content = content.replace(/overflow-x-hidden overflow-y-auto/g, 'overflow-x-hidden');

fs.writeFileSync(file, content);
console.log('Fixed iOS scroll trap!');
