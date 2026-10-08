import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const html = await res.text();
    
    // Extract ytInitialData
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!match) {
        return NextResponse.json({ videos: [] });
    }
    
    const data = JSON.parse(match[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents[0]?.itemSectionRenderer?.contents || [];
    
    const videos = contents.filter((item: any) => item.videoRenderer).map((item: any) => {
        const video = item.videoRenderer;
        return {
            id: video.videoId,
            title: video.title.runs[0].text,
            thumbnail: video.thumbnail.thumbnails[0].url,
            author: video.ownerText.runs[0].text,
            duration: video.lengthText ? video.lengthText.simpleText : ''
        };
    }).slice(0, 10);

    return NextResponse.json({ videos });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to search' }, { status: 500 });
  }
}
