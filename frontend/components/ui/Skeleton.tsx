import { cn } from "@/lib/utils";



export function Skeleton({ className }: { className?: string }) {

  return <div className={cn("animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl", className)} />;

}



export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {

  return (

    <div className="rounded-2xl border border-gray-200/80 bg-white p-4 space-y-3 shadow-card">

      <div className="flex gap-4 pb-3 border-b border-gray-100">

        {Array.from({ length: cols }).map((_, j) => (

          <Skeleton key={j} className="h-4 flex-1" />

        ))}

      </div>

      {Array.from({ length: rows }).map((_, i) => (

        <div key={i} className="flex gap-4 py-2">

          {Array.from({ length: cols }).map((_, j) => (

            <Skeleton key={j} className="h-8 flex-1" />

          ))}

        </div>

      ))}

    </div>

  );

}



export function CardSkeleton() {

  return (

    <div className="bg-white rounded-2xl border border-gray-200/80 p-6 space-y-4 shadow-card">

      <Skeleton className="h-6 w-1/3" />

      <Skeleton className="h-4 w-full" />

      <Skeleton className="h-4 w-2/3" />

    </div>

  );

}



export function StatCardSkeleton() {

  return (

    <div className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-card">

      <Skeleton className="h-4 w-24 mb-4 rounded-lg" />

      <Skeleton className="h-9 w-20 rounded-lg" />

    </div>

  );

}

