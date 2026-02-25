/**
 * PATCH /api/communities/:communityId/settings
 *
 * Updates community-level settings such as name, description, image, rules,
 * visibility, and permission flags.
 *
 * Authorization: caller must be a community admin or owner (creator role).
 * All input is validated via Zod. Rate limited via server action layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { updateCommunitySettings } from '@/app/community-admin-actions';
import { communitySettingsSchema } from '@/lib/schemas';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ communityId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { communityId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const validation = communitySettingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.flatten() },
        { status: 422 }
      );
    }

    const result = await updateCommunitySettings(communityId, validation.data);

    if (!result.success) {
      const status =
        result.message === 'Unauthenticated' ? 401
        : result.message.includes('permission') || result.message.includes('Only') ? 403
        : result.message === 'Community not found' ? 404
        : result.message.includes('Rate limit') ? 429
        : 400;
      return NextResponse.json({ error: result.message }, { status });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (err) {
    console.error('PATCH /api/communities/[communityId]/settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
