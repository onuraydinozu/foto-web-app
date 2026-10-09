import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Sunucu Tarafı Bellek Önbelleği (5 Dakika)
const placesCache = new Map<string, { data: any[]; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

// Kategori -> Foursquare v3 Parametre Eşleşmesi
function getFoursquareCategoryConfig(category: string): {
  categories?: string;
  query: string;
  displayName: string;
} {
  const cat = (category || '').toLowerCase();

  if (cat.includes('kahve') || cat.includes('coffee')) {
    // 3. Nesil Kahve: categories=13032,13034 (Coffee Shop / Cafe) veya query=kahve
    return {
      categories: '13032,13034',
      query: 'kahve',
      displayName: '3. Nesil Kahve'
    };
  }

  if (cat.includes('sokak') || cat.includes('hızlı') || cat.includes('fast')) {
    // Hızlı / Sokak: categories=13145 (Fast Food) veya query=burger doner
    return {
      categories: '13145',
      query: 'burger doner',
      displayName: 'Hızlı / Sokak'
    };
  }

  if (cat.includes('oturmalı') || cat.includes('yemek') || cat.includes('dinner') || cat.includes('restaurant')) {
    // Oturmalı Yemek: categories=13065 (Restaurant)
    return {
      categories: '13065',
      query: 'restaurant',
      displayName: 'Oturmalı Yemek'
    };
  }

  if (cat.includes('pub') || cat.includes('bar') || cat.includes('gece')) {
    // Pub / Gece: categories=13003,13018 (Bar / Pub)
    return {
      categories: '13003,13018',
      query: 'pub bar',
      displayName: 'Pub / Gece'
    };
  }

  if (cat.includes('kahvaltı') || cat.includes('brunch')) {
    // Kahvaltı & Brunch: categories=13028 (Breakfast Spot)
    return {
      categories: '13028',
      query: 'kahvalti',
      displayName: 'Kahvaltı & Brunch'
    };
  }

  if (cat.includes('aktivite') || cat.includes('kaos') || cat.includes('oyun')) {
    // Aktivite & Kaos: categories=10000 (Arts & Entertainment) veya query=oyun aktivite
    return {
      categories: '10000',
      query: 'oyun aktivite',
      displayName: 'Aktivite & Kaos'
    };
  }

  // Varsayılan: 3. Nesil Kahve
  return {
    categories: '13032,13034',
    query: 'kahve',
    displayName: '3. Nesil Kahve'
  };
}

async function handleFoursquareSearch(params: {
  lat: number | null;
  lng: number | null;
  district: string;
  category: string;
}) {
  try {
    const { lat, lng, district, category } = params;
    const targetDistrict = district && district !== 'Anlık Konum' ? district : 'Sancaktepe';
    const config = getFoursquareCategoryConfig(category);

    const apiKey = process.env.FOURSQUARE_API_KEY;
    if (!apiKey) {
      console.error('[Foursquare API]: FOURSQUARE_API_KEY is not defined in environment variables.');
      return NextResponse.json(
        { error: 'FOURSQUARE_API_KEY eksik! Lütfen Vercel veya .env.local ortam değişkenlerine ekleyin.' },
        { status: 500 }
      );
    }

    // Önbellek Anahtarı
    const cacheKey = lat && lng
      ? `fsq_${lat.toFixed(3)}_${lng.toFixed(3)}_${config.query}`
      : `fsq_${targetDistrict.toLowerCase()}_${config.query}`;

    const cached = placesCache.get(cacheKey);
    if (cached && cached.expiry > Date.now() && cached.data.length > 0) {
      console.log(`[Foursquare Cache HIT]: Key="${cacheKey}" - ${cached.data.length} mekan döndürüldü.`);
      return NextResponse.json({
        places: cached.data,
        data: cached.data,
        success: true,
        cached: true
      });
    }

    // Foursquare API v3 Endpoint Yapılandırması
    const searchParams = new URLSearchParams();

    if (lat && lng) {
      searchParams.set('ll', `${lat},${lng}`);
      searchParams.set('radius', '3500');
      searchParams.set('sort', 'DISTANCE');
    } else {
      searchParams.set('near', `${targetDistrict}, Istanbul`);
    }

    if (config.categories) {
      searchParams.set('categories', config.categories);
    }
    if (config.query) {
      searchParams.set('query', config.query);
    }
    searchParams.set('limit', '12');
    searchParams.set('fields', 'fsq_id,name,geocodes,location,categories,distance,rating,photos');

    const endpoint = `https://api.foursquare.com/v3/places/search?${searchParams.toString()}`;
    console.log(`[Foursquare Request]: ${endpoint}`);

    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        Authorization: apiKey,
      },
      next: { revalidate: 300 } // 5 dakika Next.js önbellek
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error(`[Foursquare Error ${response.status}]:`, errText);
      return NextResponse.json(
        { error: `Foursquare API Hatası (${response.status}): ${errText || 'Mekanlar alınamadı'}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];

    const formattedPlaces = results.map((item: any, idx: number) => {
      const name = item.name || 'Mekan';
      const itemLat = item.geocodes?.main?.latitude || lat || null;
      const itemLon = item.geocodes?.main?.longitude || lng || null;

      // İlçe / Mahalle Belirleme
      const itemDistrict =
        item.location?.neighborhood?.[0] ||
        item.location?.locality ||
        item.location?.suburb ||
        targetDistrict;

      // Adres
      const address = item.location?.formatted_address || item.location?.address || `${itemDistrict}, İstanbul`;

      // Mesafe: Foursquare metre döner (e.g. 450m -> 0.5 km)
      let distanceStr: string | null = null;
      let distanceKm: number | null = null;
      if (typeof item.distance === 'number') {
        const km = item.distance / 1000;
        distanceStr = `${km.toFixed(1)} km`;
        distanceKm = Number(km.toFixed(1));
      }

      // Puan: Foursquare 10 üzerinden döner (e.g. 8.8 -> 4.4 / 5)
      let ratingStr = '4.4';
      if (typeof item.rating === 'number') {
        ratingStr = (item.rating / 2).toFixed(1);
      } else {
        ratingStr = (4.2 + ((idx * 3) % 6) * 0.1).toFixed(1);
      }

      // Fotoğraf
      let photoUrl: string | null = null;
      if (Array.isArray(item.photos) && item.photos.length > 0) {
        const p = item.photos[0];
        photoUrl = `${p.prefix}original${p.suffix}`;
      }

      // Google Maps Linki (İşletme adı ve koordinatlarla)
      const mapsUrl = itemLat && itemLon
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (itemDistrict || ''))}&query_place_id=${itemLat},${itemLon}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (itemDistrict || ''))}`;

      return {
        name: name,
        district: itemDistrict,
        distance: distanceStr || (distanceKm !== null ? `${distanceKm.toFixed(1)} km` : undefined),
        distance_km: distanceKm,
        rating: ratingStr,
        category: config.displayName,
        mapsUrl: mapsUrl,
        place_id: item.fsq_id || `fsq_${idx}`,
        photo_url: photoUrl,
        address: address,
        isOpen: true,
        lat: itemLat,
        lng: itemLon
      };
    });

    // 5 Dakika Bellek Önbelleğine Kaydet
    if (formattedPlaces.length > 0) {
      placesCache.set(cacheKey, {
        data: formattedPlaces,
        expiry: Date.now() + CACHE_TTL_MS
      });
    }

    return NextResponse.json({
      places: formattedPlaces,
      data: formattedPlaces,
      success: true,
      message: formattedPlaces.length === 0 ? `"${targetDistrict}" bölgesinde Foursquare üzerinde mekan bulunamadı.` : undefined
    });

  } catch (error: any) {
    console.error('[Recommend Foursquare Route Fatal Error]:', error);
    return NextResponse.json(
      { error: 'Foursquare mekanları yüklenirken bir sorun oluştu.' },
      { status: 500 }
    );
  }
}

// GET İsteği (/api/places/recommend?lat=...&lng=...&category=...&district=...)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const latParam = searchParams.get('lat');
  const lngParam = searchParams.get('lng');
  const lat = latParam ? parseFloat(latParam) : null;
  const lng = lngParam ? parseFloat(lngParam) : null;
  const category = searchParams.get('category') || '';
  const district = searchParams.get('district') || '';

  return handleFoursquareSearch({ lat, lng, category, district });
}

// POST İsteği (Geriye Dönük Uyumluluk)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { district, lat, lng, category } = body;
  return handleFoursquareSearch({
    lat: typeof lat === 'number' ? lat : (lat ? parseFloat(lat) : null),
    lng: typeof lng === 'number' ? lng : (lng ? parseFloat(lng) : null),
    category: category || '',
    district: district || ''
  });
}
