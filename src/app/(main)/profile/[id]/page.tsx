import { notFound } from 'next/navigation';
import { getUserProfileData } from '@/lib/data';
import { UserProfile } from '@/components/user-profile';
import { getSession } from '@/lib/auth';

interface UserProfilePageProps {
  params: Promise<{ id: string }>;
}

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  try {
  const { id } = await params;

    // Validate user ID format
    if (!id || typeof id !== 'string') {
      console.error('Invalid user ID:', id);
    notFound();
  }

    const profileData = await getUserProfileData(id);
    const session = await getSession();

    if (!profileData) {
      console.error('User profile not found for ID:', id);
      notFound();
    }

    const { profileUser, userListings } = profileData;

  return (
      <UserProfile
        user={profileUser}
        listings={userListings}
        currentUser={session?.user || null}
      />
    );
  } catch (error) {
    console.error('Error in UserProfilePage:', error);
    notFound();
  }
}