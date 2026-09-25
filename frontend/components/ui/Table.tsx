import Button from "./Button";

import { cn } from "@/lib/utils";



interface PaginationProps {

  page: number;

  totalPages: number;

  onPageChange: (page: number) => void;

}



export default function Pagination({ page, totalPages, onPageChange }: PaginationProps) {

  if (totalPages <= 1) return null;



  return (

    <div className="flex items-center justify-between px-2 py-4 border-t border-gray-100 mt-2">

      <p className="text-sm text-gray-500">

        Page <span className="font-medium text-gray-700">{page}</span> of{" "}

        <span className="font-medium text-gray-700">{totalPages}</span>

      </p>

      <div className="flex gap-2">

        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>

          Previous

        </Button>

        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>

          Next

        </Button>

      </div>

    </div>

  );

}



export function TableWrapper({ children, className }: { children: React.ReactNode; className?: string }) {

  return (

    <div className={cn("overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card", className)}>

      <table className="min-w-full">{children}</table>

    </div>

  );

}



export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {

  return (

    <th className={cn(

      "px-5 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-[0.06em] bg-slate-50 border-b border-slate-200 whitespace-nowrap",

      className,

    )}>

      {children}

    </th>

  );

}



export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {

  return (

    <td className={cn("px-5 py-3.5 text-[13px] text-slate-700", className)}>

      {children}

    </td>

  );

}



export function Tr({ children, className }: { children: React.ReactNode; className?: string }) {

  return (

    <tr className={cn("hover:bg-primary-50/70 transition-colors duration-150 border-b border-slate-100 last:border-0", className)}>

      {children}

    </tr>

  );

}

