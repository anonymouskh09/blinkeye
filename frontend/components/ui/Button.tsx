import { cn } from "@/lib/utils";

import { ButtonHTMLAttributes, forwardRef } from "react";



interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {

  variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";

  size?: "sm" | "md" | "lg";

  loading?: boolean;

}



const Button = forwardRef<HTMLButtonElement, ButtonProps>(

  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {

    const variants = {

      primary: "bg-primary text-white hover:bg-primary-700 shadow-sm hover:shadow",

      secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",

      danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",

      ghost: "bg-transparent text-gray-600 hover:bg-gray-100",

      outline: "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm",

    };

    const sizes = {

      sm: "px-3 py-1.5 text-sm rounded-lg",

      md: "px-4 py-2.5 text-sm rounded-xl",

      lg: "px-6 py-3 text-base rounded-xl",

    };

    return (

      <button

        ref={ref}

        disabled={disabled || loading}

        className={cn(

          "inline-flex items-center justify-center font-medium transition-all duration-200",

          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1",

          "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",

          variants[variant],

          sizes[size],

          className,

        )}

        {...props}

      >

        {loading && (

          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">

            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />

            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />

          </svg>

        )}

        {children}

      </button>

    );

  },

);

Button.displayName = "Button";

export default Button;

