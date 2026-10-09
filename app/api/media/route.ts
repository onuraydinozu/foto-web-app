import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key) {
      return new NextResponse("Key parameter missing", { status: 400 });
    }

    const rangeHeader = request.headers.get("range");
    const isThumb = searchParams.get("thumb") === "1" || searchParams.get("thumb") === "true";

    let targetKey = key;
    let s3Response: any = null;

    // Eğer thumbnail talep edildiyse, önce thumbs/ ön eki ile hafif WebP kopyayı dene
    if (isThumb) {
      try {
        const thumbKey = `thumbs/${key}.webp`;
        const thumbCommand = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: thumbKey,
        });
        s3Response = await s3.send(thumbCommand);
        targetKey = thumbKey;
      } catch (thumbErr) {
        // Thumbnail henüz yoksa orijinal dosyaya düş
        s3Response = null;
      }
    }

    if (!s3Response) {
      const command = new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        ...(rangeHeader ? { Range: rangeHeader } : {}),
      });
      s3Response = await s3.send(command);
    }

    if (!s3Response.Body) {
      return new NextResponse("Not found", { status: 404 });
    }

    const stream = s3Response.Body.transformToWebStream();

    const headers = new Headers();
    if (s3Response.ContentType) {
      headers.set("Content-Type", s3Response.ContentType);
    } else {
      headers.set("Content-Type", "image/jpeg");
    }

    if (s3Response.ContentLength) {
      headers.set("Content-Length", s3Response.ContentLength.toString());
    }

    if (s3Response.ContentRange) {
      headers.set("Content-Range", s3Response.ContentRange);
    }

    // Eğer doğrudan indirme talep edildiyse Content-Disposition ekle (orijinal kalite kayıpsız dosya)
    const download = searchParams.get("download");
    const filename = searchParams.get("filename") || "photo";
    if (download === "1" || download === "true") {
      const safeFilename = filename.replace(/["\r\n]/g, "_");
      headers.set(
        "Content-Disposition",
        `attachment; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(safeFilename)}`
      );
    }

    // Uzun vadeli tarayıcı önbelleği (resimler değişmez, performans tavan yapar)
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    headers.set("Accept-Ranges", "bytes");
    if (s3Response.ETag) {
      headers.set("ETag", s3Response.ETag);
    }

    const responseStatus = rangeHeader && s3Response.ContentRange ? 206 : 200;

    return new Response(stream, {
      status: responseStatus,
      headers,
    });
  } catch (error: any) {
    console.error("Media API proxy error:", error?.message || error);
    if (error?.name === "NoSuchKey" || error?.$metadata?.httpStatusCode === 404) {
      return new NextResponse("File not found", { status: 404 });
    }
    return new NextResponse("Failed to load media", { status: 500 });
  }
}
