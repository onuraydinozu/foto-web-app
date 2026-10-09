const fs = require('fs');
const file = 'app/admin/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the password leak paragraph
content = content.replace(
  `<p className="text-[11px] text-neutral-500 font-mono">
            Varsayılan Şifre: <span className="text-[#CCFF00]">snapadmin2026</span>
          </p>`,
  `<div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-500 font-mono">
            <Lock className="w-3.5 h-3.5 text-[#CCFF00]" />
            <span>256-Bit Uçtan Uca Korumalı Yönetici Paneli</span>
          </div>`
);

// 2. Change placeholder from ADMIN_SECRET_KEY... to Yönetici Şifresi
content = content.replace('placeholder="ADMIN_SECRET_KEY..."', 'placeholder="Yönetici Şifresi..."');

// 3. Improve error message handling
content = content.replace(
  "throw new Error('Hatalı Admin Şifresi! Lütfen ADMIN_SECRET_KEY değerini kontrol edin.');",
  "const errJson = await res.json().catch(() => ({})); throw new Error(errJson.error || 'Hatalı Yönetici Şifresi!');"
);

fs.writeFileSync(file, content);
console.log('Successfully updated app/admin/page.tsx to remove password leak!');
