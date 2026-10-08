const fs = require('fs');
const fg = require('child_process').execSync('find app/room -name "page.tsx"').toString().trim();
let content = fs.readFileSync(fg, 'utf8');

// Replace the buggy currentUser block
content = content.replace(
  `    if (!currentUser) {
      setShowAuthModal(true);
    } else if (!savedNick) {
      const username = currentUser.user_metadata?.username || currentUser.email?.split('@')[0];
      if (username) {
        localStorage.setItem('snaproom_nickname', username);
        setNickname(username);
      } else {
        setShowUserModal(true);
      }
    }`,
  `    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setShowAuthModal(true);
      } else if (!savedNick) {
        const username = session.user.user_metadata?.username || session.user.email?.split('@')[0];
        if (username) {
          localStorage.setItem('snaproom_nickname', username);
          setCurrentNickname(username);
        } else {
          setShowUserModal(true);
        }
      }
    });`
);

// We must also insert the AuthModal inside the return ()
const mainEnd = content.lastIndexOf('</main>');
if (mainEnd !== -1) {
  content = content.substring(0, mainEnd) + `
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => {}} 
        onSuccess={(newUser) => {
          setShowAuthModal(false);
          const username = newUser.user_metadata?.username || newUser.email?.split('@')[0];
          if (username) {
            localStorage.setItem('snaproom_nickname', username);
            setCurrentNickname(username);
          } else {
            setShowUserModal(true);
          }
          fetchData();
        }} 
      />\n` + content.substring(mainEnd);
}

fs.writeFileSync(fg, content);
console.log('Fixed room auth logic!');
