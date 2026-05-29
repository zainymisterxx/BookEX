import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

interface ProfileCompletionGuardProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Server component that enforces profile completion
 * Redirects users with incomplete profiles to settings page
 */
export async function ProfileCompletionGuard({
  children,
  redirectTo = '/profile/settings'
}: ProfileCompletionGuardProps) {
  const session = await getSession();

  // If user is not authenticated, let the page handle it
  if (!session?.user) {
    return <>{children}</>;
  }

  // Compute profile completeness server-side to avoid relying on stored flag
  const client = await (await import('@/lib/mongodb')).default;
  const db = client.db('bookex');
  const { ObjectId } = await import('mongodb');
  const userDoc = await db.collection('users').findOne({ _id: new ObjectId(session.user.id) });
  const listingsCount = await db.collection('books').countDocuments({ sellerId: session.user.id, status: 'active' });
  const { computeProfileCompleteness } = await import('@/lib/location/location-utils');
  const completeness = computeProfileCompleteness({ ...(userDoc || {}), listingsCount });
  if (!completeness.isComplete) redirect(redirectTo);

  // Profile is complete, render children
  return <>{children}</>;
}
