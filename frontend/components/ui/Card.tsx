import { cn } from "@/lib/utils";



interface CardProps {

  children: React.ReactNode;

  className?: string;

  hover?: boolean;

  onClick?: () => void;

}



export default function Card({ children, className, hover, onClick }: CardProps) {

  return (

    <div

      onClick={onClick}

      className={cn(

        "bg-white rounded-2xl border border-gray-200/80 shadow-card",

        hover && "hover:shadow-card-hover hover:border-primary/20 transition-all duration-200 cursor-pointer",

        className,

      )}

    >

      {children}

    </div>

  );

}



export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {

  return <div className={cn("px-6 py-4 border-b border-gray-100", className)}>{children}</div>;

}



export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {

  return <div className={cn("px-6 py-5", className)}>{children}</div>;

}



export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {

  return <h3 className={cn("text-base font-semibold text-gray-900", className)}>{children}</h3>;

}

