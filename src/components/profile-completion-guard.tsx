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

  // If profile is not completed, redirect to settings
  if (!session.user.profileCompleted) {
    redirect(redirectTo);
  }

  // Profile is complete, render children
  return <>{children}</>;
}
