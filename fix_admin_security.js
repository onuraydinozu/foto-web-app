const fs = require('fs');
const file = 'app/api/admin/route.ts';
let content = fs.readFileSync(file, 'utf8');

// Add crypto import
if (!content.includes('import crypto')) {
  content = `import crypto from "crypto";\n` + content;
}

// In-memory rate limiting map
const rateLimiterCode = `
// Brute-force saldırılarına karşı IP bazlı hız kısıtlaması (15 dakikada maks 5 deneme)
const rateLimitMap = new Map<string, { attempts: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record) return true;
  if (now > record.resetAt) {
    rateLimitMap.delete(ip);
    return true;
  }
  return record.attempts < 5;
}

function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { attempts: 1, resetAt: now + 15 * 60 * 1000 });
  } else {
    record.attempts += 1;
  }
}

function verifyAdmin(req: Request): { ok: boolean; rateLimited?: boolean } {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown-ip";
  if (!checkRateLimit(ip)) {
    return { ok: false, rateLimited: true };
  }

  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  const validSecret = process.env.ADMIN_SECRET_KEY || "snapadmin2026";

  if (!token || token.length !== validSecret.length) {
    recordFailedAttempt(ip);
    return { ok: false };
  }

  try {
    const isValid = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(validSecret));
    if (!isValid) recordFailedAttempt(ip);
    return { ok: isValid };
  } catch {
    recordFailedAttempt(ip);
    return { ok: false };
  }
}
`;

content = content.replace(/function verifyAdmin\(req: Request\): boolean \{[\s\S]*?\n\}/, rateLimiterCode.trim());

// Update GET and POST to check rateLimited
content = content.replace(
  `if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }`,
  `const auth = verifyAdmin(req);
  if (auth.rateLimited) {
    return NextResponse.json({ error: "Çok fazla başarısız deneme yapıldı. Güvenlik nedeniyle 15 dakika kilitlendi." }, { status: 429 });
  }
  if (!auth.ok) {
    return NextResponse.json({ error: "Hatalı yönetici anahtarı." }, { status: 401 });
  }`
);

// Do the same for POST
content = content.replace(
  `if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }`,
  `const auth = verifyAdmin(req);
  if (auth.rateLimited) {
    return NextResponse.json({ error: "Çok fazla başarısız deneme yapıldı. Güvenlik nedeniyle 15 dakika kilitlendi." }, { status: 429 });
  }
  if (!auth.ok) {
    return NextResponse.json({ error: "Hatalı yönetici anahtarı." }, { status: 401 });
  }`
);

fs.writeFileSync(file, content);
console.log('Successfully updated app/api/admin/route.ts with timing-safe comparison and rate limiting!');
