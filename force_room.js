const fs = require('fs');
const fg = require('child_process').execSync('find app/room -name "page.tsx"').toString().trim();
let content = fs.readFileSync(fg, 'utf8');

content = content.replace(
  '<AuthModal \n        isOpen={showAuthModal}',
  '<AuthModal \n        forceLogin={true}\n        isOpen={showAuthModal}'
);

fs.writeFileSync(fg, content);
console.log('Forced login in room page!');
