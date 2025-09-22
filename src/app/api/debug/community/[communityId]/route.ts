import { NextRequest, NextResponse } from 'next/server';
import { debugCommunity } from '@/lib/debug-community';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const { communityId } = await params;
    const result = await debugCommunity(communityId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json({ error: 'Debug failed' }, { status: 500 });
  }
}
