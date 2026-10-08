const fs = require('fs');

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Strip massive shadows that cause severe GPU repaints on mobile
  content = content.replace(/shadow-\[0_30px_90px_-20px_rgba\(0,0,0,0\.9\)\]/g, 'shadow-2xl');
  content = content.replace(/shadow-\[0_20px_50px_rgba\(0,0,0,0\.7\)\]/g, 'shadow-2xl');
  content = content.replace(/shadow-\[0_0_30px_rgba\(204,255,0,0\.1\)\]/g, 'shadow-md');
  content = content.replace(/shadow-\[0_0_30px_rgba\(204,255,0,0\.5\)\]/g, 'shadow-lg');
  content = content.replace(/hover:shadow-\[0_0_45px_rgba\(204,255,0,0\.8\)\]/g, 'hover:shadow-xl');
  content = content.replace(/shadow-\[0_8px_20px_rgba\(204,255,0,0\.4\)\]/g, 'shadow-md');
  content = content.replace(/shadow-\[0_8px_20px_rgba\(255,46,147,0\.4\)\]/g, 'shadow-md');
  content = content.replace(/shadow-\[0_0_20px_rgba\(204,255,0,0\.4\)\]/g, 'shadow-sm');
  content = content.replace(/shadow-\[0_0_20px_rgba\(204,255,0,0\.3\)\]/g, 'shadow-sm');
  content = content.replace(/shadow-\[0_0_15px_rgba\(204,255,0,0\.4\)\]/g, 'shadow-sm');
  content = content.replace(/shadow-\[0_0_15px_rgba\(204,255,0,0\.25\)\]/g, '');
  content = content.replace(/shadow-\[0_0_12px_rgba\(204,255,0,0\.25\)\]/g, '');

  // Strip text drop-shadows that are expensive to render
  content = content.replace(/drop-shadow-\[0_0_10px_rgba\(204,255,0,0\.5\)\]/g, '');
  content = content.replace(/drop-shadow-\[0_0_15px_rgba\(204,255,0,0\.8\)\]/g, '');

  fs.writeFileSync(file, content);
  console.log('Optimized shadows in ' + file);
}

fixFile('app/page.tsx');
