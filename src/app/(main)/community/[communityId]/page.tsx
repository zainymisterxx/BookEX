import { notFound } from 'next/navigation';
import { getCommunityDetails } from '@/lib/data';
import { CommunityPage } from '@/components/community/community-page';
import { getSession } from '@/lib/auth';

// This is now a Server Component
export default async function CommunityDetailPage({ params }: { params: Promise<{ communityId: string }> }) {
  try {
    // Fetch data on the server
    const { communityId } = await params;
    
    // Validate communityId format
    if (!communityId || typeof communityId !== 'string') {
      console.error('Invalid communityId:', communityId);
      notFound();
    }
    
    const communityData = await getCommunityDetails(communityId, 1, 10); // Start with first page, 10 posts per page
    const session = await getSession();

    if (!communityData) {
      console.error('Community data not found for ID:', communityId);
      notFound();
    }

    const { community } = communityData;

  // Ensure community has channels array (for backward compatibility)
  const communityWithChannels = {
    ...community,
    channels: community.channels || [
      {
        _id: 'general',
        name: 'General',
        type: 'forum' as const,
        description: 'General discussion',
        order: 0,
        createdAt: new Date().toISOString()
      }
    ]
  };

    // Pass server-fetched data as initial props to the client component
    return (
      <CommunityPage
        community={communityWithChannels}
        currentUser={session?.user || null}
      />
    );
  } catch (error) {
    console.error('Error in CommunityDetailPage:', error);
    notFound();
  }
}
