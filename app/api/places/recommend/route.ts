import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { district, lat, lng, category } = await req.json();

    const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      console.error('[Google Places API]: GOOGLE_PLACES_API_KEY bulunamadı!');
      return NextResponse.json(
        { error: 'GOOGLE_PLACES_API_KEY eksik! Lütfen Vercel veya .env.local ortam değişkenlerine ekleyin.' },
        { status: 500 }
      );
    }

    const targetDistrict = district && district !== 'Anlık Konum' ? district : 'İstanbul';
    const textQuery = `${targetDistrict} ${category || 'popüler mekanlar'}`.trim();
    const hasGps = typeof lat === 'number' && typeof lng === 'number';

    console.log(`[Google Places Search Request]: textQuery="${textQuery}", GPS=${hasGps ? `${lat},${lng}` : 'Yok'}`);

    const googleApiUrl = 'https://places.googleapis.com/v1/places:searchText';
    const requestBody: any = {
      textQuery,
      languageCode: 'tr',
      maxResultCount: 6
    };

    if (hasGps) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 3500.0
        }
      };
    }

    const fieldMask = 'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.googleMapsUri,places.photos';

    const gRes = await fetch(googleApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(requestBody)
    });

    if (!gRes.ok) {
      const errText = await gRes.text();
      console.error(`[Google Places API Error ${gRes.status}]:`, errText);
      return NextResponse.json(
        { error: `Google Places API Hatası (${gRes.status}): ${errText}` },
        { status: 500 }
      );
    }

    const gData = await gRes.json();
    const places = gData.places || [];

    if (places.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: `Google Haritalar'da "${textQuery}" için sonuç bulunamadı.`
      });
    }

    const formattedPlaces = places.map((place: any) => {
      let photoUrl = null;
      if (place.photos && place.photos.length > 0) {
        photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=600&maxWidthPx=800&key=${apiKey}`;
      }

      return {
        place_id: place.id,
        name: place.displayName?.text || 'Mekan',
        district: targetDistrict,
        address: place.formattedAddress,
        rating: place.rating || 4.2,
        review_count: place.userRatingCount || 0,
        photo_url: photoUrl,
        googleMapsUri: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place.displayName?.text || '') + ' ' + (place.formattedAddress || ''))}`
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedPlaces
    });

  } catch (error: any) {
    console.error('[Recommend API Fatal Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Sunucu hatası oluştu.' },
      { status: 500 }
    );
  }
}
