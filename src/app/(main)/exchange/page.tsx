
import { BookCard } from "@/components/book-card";
import type { Book } from '@/lib/types';
import { EnhancedBookFilters } from "@/components/enhanced-book-filters";
import { SearchResultsHeader } from '@/components/ui/filter-tags';
import { getBooksForExchange, getAvailableBookFilters, type EnhancedBookFilters as BookFilterType } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

export default async function ExchangePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {

  const awaitedSearchParams = await searchParams;
  const { searchQuery, genre, condition, city, sortBy, page } = awaitedSearchParams;

  const currentPage = Math.max(1, parseInt(typeof page === 'string' ? page : '1'));
  const itemsPerPage = 12;

  const filters: BookFilterType & { page: number; limit: number } = {
    searchQuery: typeof searchQuery === 'string' ? searchQuery : undefined,
    genre: typeof genre === 'string' ? genre : undefined,
    condition: typeof condition === 'string' ? condition : undefined,
    city: typeof city === 'string' ? city : undefined,
    sortBy: typeof sortBy === 'string' ? sortBy as any : undefined,
    page: currentPage,
    limit: itemsPerPage,
  };

  const { books, totalCount, hasMore } = await getBooksForExchange(filters);
  const { genres, conditions, cities } = await getAvailableBookFilters('exchange');

  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const showPagination = totalPages > 1;

  // Helper function to build pagination URLs
  const buildPageUrl = (pageNum: number) => {
    const params = new URLSearchParams();
    if (filters.searchQuery) params.set('searchQuery', filters.searchQuery);
    if (filters.genre) params.set('genre', filters.genre);
    if (filters.condition) params.set('condition', filters.condition);
    if (filters.city) params.set('city', filters.city);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (pageNum > 1) params.set('page', pageNum.toString());
    
    const query = params.toString();
    return `/exchange${query ? `?${query}` : ''}`;
  };

  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16">
        <div className="space-y-4 text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">Exchange Books</h1>
          <p className="text-lg md:text-xl max-w-3xl mx-auto text-muted-foreground">
            Swap books with readers in your city. Find the perfect trade.
          </p>
        </div>

        <EnhancedBookFilters
          genres={genres}
          conditions={conditions}
          cities={cities}
          showPriceFilter={false}
          initialFilters={{
            searchQuery: filters.searchQuery,
            genre: filters.genre,
            condition: filters.condition,
            city: filters.city,
            sortBy: filters.sortBy || 'relevance',
          }}
        />
        
        <SearchResultsHeader
          totalResults={totalCount}
          searchQuery={filters.searchQuery}
          activeFiltersCount={Object.values(filters).filter(Boolean).length - 2} // Exclude page and limit
          className="mt-8"
        />

        {books.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8 mt-8">
              {books.map((book) => (
                <BookCard 
                  key={String(book._id)} 
                  book={book} 
                  searchTerm={filters.searchQuery || ''}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {showPagination && (
              <div className="flex items-center justify-between mt-12 bg-background rounded-lg p-6 border">
                <div className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} books
                </div>
                
                <div className="flex items-center gap-2">
                  {/* Previous Page */}
                  {currentPage > 1 ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={buildPageUrl(currentPage - 1)}>
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                  )}

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {/* Show first page */}
                    {currentPage > 3 && (
                      <>
                        <Button variant={1 === currentPage ? "default" : "outline"} size="sm" asChild>
                          <Link href={buildPageUrl(1)}>1</Link>
                        </Button>
                        {currentPage > 4 && <span className="px-2 text-muted-foreground">...</span>}
                      </>
                    )}

                    {/* Show pages around current */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages, currentPage - 2 + i));
                      if (pageNum < Math.max(1, currentPage - 2) || pageNum > Math.min(totalPages, currentPage + 2)) return null;
                      
                      return (
                        <Button 
                          key={pageNum}
                          variant={pageNum === currentPage ? "default" : "outline"} 
                          size="sm" 
                          asChild
                        >
                          <Link href={buildPageUrl(pageNum)}>{pageNum}</Link>
                        </Button>
                      );
                    })}

                    {/* Show last page */}
                    {currentPage < totalPages - 2 && (
                      <>
                        {currentPage < totalPages - 3 && <span className="px-2 text-muted-foreground">...</span>}
                        <Button variant={totalPages === currentPage ? "default" : "outline"} size="sm" asChild>
                          <Link href={buildPageUrl(totalPages)}>{totalPages}</Link>
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Next Page */}
                  {hasMore ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={buildPageUrl(currentPage + 1)}>
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
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
