export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getUserAgentAccess } from '@/lib/db/queries';

export async function GET(_req: NextRequest) {
  const hdrs = await headers();
  const session = await auth.api.getSession({ headers: hdrs });
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'unauthorized' }, {
      status: 401,
      headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' }
    });
  }

  try {
    const access = await getUserAgentAccess(session.user.id);
    return NextResponse.json(access, {
      headers: { 'Cache-Control': 'private, no-store, no-cache, must-revalidate' }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get agent access' }, {
      status: 500,
      headers: { 'Cache-Control': 'no-store' }
    });
  }
}
