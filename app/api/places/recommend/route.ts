import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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
        { error: 'GEMINI_API_KEY eksik! Lütfen Vercel ortam değişkenlerine ekleyin.' },
        { status: 500 }
      );
    }

    const targetDistrict = district && district !== 'Anlık Konum' ? district : 'Kadıköy';
    const cleanSearchQuery = getCleanCategoryQuery(targetDistrict, category);
    const cacheKey = `${targetDistrict.trim().toLowerCase()}_${cleanSearchQuery.trim().toLowerCase()}`;

    // 1. ÖNBELLEK KONTROLÜ (15 dakika içindeyse anında dön)
    const cachedEntry = placesCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiry > Date.now() && cachedEntry.data.length > 0) {
      console.log(`[Places Cache HIT]: Key="${cacheKey}" - ${cachedEntry.data.length} mekan önbellekten döndürüldü.`);
      return NextResponse.json({
        success: true,
        places: cachedEntry.data,
        data: cachedEntry.data,
        cached: true
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const hasGps = typeof lat === 'number' && typeof lng === 'number';
    const locationContext = hasGps
      ? `Kullanıcının GPS koordinatları: ${lat}, ${lng}.`
      : `Bölge: "${targetDistrict}".`;

    const filterContext = Array.isArray(filters) && filters.length > 0
      ? `Filtreler: ${filters.join(', ')}.`
      : '';

    const prompt = `Sen İstanbul'un en popüler mekanlarını ezbere bilen uzman bir rehbersin.
${locationContext}
${filterContext}

GÖREV:
Kullanıcının konumu: ${targetDistrict}. Bu ilçede ve hemen bitişiğindeki popüler merkezlerde (cadde/AVM aksları) bulunan en iyi 4 adet ${cleanSearchQuery} mekanını listele.

KESİN KURALLAR:
1. ASLA konut projelerinin, sitelerin sosyal tesislerini, kapalı kulüpleri veya özel mülkleri mekan olarak önerme (Örn: Asla site lokalleri veya özel tesisleri yazma).
2. Yalnızca Google Haritalar'da resmi dükkan/işletme kaydı olan, herkesin kapıdan serbestçe girebileceği gerçek ticari işletmeleri öner.
3. Açıklamaları tek cümle tut, süreyi 2 saniyenin altında tut.
4. ASLA uydurma mekan yazma, sadece bilinen gerçek ticari mekanları listele.
5. Sonuçları YALNIZCA aşağıdaki JSON formatında, bir kod bloğu (\`\`\`json ... \`\`\`) içinde döndür:

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

    console.log(`[Gemini Ultra-Fast Call]: targetDistrict="${targetDistrict}", category="${cleanSearchQuery}"`);

    // Model önceliği: gemini-flash-lite-latest (taze kota & ultra hızlı), ardından gemini-flash-latest
    let response: any;
    const modelsToTry = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.1,
              topP: 0.8,
              tools: [{ googleSearch: {} }]
            }
          });
        } catch (groundingErr: any) {
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.1,
              topP: 0.8
            }
          });
        }
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Retry]: ${modelName} başarısız oldu (${err.message?.slice(0, 80)}), sonraki modele geçiliyor...`);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (!response?.text && lastError) {
      throw lastError;
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
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ' ' + placeDistrict)}`;

            return {
              place_id: `rec_${Date.now()}_${idx}`,
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
      places: places,
      data: places,
      message: places.length === 0 ? `"${targetDistrict}" bölgesinde mekan bulunamadı.` : undefined
    });

  } catch (error: any) {
    console.error('[Recommend API Fatal Error]:', error);
    return NextResponse.json(
      { error: '⚠️ Sunucular şu an biraz yoğun, birkaç saniye sonra tekrar dener misin?' },
      { status: 503 }
    );
  }
}
