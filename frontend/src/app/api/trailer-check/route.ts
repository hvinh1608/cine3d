import { NextRequest, NextResponse } from 'next/server';

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtu.be']);

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url')?.trim();
  if (!rawUrl) return NextResponse.json({ playable: false }, { status: 400 });

  try {
    const trailerUrl = new URL(rawUrl);
    if (trailerUrl.protocol !== 'https:' || !YOUTUBE_HOSTS.has(trailerUrl.hostname.toLowerCase())) {
      return NextResponse.json({ playable: false }, { status: 400 });
    }

    const oembedUrl = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(trailerUrl.toString())}`;
    const response = await fetch(oembedUrl, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(5_000) });
    return NextResponse.json(
      { playable: response.ok },
      { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch {
    return NextResponse.json({ playable: false });
  }
}
