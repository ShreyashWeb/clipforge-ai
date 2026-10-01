export function Skeleton({ className = '' }) {
  return <span aria-hidden="true" className={`skeleton block rounded-lg ${className}`} />;
}

export function JobsSkeleton() {
  return (
    <div aria-label="Loading jobs" className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <Skeleton className="h-24" key={index} />)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5" key={index}>
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-5 h-5 w-4/5" />
            <Skeleton className="mt-4 h-4 w-2/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function JobDetailSkeleton() {
  return (
    <div aria-label="Loading job" className="space-y-8">
      <Skeleton className="h-6 w-28" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-44" />
      <Skeleton className="h-56" />
    </div>
  );
}
