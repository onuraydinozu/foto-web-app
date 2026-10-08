const fs = require('fs');

function downgradeFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace heavy backdrop blurs with much lighter ones or remove them if combined with 90% opacity
  content = content.replace(/backdrop-blur-3xl/g, 'backdrop-blur-md');
  content = content.replace(/backdrop-blur-2xl/g, 'backdrop-blur-sm');
  content = content.replace(/backdrop-blur-xl/g, 'backdrop-blur-sm');
  
  // Replace massive static blurs with something smaller or just remove the blur class
  content = content.replace(/blur-\[130px\]/g, 'blur-[60px]');
  content = content.replace(/blur-\[140px\]/g, 'blur-[60px]');
  content = content.replace(/blur-\[160px\]/g, 'blur-[80px]');

  // Reduce opacity on those static gradient balls since blur is smaller
  content = content.replace(/opacity-70/g, 'opacity-40');
  content = content.replace(/opacity-30/g, 'opacity-20');
  
  fs.writeFileSync(file, content);
  console.log('Downgraded heavy CSS filters in ' + file);
}

downgradeFile('app/page.tsx');
