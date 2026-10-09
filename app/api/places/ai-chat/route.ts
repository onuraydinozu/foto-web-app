import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, userCoords } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.error('[Gemini AI]: GEMINI_API_KEY çevre değişkeni bulunamadı!');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY eksik! Lütfen Vercel veya .env.local ortam değişkenlerine ekleyin.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const conversationHistory = (messages || [])
      .map((m: any) => `${m.role === 'user' ? 'Kullanıcı' : 'Gurme'}: ${m.content}`)
      .join('\n');

    const rawLastUserMessage = messages?.filter((m: any) => m.role === 'user')?.pop()?.content || '';
    const cleanLastMessage = rawLastUserMessage.replace(/[\u{1F300}-\u{1FAFF}|\u{2600}-\u{27BF}]/gu, '').trim();

    const locationContext = userCoords?.lat && userCoords?.lng
      ? `Kullanıcının anlık cihaz GPS koordinatları: Enlem ${userCoords.lat}, Boylam ${userCoords.lng}.`
      : `Kullanıcı henüz GPS konumu paylaşmadı.`;

    const prompt = `Sen İstanbul mekanlarını ve gerçek şubelerini sokak sokak bilen, asılsız bilgi vermeyen uzman bir "Masa Gurmesi" yapay zekasısın.
${locationContext}

KONUŞMA GEÇMİŞİ:
${conversationHistory}

KULLANICININ SON İSTEĞİ:
"${cleanLastMessage || rawLastUserMessage}"

HAYALİ ŞUBE YASAĞI VE KESİN KURALLAR:
1. Kullanıcının belirttiği ilçede/semtte FİZİKİ ŞUBESİ OLMAYAN popüler zincirleri (örn: Kronotrop, Petra, Federal, Montag vb.) ASLA o semtteymiş gibi uydurma!
2. Yalnızca belirtilen ilçe sınırları içinde gerçek adresi, dükkanı ve tabelası olan işletmeleri (yerel butik kafeler veya o ilçede fiilen açılmış şubeler) seç.
3. Örneğin Sancaktepe dendiğinde o semtte gerçekten bulunan yerleri (Brogg Coffee, Coffy, Cookienero, Coffee Venga, Roew Coffee, Rings AVM kafeleri vb.) getir. Olmayan bir markayı o ilçeye asla yapıştırma!
4. ASLA konut projelerinin, sitelerin sosyal tesislerini, kapalı kulüpleri veya özel mülkleri mekan olarak önerme.
5. Eğer o semtte aranan kriterde yeterli mekan bulamazsan ASLA mekan uydurma; 'Bu semtte istediğin kritere uygun mekan sayısı çok kısıtlı, en yakın şu popüler noktaya bakabilirsin' de.
6. Eğer kullanıcı ne aradığını veya hangi semtte olduğunu henüz hiç belirtmediyse:
   - "places" dizisini boş bırak ([]).
   - "text" alanında kısaca ve samimi bir dille hangi semtte olduğunu sor.
7. Eğer semt ve istek belliyse, önerdiğin en fazla 3 gerçek ticari mekanı ve samimi 1-2 cümlelik yorumunu YALNIZCA geçerli bir JSON nesnesi olarak döndür:

\`\`\`json
{
  "text": "Semt hakkında dobra, samimi ve arkadaş canlısı 1-2 cümlelik yorumun",
  "places": [
    {
      "name": "Mekan Adı",
      "district": "Semt Adı",
      "rating": "4.4",
      "summary": "Neden önerildiği ve ortamı hakkında 1 kısa cümle",
      "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Mekan+Adi+Semt"
    }
  ]
}
\`\`\`
Sadece bu JSON formatında cevap ver.`;

    console.log(`[Gemini AI Chat Safe Call]: Prompt sent for: "${cleanLastMessage || rawLastUserMessage}"`);

    const modelsToTry = ['gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.5-flash-lite'];
    let response: any;
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.05,
              topP: 0.8,
              tools: [{ googleSearch: {} }]
            }
          });
        } catch (groundingErr: any) {
          response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              temperature: 0.05,
              topP: 0.8
            }
          });
        }
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Chat Retry]: ${modelName} başarısız oldu (${err.message?.slice(0, 80)}), sonraki modele geçiliyor...`);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    if (!response?.text && lastError) {
      throw lastError;
    }

    const fullText = response?.text || '';
    let responseText = 'İşte tavsiye ettiğim mekanlar:';
    let places: any[] = [];
    let jsonString = '';

    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1].trim();
    } else {
      const objMatch = fullText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        jsonString = objMatch[0].trim();
      }
    }

    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (parsed.text) responseText = parsed.text;
        if (Array.isArray(parsed.places)) {
          places = parsed.places.map((p: any, idx: number) => {
            const placeName = p.name || 'Mekan';
            const placeDistrict = p.district || '';
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName + ' ' + placeDistrict)}`;

            return {
              place_id: `chat_${Date.now()}_${idx}`,
              name: placeName,
              district: placeDistrict,
              rating: p.rating || '4.4',
              reason: p.summary || p.reason || 'Tavsiye edilen gerçek mekan.',
              summary: p.summary || p.reason || 'Tavsiye edilen gerçek mekan.',
              mapsUrl: mapsUrl,
              googleMapsUri: mapsUrl
            };
          });
        }
      } catch (e) {
        console.error('Failed to parse places JSON from Gemini response:', e);
      }
    }

    if (places.length === 0 && fullText && !jsonString) {
      responseText = fullText.replace(/```(?:json)?[\s\S]*?```/g, '').trim();
    }

    return NextResponse.json({
      text: responseText,
      content: responseText,
      places: places
    });

  } catch (error: any) {
    console.error('[Gemini AI Chat Fatal Error]:', error);
    return NextResponse.json(
      { error: '⚠️ Sunucular şu an biraz yoğun, birkaç saniye sonra tekrar dener misin?' },
      { status: 503 }
    );
  }
}
