import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const requestedPath = Array.isArray(resolvedParams.path) ? resolvedParams.path.join('/') : '';
  const mediaBaseUrl = (process.env.NEXT_PUBLIC_MEDIA_PUBLIC_URL || 'https://media.farya.pk').replace(/\/+$/, '');
  const targetUrl = `${mediaBaseUrl}/uploads/${requestedPath}`;

  return NextResponse.redirect(targetUrl, 307);
}
