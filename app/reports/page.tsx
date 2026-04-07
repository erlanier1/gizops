import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function ReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Revenue, bookings, and operations analytics."
      />
      <div className="rounded-xl bg-smoke border border-line p-10 flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
          <BarChart3 className="h-7 w-7 text-mist/40" />
        </div>
        <p className="text-sm font-medium text-cream mb-1">Reports & Analytics</p>
        <p className="text-xs text-mist/50 max-w-xs">
          Revenue trends, booking analytics, and operational reports are coming soon.
        </p>
      </div>
    </div>
  );
}
