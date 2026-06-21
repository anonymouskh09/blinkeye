import { cn } from "@/lib/utils";

import { SelectHTMLAttributes, forwardRef } from "react";



interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {

  label?: string;

  error?: string;

  options: { value: string; label: string }[];

  placeholder?: string;

}



const Select = forwardRef<HTMLSelectElement, SelectProps>(

  ({ className, label, error, id, options, placeholder, ...props }, ref) => (

    <div className="w-full">

      {label && (

        <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1.5">

          {label}

        </label>

      )}

      <select

        ref={ref}

        id={id}

        className={cn(

          "w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm transition-all duration-200 bg-white shadow-sm",

          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",

          error && "border-red-400",

          className,

        )}

        {...props}

      >

        {placeholder && <option value="">{placeholder}</option>}

        {options.map((opt) => (

          <option key={opt.value} value={opt.value}>

            {opt.label}

          </option>

        ))}

      </select>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}

    </div>

  ),

);

Select.displayName = "Select";

export default Select;

