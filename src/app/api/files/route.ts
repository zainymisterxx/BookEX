import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      message: 'Deprecated on Vercel. Upload directly to the media service at NEXT_PUBLIC_MEDIA_API_URL.',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      message: 'Deprecated on Vercel. Media files are served from the Azure media host.',
    },
    { status: 410 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      success: false,
      message: 'Deprecated on Vercel. Delete uploads through the Azure media service.',
    },
    { status: 410 }
  );
}
