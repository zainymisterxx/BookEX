export default function Loading() {
  return (
    <div className="bg-secondary">
      <div className="container py-12 md:py-16 animate-pulse">
        <div className="space-y-4 text-center mb-12">
          <div className="h-10 bg-muted rounded w-56 mx-auto" />
          <div className="h-6 bg-muted rounded w-96 mx-auto" />
        </div>

        {/* Action bar skeleton */}
        <div className="flex gap-4 mb-8 p-4 bg-background rounded-lg border">
          <div className="h-12 bg-muted rounded w-44" />
        </div>

        {/* Community cards list */}
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-background rounded-lg border p-5 flex items-center gap-4">
              <div className="h-14 w-14 bg-muted rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-5 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-24" />
              </div>
              <div className="h-9 bg-muted rounded w-20 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
