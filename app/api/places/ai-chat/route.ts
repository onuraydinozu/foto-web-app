import { generateText, tool } from 'ai';
import { createGoogle } from '@ai-sdk/google';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, userCoords } = await req.json();

    const placesApiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

    let fetchedPlaces: any[] = [];
    let apiError: string | null = null;

    // 1. searchGooglePlaces Tool Tanımı
    // @ts-ignore
    const searchGooglePlacesTool = tool({
      description: 'Google Places API (New) üzerinden gerçek canlı mekanları arar. Kullanıcı bir semt ve istek belirttiğinde bu aracı çağırmak ZORUNLUDUR.',
      // @ts-ignore
      parameters: z.object({
        query: z.string().describe('Aranacak mekan türü veya istek (örn: "gece açık yemek", "sınırsız tavuk", "sakin kafe")'),
        district: z.string().describe('Semt adı (örn: "Sancaktepe", "Kadıköy", "Beşiktaş")'),
        lat: z.number().optional().describe('Enlem (varsa)'),
        lng: z.number().optional().describe('Boylam (varsa)')
      }) as any,
      // @ts-ignore
      execute: async ({ query, district, lat, lng }: any) => {
        const effectiveLat = lat ?? userCoords?.lat;
        const effectiveLng = lng ?? userCoords?.lng;
        const hasGps = typeof effectiveLat === 'number' && typeof effectiveLng === 'number';

        if (!placesApiKey) {
          console.error('[Google Places API]: GOOGLE_PLACES_API_KEY çevre değişkeni bulunamadı!');
          apiError = 'Google Haritalar bağlantısı kurulamadı, API anahtarınızı kontrol edin (GOOGLE_PLACES_API_KEY eksik).';
          return [];
        }

        const textQuery = `${district || ''} ${query}`.trim();
        console.log(`[Google Places Search]: textQuery="${textQuery}", district="${district}"`);

        try {
          const googleApiUrl = 'https://places.googleapis.com/v1/places:searchText';
          const requestBody: any = {
            textQuery,
            languageCode: 'tr',
            maxResultCount: 3
          };

          if (hasGps) {
            requestBody.locationBias = {
              circle: {
                center: { latitude: effectiveLat, longitude: effectiveLng },
                radius: 3500.0
              }
            };
          }

          const fieldMask = 'places.displayName,places.rating,places.formattedAddress,places.googleMapsUri,places.regularOpeningHours,places.photos';

          const gRes = await fetch(googleApiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': placesApiKey,
              'X-Goog-FieldMask': fieldMask
            },
            body: JSON.stringify(requestBody)
          });

          console.log(`[Google Places HTTP Status]: ${gRes.status}`);

          if (!gRes.ok) {
            const errBody = await gRes.text();
            console.error(`[Google Places API Error ${gRes.status}]:`, errBody);
            apiError = `Google Haritalar bağlantısı kurulamadı (${gRes.status} hatası). Lütfen Google Cloud Console'da Places API (New) ve API anahtarınızı kontrol edin.`;
            return [];
          }

          const gData = await gRes.json();
          if (gData.places && gData.places.length > 0) {
            const mapped = gData.places.map((p: any) => ({
              place_id: p.id || Math.random().toString(),
              name: p.displayName?.text || 'Mekan',
              rating: p.rating || 4.2,
              address: p.formattedAddress || district,
              district: district || p.formattedAddress?.split(',')[1]?.trim() || '',
              googleMapsUri: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.displayName?.text || '') + ' ' + (p.formattedAddress || ''))}`,
              open_now: p.regularOpeningHours?.openNow ?? true,
              photo_url: p.photos?.[0]?.name ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=600&maxWidthPx=800&key=${placesApiKey}` : null,
              reason: p.rating ? `Puanı ${p.rating} olan gerçek Google Haritalar mekanı.` : 'Google Haritalar üzerinden bulundu.'
            }));
            fetchedPlaces = mapped;
            return mapped;
          } else {
            console.log(`[Google Places]: 0 mekan bulundu textQuery: ${textQuery}`);
            return [];
          }
        } catch (fetchErr: any) {
          console.error('[Google Places Exception]:', fetchErr);
          apiError = `Google Haritalar bağlantı hatası: ${fetchErr.message}`;
          return [];
        }
      }
    });

    const formattedMessages = (messages || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content || ''
    }));

    const lastUserText = formattedMessages[formattedMessages.length - 1]?.content || '';

    // 2. Model Sistem Komutu
    const systemPrompt = `Sen bir arkadaş grubunun dobra, açık sözlü ve nokta atışı tavsiye veren yapay zeka mekan asistanısın.

KURALLAR:
1. Kullanıcı bir mekan türü veya yemek sorduğunda:
   - Eğer kullanıcının bulunduğu semti bilmiyorsan ve cihaz koordinatı (GPS) gelmediyse, ASLA MEKAN UYDURMA. Kullanıcıya doğrudan, kısa ve samimi bir dille nerede olduğunu, hangi semtte aradığını sor.
   - Eğer semt belirtildiyse (örn: 'Sancaktepe', 'Kadıköy', 'Beşiktaş') veya GPS koordinatı varsa, ASLA HAFIZANDAN MEKAN UYDURMA. ZORUNLU OLARAK 'searchGooglePlaces' aracını çağır ve gerçek Google Places verisini çek.
2. 'searchGooglePlaces' aracından gelen mekanları incele. Kullanıcıya dobra, samimi bir dille, mekanın ortamını ve puanını 2-3 cümleyle özetle.
3. Asla 'Basta', 'Moda', 'Kadıköy' gibi sabit uydurma mekanlar önerme. Sadece ve sadece Google'dan dönen mekanları öner.
4. Asla robotik giriş cümleleri veya kurumsal nezaket kalıpları kurma. Bir kankan gibi samimi konuş.`;

    let responseText = '';

    // 3. Gemini LLM Çağrısı
    if (geminiApiKey && geminiApiKey.length > 5) {
      try {
        const google = createGoogle({ apiKey: geminiApiKey });

        const result = await generateText({
          model: google('gemini-1.5-flash'),
          system: systemPrompt,
          messages: formattedMessages,
          // @ts-ignore
          tools: {
            searchGooglePlaces: searchGooglePlacesTool
          },
          // @ts-ignore
          maxSteps: 2
        });

        responseText = result.text;
      } catch (geminiErr: any) {
        console.error('[Gemini LLM Error]:', geminiErr);
      }
    }

    // Eğer Gemini çağrısı yapılamadıysa veya model tool çağırmadıysa ama kullanıcı bir semt yazdıysa
    if (fetchedPlaces.length === 0 && !apiError) {
      // Mesaj geçmişinden son istek ve semt çıkarımı
      const allText = formattedMessages.map((m: any) => m.content).join(' ');
      const words = lastUserText.trim().split(/\s+/);
      
      // Kullanıcı sadece semt yazmış olabilir (örn: "sancaktepe")
      const potentialDistrict = words.length <= 3 ? lastUserText.trim() : words[0];
      const previousRequest = formattedMessages.find((m: any) => m.role === 'user' && m.content !== lastUserText)?.content || 'gece açık yemek restoran';

      console.log(`[Manual Tool Trigger]: District="${potentialDistrict}", Query="${previousRequest}"`);

      // Doğrudan aracı tetikle
      await searchGooglePlacesTool.execute({
        query: previousRequest,
        district: potentialDistrict,
        lat: userCoords?.lat,
        lng: userCoords?.lng
      }, { toolCallId: 'direct_call', messages: [] } as any);

      if (fetchedPlaces.length > 0) {
        responseText = `${potentialDistrict} için canlı Google Haritalar'ı taradım! İşte o bölgede bulduğum gerçek mekanlar:`;
      }
    }

    // Eğer hata oluştuysa kullanıcıya açıkça bildir, asla sahte mekan basma
    if (apiError) {
      return Response.json({
        content: `⚠️ ${apiError}`,
        places: []
      });
    }

    if (fetchedPlaces.length === 0 && !responseText) {
      responseText = "Hangi semtte arıyorsunuz? Semti söylerseniz Google Haritalar'dan canlı mekanları çıkartayım.";
    }

    return Response.json({
      content: responseText,
      places: fetchedPlaces
    });

  } catch (error: any) {
    console.error('Fatal AI Chat Route Error:', error);
    return Response.json({
      content: `⚠️ Bir hata oluştu: ${error.message || 'Sunucu hatası'}`,
      places: []
    });
  }
}
