import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel Serverless Function süresi 30 saniye

// Sunucu Tarafı Bellek Önbelleği (15 Dakika)
const placesCache = new Map<string, { data: any[]; expiry: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Emoji ve Çöp Karakter Temizleme / Kategori Eşleme
function getCleanCategoryQuery(district: string, category: string): string {
  const cat = category || '';
  if (cat.includes('Kahve')) return `${district} en iyi 3. nesil kahve mekanları cafe`;
  if (cat.includes('Sokak') || cat.includes('Hızlı')) return `${district} popüler sokak lezzetleri burger döner fast food`;
  if (cat.includes('Oturmalı') || cat.includes('Dinner')) return `${district} akşam yemeği oturmalı kaliteli restoran yemek`;
  if (cat.includes('Pub') || cat.includes('Gece') || cat.includes('Bar')) return `${district} en iyi pub bar`;
  if (cat.includes('Aktivite') || cat.includes('Kaos')) return `${district} eğlenceli aktivite oyun kafe mekanları`;
  if (cat.includes('Kahvaltı') || cat.includes('Brunch')) return `${district} en iyi kahvaltı ve brunch mekanları`;
  if (cat.includes('Park') || cat.includes('Otopark')) return `${district} otoparkı olan restoran kafe mekanlar`;
  if (cat.includes('Tavuk') || cat.includes('Kanat')) return `${district} popüler sınırsız tavuk kanat mekanları`;

  // Emoji ve özel sembolleri temizle
  const clean = cat.replace(/[\u{1F300}-\u{1FAFF}|\u{2600}-\u{27BF}]/gu, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  return `${district} ${clean || 'popüler mekanlar'}`.trim();
}

export async function POST(req: Request) {
  try {
    const { district, lat, lng, category, filters } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.error('[Gemini AI]: GEMINI_API_KEY bulunamadı!');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY eksik! Lütfen Vercel veya .env.local ortam değişkenlerine ekleyin.' },
        { status: 500 }
      );
    }

    const targetDistrict = district && district !== 'Anlık Konum' ? district : 'Kadıköy';
    const cleanSearchQuery = getCleanCategoryQuery(targetDistrict, category);
    const cacheKey = `${targetDistrict.trim().toLowerCase()}_${cleanSearchQuery.trim().toLowerCase()}`;

    // 1. ÖNBELLEK KONTROLÜ (15 dakika içindeyse Gemini'ye istek atma)
    const cachedEntry = placesCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiry > Date.now() && cachedEntry.data.length > 0) {
      console.log(`[Places Cache HIT]: Key="${cacheKey}" - ${cachedEntry.data.length} mekan anında önbellekten döndürüldü.`);
      return NextResponse.json({
        success: true,
        data: cachedEntry.data,
        cached: true
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const hasGps = typeof lat === 'number' && typeof lng === 'number';
    const locationContext = hasGps
      ? `Kullanıcının anlık cihaz GPS koordinatları: Enlem ${lat}, Boylam ${lng}.`
      : `Kullanıcı semt olarak "${targetDistrict}" seçti.`;

    const filterContext = Array.isArray(filters) && filters.length > 0
      ? `Kullanıcının tercihleri: ${filters.join(', ')}.`
      : '';

    const prompt = `Sen İstanbul'un en hızlı ve nokta atışı mekan rehberisin.
${locationContext}
${filterContext}

GÖREV:
"${cleanSearchQuery}" araması için en popüler, gerçek ve şu an açık en iyi 3-4 mekanı belirle.

HIZ VE FORMAT KURALLARI:
1. Çok hızlı ve özet cevap ver. Google'da derinlemesine araştırma yapmak yerine en popüler ilk 3-4 mekanı al.
2. Açıklamaları tek cümle tut ve süreyi 3 saniyenin altında tut.
3. ASLA uydurma mekan yazma, gerçek mekanları listele.
4. Sonuçları YALNIZCA aşağıdaki JSON formatında, bir kod bloğu (\`\`\`json ... \`\`\`) içinde döndür:

\`\`\`json
[
  {
    "name": "Mekan Adı",
    "district": "${targetDistrict}",
    "address": "Açık adres veya semt detayı",
    "rating": 4.6,
    "review_count": 450,
    "price_level": "$$",
    "summary": "Mekan hakkında 1 cümlelik özet bilgi ve neden tercih edildiği",
    "isOpen": true,
    "parking_info": {
      "valet": false,
      "street": true
    },
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Mekan+Adi+${encodeURIComponent(targetDistrict)}"
  }
]
\`\`\`
`;

    console.log(`[Gemini Fast Search Call]: query="${cleanSearchQuery}"`);

    // 2. TIMEOUT KORUMALI ÇAĞRI (504 Timeout'u engellemek için 4.5s yarış)
    let response: any;
    try {
      const groundingPromise = ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      // 4.5 saniyeden uzun sürerse doğrudan modele düş (504 Timeout engelleme)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('GROUNDING_TIMEOUT')), 4500)
      );

      response = await Promise.race([groundingPromise, timeoutPromise]);
    } catch (err: any) {
      console.warn('[Gemini Speed Optimization]: Grounding yavaş kaldı veya hata verdi, hızlı direkt modele geçildi:', err.message);
      // Hızlı direkt model çağrısı (1.5-2 saniyede döner)
      response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
      });
    }

    const fullText = response?.text || '';
    let places: any[] = [];
    let jsonString = '';

    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1].trim();
    } else {
      const arrayMatch = fullText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        jsonString = arrayMatch[0].trim();
      }
    }

    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
          places = parsed.map((p: any, idx: number) => {
            const placeName = p.name || 'Mekan';
            const placeDistrict = p.district || targetDistrict;
            const mapsUrl = p.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ' ' + placeDistrict)}`;

            return {
              place_id: `gemini_rec_${Date.now()}_${idx}`,
              name: placeName,
              district: placeDistrict,
              address: p.address || `${placeDistrict}, İstanbul`,
              rating: typeof p.rating === 'number' ? p.rating : parseFloat(p.rating) || 4.5,
              review_count: p.review_count || 100,
              price_level: p.price_level || '$$',
              summary: p.summary || p.reason || '',
              reason: p.summary || p.reason || '',
              isOpen: p.isOpen !== false,
              parking_info: p.parking_info || { street: true },
              mapsUrl: mapsUrl,
              googleMapsUri: mapsUrl,
              photo_url: p.photo_url || p.photoUrl || null
            };
          });
        }
      } catch (parseErr) {
        console.error('Failed to parse places JSON from Gemini response:', parseErr);
      }
    }

    // 3. BAŞARILI SONUCU 15 DAKİKA ÖNBELLEĞE AL
    if (places.length > 0) {
      placesCache.set(cacheKey, {
        data: places,
        expiry: Date.now() + CACHE_TTL_MS
      });
    }

    return NextResponse.json({
      success: true,
      data: places,
      message: places.length === 0 ? `"${targetDistrict}" bölgesinde mekan bulunamadı.` : undefined
    });

  } catch (error: any) {
    console.error('[Recommend API Fatal Error]:', error);

    const errMsg = String(error?.message || '');
    const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');

    if (isRateLimit) {
      return NextResponse.json(
        { error: '⚡ Radar biraz yoğun! Lütfen 30 saniye sonra tekrar deneyin.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: errMsg || 'Canlı mekan arama servisinde hata oluştu.' },
      { status: 500 }
    );
  }
}
