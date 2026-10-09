import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

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

    const ai = new GoogleGenAI({ apiKey });

    const targetDistrict = district && district !== 'Anlık Konum' ? district : 'İstanbul';
    const hasGps = typeof lat === 'number' && typeof lng === 'number';
    const locationContext = hasGps
      ? `Kullanıcının anlık cihaz GPS koordinatları: Enlem ${lat}, Boylam ${lng}.`
      : `Kullanıcı semt olarak "${targetDistrict}" seçti.`;

    const filterContext = Array.isArray(filters) && filters.length > 0
      ? `Kullanıcının seçtiği öncelikler: ${filters.join(', ')}.`
      : '';

    const prompt = `Sen İstanbul'un en güncel ve güvenilir mekan rehberisin.
${locationContext}
${filterContext}

GÖREV:
Google Search Grounding (Canlı Google Araması) aracını kullanarak "${targetDistrict}" bölgesinde "${category || 'popüler yeme-içme mekanları'}" için en iyi 4-5 gerçek, popüler ve şu an faal mekanı Google'da ara ve bul.

KURALLAR:
1. ASLA hafızandan veya hayal gücünden mekan uydurma. Yalnızca canlı Google aramasında karşına çıkan gerçek mekanları listele.
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

    console.log(`[Gemini Grounding Places Call]: targetDistrict="${targetDistrict}", category="${category}"`);

    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
    } catch (modelErr: any) {
      console.warn('gemini-flash-latest failed, trying gemini-3.8-flash:', modelErr.message);
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
    }

    const fullText = response?.text || '';
    let places: any[] = [];

    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
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

    return NextResponse.json({
      success: true,
      data: places,
      message: places.length === 0 ? `Google canlı aramasında "${targetDistrict} - ${category}" için uygun mekan bulunamadı.` : undefined
    });

  } catch (error: any) {
    console.error('[Recommend API Fatal Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Canlı mekan arama servisinde hata oluştu.' },
      { status: 500 }
    );
  }
}
