const fs = require('fs');
const file = 'components/BackgroundAnimations.tsx';
let content = fs.readFileSync(file, 'utf8');

// Reduce item count
content = content.replace(/length: 12/g, 'length: 4');

// Remove drop-shadows which are very expensive during transforms
content = content.replace(/className="drop-shadow-\[[^\]]*\]"/g, '');

// Reduce opacity even more so it's subtle and maybe skip rotation for better perf?
content = content.replace(/opacity-\[0\.25\]/g, 'opacity-[0.10]');

// Also increase duration to make them slower and less CPU intensive
content = content.replace(/Math\.random\(\) \* 20 \+ 20/g, 'Math.random() * 40 + 40');

fs.writeFileSync(file, content);
console.log('Fixed Background Animations performance!');
