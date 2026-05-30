import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-config';
import { redirect } from 'next/navigation';
import { getMyBooks } from '@/lib/data';
import { BookCard } from '@/components/book-card';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Book } from '@/lib/types';

const STATUS_BADGE_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  active: 'default',
  sold: 'secondary',
  exchanged: 'secondary',
  expired: 'destructive',
  donated: 'outline',
};

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_BADGE_VARIANTS[status] ?? 'outline';
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

export default async function MyListingsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  const books = await getMyBooks(session.user.id);

  return (
    <div className="container py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold font-headline">My Listings</h1>
          <p className="text-muted-foreground mt-1">
            {books.length} {books.length === 1 ? 'book' : 'books'} listed
          </p>
        </div>
        <Button asChild>
          <Link href="/books/sell">+ Add New Listing</Link>
        </Button>
      </div>

      {books.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground">
          <BookOpen className="h-16 w-16 mb-4 opacity-40" />
          <p className="text-lg font-medium">No listings yet</p>
          <p className="text-sm mt-1">Start selling or exchanging your books.</p>
          <Button asChild className="mt-6">
            <Link href="/books/sell">List a Book</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {books.map((book: Book) => (
            <div key={String(book._id)} className="flex flex-col gap-2">
              <BookCard book={book} showManageOptions />
              <StatusBadge status={(book as any).status ?? 'active'} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
