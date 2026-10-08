const fs = require('fs');
let file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('import AuthModal')) {
  content = content.replace("import { motion", "import AuthModal from '@/components/AuthModal';\nimport { motion");
}

content = content.replace('onSuccess={(newUser) => {', 'onSuccess={(newUser: any) => {');

fs.writeFileSync(file, content);

// Also fix in app/room
const fg = require('child_process').execSync('find app/room -name "page.tsx"').toString().trim();
let content2 = fs.readFileSync(fg, 'utf8');
content2 = content2.replace('onSuccess={(newUser) => {', 'onSuccess={(newUser: any) => {');
fs.writeFileSync(fg, content2);

console.log('Fixed imports!');
