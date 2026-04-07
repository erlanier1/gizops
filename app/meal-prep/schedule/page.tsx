import { ChefHat } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function MealPrepSchedulePage() {
  return (
    <div>
      <PageHeader
        title="Meal Prep Schedule"
        description="Weekly delivery and prep schedule."
      />
      <div className="rounded-xl bg-smoke border border-line p-10 flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
          <ChefHat className="h-7 w-7 text-mist/40" />
        </div>
        <p className="text-sm font-medium text-cream mb-1">Meal Prep Schedule</p>
        <p className="text-xs text-mist/50 max-w-xs">
          The weekly delivery schedule module is coming soon. You'll be able to manage prep days, delivery windows, and staff assignments here.
        </p>
      </div>
    </div>
  );
}
