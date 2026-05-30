import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    await client.db('bookex').command({ ping: 1 });
    return NextResponse.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: 'error', db: 'disconnected' }, { status: 503 });
  }
}
