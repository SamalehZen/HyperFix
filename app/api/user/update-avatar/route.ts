import { db } from '@/lib/db';
import { user } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getSessionFromHeaders } from '@/lib/local-session';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 });
    }

    await db
      .update(user)
      .set({ 
        image: imageUrl,
        updatedAt: new Date()
      })
      .where(eq(user.id, session.userId));

    return NextResponse.json({ success: true, imageUrl });
  } catch (error) {
    console.error('Failed to update avatar:', error);
    return NextResponse.json({ error: 'Failed to update avatar' }, { status: 500 });
  }
}
