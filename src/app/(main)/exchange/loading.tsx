export default function Loading() {
  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16 animate-pulse">
        <div className="space-y-4 text-center mb-12">
          <div className="h-10 bg-muted rounded w-56 mx-auto" />
          <div className="h-6 bg-muted rounded w-80 mx-auto" />
        </div>

        {/* Filter bar skeleton */}
        <div className="flex gap-3 mb-8 p-4 bg-background rounded-lg border">
          <div className="h-10 bg-muted rounded flex-1" />
          <div className="h-10 bg-muted rounded w-32" />
          <div className="h-10 bg-muted rounded w-32" />
          <div className="h-10 bg-muted rounded w-32" />
        </div>

        {/* Results header skeleton */}
        <div className="h-5 bg-muted rounded w-40 mt-8 mb-4" />

        {/* Book card grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 md:gap-8 mt-8">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="bg-background rounded-lg border overflow-hidden">
              <div className="aspect-[3/4] bg-muted" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
                <div className="h-5 bg-muted rounded w-2/3 mt-2" />
              </div>
            </div>
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between mt-12 bg-background rounded-lg p-6 border">
          <div className="h-4 bg-muted rounded w-48" />
          <div className="flex gap-2">
            <div className="h-8 bg-muted rounded w-24" />
            <div className="h-8 bg-muted rounded w-8" />
            <div className="h-8 bg-muted rounded w-8" />
            <div className="h-8 bg-muted rounded w-8" />
            <div className="h-8 bg-muted rounded w-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
