const fs = require('fs');

function downgradeFile(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/backdrop-blur-3xl/g, 'backdrop-blur-md');
  content = content.replace(/backdrop-blur-2xl/g, 'backdrop-blur-sm');
  content = content.replace(/backdrop-blur-xl/g, 'backdrop-blur-sm');
  fs.writeFileSync(file, content);
  console.log('Downgraded heavy CSS filters in ' + file);
}

process.argv.slice(2).forEach(downgradeFile);
