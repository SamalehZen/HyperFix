import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Speech-to-text is now handled client-side using Web Speech API.' },
    { status: 410 }
  );
}
