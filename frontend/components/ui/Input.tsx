import { cn } from "@/lib/utils";

import { InputHTMLAttributes, forwardRef } from "react";



interface InputProps extends InputHTMLAttributes<HTMLInputElement> {

  label?: string;

  error?: string;

}



const Input = forwardRef<HTMLInputElement, InputProps>(

  ({ className, label, error, id, ...props }, ref) => (

    <div className="w-full">

      {label && (

        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">

          {label}

        </label>

      )}

      <input

        ref={ref}

        id={id}

        className={cn(

          "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm transition-all duration-200 bg-white shadow-sm",

          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",

          "placeholder:text-gray-400 disabled:bg-gray-50 disabled:cursor-not-allowed",

          error && "border-red-400 focus:ring-red-500/20 focus:border-red-400",

          className,

        )}

        {...props}

      />

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

    </div>

  ),

);

Input.displayName = "Input";

export default Input;

