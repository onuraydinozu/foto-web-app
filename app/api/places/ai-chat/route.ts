import { NextResponse } from 'next/server';
import { generateText, tool } from 'ai';
import { createGoogle } from '@ai-sdk/google';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, userCoords } = await req.json();

    const geminiApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
    const placesApiKey = process.env.GOOGLE_PLACES_API_KEY || geminiApiKey;

    if (!geminiApiKey) {
      console.error('[AI Chat Error]: GOOGLE_GENERATIVE_AI_API_KEY is not defined.');
      return NextResponse.json(
        { error: 'GOOGLE_GENERATIVE_AI_API_KEY bulunamadı. Lütfen Vercel ayarlarından ekleyin.' },
        { status: 500 }
      );
    }

    const google = createGoogle({ apiKey: geminiApiKey });

    // Format all incoming messages to preserve full conversation history
    const formattedMessages = (messages || []).map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content || ''
    }));

    let fetchedPlaces: any[] = [];

    // Gerçek Google Places API Tool'u
    // @ts-ignore
    const searchGooglePlaces = tool({
      description: 'Google Places API (New) üzerinden gerçek canlı mekanları arar. Kullanıcı bir semt ve istek belirttiğinde bu aracı çağırmak ZORUNLUDUR.',
      // @ts-ignore
      parameters: z.object({
        query: z.string().describe('Aranacak mekan türü veya yemek (örn: "gece açık yemek", "sınırsız tavuk", "sakin kafe")'),
        district: z.string().describe('Kullanıcının belirttiği veya konumundan anlaşılan semt/ilçe adı (örn: "Çekmeköy", "Sancaktepe", "Kadıköy")'),
        lat: z.number().optional().describe('Kullanıcı GPS enlem değeri'),
        lng: z.number().optional().describe('Kullanıcı GPS boylam değeri')
      }) as any,
      // @ts-ignore
      execute: async ({ query, district, lat, lng }: any) => {
        if (!placesApiKey) {
          throw new Error('GOOGLE_PLACES_API_KEY tanımlanmamış. Lütfen Vercel ortam değişkenlerine ekleyin.');
        }

        const effectiveLat = lat ?? userCoords?.lat;
        const effectiveLng = lng ?? userCoords?.lng;
        const hasGps = typeof effectiveLat === 'number' && typeof effectiveLng === 'number';

        const textQuery = `${district} ${query}`.trim();
        console.log(`[Google Places API Call]: textQuery="${textQuery}"`);

        const googleApiUrl = 'https://places.googleapis.com/v1/places:searchText';
        const requestBody: any = {
          textQuery,
          languageCode: 'tr',
          maxResultCount: 4
        };

        if (hasGps) {
          requestBody.locationBias = {
            circle: {
              center: { latitude: effectiveLat, longitude: effectiveLng },
              radius: 4000.0
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

        if (!gRes.ok) {
          const errText = await gRes.text();
          console.error(`[Google Places API Failed]: ${gRes.status} - ${errText}`);
          throw new Error(`Google Places API Hatası (${gRes.status}): ${errText}`);
        }

        const gData = await gRes.json();
        if (gData.places && gData.places.length > 0) {
          const mapped = gData.places.map((p: any, idx: number) => ({
            place_id: p.id || `google_${idx}`,
            name: p.displayName?.text || 'Mekan',
            rating: p.rating || 4.2,
            address: p.formattedAddress || district,
            district: district,
            googleMapsUri: p.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((p.displayName?.text || '') + ' ' + (p.formattedAddress || ''))}`,
            open_now: p.regularOpeningHours?.openNow ?? true,
            photo_url: p.photos?.[0]?.name ? `https://places.googleapis.com/v1/${p.photos[0].name}/media?maxHeightPx=600&maxWidthPx=800&key=${placesApiKey}` : null,
            reason: p.rating ? `Puanı ${p.rating} olan gerçek Google Haritalar mekanı.` : 'Google Haritalar üzerinden bulundu.'
          }));
          fetchedPlaces = mapped;
          return mapped;
        }

        console.log(`[Google Places]: 0 mekan döndü.`);
        return [];
      }
    });

    const locationInfo = userCoords?.lat && userCoords?.lng
      ? `Kullanıcının canlı GPS koordinatları: [Enlem: ${userCoords.lat}, Boylam: ${userCoords.lng}].`
      : `Kullanıcının GPS koordinatı kapalı veya paylaşılmadı.`;

    const systemPrompt = `Sen bir mekan gurmesi yapay zeka asistanısın.
${locationInfo}

GÖREVLERİN:
1. Kullanıcının tüm mesaj geçmişini dikkatle takip et.
2. Kullanıcı bir semt adı söylediğinde (Örn: Çekmeköy, Sancaktepe, Kadıköy, Beşiktaş vb.) veya konum verdiğinde bunu anla. Çekmeköy veya başka bir semt dendiğinde ASLA tekrar "hangi semttesiniz" diye sorma!
3. Kullanıcının istediği semt ve mekan türü için ZORUNLU OLARAK 'searchGooglePlaces' aracını çağır ve canlı verileri çek.
4. ASLA hafızandan uydurma mekan veya geçmiş konuşmalardaki eski mekanları söyleme. Sadece 'searchGooglePlaces' aracından dönen gerçek mekanları aktar.
5. Kullanıcıya dobra, arkadaş canlısı ve samimi bir dille mekanları 2-3 cümleyle tanıt.
6. Eğer kullanıcı ne aradığını veya nerede olduğunu henüz söylemediyse samimi bir dille kısaca sor.`;

    // Gerçek Gemini LLM çağrısı (Tool Calling ile)
    const result = await generateText({
      model: google('gemini-1.5-flash'),
      system: systemPrompt,
      messages: formattedMessages,
      // @ts-ignore
      tools: {
        searchGooglePlaces: searchGooglePlaces
      },
      // @ts-ignore
      maxSteps: 3
    });

    return NextResponse.json({
      content: result.text || 'İşte bulduğum gerçek mekanlar:',
      places: fetchedPlaces
    });

  } catch (error: any) {
    console.error('[AI Chat Fatal Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Yapay zeka servisinde bir hata oluştu.' },
      { status: 500 }
    );
  }
}
