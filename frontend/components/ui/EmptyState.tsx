import Button from "./Button";



interface EmptyStateProps {

  title: string;

  description?: string;

  actionLabel?: string;

  onAction?: () => void;

  icon?: React.ReactNode;

}



export default function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {

  return (

    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">

      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200/80 flex items-center justify-center mb-5 text-gray-400 shadow-sm">

        {icon || (

          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">

            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}

              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />

          </svg>

        )}

      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-1.5">{title}</h3>

      {description && <p className="text-sm text-gray-500 mb-6 max-w-md leading-relaxed">{description}</p>}

      {actionLabel && onAction && (

        <Button onClick={onAction}>{actionLabel}</Button>

      )}

    </div>

  );

}

