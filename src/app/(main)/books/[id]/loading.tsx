export default function Loading() {
  return (
    <div className="bg-background">
      <div className="container py-8 md:py-12 animate-pulse">
        <div className="grid md:grid-cols-3 gap-8 md:gap-16">
          {/* Cover image */}
          <div className="md:col-span-1">
            <div className="aspect-[3/4] w-full bg-muted rounded-lg" />
          </div>

          {/* Details */}
          <div className="md:col-span-2 space-y-6">
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-20" />
              <div className="h-12 bg-muted rounded w-3/4" />
              <div className="h-6 bg-muted rounded w-1/2" />
            </div>

            <div className="flex gap-4">
              <div className="h-8 bg-muted rounded w-24" />
              <div className="h-8 bg-muted rounded w-32" />
            </div>

            <div className="h-px bg-muted w-full" />

            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-32" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>

            <div className="h-px bg-muted w-full" />

            {/* Seller card */}
            <div className="bg-muted/30 rounded-lg border p-4 space-y-4">
              <div className="h-5 bg-muted rounded w-40" />
              <div className="flex gap-4 items-center">
                <div className="h-16 w-16 bg-muted rounded-full shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-muted rounded w-32" />
                  <div className="h-4 bg-muted rounded w-24" />
                  <div className="h-4 bg-muted rounded w-20" />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="h-14 bg-muted rounded flex-1" />
              <div className="h-14 bg-muted rounded flex-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
