import { S3Client, ListObjectsV2Command, DeleteObjectsCommand, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { MAX_SAFE_STORAGE_BYTES, TOTAL_QUOTA_BYTES } from "@/lib/constants";
import fs from "fs";
import path from "path";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
  return createClient(supabaseUrl, supabaseKey);
}

function verifyAdmin(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  const validSecret = process.env.ADMIN_SECRET_KEY || "snapadmin2026";
  return token === validSecret;
}

// GET: Depolama İstatistikleri ve Tüm Aktif Odalar
export async function GET(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    // 1. Cloudflare R2 İstatistikleri
    let usedBytes = 0;
    let fileCount = 0;
    let continuationToken: string | undefined = undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const res: ListObjectsV2CommandOutput = await s3.send(listCommand);
      if (res.Contents) {
        fileCount += res.Contents.length;
        for (const item of res.Contents) {
          usedBytes += item.Size || 0;
        }
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    // 2. Supabase Odaları ve Fotoğraf Sayıları
    const supabase = getSupabase();
    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("*, photos(count)")
      .order("created_at", { ascending: false });

    if (roomsError) {
      console.error("Odalar çekilemedi:", roomsError);
    }

    const formattedRooms = (rooms || []).map((r: any) => ({
      ...r,
      photo_count: r.photos?.[0]?.count || 0,
    }));

    return NextResponse.json({
      metrics: {
        usedBytes,
        maxSafeBytes: MAX_SAFE_STORAGE_BYTES,
        totalQuotaBytes: TOTAL_QUOTA_BYTES,
        fileCount,
        roomCount: formattedRooms.length,
      },
      rooms: formattedRooms,
    });
  } catch (error) {
    console.error("Admin API Hatası:", error);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}

// POST: Oda Silme veya Tüm Depoyu Sıfırlama (Purge All Storage)
export async function POST(req: Request) {
  if (!verifyAdmin(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const { action, roomId } = await req.json();

    // 1. Belirli Bir Odayı Silme
    if (action === "delete_room" && roomId) {
      // Odaya ait tüm R2 dosyalarını bul ve toplu sil
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: `${roomId}/`,
      });
      const listRes: ListObjectsV2CommandOutput = await s3.send(listCommand);

      if (listRes.Contents && listRes.Contents.length > 0) {
        const deleteParams = {
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: {
            Objects: listRes.Contents.map((obj) => ({ Key: obj.Key! })),
          },
        };
        await s3.send(new DeleteObjectsCommand(deleteParams));
      }

      // Supabase DB'den odayı sil
      const supabase = getSupabase();
      await supabase.from("rooms").delete().eq("id", roomId);

      return NextResponse.json({ success: true, message: "Oda ve R2 dosyaları kalıcı olarak silindi." });
    }

    // 2. TÜM DEPOYU SİL / BOŞALT (Cloudflare R2 & Tüm Verileri Sıfırla)
    if (action === "purge_all_storage") {
      let totalDeleted = 0;
      let continuationToken: string | undefined = undefined;

      // Cloudflare R2 üzerindeki TÜM nesneleri döngüyle bul ve temizle
      do {
        const listCmd = new ListObjectsV2Command({
          Bucket: process.env.R2_BUCKET_NAME,
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        });
        const listRes: ListObjectsV2CommandOutput = await s3.send(listCmd);

        if (listRes.Contents && listRes.Contents.length > 0) {
          const keysToDelete = listRes.Contents.map((item) => ({ Key: item.Key! }));
          await s3.send(
            new DeleteObjectsCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Delete: { Objects: keysToDelete },
            })
          );
          totalDeleted += keysToDelete.length;
        }
        continuationToken = listRes.NextContinuationToken;
      } while (continuationToken);

      // Supabase verilerini temizle
      const supabase = getSupabase();
      try {
        await supabase.from("photos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await supabase.from("rooms").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (dbErr) {
        console.warn("DB temizleme hatası (RLS kısıtlaması olabilir):", dbErr);
      }

      // Yerel ve geçici veri dosyalarını sıfırla
      const filesToReset = [
        path.join(process.cwd(), "data", "deleted_photos.json"),
        path.join(process.cwd(), "data", "room_polls.json"),
        path.join("/tmp", "snaproom_deleted_photos.json"),
        path.join("/tmp", "snaproom_room_polls.json"),
      ];

      for (const fp of filesToReset) {
        try {
          if (fs.existsSync(fp)) {
            fs.writeFileSync(fp, fp.includes("polls") ? "{}" : "[]", "utf-8");
          }
        } catch {}
      }

      return NextResponse.json({
        success: true,
        deletedCount: totalDeleted,
        message: `Cloudflare R2 deposundaki tüm veriler (${totalDeleted} dosya) başarıyla silindi ve alan açıldı!`,
      });
    }

    return NextResponse.json({ error: "Geçersiz işlem" }, { status: 400 });
  } catch (error: any) {
    console.error("Admin action hatası:", error);
    return NextResponse.json({ error: error?.message || "İşlem başarısız" }, { status: 500 });
  }
}
