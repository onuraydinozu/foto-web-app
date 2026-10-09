import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Kategori eşleştirmesi (query ve categories parametresi)
function getCategoryParams(category: string): { params: string; label: string } {
  const cat = (category || '').toLowerCase();

  // "3. Nesil Kahve" -> query=kahve&categories=13032,13034
  if (cat.includes('kahve') || cat.includes('coffee')) {
    return { params: 'query=kahve&categories=13032,13034', label: '3. Nesil Kahve' };
  }

  // "Hızlı / Sokak" -> query=burger&categories=13145
  if (cat.includes('sokak') || cat.includes('hızlı') || cat.includes('fast') || cat.includes('burger')) {
    return { params: 'query=burger&categories=13145', label: 'Hızlı / Sokak' };
  }

  // "Oturmalı Yemek" -> categories=13065
  if (cat.includes('oturmalı') || cat.includes('yemek') || cat.includes('dinner') || cat.includes('restaurant')) {
    return { params: 'categories=13065', label: 'Oturmalı Yemek' };
  }

  // "Pub / Gece" -> categories=13003,13018
  if (cat.includes('pub') || cat.includes('bar') || cat.includes('gece')) {
    return { params: 'categories=13003,13018', label: 'Pub / Gece' };
  }

  // "Kahvaltı & Brunch" -> categories=13028
  if (cat.includes('kahvaltı') || cat.includes('brunch')) {
    return { params: 'categories=13028', label: 'Kahvaltı & Brunch' };
  }

  // "Aktivite & Kaos" -> categories=10000
  if (cat.includes('aktivite') || cat.includes('kaos') || cat.includes('oyun')) {
    return { params: 'categories=10000', label: 'Aktivite & Kaos' };
  }

  // Varsayılan
  return { params: 'query=kahve&categories=13032,13034', label: '3. Nesil Kahve' };
}

async function handlePlacesSearch(req: Request, isGet: boolean) {
  // 1. Ortam değişkeni kontrolü
  const apiKey = process.env.FOURSQUARE_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "FOURSQUARE_API_KEY bulunamadı." }, { status: 500 });
  }

  // 2. Gelen parametreleri al
  let lat: number | null = null;
  let lng: number | null = null;
  let district = '';
  let category = '';

  if (isGet) {
    const { searchParams } = new URL(req.url);
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    lat = latParam ? parseFloat(latParam) : null;
    lng = lngParam ? parseFloat(lngParam) : null;
    district = searchParams.get('district') || '';
    category = searchParams.get('category') || '';
  } else {
    const body = await req.json().catch(() => ({}));
    lat = typeof body.lat === 'number' ? body.lat : (body.lat ? parseFloat(body.lat) : null);
    lng = typeof body.lng === 'number' ? body.lng : (body.lng ? parseFloat(body.lng) : null);
    district = body.district || '';
    category = body.category || '';
  }

  const hasCoords = lat !== null && !isNaN(lat) && lng !== null && !isNaN(lng);
  const targetDistrict = district && district !== 'Anlık Konum' ? district : 'Sancaktepe';
  const { params: categoryParams, label: categoryLabel } = getCategoryParams(category);

  // 3. İstek URL'sini oluştur
  const url = hasCoords
    ? `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&radius=3500&sort=DISTANCE&limit=12&${categoryParams}`
    : `https://api.foursquare.com/v3/places/search?near=${encodeURIComponent(targetDistrict + ', Istanbul')}&sort=RATING&limit=12&${categoryParams}`;

  console.log(`[Foursquare v3 URL]: ${url}`);

  // 4. Fetch isteği ve Kritik Header Formatı (Bearer eklenmez, çıplak anahtar)
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: apiKey,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`Foursquare Hatası (${res.status}):`, errorText);
    return NextResponse.json({ error: `Foursquare API (${res.status})` }, { status: res.status });
  }

  const data = await res.json();

  // 5. Yanıtı Standartlaştır
  const places = (data.results || []).map((item: any) => ({
    name: item.name,
    address: item.location?.formatted_address || item.location?.address || `${targetDistrict || 'İstanbul'}`,
    distance: item.distance ? `${(item.distance / 1000).toFixed(1)} km` : null,
    rating: item.rating ? (item.rating / 2).toFixed(1) : "4.3",
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + ' ' + (item.location?.locality || targetDistrict || 'İstanbul'))}`,
    district: item.location?.locality || targetDistrict || 'İstanbul',
    place_id: item.fsq_id || item.name,
    category: categoryLabel,
    isOpen: true,
  }));

  return NextResponse.json({ places });
}

export async function GET(req: Request) {
  try {
    return await handlePlacesSearch(req, true);
  } catch (err: any) {
    console.error('[Recommend GET Error]:', err);
    return NextResponse.json({ error: 'Mekanlar yüklenirken bir sorun oluştu.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    return await handlePlacesSearch(req, false);
  } catch (err: any) {
    console.error('[Recommend POST Error]:', err);
    return NextResponse.json({ error: 'Mekanlar yüklenirken bir sorun oluştu.' }, { status: 500 });
  }
}
