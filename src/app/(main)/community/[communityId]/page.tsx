import { notFound } from 'next/navigation';
import { getCommunityDetails } from '@/lib/data';
import { CommunityDetailClient } from '@/components/community/community-detail-client';
import { getSession } from '@/lib/auth';

// This is now a Server Component
export default async function CommunityDetailPage({ params }: { params: Promise<{ communityId: string }> }) {

  // Fetch data on the server
  const { communityId } = await params;
  const communityData = await getCommunityDetails(communityId, 1, 10); // Start with first page, 10 posts per page
  const session = await getSession();

  if (!communityData) {
    notFound();
  }

  const { community, posts, pagination } = communityData;

  // Pass server-fetched data as initial props to the client component
  return (
    <CommunityDetailClient
      initialCommunity={community}
      initialPosts={posts}
      initialPagination={pagination}
      communityId={communityId}
      currentUser={session?.user || null}
    />
  );
}
