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

    const prompt = `Sen bir arkadaş grubunun dobra, açık sözlü ve nokta atışı tavsiye veren "Masa Gurmesi" yapay zekasısın.
${locationContext}

KONUŞMA GEÇMİŞİ:
${conversationHistory}

KULLANICININ SON İSTEĞİ:
"${cleanLastMessage || rawLastUserMessage}"

GÖREVİN VE KURALLAR:
1. Çok hızlı ve dobra cevap ver (2 saniyenin altında). Kullanıcının istediği semtteki gerçek mekanları hafızandan listele.
2. ASLA hafızandan uydurma mekan yazma. Sadece gerçek ve bilinen popüler mekanları listele.
3. Eğer kullanıcı ne aradığını veya hangi semtte olduğunu henüz hiç belirtmediyse, kısaca samimi bir dille hangi semtte olduğunu sor.
4. Eğer semt ve istek belliyse, önerdiğin gerçek mekanları (en fazla 3 mekan) aşağıdaki JSON formatında bir kod bloğu (\`\`\`json ... \`\`\`) olarak cevabının sonuna iliştir:

\`\`\`json
[
  {
    "name": "Mekan Adı",
    "district": "Semt / İlçe",
    "rating": "4.5",
    "summary": "Neden önerildiği, ortamı ve açık olma durumu hakkında 1 cümle",
    "mapsUrl": "https://www.google.com/maps/search/?api=1&query=Mekan+Adi+Semt"
  }
]
\`\`\`

5. JSON bloğunun üstünde arkadaşına anlatır gibi dobra, 2-3 cümlelik samimi yorumunu yap. Robotik kurumsal nezaket cümleleri kurma.`;

    console.log(`[Gemini AI Chat Call]: Prompt sent for: "${cleanLastMessage || rawLastUserMessage}"`);

    // 2. YEDEK MODELLERLE ÇAĞRI (503 High Demand ve 429 için otomatik fallback)
    let response: any;
    const modelsToTry = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-3.8-flash'];
    let lastError: any = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: prompt
        });
        if (response?.text) break;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Gemini Chat Retry]: ${modelName} başarısız oldu (${err.message?.slice(0, 80)}), yedek modele geçiliyor...`);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (!response?.text && lastError) {
      throw lastError;
    }

    const fullText = response?.text || '';
    let places: any[] = [];
    let cleanContent = fullText;
    let jsonString = '';

    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1].trim();
      cleanContent = fullText.replace(/```(?:json)?[\s\S]*?```/g, '').trim();
    } else {
      const arrayMatch = fullText.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        jsonString = arrayMatch[0].trim();
        cleanContent = fullText.replace(/\[\s*\{[\s\S]*\}\s*\]/g, '').trim();
      }
    }

    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
          places = parsed.map((p: any, idx: number) => ({
            place_id: `gemini_chat_${Date.now()}_${idx}`,
            name: p.name || 'Mekan',
            district: p.district || '',
            rating: p.rating || '4.5',
            reason: p.summary || p.reason || 'Tavsiye edilen popüler mekan.',
            mapsUrl: p.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name || '') + ' ' + (p.district || ''))}`,
            googleMapsUri: p.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name || '') + ' ' + (p.district || ''))}`
          }));
        }
      } catch (e) {
        console.error('Failed to parse places JSON from Gemini response:', e);
      }
    }

    return NextResponse.json({
      content: cleanContent || 'İşte tavsiye ettiğim mekanlar:',
      places
    });

  } catch (error: any) {
    console.error('[Gemini AI Chat Fatal Error]:', error);
    return NextResponse.json(
      { error: '⚠️ Sunucular şu an biraz yoğun, birkaç saniye sonra tekrar dener misin?' },
      { status: 503 }
    );
  }
}
