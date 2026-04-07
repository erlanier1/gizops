interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-2xl font-bold text-cream">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-[#8A7560]">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
