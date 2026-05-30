import { Suspense } from 'react';
import { getBooksForSale, getBooksForExchange } from '@/lib/data';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import SearchInput from './search-input';

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const [saleResult, exchangeResult] = query
    ? await Promise.all([
        getBooksForSale({ searchQuery: query }),
        getBooksForExchange({ searchQuery: query, page: 1, limit: 24 }),
      ])
    : [{ books: [] }, { books: [] }];

  const saleBooks = (saleResult as any).books ?? saleResult ?? [];
  const exchangeBooks = (exchangeResult as any).books ?? exchangeResult ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Search Books</h1>
      <Suspense><SearchInput defaultValue={query} /></Suspense>

      {query && (
        <p className="text-sm text-muted-foreground mb-6 mt-2">
          Results for <span className="font-medium">&ldquo;{query}&rdquo;</span>
        </p>
      )}

      <Tabs defaultValue="sale">
        <TabsList>
          <TabsTrigger value="sale">For Sale ({saleBooks.length})</TabsTrigger>
          <TabsTrigger value="exchange">For Exchange ({exchangeBooks.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="sale"><BookGrid books={saleBooks} query={query} /></TabsContent>
        <TabsContent value="exchange"><BookGrid books={exchangeBooks} query={query} /></TabsContent>
      </Tabs>
    </div>
  );
}

function BookGrid({ books, query }: { books: any[]; query: string }) {
  if (!query) return <p className="text-muted-foreground py-8 text-center">Enter a search term above.</p>;
  if (books.length === 0) return <p className="text-muted-foreground py-8 text-center">No results for &ldquo;{query}&rdquo;.</p>;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
      {books.map((book: any) => (
        <Link key={String(book._id)} href={`/books/${String(book._id)}`}>
          <Card className="hover:shadow-md transition-shadow h-full">
            <CardContent className="pt-4 space-y-1">
              <p className="font-medium line-clamp-1">{book.title}</p>
              <p className="text-sm text-muted-foreground line-clamp-1">{book.author}</p>
              <div className="flex gap-2 flex-wrap pt-1">
                <Badge variant="outline">{book.condition}</Badge>
                {book.price && <Badge variant="secondary">${book.price}</Badge>}
                {book.cityNormalized && <Badge variant="outline">{book.cityNormalized}</Badge>}
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
