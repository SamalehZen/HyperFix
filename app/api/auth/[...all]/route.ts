import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Authentication provider disabled' },
    { status: 404, headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
  );
}

export async function POST() {
  return NextResponse.json({ error: 'Authentication provider disabled' }, { status: 404 });
}
