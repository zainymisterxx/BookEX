"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Heart, ArrowLeft, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMyProfileData } from '@/app/actions';
import type { Book } from '@/lib/types';

function WishlistBookCard({ book }: { book: Book & { _id: string } }) {
  return (
    <Link
      href={`/books/${book._id}`}
      className="group block rounded-xl border bg-card hover:shadow-md transition-shadow p-4 space-y-2"
    >
      {book.imageUrl && (
        <div className="relative h-48 w-full overflow-hidden rounded-lg bg-muted">
          <img
            src={book.imageUrl}
            alt={book.title}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      )}
      <h3 className="font-semibold line-clamp-2 group-hover:text-primary transition-colors">{book.title}</h3>
      <p className="text-sm text-muted-foreground">{book.author}</p>
      <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-secondary capitalize">{book.type}</span>
    </Link>
  );
}

export default function WishlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [books, setBooks] = useState<(Book & { _id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status !== 'authenticated' || !session?.user?.id) return;

    getMyProfileData(session.user.id).then((result) => {
      if (result.success) {
        setBooks((result.data as any)?.wishlist ?? []);
      }
      setLoading(false);
    });
  }, [status, session, router]);

  if (status === 'loading' || loading) {
    return (
      <main className="container max-w-4xl py-10">
        <p className="text-muted-foreground">Loading your wishlist…</p>
      </main>
    );
  }

  return (
    <main className="container max-w-4xl py-10 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/books"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <Heart className="h-6 w-6 text-destructive fill-destructive" />
        <h1 className="text-2xl font-bold">My Wishlist</h1>
        <span className="text-muted-foreground text-sm">({books.length})</span>
      </div>

      {books.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground text-lg">Your wishlist is empty.</p>
          <Button asChild>
            <Link href="/books">Browse Books</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {books.map((book) => (
            <WishlistBookCard key={book._id} book={book} />
          ))}
        </div>
      )}
    </main>
  );
}
