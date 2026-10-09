import { streamText, tool } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: google('gemini-1.5-flash'),
    system: `Sen bir arkadaş grubunun 'Masa Gurmesi' adlı yapay zeka karar asistanısın.
Görevin: Grubun 'nereye gitsek' kararsızlığını ve spesifik mekan taleplerini (örn: sınırsız tavuk, teras, sessiz kafe, gece açık çorbacı) çözmek.

Kurallar:
1. Kısa, samimi, net ve doğrudan konuş. Giriş tekerlemeleri veya gereksiz nezaket cümleleri kurma.
2. Eğer kullanıcının bulunduğu semt veya lokasyon bilinmiyorsa, listeleme yapmadan önce hemen kısaca sor: 'Hangi semttesiniz ya da arabayla kaça kadar geçersiniz?'
3. Lokasyon belli olduğunda en fazla 2 veya 3 spesifik mekan öner. Her mekan için otopark durumunu (varsa) ve o mekanı neden seçtiğini 1 cümleyle belirt.
4. Mekan önerirken her zaman 'show_places' aracını çağırarak kartları arayüze bas.`,
    messages,
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

  return (result as any).toTextStreamResponse ? (result as any).toTextStreamResponse() : (result as any).toDataStreamResponse();
}
