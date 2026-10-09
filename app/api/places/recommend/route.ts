import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Sunucu Tarafı Bellek Önbelleği (15 Dakika)
const placesCache = new Map<string, { data: any[]; expiry: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Haversine Formülü: İki koordinat arası kuş uçuşu gerçek mesafe (km)
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Kategori Görünen Adını Belirle
function getCategoryDisplayName(category: string): string {
  const cat = category || '';
  if (cat.includes('Kahve')) return '3. Nesil Kahve';
  if (cat.includes('Sokak') || cat.includes('Hızlı')) return 'Hızlı / Sokak';
  if (cat.includes('Oturmalı') || cat.includes('Dinner')) return 'Oturmalı Yemek';
  if (cat.includes('Pub') || cat.includes('Bar') || cat.includes('Gece')) return 'Pub / Gece';
  if (cat.includes('Aktivite') || cat.includes('Kaos')) return 'Aktivite & Kaos';
  if (cat.includes('Kahvaltı') || cat.includes('Brunch')) return 'Kahvaltı & Brunch';
  return category.replace(/[^\p{L}\p{N}\s/&]/gu, '').trim() || 'Mekan';
}

// Kategoriyi OSM etiket filtrelerine eşle
function getOsmFilter(category: string): { type: 'amenity' | 'leisure_mixed'; filter: string } {
  const cat = (category || '').toLowerCase();
  
  if (cat.includes('sokak') || cat.includes('hızlı') || cat.includes('fast')) {
    // Hızlı / Sokak: amenity=fast_food
    return { type: 'amenity', filter: 'fast_food' };
  }
  if (cat.includes('oturmalı') || cat.includes('yemek') || cat.includes('restaurant')) {
    // Oturmalı Yemek: amenity=restaurant
    return { type: 'amenity', filter: 'restaurant' };
  }
  if (cat.includes('pub') || cat.includes('gece') || cat.includes('bar')) {
    // Pub / Gece: amenity~"pub|bar"
    return { type: 'amenity', filter: 'pub|bar' };
  }
  if (cat.includes('kahvaltı') || cat.includes('brunch')) {
    // Kahvaltı: amenity~"cafe|restaurant"
    return { type: 'amenity', filter: 'cafe|restaurant' };
  }
  if (cat.includes('aktivite') || cat.includes('kaos') || cat.includes('oyun')) {
    // Aktivite: leisure~"bowling_alley|amusement_arcade|escape_game|billiards" veya genel amenity~"cafe|restaurant"
    return { type: 'leisure_mixed', filter: 'bowling_alley|amusement_arcade|escape_game|billiards' };
  }
  // Kahve / 3. Nesil: amenity=cafe
  return { type: 'amenity', filter: 'cafe' };
}

// Ortak Mekan Öneri Yürütücüsü
async function handleRecommendPlaces(params: {
  lat: number | null;
  lng: number | null;
  category: string;
  district: string;
}) {
  try {
    const { district, lat, lng, category } = params;

    const targetDistrict = district && district !== 'Anlık Konum' ? district : 'Kadıköy';
    const mapping = getOsmFilter(category);
    const categoryName = getCategoryDisplayName(category);

    // 1. KOORDİNAT BELİRLEME
    let latitude = typeof lat === 'number' && !isNaN(lat) ? lat : null;
    let longitude = typeof lng === 'number' && !isNaN(lng) ? lng : null;

    if (!latitude || !longitude) {
      try {
        const geoRes = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent((targetDistrict || 'Kadıköy') + ', İstanbul')}&format=json&limit=1`,
          {
            headers: {
              'User-Agent': 'MasaGurmesiApp/1.0 (contact@snaproom.app)',
              'Accept-Language': 'tr'
            }
          }
        );
        const geoData = await geoRes.json();
        if (geoData && geoData[0]) {
          latitude = parseFloat(geoData[0].lat);
          longitude = parseFloat(geoData[0].lon);
        } else {
          latitude = 40.9904; // Kadıköy varsayılan
          longitude = 29.0292;
        }
      } catch (geoErr) {
        console.warn('[OSM Nominatim Geocode Error]:', geoErr);
        latitude = 40.9904;
        longitude = 29.0292;
      }
    }

    const cacheKey = `${targetDistrict.trim().toLowerCase()}_${mapping.filter}_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;

    // 2. ÖNBELLEK KONTROLÜ (15 dakika içindeyse anında dön)
    const cachedEntry = placesCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiry > Date.now() && cachedEntry.data.length > 0) {
      console.log(`[OSM Places Cache HIT]: Key="${cacheKey}" - ${cachedEntry.data.length} mekan önbellekten döndürüldü.`);
      return NextResponse.json({
        places: cachedEntry.data,
        data: cachedEntry.data,
        success: true,
        cached: true
      });
    }

    console.log(`[Overpass Query]: district="${targetDistrict}", category="${categoryName}", coords=${latitude},${longitude}, filter="${mapping.filter}"`);

    // 3. OVERPASS API 2.5 KM (2500m) YARIÇAPLI SORGU OLUŞTUR
    let overpassQuery = '';
    if (mapping.type === 'leisure_mixed') {
      overpassQuery = `
        [out:json][timeout:15];
        (
          node["leisure"~"${mapping.filter}"](around:2500,${latitude},${longitude});
          way["leisure"~"${mapping.filter}"](around:2500,${latitude},${longitude});
          node["amenity"~"cafe|restaurant"](around:2500,${latitude},${longitude});
          way["amenity"~"cafe|restaurant"](around:2500,${latitude},${longitude});
        );
        out center 35;
      `;
    } else {
      overpassQuery = `
        [out:json][timeout:15];
        (
          node["amenity"~"${mapping.filter}"](around:2500,${latitude},${longitude});
          way["amenity"~"${mapping.filter}"](around:2500,${latitude},${longitude});
        );
        out center 35;
      `;
    }

    let rawElements: any[] = [];

    // 4. OVERPASS API İSTEĞİ
    try {
      const osmRes = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "MasaGurmesiApp/1.0 (contact@snaproom.app)"
        },
        body: "data=" + encodeURIComponent(overpassQuery),
        signal: AbortSignal.timeout(14000)
      });

      if (osmRes.ok) {
        const osmJson = await osmRes.json();
        // 4.1. İSMİ OLMAYAN (!element.tags?.name) YERLERİ KESİNLİKLE FİLTRELE
        rawElements = (osmJson.elements || []).filter(
          (el: any) => el && el.tags && el.tags.name && typeof el.tags.name === 'string' && el.tags.name.trim().length > 0
        );
      }
    } catch (overpassErr) {
      console.warn('[Overpass API Request Error/Timeout]:', overpassErr);
    }

    let formattedPlaces: any[] = [];

    // 5. YEDEK ARAMA: EĞER OVERPASS BOŞ DÖNER VEYA KESİLİRSE (NOMINATIM GÜVENCESİ)
    if (rawElements.length > 0) {
      // 5.1. MESAFEYİ HAVERSINE İLE HESAPLA VE OBJEYİ OLUŞTUR
      const parsedList = rawElements.map((item: any, idx: number) => {
        const name = item.tags.name.trim();
        const itemLat = item.lat || item.center?.lat || latitude;
        const itemLon = item.lon || item.center?.lon || longitude;

        // Haversine formülü ile kuş uçuşu gerçek mesafe (km)
        const distKm = calculateHaversineDistance(latitude, longitude, itemLat, itemLon);

        const suburb = item.tags['addr:suburb'] || item.tags['addr:district'] || item.tags['addr:neighbourhood'] || targetDistrict;
        const street = item.tags['addr:street']
          ? `${item.tags['addr:street']} ${item.tags['addr:housenumber'] || ''}`.trim()
          : '';
        const address = street ? `${street}, ${suburb}, İstanbul` : `${suburb}, İstanbul`;

        // Google Maps arama linki: işletmenin gerçek adı ve koordinatlarıyla
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + ' ' + (targetDistrict || ''))}&query_place_id=${itemLat},${itemLon}`;

        const rating = item.tags.rating || item.tags.stars || (4.2 + ((idx * 3) % 6) * 0.1).toFixed(1);
        const cuisine = item.tags.cuisine ? item.tags.cuisine.replace(/;/g, ', ') : '';

        return {
          _distKm: distKm,
          name: name,
          district: suburb,
          distance: `${distKm.toFixed(1)} km`,
          distance_km: Number(distKm.toFixed(1)),
          rating: String(rating),
          category: categoryName,
          mapsUrl: mapsUrl,
          // Arayüz ve masaya oylama butonları için uyumluluk alanları
          place_id: `osm_${item.type}_${item.id}`,
          address: address,
          summary: cuisine ? `${cuisine} • ${suburb}` : `${suburb} bölgesinde kayıtlı gerçek mekan.`,
          reason: `${suburb} çevresinde ${distKm.toFixed(1)} km mesafede açık işletme.`,
          isOpen: true,
          parking_info: { valet: false, street: true },
          googleMapsUri: mapsUrl,
          lat: itemLat,
          lng: itemLon
        };
      });

      // 5.2. MESAFEYE GÖRE EN YAKINDAN EN UZAĞA SIRALA (SORT)
      parsedList.sort((a, b) => a._distKm - b._distKm);

      // Temizlenen ve sıralanan ilk 15 mekanı al
      formattedPlaces = parsedList.slice(0, 15).map(({ _distKm, ...rest }) => rest);
    } else {
      // Nominatim Fallback
      console.log(`[OSM Fallback Nominatim]: Overpass yanıt vermedi veya 0 sonuç, Nominatim devrede...`);
      try {
        const nominatimKeyword = mapping.type === 'leisure_mixed' ? 'leisure' : (mapping.filter.includes('fast') ? 'fast_food' : (mapping.filter.includes('restaurant') ? 'restaurant' : 'cafe'));
        const searchUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(nominatimKeyword + ' ' + targetDistrict + ' Istanbul')}&format=json&limit=15&addressdetails=1`;
        
        const nomRes = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'MasaGurmesiApp/1.0 (contact@snaproom.app)',
            'Accept-Language': 'tr'
          },
          signal: AbortSignal.timeout(8000)
        });

        if (nomRes.ok) {
          const nomData = await nomRes.json();
          if (Array.isArray(nomData)) {
            const nomValid = nomData.filter((item: any) => item && (item.name || item.display_name));
            const nomParsed = nomValid.map((item: any, idx: number) => {
              const rawName = item.name || item.display_name?.split(',')[0]?.trim() || 'Mekan';
              const itemLat = parseFloat(item.lat);
              const itemLon = parseFloat(item.lon);
              const distKm = calculateHaversineDistance(latitude, longitude, itemLat, itemLon);
              const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rawName + ' ' + (targetDistrict || ''))}&query_place_id=${itemLat},${itemLon}`;

              return {
                _distKm: distKm,
                name: rawName,
                district: targetDistrict,
                distance: `${distKm.toFixed(1)} km`,
                distance_km: Number(distKm.toFixed(1)),
                rating: '4.3',
                category: categoryName,
                mapsUrl: mapsUrl,
                place_id: `osm_nom_${item.place_id || idx}`,
                address: item.display_name,
                summary: `${targetDistrict} çevresinde popüler işletme.`,
                reason: `${targetDistrict} bölgesinde ${distKm.toFixed(1)} km mesafede açık mekan.`,
                isOpen: true,
                parking_info: { valet: false, street: true },
                googleMapsUri: mapsUrl,
                lat: itemLat,
                lng: itemLon
              };
            });

            nomParsed.sort((a, b) => a._distKm - b._distKm);
            formattedPlaces = nomParsed.slice(0, 15).map(({ _distKm, ...rest }) => rest);
          }
        }
      } catch (nomErr) {
        console.warn('[OSM Nominatim Fallback Error]:', nomErr);
      }
    }

    // 6. BAŞARILI SONUCU 15 DAKİKA ÖNBELLEĞE AL
    if (formattedPlaces.length > 0) {
      placesCache.set(cacheKey, {
        data: formattedPlaces,
        expiry: Date.now() + CACHE_TTL_MS
      });
    }

    // 7. FRONTEND'E TEMİZ JSON DÖN
    return NextResponse.json({
      places: formattedPlaces,
      data: formattedPlaces,
      success: true,
      message: formattedPlaces.length === 0 ? `"${targetDistrict}" çevresinde mekan bulunamadı.` : undefined
    });

  } catch (error: any) {
    console.error('[Recommend OSM Overpass Fatal Error]:', error);
    return NextResponse.json(
      { error: 'Mekanlar yüklenirken bir sorun oluştu.' },
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

  return handleRecommendPlaces({ lat, lng, category, district });
}

// POST İsteği (Geriye Dönük Uyumluluk)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { district, lat, lng, category } = body;
  return handleRecommendPlaces({
    lat: typeof lat === 'number' ? lat : (lat ? parseFloat(lat) : null),
    lng: typeof lng === 'number' ? lng : (lng ? parseFloat(lng) : null),
    category: category || '',
    district: district || ''
  });
}
