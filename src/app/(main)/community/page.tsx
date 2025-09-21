
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, PlusCircle } from 'lucide-react';
import type { Community } from '@/lib/types';
import { CommunityList } from './community-list';
import { CreateCommunityModal } from '@/components/create-community-modal';
import { getCommunities } from '@/lib/data';
import { Suspense } from 'react';

export default async function CommunityPage() {
  const communities = await getCommunities();

  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16">
        <div className="space-y-4 text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">Community Hub</h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground">
            Find your niche, join discussions, and connect with fellow book lovers.
          </p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-8 p-4 bg-background rounded-lg shadow-sm border">
          <CreateCommunityModal>
            <Button size="lg" className="h-12 text-base">
              <PlusCircle className="mr-2 h-5 w-5" />
              Create Community
            </Button>
          </CreateCommunityModal>
        </div>
        
        <Suspense fallback={<div>Loading communities...</div>}>
          <CommunityList initialCommunities={communities} />
        </Suspense>

      </div>
    </div>
  );
}
