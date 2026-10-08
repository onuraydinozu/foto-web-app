const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('AuthModal')) {
  content = content.replace("import { Sparkles", "import AuthModal from '@/components/AuthModal';\nimport { Sparkles");
}

// 2. Remove old state
content = content.replace(/const \[authMode, setAuthMode\] = useState<'login' \| 'register'>\('login'\);\n/g, '');
content = content.replace(/const \[authEmail, setAuthEmail\] = useState\(''\);\n/g, '');
content = content.replace(/const \[authPassword, setAuthPassword\] = useState\(''\);\n/g, '');
content = content.replace(/const \[authLoading, setAuthLoading\] = useState\(false\);\n/g, '');
content = content.replace(/const \[authError, setAuthError\] = useState\(''\);\n/g, '');

// 3. Remove old handleAuth
content = content.replace(/const handleAuth = async \(e: React\.FormEvent\) => \{[\s\S]*?\};\n/, '');

// 4. Update the MyCapsules to show username instead of email
content = content.replace(/<span className="text-white text-xs font-bold truncate max-w-\[150px\] sm:max-w-\[200px\]">\{user.email\}<\/span>/, '<span className="text-white text-xs font-bold truncate max-w-[150px] sm:max-w-[200px]">{user?.user_metadata?.username || user?.email?.split("@")[0] || "Kullanıcı"}</span>');

// 5. Replace the entire old Auth Modal inside return()
const modalStart = content.indexOf('{/* AUTH MODALI */}');
if (modalStart !== -1) {
  // Find where the modal ends (it ends before `      {/* 1. CANLI AMBIENT MESH GRADIENT */}`)
  const modalEnd = content.indexOf('{/* 1. CANLI AMBIENT MESH GRADIENT */}');
  if (modalEnd !== -1) {
    const newModalStr = `{/* AUTH MODALI */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={(newUser) => {
          setUser(newUser);
          fetchMyCapsules(newUser);
        }} 
      />\n\n      `;
    content = content.substring(0, modalStart) + newModalStr + content.substring(modalEnd);
  }
}

fs.writeFileSync(file, content);
console.log('Updated app/page.tsx to use AuthModal!');
