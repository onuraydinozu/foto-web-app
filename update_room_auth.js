const fs = require('fs');
// Find room page
const fg = require('child_process').execSync('find app/room -name "page.tsx"').toString().trim();
let content = fs.readFileSync(fg, 'utf8');

// Add import
if (!content.includes('AuthModal')) {
  content = content.replace("import PollsCard", "import AuthModal from '@/components/AuthModal';\nimport PollsCard");
}

// Check state for auth modal
if (!content.includes('showAuthModal')) {
  content = content.replace(
    "const [showUserModal, setShowUserModal] = useState(false);",
    "const [showUserModal, setShowUserModal] = useState(false);\n  const [showAuthModal, setShowAuthModal] = useState(false);"
  );
}

// Modify the logic that shows the user modal
// Old: 
// if (!savedNick) {
//   setShowUserModal(true);
// }
// New:
// if (!user) {
//   setShowAuthModal(true);
// } else if (!savedNick) { ... }

content = content.replace(
  /if \(\!savedNick\) \{\s+setShowUserModal\(true\);\s+\}/,
  `if (!currentUser) {
      setShowAuthModal(true);
    } else if (!savedNick) {
      const username = currentUser.user_metadata?.username || currentUser.email?.split('@')[0];
      if (username) {
        localStorage.setItem('snaproom_nickname', username);
        setNickname(username);
      } else {
        setShowUserModal(true);
      }
    }`
);

// We need to get `currentUser` in `fetchData`. Currently `fetchData` doesn't fetch the user.
// Wait, `useEffect` gets `supabase.auth.getSession()`.
// Let's modify the useEffect for auth.

fs.writeFileSync(fg, content);
console.log('Updated app/room/[short_id]/page.tsx to use AuthModal!');
