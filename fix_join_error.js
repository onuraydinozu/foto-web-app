const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "setErrorMsg('Lütfen en az 4 veya 6 haneli Kapsül Kodunu eksiksiz gir.');",
  "setErrorMsg('Lütfen geçerli bir Kapsül Kodu gir.');"
);

// We should also modify the check. If the length is < 3 it's invalid.
content = content.replace(
  "if (fullCode.length < 4) {",
  "if (fullCode.length < 3) {"
);

fs.writeFileSync(file, content);
console.log('Fixed join error message!');
