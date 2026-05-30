import { Skeleton } from '@/components/ui/skeleton';

export default function OrganizationProfileLoading() {
  return (
    <div className="container py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-5 w-32" />
        </div>
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
