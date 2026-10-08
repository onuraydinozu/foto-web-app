const fs = require('fs');
const file = 'components/AuthModal.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'interface AuthModalProps {\n  isOpen: boolean;\n  onClose: () => void;\n  onSuccess?: (user: any) => void;\n}',
  'interface AuthModalProps {\n  isOpen: boolean;\n  onClose: () => void;\n  onSuccess?: (user: any) => void;\n  forceLogin?: boolean;\n}'
);

content = content.replace(
  'export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {',
  'export default function AuthModal({ isOpen, onClose, onSuccess, forceLogin = false }: AuthModalProps) {'
);

// Add useRouter
content = content.replace(
  'import { supabase } from \'@/lib/supabase\';',
  'import { supabase } from \'@/lib/supabase\';\nimport { useRouter } from \'next/navigation\';'
);

content = content.replace(
  'const [error, setError] = useState(\'\');',
  'const [error, setError] = useState(\'\');\n  const router = useRouter();'
);

// Modify background click
content = content.replace(
  'onClick={onClose}',
  'onClick={forceLogin ? undefined : onClose}'
);

// Modify X button
content = content.replace(
  `            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 transition"
            >`,
  `            <button
              onClick={() => forceLogin ? router.push('/') : onClose()}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 transition"
            >`
);

fs.writeFileSync(file, content);
console.log('Added forceLogin to AuthModal!');
