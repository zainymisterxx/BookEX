'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  rejected: 'bg-red-100 text-red-800',
};

type Donation = {
  _id: string;
  organizationName?: string;
  status: string;
  books: { title: string; author: string }[];
  chatId?: string;
  createdAt: string;
  updatedAt: string;
};

export default function DonationHistoryPage() {
  const { status } = useSession();
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (status === 'unauthenticated') { window.location.href = '/'; return; }
    if (status !== 'authenticated') return;
    fetch('/api/donations/history')
      .then(r => r.ok ? r.json() : [])
      .then(setDonations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const filtered = activeTab === 'all' ? donations : donations.filter(d => d.status === activeTab);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
      {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Donation History</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="flex-wrap h-auto gap-1">
          {['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => (
            <TabsTrigger key={s} value={s} className="capitalize">{s.replace('_', ' ')}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg">No donations found.</p>
          <Button asChild className="mt-4"><Link href="/donate">Browse Organizations</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(d => (
            <Card key={d._id}>
              <CardHeader className="pb-2 flex flex-row items-start justify-between">
                <CardTitle className="text-base">{d.organizationName ?? 'Organization'}</CardTitle>
                <Badge className={STATUS_COLORS[d.status] ?? ''}>{d.status.replace('_', ' ')}</Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>{d.books.length} book{d.books.length !== 1 ? 's' : ''}: {d.books.slice(0, 2).map(b => b.title).join(', ')}{d.books.length > 2 ? '…' : ''}</p>
                <p>Updated {new Date(d.updatedAt).toLocaleDateString()}</p>
                {d.chatId && (
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link href={`/messages/${d.chatId}`}>Open Chat</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
