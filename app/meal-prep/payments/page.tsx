import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function MealPrepPaymentsPage() {
  return (
    <div>
      <PageHeader
        title="Meal Prep Payments"
        description="Track payments and outstanding balances for meal prep clients."
      />
      <div className="rounded-xl bg-smoke border border-line p-10 flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
          <CreditCard className="h-7 w-7 text-mist/40" />
        </div>
        <p className="text-sm font-medium text-cream mb-1">Meal Prep Payments</p>
        <p className="text-xs text-mist/50 max-w-xs">
          Payment tracking and invoicing for meal prep clients is coming soon.
        </p>
      </div>
    </div>
  );
}
