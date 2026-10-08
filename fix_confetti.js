const fs = require('fs');
const file = 'components/PollsCard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  `    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#CCFF00', '#FF2E93', '#7928CA', '#FFFFFF'],
    });`,
  `    try {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.8 },
          colors: ['#CCFF00', '#FF2E93', '#7928CA', '#FFFFFF'],
        });
      }
    } catch(err) { console.error('Confetti err:', err); }`
);

fs.writeFileSync(file, content);
console.log('Fixed confetti try-catch!');
