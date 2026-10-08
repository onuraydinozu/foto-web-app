const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Convert main card motion.div to div
content = content.replace(
  /<motion\.div\n\s*initial=\{\{ scale: 0\.95, y: 20 \}\}\n\s*animate=\{\{ scale: 1, opacity: 1, y: 0 \}\}\n\s*transition=\{\{ type: 'spring', damping: 20, stiffness: 140 \}\}\n/g,
  '<div\n'
);
content = content.replace(
  /<motion\.div\n\s*initial=\{\{ scale: 0\.95, y: 20 \}\}\n\s*animate=\{\{ scale: 1, y: 0 \}\}\n\s*transition=\{\{ type: 'spring', damping: 20, stiffness: 140 \}\}\n/g,
  '<div\n'
);

// We need to carefully replace the closing tag of the main glass card
// It's easier to just strip Framer Motion from the main structural cards

// Strip AnimatePresence around auth block and motion.div
content = content.replace(/<AnimatePresence>/g, '');
content = content.replace(/<\/AnimatePresence>/g, '');

content = content.replace(
  /<motion\.div\n\s*initial=\{\{ scale: 0\.95 \}\}\n\s*animate=\{\{ opacity: 1, scale: 1 \}\}\n/g,
  '<div\n'
);
content = content.replace(
  /<motion\.div\n\s*initial=\{\{ y: 10 \}\}\n\s*animate=\{\{ y: 0 \}\}\n\s*style=\{\{ opacity: 1 \}\}\n/g,
  '<div\n'
);

// Top badges
content = content.replace(
  /<motion\.div\n\s*initial=\{\{ scale: 0, rotate: -15 \}\}\n\s*animate=\{\{ scale: 1, rotate: -7 \}\}\n\s*whileHover=\{\{ scale: 1\.1, rotate: 0 \}\}\n/g,
  '<div\n'
);
content = content.replace(
  /<motion\.div\n\s*initial=\{\{ scale: 0, rotate: 18 \}\}\n\s*animate=\{\{ scale: 1, rotate: 6 \}\}\n\s*whileHover=\{\{ scale: 1\.1, rotate: 0 \}\}\n/g,
  '<div\n'
);

// Globe hover
content = content.replace(
  /<motion\.div\n\s*whileHover=\{\{ rotate: 10, scale: 1\.1 \}\}\n\s*transition=\{\{ type: 'spring', stiffness: 300 \}\}\n/g,
  '<div\n'
);

// Button hover
content = content.replace(
  /<motion\.button\n\s*whileHover=\{\{ scale: 1\.02 \}\}\n\s*whileTap=\{\{ scale: 0\.97 \}\}\n/g,
  '<button\n'
);
content = content.replace(/<\/motion\.button>/g, '</button>');
content = content.replace(/<\/motion\.div>/g, '</div>');

fs.writeFileSync(file, content);
console.log('Nuked framer motion from structural elements!');
