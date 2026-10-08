import fs from 'fs';
import path from 'path';

// Yerel geliştirme dosya yolu
const LOCAL_DATA_FILE = path.join(process.cwd(), 'data', 'deleted_photos.json');
// Vercel / Serverless için yazılabilir geçici dosya yolu
const TMP_DATA_FILE = path.join('/tmp', 'snaproom_deleted_photos.json');

// Bellek içi yedek
const inMemoryDeleted = new Set<string>();

function getUsableFilePath(): string {
  try {
    const dir = path.dirname(LOCAL_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    // Test write
    fs.accessSync(dir, fs.constants.W_OK);
    return LOCAL_DATA_FILE;
  } catch {
    return TMP_DATA_FILE;
  }
}

export function getDeletedPhotoIds(): string[] {
  const result = new Set<string>(inMemoryDeleted);

  for (const filePath of [LOCAL_DATA_FILE, TMP_DATA_FILE]) {
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) {
          parsed.forEach((id) => result.add(id));
        }
      }
    } catch {}
  }

  return Array.from(result);
}

export function addDeletedPhotoId(id: string): void {
  inMemoryDeleted.add(id);

  try {
    const targetFile = getUsableFilePath();
    const dir = path.dirname(targetFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const current = getDeletedPhotoIds();
    fs.writeFileSync(targetFile, JSON.stringify(current, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Sunucusuz ortamda dosya yazılamadı, bellek içi saklanıyor:', e);
  }
}
