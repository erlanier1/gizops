interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="mb-6 flex min-w-0 flex-col items-stretch gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="break-words text-xl font-bold text-cream sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[#8A7560]">{description}</p>
        )}
      </div>
      {action && <div className="min-w-0 shrink-0">{action}</div>}
    </div>
  );
}
