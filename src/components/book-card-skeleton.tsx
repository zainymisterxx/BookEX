import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BookCardSkeleton() {
  return (
    <Card className="overflow-hidden border-2">
      <CardContent className="p-0">
        <div className="relative aspect-[3/4] w-full bg-muted/20">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="p-4 space-y-1">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex items-center pt-1">
            <Skeleton className="h-4 w-4 mr-1.5" />
            <Skeleton className="h-4 w-1/3" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
