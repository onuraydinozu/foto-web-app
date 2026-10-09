import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Haversine formülü ile km cinsinden mesafe hesaplama
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Kategori Anahtar Kelime Sözlüğü (Google Arama Motoru İçin Optimize Edilmiş Arama Metni)
function getCategoryQuery(cat: string, targetDistrict: string): string {
  const d = targetDistrict && targetDistrict !== 'Anlık Konum' ? targetDistrict : 'İstanbul';
  const c = (cat || '').toLowerCase();

  if (c.includes('hızlı') || c.includes('sokak') || c.includes('burger')) {
    return `${d} burger sokak lezzetleri fast food doner`;
  }
  if (c.includes('kahve') || c.includes('kafe') || c.includes('tatlı')) {
    return `${d} 3. nesil kahve cafe coffee`;
  }
  if (c.includes('oturmalı') || c.includes('yemek') || c.includes('dinner')) {
    return `${d} restoran yemek bistro`;
  }
  if (c.includes('pub') || c.includes('bar') || c.includes('gece') || c.includes('bira')) {
    return `${d} pub bar bira kokteyl`;
  }
  if (c.includes('kahvaltı') || c.includes('brunch') || c.includes('fırın')) {
    return `${d} kahvalti brunch tatli firin`;
  }
  if (c.includes('aktivite') || c.includes('kaos') || c.includes('oyun')) {
    return `${d} oyun bowling bilardo eglence`;
  }
  return `${d} en popüler mekanlar restoran kafe`;
}

export async function POST(req: Request) {
  try {
    const { district, lat, lng, category, filters } = await req.json();

    const targetDistrict = district || 'Kadıköy';
    const textQuery = getCategoryQuery(category, targetDistrict);
    const hasGps = typeof lat === 'number' && typeof lng === 'number';

    const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // 1. API ANAHTARI KONTROLÜ (Kesinlikle sahte veri dönme, açıkça hata dön!)
    if (!API_KEY) {
      console.error('[Google Places API]: GOOGLE_PLACES_API_KEY çevre değişkeni bulunamadı!');
      return NextResponse.json({
        success: false,
        error: "GOOGLE_PLACES_API_KEY eksik! Lütfen Vercel veya .env dosyasına anahtarınızı ekleyin."
      }, { status: 500 });
    }

    console.log(`[Google Places Live Search]: textQuery="${textQuery}", district="${targetDistrict}", keyLength=${API_KEY.length}`);

    // 2. GOOGLE PLACES API (NEW) ÇAĞRISI
    const googleApiUrl = 'https://places.googleapis.com/v1/places:searchText';
    const requestBody: any = {
      textQuery,
      languageCode: 'tr',
      maxResultCount: 8
    };

    if (hasGps) {
      requestBody.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 4000.0
        }
      };
    }

    const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.priceLevel,places.regularOpeningHours,places.parkingOptions,places.location,places.photos,places.googleMapsUri';

    const gRes = await fetch(googleApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`[Google Places Response Status]: ${gRes.status}`);

    if (!gRes.ok) {
      const errText = await gRes.text();
      console.error(`[Google Places API Error ${gRes.status}]:`, errText);
      return NextResponse.json({
        success: false,
        error: `Google Places API Hatası (${gRes.status}): ${errText}`
      }, { status: 500 });
    }

    const gData = await gRes.json();
    const places = gData.places || [];

    if (places.length === 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: `Google Haritalar'da "${textQuery}" için açık mekan bulunamadı.`
      });
    }

    const formattedPlaces = places.map((place: any) => {
      let photoUrl = null;
      if (place.photos && place.photos.length > 0) {
        photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=600&maxWidthPx=800&key=${API_KEY}`;
      }

      const pLat = place.location?.latitude;
      const pLng = place.location?.longitude;
      const distance = (hasGps && pLat && pLng) ? calculateDistance(lat, lng, pLat, pLng) : null;

      return {
        place_id: place.id,
        name: place.displayName?.text || 'Mekan',
        district: targetDistrict,
        address: place.formattedAddress,
        rating: place.rating || 4.2,
        review_count: place.userRatingCount || 0,
        price_level: place.priceLevel === 'PRICE_LEVEL_INEXPENSIVE' ? '$' : place.priceLevel === 'PRICE_LEVEL_EXPENSIVE' ? '$$$' : '$$',
        parking_info: {
          valet: !!place.parkingOptions?.hasValetParking,
          free_lot: !!place.parkingOptions?.hasFreeParkingLot,
          street: !!place.parkingOptions?.hasStreetParking || true
        },
        lat: pLat,
        lng: pLng,
        photo_url: photoUrl,
        googleMapsUri: place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((place.displayName?.text || '') + ' ' + (place.formattedAddress || ''))}`,
        distance_km: distance,
        open_now: place.regularOpeningHours?.openNow ?? true
      };
    });

    // Yumuşak sıralama (Soft-sort, ASLA mekanları filtre yüzünden çöpe atma)
    let sortedPlaces = [...formattedPlaces];
    if (filters?.includes('rating')) {
      sortedPlaces.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (hasGps) {
      sortedPlaces.sort((a, b) => (a.distance_km || 99) - (b.distance_km || 99));
    }

    return NextResponse.json({
      success: true,
      data: sortedPlaces,
      source: 'google_places_api_new',
      query: textQuery
    });

  } catch (error: any) {
    console.error('[Recommend Route Fatal Error]:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Sunucu hatası oluştu.'
    }, { status: 500 });
  }
}
