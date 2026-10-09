import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Helper to calculate distance in km using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export async function POST(req: Request) {
  try {
    const { district, lat, lng, category, filters } = await req.json();
    
    const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
    
    if (!API_KEY) {
      const ALL_MOCK_PLACES = [
        {
          place_id: "mock_1",
          name: "Story Coffee Roasters Moda",
          district: district || "Moda",
          category: "☕ 3. Nesil Kahve & Tatlı",
          rating: 4.8,
          review_count: 1420,
          price_level: "$$",
          parking_info: { valet: false, free_lot: false, street: true },
          lat: lat ? lat + 0.005 : 40.985,
          lng: lng ? lng + 0.003 : 29.028,
          photo_url: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800",
          distance_km: 0.6
        },
        {
          place_id: "mock_2",
          name: "Basta! Street Food Bar",
          district: district || "Kadıköy",
          category: "🍔 Hızlı / Sokak Lezzeti",
          rating: 4.7,
          review_count: 2150,
          price_level: "$$",
          parking_info: { valet: false, free_lot: false, street: true },
          lat: lat ? lat + 0.003 : 40.988,
          lng: lng ? lng + 0.005 : 29.024,
          photo_url: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800",
          distance_km: 1.1
        },
        {
          place_id: "mock_3",
          name: "Fauna Trattoria & Pasta",
          district: district || "Moda",
          category: "🍝 Oturmalı Yemek (Dinner)",
          rating: 4.9,
          review_count: 980,
          price_level: "$$$",
          parking_info: { valet: true, free_lot: false, street: false },
          lat: lat ? lat - 0.002 : 40.982,
          lng: lng ? lng + 0.002 : 29.031,
          photo_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&q=80&w=800",
          distance_km: 1.4
        },
        {
          place_id: "mock_4",
          name: "Arkaoda Kadıköy",
          district: district || "Kadıköy",
          category: "🍻 Pub / Bar & Gece",
          rating: 4.5,
          review_count: 3600,
          price_level: "$$",
          parking_info: { valet: false, free_lot: false, street: false },
          lat: lat ? lat - 0.004 : 40.987,
          lng: lng ? lng - 0.002 : 29.023,
          photo_url: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&q=80&w=800",
          distance_km: 0.9
        },
        {
          place_id: "mock_5",
          name: "Goblin Oyun Kulübü & Kafe",
          district: district || "Kadıköy",
          category: "🎯 Aktivite & Kaos",
          rating: 4.6,
          review_count: 820,
          price_level: "$$",
          parking_info: { valet: false, free_lot: false, street: true },
          lat: lat ? lat + 0.006 : 40.991,
          lng: lng ? lng + 0.004 : 29.027,
          photo_url: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&q=80&w=800",
          distance_km: 1.3
        },
        {
          place_id: "mock_6",
          name: "Brekkie Croissant & Breakfast",
          district: district || "Moda",
          category: "🥐 Kahvaltı & Brunch",
          rating: 4.8,
          review_count: 2400,
          price_level: "$$",
          parking_info: { valet: false, free_lot: false, street: true },
          lat: lat ? lat + 0.002 : 40.984,
          lng: lng ? lng + 0.006 : 29.033,
          photo_url: "https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&q=80&w=800",
          distance_km: 0.8
        }
      ];

      // Filter by category if selected, otherwise return all
      const filtered = category 
        ? ALL_MOCK_PLACES.filter(p => p.category.includes(category.split(' ')[1] || ''))
        : ALL_MOCK_PLACES;

      return NextResponse.json({
        success: true,
        data: filtered.length > 0 ? filtered : ALL_MOCK_PLACES.slice(0, 3),
        source: 'mock'
      });
    }

    try {
      const { data: cached } = await supabase
        .from('cached_places')
        .select('*')
        .eq('district', district || 'Yakınlar')
        .eq('category', category)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(10);
      
      if (cached && cached.length > 0) {
        const withDistances = cached.map(c => ({
          ...c,
          distance_km: (lat && lng && c.lat && c.lng) ? calculateDistance(lat, lng, c.lat, c.lng) : null
        })).sort((a, b) => (a.distance_km || 99) - (b.distance_km || 99));
        return NextResponse.json({ success: true, data: withDistances, source: 'cache' });
      }
    } catch (e) {
      console.error("Cache read error:", e);
    }

    let googleApiUrl = 'https://places.googleapis.com/v1/places:searchText';
    const requestBody: any = {
      textQuery: `${category} in ${district || 'Istanbul'}`,
      languageCode: 'tr'
    };

    if (lat && lng && district === 'Anlık Konum') {
      googleApiUrl = 'https://places.googleapis.com/v1/places:searchNearby';
      delete requestBody.textQuery;
      requestBody.locationRestriction = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 3000.0
        }
      };
      if (category.includes('Kahve')) requestBody.includedTypes = ['coffee_shop', 'cafe', 'bakery'];
      else if (category.includes('Hızlı')) requestBody.includedTypes = ['hamburger_restaurant', 'fast_food_restaurant', 'pizza_restaurant'];
      else if (category.includes('Oturmalı')) requestBody.includedTypes = ['restaurant', 'bistro', 'italian_restaurant'];
      else if (category.includes('Pub')) requestBody.includedTypes = ['bar', 'pub', 'brewery'];
      else if (category.includes('Aktivite')) requestBody.includedTypes = ['bowling_alley', 'amusement_center', 'board_game_club'];
      else if (category.includes('Kahvaltı')) requestBody.includedTypes = ['brunch_restaurant', 'breakfast_restaurant'];
    }

    const fieldMask = 'places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.regularOpeningHours,places.parkingOptions,places.location,places.photos';

    const response = await fetch(googleApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(requestBody)
    });

    const googleData = await response.json();
    if (!googleData.places || googleData.places.length === 0) {
      return NextResponse.json({ success: true, data: [], source: 'google' });
    }

    const formattedPlaces = googleData.places.map((place: any) => {
      let photoUrl = null;
      if (place.photos && place.photos.length > 0) {
        photoUrl = `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=800&maxWidthPx=800&key=${API_KEY}`;
      }
      const pLat = place.location?.latitude;
      const pLng = place.location?.longitude;

      return {
        place_id: place.id,
        name: place.displayName?.text,
        district: district || 'Yakınlar',
        category,
        rating: place.rating,
        review_count: place.userRatingCount,
        price_level: place.priceLevel?.replace('PRICE_LEVEL_', ''),
        parking_info: place.parkingOptions || { valet: false, free_lot: false, street: true },
        lat: pLat,
        lng: pLng,
        photoUrl,
        distance_km: (lat && lng && pLat && pLng) ? calculateDistance(lat, lng, pLat, pLng) : null
      };
    }).sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);

    try {
      const cacheRecords = formattedPlaces.map(({ distance_km, ...rest }: any) => rest);
      supabase.from('cached_places').upsert(cacheRecords, { onConflict: 'place_id' }).then();
    } catch (e) {}

    return NextResponse.json({ success: true, data: formattedPlaces, source: 'google' });

  } catch (error: any) {
    console.error('Places API Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
