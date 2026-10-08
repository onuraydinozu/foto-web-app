const fs = require('fs');
const file = 'app/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add `joinCode` state and remove `codeDigits`
content = content.replace(
  `const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);`,
  `const [joinCode, setJoinCode] = useState('');`
);

// 2. Remove `inputRefs`
content = content.replace(/const inputRefs = \[\s*useRef<HTMLInputElement>\(null\),\s*useRef<HTMLInputElement>\(null\),\s*useRef<HTMLInputElement>\(null\),\s*useRef<HTMLInputElement>\(null\),\s*useRef<HTMLInputElement>\(null\),\s*useRef<HTMLInputElement>\(null\),\s*\];/g, '');

// 3. Replace `fullCode` references
content = content.replace(/const fullCode = codeDigits.join\(''\);/g, `const fullCode = joinCode.trim();`);

// 4. Remove `handleDigitChange`, `handleKeyDown`, `handlePaste`
const digitChangeRegex = /const handleDigitChange = \([\s\S]*?\}\s*const handleKeyDown = \([\s\S]*?\}\s*const handlePaste = \([\s\S]*?\};\n/g;
content = content.replace(digitChangeRegex, '');

// Also sometimes handleDigitChange might be separate
content = content.replace(/const handleDigitChange = \(index: number, value: string\) => \{[\s\S]*?\};\n/g, '');
content = content.replace(/const handleKeyDown = \(index: number, e: React.KeyboardEvent<HTMLInputElement>\) => \{[\s\S]*?\};\n/g, '');
content = content.replace(/const handlePaste = \(e: React.ClipboardEvent<HTMLInputElement>\) => \{[\s\S]*?\};\n/g, '');

// 5. Replace the UI block for the Passport
const uiStart = content.indexOf('<div className="grid grid-cols-6 gap-1.5 sm:gap-2">');
const uiEnd = content.indexOf('<p className="text-[11px] text-neutral-400 text-center font-mono">');

if (uiStart !== -1 && uiEnd !== -1) {
  const newUI = `
            <div className="relative">
              <input
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinWithCode()}
                placeholder="Kapsül kodunu buraya gir (Örn: I56XBR)..."
                className="w-full h-14 text-center font-mono text-lg font-black rounded-xl bg-black/50 border border-white/15 text-white placeholder:text-neutral-600 focus:border-[#CCFF00] focus:bg-white/5 transition-all outline-none uppercase"
              />
              {joinCode.length > 0 && (
                <button 
                  onClick={() => setJoinCode('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            `;
  content = content.substring(0, uiStart) + newUI + content.substring(uiEnd);
}

// Fix "6 HANELİ" text
content = content.replace(
  '<span className="font-mono text-[10px] text-[#CCFF00] font-black tracking-wider">6 HANELİ KAPSÜL KODU</span>',
  '<span className="font-mono text-[10px] text-[#CCFF00] font-black tracking-wider">KAPSÜL KODU</span>'
);

// Fix "6 haneli Kapsül Kodunu yaz"
content = content.replace(
  'Arkadaşından aldığın 6 haneli Kapsül Kodunu yaz (örn:',
  'Arkadaşından aldığın Kapsül Kodunu yaz (örn:'
);

fs.writeFileSync(file, content);
console.log('Fixed passport UI to be a single flexible input!');
