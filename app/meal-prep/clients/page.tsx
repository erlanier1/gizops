import { Users } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function MealPrepClientsPage() {
  return (
    <div>
      <PageHeader
        title="Meal Prep Clients"
        description="Manage recurring meal prep clients and their preferences."
      />
      <div className="rounded-xl bg-smoke border border-line p-10 flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
          <Users className="h-7 w-7 text-mist/40" />
        </div>
        <p className="text-sm font-medium text-cream mb-1">Meal Prep Clients</p>
        <p className="text-xs text-mist/50 max-w-xs">
          Client management for meal prep subscriptions is coming soon. You'll manage dietary preferences, delivery addresses, and weekly orders here.
        </p>
      </div>
    </div>
  );
}
