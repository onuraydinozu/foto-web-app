import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand, ListObjectsV2CommandOutput } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDeletedPhotoIds, addDeletedPhotoId } from "@/lib/deletedStore";
import { MAX_SAFE_STORAGE_BYTES, TOTAL_QUOTA_BYTES } from "@/lib/constants";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// Cloudflare R2 üzerindeki toplam kullanılan alanı (Byte) hesaplar
async function getBucketUsedBytes(): Promise<number> {
  try {
    let total = 0;
    let continuationToken: string | undefined = undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });
      const res: ListObjectsV2CommandOutput = await s3.send(listCommand);
      if (res.Contents) {
        for (const item of res.Contents) {
          total += item.Size || 0;
        }
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    return total;
  } catch (err) {
    console.error("R2 Depolama boyutu sorgulama hatası:", err);
    return 0;
  }
}

// Depolama doluluk istatistiğini ve silinmiş anı ID'lerini dönen GET ucu
export async function GET() {
  try {
    const usedBytes = await getBucketUsedBytes();
    const deletedIds = getDeletedPhotoIds();
    return NextResponse.json({
      usedBytes,
      maxSafeBytes: MAX_SAFE_STORAGE_BYTES,
      totalQuotaBytes: TOTAL_QUOTA_BYTES,
      isExceeded: usedBytes >= MAX_SAFE_STORAGE_BYTES,
      deletedIds,
    });
  } catch (error) {
    return NextResponse.json({ error: "İstatistik alınamadı" }, { status: 500 });
  }
}

// Sert Kontrollü Yükleme İstek Ucu (POST)
export async function POST(req: Request) {
  try {
    const { filename, contentType, fileSize = 0 } = await req.json();
    
    if (!filename || !contentType) {
      return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
    }

    // 1. BEKÇİ KONTROLÜ: Mevcut boyutu al
    const currentUsedBytes = await getBucketUsedBytes();
    const prospectiveTotal = currentUsedBytes + Number(fileSize);

    // 2. HARD CAP: 9.5 GB aşılıyorsa Presigned URL vermeyi REDDET!
    if (prospectiveTotal >= MAX_SAFE_STORAGE_BYTES) {
      return NextResponse.json(
        {
          error: "STORAGE_LIMIT_EXCEEDED",
          message: "10 GB ücretsiz kota dolmak üzere! Sürpriz fatura engellemek için yükleme kilitlendi.",
          usedBytes: currentUsedBytes,
          limitBytes: MAX_SAFE_STORAGE_BYTES,
        },
        { status: 403 }
      );
    }

    // 3. Güvenli ise 1 saatlik geçici PUT izni (Presigned URL) üret
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filename,
      ContentType: contentType,
    });
    
    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    
    return NextResponse.json({
      url,
      usedBytes: currentUsedBytes,
      limitBytes: MAX_SAFE_STORAGE_BYTES,
    });
  } catch (error) {
    console.error("Presigned URL hatası:", error);
    return NextResponse.json({ error: "URL oluşturulamadı" }, { status: 500 });
  }
}

// Fotoğraf Silme (DELETE) - R2 Fiziksel Silme + Supabase Kaydı Temizleme + Kalıcı Kara Liste
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { fileKey, photoId, roomId, expirePurge } = body;

    // Süre dolduğunda tüm odayı otomatik temizleme
    if (expirePurge && roomId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: roomPhotos } = await supabase.from('photos').select('id, r2_file_key').eq('room_id', roomId);
        if (roomPhotos && roomPhotos.length > 0) {
          for (const p of roomPhotos) {
            if (p.r2_file_key) {
              try {
                await s3.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: p.r2_file_key }));
              } catch (e) {}
            }
            if (p.id) addDeletedPhotoId(p.id);
          }
          await supabase.from('photos').delete().eq('room_id', roomId);
        }
        return NextResponse.json({ success: true, purged: roomPhotos?.length || 0 });
      } catch (purgeErr) {
        console.error("Expire purge hatası:", purgeErr);
        return NextResponse.json({ error: "Oda temizlenemedi" }, { status: 500 });
      }
    }

    if (!fileKey && !photoId) {
      return NextResponse.json({ error: "Eksik parametre" }, { status: 400 });
    }

    // 1. Kalıcı kara listeye kaydet (Böylece asla geri gelemez)
    if (photoId) {
      addDeletedPhotoId(photoId);
    }

    // 2. Cloudflare R2'den fiziksel dosyayı kalıcı olarak sil (kotayı anında boşaltır)
    if (fileKey) {
      try {
        const deleteCommand = new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileKey,
        });
        await s3.send(deleteCommand);
      } catch (e) {
        console.warn("R2 fiziksel dosya silinirken uyarı:", e);
      }
    }

    // 3. Supabase DB'den kaydı silmeyi dene (Varsa service role key veya anon key ile)
    if (photoId) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { error: dbError } = await supabase.from('photos').delete().eq('id', photoId);
        if (dbError) {
          console.warn("Supabase silme uyarısı (RLS devrede olabilir):", dbError.message);
        }
      } catch (e) {
        console.warn("Supabase bağlantı hatası:", e);
      }
    }

    return NextResponse.json({ success: true, deletedId: photoId });
  } catch (error) {
    console.error("Fotoğraf silme hatası:", error);
    return NextResponse.json({ error: "Fotoğraf silinemedi" }, { status: 500 });
  }
}
