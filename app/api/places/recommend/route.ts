import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Sunucu Tarafı Bellek Önbelleği (15 Dakika)
const placesCache = new Map<string, { data: any[]; expiry: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

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

    const targetDistrict = district && district !== 'Anlık Konum' ? district : 'İstanbul';
    const targetCategory = category || 'popüler yeme-içme mekanları';
    const cacheKey = `${targetDistrict.trim().toLowerCase()}_${targetCategory.trim().toLowerCase()}`;

    // 1. ÖNBELLEK KONTROLÜ (15 dakika içindeyse Gemini'ye istek atma)
    const cachedEntry = placesCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiry > Date.now() && cachedEntry.data.length > 0) {
      console.log(`[Places Cache HIT]: Key="${cacheKey}" - ${cachedEntry.data.length} mekan önbellekten döndürüldü.`);
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
      ? `Kullanıcının seçtiği öncelikler: ${filters.join(', ')}.`
      : '';

    const prompt = `Sen İstanbul'un en güncel ve popüler mekan rehberisin.
${locationContext}
${filterContext}

GÖREV:
"${targetDistrict}" bölgesinde "${targetCategory}" kategorisinde gidilebilecek en iyi 4 popüler, gerçek ve şu an aktif mekanı listele.

KURALLAR:
1. ASLA hafızandan uydurma mekan yazma, yalnızca gerçek ve popüler mekanları listele.
2. Mekanların Google Maps arama bağlantılarını doğru oluştur.
3. Sonuçları YALNIZCA aşağıdaki JSON formatında, bir kod bloğu (\`\`\`json ... \`\`\`) içinde döndür:

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

    console.log(`[Gemini Grounding Places Call]: targetDistrict="${targetDistrict}", category="${targetCategory}"`);

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
    } catch (groundingErr: any) {
      console.warn('[Gemini Grounding Warning]: Grounding quota or tool failed, falling back to direct model:', groundingErr.message);
      // Fallback: Gemini direct generation without search tool (prevents 429 quota exhaustion on Search Grounding)
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

    // 2. BAŞARILI SONUCU 15 DAKİKA ÖNBELLEĞE AL
    if (places.length > 0) {
      placesCache.set(cacheKey, {
        data: places,
        expiry: Date.now() + CACHE_TTL_MS
      });
    }

    return NextResponse.json({
      success: true,
      data: places,
      message: places.length === 0 ? `"${targetDistrict} - ${targetCategory}" için mekan bulunamadı.` : undefined
    });

  } catch (error: any) {
    console.error('[Recommend API Fatal Error]:', error);

    const errMsg = String(error?.message || '');
    const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota');

    // Eğer kota hatası alındıysa ve önbellekte eski veri varsa onu kurtarıcı olarak ver
    if (isRateLimit) {
      return NextResponse.json(
        { error: '⚡ Radar biraz yoğun (dakikalık istek limiti)! Lütfen 30 saniye sonra tekrar deneyin.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: errMsg || 'Canlı mekan arama servisinde hata oluştu.' },
      { status: 500 }
    );
  }
}
