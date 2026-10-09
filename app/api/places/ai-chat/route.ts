import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, userCoords } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // 1. API Anahtarı Kontrolü
    if (!apiKey) {
      console.error('[Gemini AI]: GEMINI_API_KEY çevre değişkeni bulunamadı!');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY eksik! Lütfen Vercel veya .env.local ortam değişkenlerine ekleyin.' },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Son kullanıcı mesajı ve mesaj geçmişi
    const conversationHistory = (messages || [])
      .map((m: any) => `${m.role === 'user' ? 'Kullanıcı' : 'Gurme'}: ${m.content}`)
      .join('\n');

    const lastUserMessage = messages?.filter((m: any) => m.role === 'user')?.pop()?.content || '';

    const locationContext = userCoords?.lat && userCoords?.lng
      ? `Kullanıcının anlık cihaz GPS koordinatları: Enlem ${userCoords.lat}, Boylam ${userCoords.lng}.`
      : `Kullanıcı henüz GPS konumu paylaşmadı.`;

    const prompt = `Sen bir arkadaş grubunun dobra, açık sözlü ve nokta atışı tavsiye veren "Masa Gurmesi" yapay zekasısın.
${locationContext}

KONUŞMA GEÇMİŞİ:
${conversationHistory}

KULLANICININ SON İSTEĞİ:
"${lastUserMessage}"

GÖREVİN VE KURALLAR:
1. Google Search Grounding (Canlı Google Araması) aracını kullanarak kullanıcının istediği semtteki (Örn: Sancaktepe, Çekmeköy, Kadıköy, Beşiktaş vb.) gerçek, canlı ve açık mekanları Google'da ara.
2. ASLA hafızandan veya hayal gücünden mekan uydurma. Yalnızca canlı Google arama sonuçlarında bulduğun gerçek mekanları listele.
3. Eğer kullanıcı ne aradığını veya hangi semtte olduğunu henüz hiç belirtmediyse, arama yapmadan önce kısaca samimi bir dille hangi semtte olduğunu sor.
4. Eğer semt ve istek belliyse, canlı Google aramasından bulduğun gerçek mekanları (en fazla 3 mekan) aşağıdaki JSON formatında bir kod bloğu ('''json ... ''') olarak cevabının sonuna iliştir:

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

5. JSON bloğunun üstünde ise arkadaşına anlatır gibi dobra, 2-3 cümlelik samimi yorumunu yap. Giriş tekerlemesi veya robotik kurumsal nezaket cümleleri kurma.`;

    console.log(`[Gemini Grounding Call]: Prompt sending to gemini-flash-latest with tools: [{ googleSearch: {} }]`);

    // 2. Gemini Live Google Search Grounding Çağrısı
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
      // Fallback model
      response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
    }

    const fullText = response?.text || '';
    console.log(`[Gemini Grounding Response]: Length = ${fullText.length}`);

    // 3. JSON Mekan Kartlarını Ayıkla
    let places: any[] = [];
    let cleanContent = fullText;

    const jsonMatch = fullText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (Array.isArray(parsed)) {
          places = parsed.map((p: any, idx: number) => ({
            place_id: `gemini_ground_${idx}`,
            name: p.name || 'Mekan',
            district: p.district || '',
            rating: p.rating || '4.5',
            reason: p.summary || p.reason || 'Canlı Google aramasında önerilen mekan.',
            mapsUrl: p.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name || '') + ' ' + (p.district || ''))}`,
            googleMapsUri: p.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.name || '') + ' ' + (p.district || ''))}`
          }));
        }
        // Temiz metin: JSON bloğunu metinden çıkar
        cleanContent = fullText.replace(/```(?:json)?[\s\S]*?```/g, '').trim();
      } catch (e) {
        console.error('Failed to parse places JSON from Gemini response:', e);
      }
    }

    return NextResponse.json({
      content: cleanContent || 'İşte canlı Google aramasıyla bulduğum mekanlar:',
      places
    });

  } catch (error: any) {
    console.error('[Gemini AI Grounding Fatal Error]:', error);
    // Hata varsa kesinlikle maskeleme, HTTP 500 ile açıkça sebebi dön
    return NextResponse.json(
      { error: error.message || 'Gemini yapay zeka servisinde bir hata oluştu.' },
      { status: 500 }
    );
  }
}
