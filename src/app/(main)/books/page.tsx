
import { BookCard } from "@/components/book-card";
import { EnhancedBookFilters } from '@/components/enhanced-book-filters';
import { SearchResultsHeader } from '@/components/ui/filter-tags';
import { getBooksForSale, getAvailableBookFilters, type EnhancedBookFilters as BookFilterType } from "@/lib/data";
import type { Book } from '@/lib/types';

export default async function BooksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const awaitedSearchParams = await searchParams;
  const { searchQuery, genre, condition, minPrice, maxPrice, sortBy } = awaitedSearchParams;

  const filters: BookFilterType = {
    searchQuery: typeof searchQuery === 'string' ? searchQuery : undefined,
    genre: typeof genre === 'string' ? genre : undefined,
    condition: typeof condition === 'string' ? condition : undefined,
    minPrice: typeof minPrice === 'string' ? parseInt(minPrice) : undefined,
    maxPrice: typeof maxPrice === 'string' ? parseInt(maxPrice) : undefined,
    sortBy: typeof sortBy === 'string' ? sortBy as any : undefined,
  };

  const { books, totalCount } = await getBooksForSale(filters);
  const { genres, conditions } = await getAvailableBookFilters('sell');

  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16">
        <div className="space-y-4 text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">Buy Books</h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground">
            Browse through a collection of books from sellers in our community. Find your next favorite read.
          </p>
        </div>

        <EnhancedBookFilters
          genres={genres}
          conditions={conditions}
          showPriceFilter={true}
          initialFilters={{
            searchQuery: filters.searchQuery,
            genre: filters.genre,
            condition: filters.condition,
            minPrice: filters.minPrice || 0,
            maxPrice: filters.maxPrice || 10000,
            sortBy: filters.sortBy || 'relevance',
          }}
        />

        <SearchResultsHeader
          totalResults={totalCount}
          searchQuery={filters.searchQuery}
          activeFiltersCount={Object.values(filters).filter(Boolean).length}
          className="mt-8"
        />

        {books.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8 mt-8">
            {books.map((book) => (
              <BookCard 
                key={String(book._id)} 
                book={book} 
                searchTerm={filters.searchQuery || ''}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-background rounded-lg border-2 border-dashed mt-8">
            <h3 className="text-xl font-semibold font-headline">No books found</h3>
            <p className="text-muted-foreground mt-2 mb-6">Try adjusting your search or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}
