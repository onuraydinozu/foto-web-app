import { generateText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      // Graceful fallback if API key is not yet set on Vercel
      return Response.json({
        content: "Masa Gurmesi devrede! Kadıköy ve çevresinde aradığın kritere uygun şu mekanları öneriyorum:",
        places: [
          {
            place_id: "gurme_1",
            name: "B.O.B Moda (Wings & Burger)",
            district: "Moda / Kadıköy",
            rating: 4.6,
            reason: "Sıcak soslu ve sınırsız kova alternatifleriyle grubun favorisi.",
            parking_note: "Sokak dar, Caferağa otoparkına bırakmak şart.",
            lat: 40.985,
            lng: 29.028
          },
          {
            place_id: "gurme_2",
            name: "Wings & Beer Hasanpaşa",
            district: "Hasanpaşa / Kadıköy",
            rating: 4.4,
            reason: "Geniş masalar ve fix menü çıtır sepet.",
            parking_note: "Karşısında İSPARK var, arabayla çok rahat.",
            lat: 40.992,
            lng: 29.035
          }
        ]
      });
    }

    // Format messages for ai SDK
    const formattedMessages = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content || ''
    }));

    const result = await generateText({
      model: google('gemini-1.5-flash'),
      system: `Sen bir arkadaş grubunun 'Masa Gurmesi' adlı yapay zeka karar asistanısın.
Görevin: Grubun 'nereye gitsek' kararsızlığını ve spesifik mekan taleplerini (örn: sınırsız tavuk, teras, sessiz kafe, gece açık çorbacı) çözmek.

Kurallar:
1. Kısa, samimi, net ve doğrudan konuş. Giriş tekerlemeleri veya gereksiz nezaket cümleleri kurma.
2. Eğer kullanıcının bulunduğu semt veya lokasyon bilinmiyorsa, listeleme yapmadan önce hemen kısaca sor: 'Hangi semttesiniz ya da arabayla kaça kadar geçersiniz?'
3. Lokasyon belli olduğunda en fazla 2 veya 3 spesifik mekan öner. Her mekan için otopark durumunu (varsa) ve o mekanı neden seçtiğini 1 cümleyle belirt.
4. Mekan önerirken her zaman 'show_places' aracını çağırarak kartları arayüze bas.`,
      messages: formattedMessages,
      // @ts-ignore
      tools: {
        show_places: tool({
          description: 'Önerilen mekanların detaylarını arayüze kart olarak yollamak için bu aracı kullan.',
          // @ts-ignore
          parameters: z.object({
            places: z.array(
              z.object({
                place_id: z.string().describe('Rastgele benzersiz ID'),
                name: z.string().describe('Mekanın adı'),
                district: z.string().describe('Semt/İlçe'),
                rating: z.number().describe('Mekan puanı (örn: 4.5)'),
                reason: z.string().describe('Bu mekanı neden önerdin (1 cümle)'),
                parking_note: z.string().describe('Otopark durumu (örn: Vale var, İSPARK yakın, Sokak zor)'),
                lat: z.number().optional().describe('Tahmini enlem'),
                lng: z.number().optional().describe('Tahmini boylam'),
              })
            ).describe('Önerilecek mekanlar listesi'),
          }) as any
        }),
      },
    });

    let places: any[] = [];
    if (result.toolCalls && result.toolCalls.length > 0) {
      for (const tc of (result.toolCalls as any[])) {
        if (tc.toolName === 'show_places' && tc.args?.places) {
          places = places.concat(tc.args.places);
        }
      }
    }

    return Response.json({
      content: result.text || (places.length > 0 ? "İşte masaya özel seçtiğim mekanlar:" : "Nasıl bir yere gitmek istersiniz?"),
      places
    });
  } catch (err: any) {
    console.error('Masa Gurmesi API Error:', err);
    return Response.json({
      content: "Şu an bağlantıda ufak bir dalgalanma var ama hemen alternatif sunayım:",
      places: [
        {
          place_id: "fb_1",
          name: "Moda Çay Bahçesi & Çevresi",
          district: "Moda / Kadıköy",
          rating: 4.5,
          reason: "Açık hava, deniz manzarası ve sakin muhabbet.",
          parking_note: "Otopark Moda İSPARK.",
          lat: 40.983,
          lng: 29.025
        }
      ]
    });
  }
}
