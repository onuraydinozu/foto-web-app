const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const fullCode = codeDigits.join('').trim().toUpperCase();",
  "const fullCode = joinCode.trim().toUpperCase();"
);

fs.writeFileSync(file, content);
console.log('Fixed codeDigits error!');
