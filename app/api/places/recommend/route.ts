import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const district = searchParams.get("district") || "Sancaktepe";
    const category = searchParams.get("category") || "Kahve";

    const apiKey = process.env.FOURSQUARE_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "FOURSQUARE_API_KEY eksik!" },
        { status: 500 }
      );
    }

    // Kategori eşleştirmeleri
    let queryText = "kahve";
    let categories = "13032,13034"; // Coffee Shop, Cafe

    if (category.includes("Sokak") || category.includes("Hızlı")) {
      queryText = "burger";
      categories = "13145";
    } else if (category.includes("Yemek")) {
      queryText = "restoran";
      categories = "13065";
    } else if (category.includes("Pub") || category.includes("Gece")) {
      queryText = "pub";
      categories = "13003,13018";
    } else if (category.includes("Kahvaltı")) {
      queryText = "kahvaltı";
      categories = "13028";
    } else if (category.includes("Aktivite")) {
      queryText = "eğlence";
      categories = "10000";
    }

    // KESİNLİKLE v3 PLACES ENDPOINT'İ KULLANILACAK (v2 KESİNLİKLE YASAKTIR):
    const targetUrl = new URL("https://api.foursquare.com/v3/places/search");
    if (lat && lng) {
      targetUrl.searchParams.set("ll", `${lat},${lng}`);
      targetUrl.searchParams.set("radius", "4000"); // 4 km yarıçap
      targetUrl.searchParams.set("sort", "DISTANCE");
    } else {
      targetUrl.searchParams.set("near", `${district}, Istanbul`);
      targetUrl.searchParams.set("sort", "RATING");
    }
    targetUrl.searchParams.set("query", queryText);
    targetUrl.searchParams.set("categories", categories);
    targetUrl.searchParams.set("limit", "15");

    const fsqRes = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: apiKey,
      },
      cache: "no-store",
    });

    if (!fsqRes.ok) {
      const errText = await fsqRes.text();
      console.error("Foursquare API Hatası:", fsqRes.status, errText);
      return NextResponse.json(
        { error: `Foursquare API Hatası (${fsqRes.status}): ${errText}` },
        { status: fsqRes.status }
      );
    }

    const data = await fsqRes.json();
    const results = data.results || [];

    const places = results.map((item: any) => {
      const name = item.name || "Mekan";
      const address =
        item.location?.formatted_address ||
        item.location?.address ||
        item.location?.locality ||
        `${district}, İstanbul`;
      const distanceKm = item.distance
        ? `${(item.distance / 1000).toFixed(1)} km`
        : null;
      const rating = item.rating
        ? (item.rating / 2).toFixed(1)
        : "4.3";
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        name + " " + (item.location?.locality || district || "İstanbul")
      )}`;

      return {
        name,
        address,
        distance: distanceKm,
        rating,
        mapsUrl,
      };
    });

    return NextResponse.json({ places });
  } catch (error: any) {
    console.error("Route Hatası:", error);
    return NextResponse.json(
      { error: error?.message || "Sunucu hatası" },
      { status: 500 }
    );
  }
}
