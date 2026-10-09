import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel Serverless Function süresi 30 saniye

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

    const rawLastUserMessage = messages?.filter((m: any) => m.role === 'user')?.pop()?.content || '';
    // Emojileri temizle (Örn: "🚗 Parkı Kolay Mekan" -> "Parkı Kolay Mekan")
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
1. Çok hızlı ve net cevap ver (3 saniyenin altında). Google Search Grounding aracını kullanarak kullanıcının istediği semtteki gerçek, canlı ve açık mekanları bul.
2. ASLA hafızandan veya hayal gücünden mekan uydurma. Gerçek mekanları listele.
3. Eğer kullanıcı ne aradığını veya hangi semtte olduğunu henüz hiç belirtmediyse, arama yapmadan önce kısaca samimi bir dille hangi semtte olduğunu sor.
4. Eğer semt ve istek belliyse, bulduğun gerçek mekanları (en fazla 3 mekan) aşağıdaki JSON formatında bir kod bloğu (\`\`\`json ... \`\`\`) olarak cevabının sonuna iliştir:

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

    // 2. TIMEOUT KORUMALI ÇAĞRI (504 Timeout engellemek için 5s yarış)
    let response: any;
    try {
      const groundingPromise = ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI_CHAT_TIMEOUT')), 5000)
      );

      response = await Promise.race([groundingPromise, timeoutPromise]);
    } catch (groundingErr: any) {
      console.warn('[Gemini AI Grounding Warning]: Grounding yavaş kaldı veya hata verdi, hızlı direkt modele geçiliyor:', groundingErr.message);
      // Hızlı direkt model çağrısı (1.5-2 saniyede döner, 504 riskini sıfırlar)
      response = await ai.models.generateContent({
        model: 'gemini-flash-latest',
        contents: prompt
      });
    }

    const fullText = response?.text || '';
    console.log(`[Gemini Response]: Length = ${fullText.length}`);

    // 3. JSON Mekan Kartlarını Ayıkla
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
            place_id: `gemini_ground_${Date.now()}_${idx}`,
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
      content: cleanContent || 'İşte canlı aramada bulduğum mekanlar:',
      places
    });

  } catch (error: any) {
    console.error('[Gemini AI Grounding Fatal Error]:', error);
    const errMsg = String(error?.message || '');
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
      return NextResponse.json(
        { error: '⚡ Gurme biraz yoğun! Lütfen 30 saniye sonra tekrar deneyin.' },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: errMsg || 'Gemini yapay zeka servisinde bir hata oluştu.' },
      { status: 500 }
    );
  }
}
