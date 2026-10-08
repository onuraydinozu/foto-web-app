const fs = require('fs');

function downgradeFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace heavy backdrop blurs with much lighter ones or remove them if combined with 90% opacity
  content = content.replace(/backdrop-blur-3xl/g, 'backdrop-blur-md');
  content = content.replace(/backdrop-blur-2xl/g, 'backdrop-blur-sm');
  content = content.replace(/backdrop-blur-xl/g, 'backdrop-blur-sm');
  
  fs.writeFileSync(file, content);
  console.log('Downgraded heavy CSS filters in ' + file);
}

try {
  downgradeFile('app/room/[short_id]/page.tsx');
} catch (e) {
  console.log(e.message);
}
