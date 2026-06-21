import { cn } from "@/lib/utils";



interface BadgeProps {

  children: React.ReactNode;

  className?: string;

}



export default function Badge({ children, className }: BadgeProps) {

  return (

    <span className={cn(

      "inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold ring-1 ring-inset ring-black/5",

      className,

    )}>

      {children}

    </span>

  );

}

