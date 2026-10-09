const fs = require('fs');
const file = 'app/room/[short_id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add Zap to lucide-react
content = content.replace(
  'ArrowLeft\n} from \'lucide-react\';',
  'ArrowLeft, Zap\n} from \'lucide-react\';'
);

// 2. Change handleFileUpload to processFiles
content = content.replace(
  'handleFileUpload(e.target.files);',
  'processFiles(e.target.files);'
);

fs.writeFileSync(file, content);
console.log('Fixed TS errors in app/room/[short_id]/page.tsx!');
