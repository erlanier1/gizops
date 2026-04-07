import { Package } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function InventoryPage() {
  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Track stock levels, ingredients, and supplies."
      />
      <div className="rounded-xl bg-smoke border border-line p-10 flex flex-col items-center justify-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
          <Package className="h-7 w-7 text-mist/40" />
        </div>
        <p className="text-sm font-medium text-cream mb-1">Inventory Management</p>
        <p className="text-xs text-mist/50 max-w-xs">
          Stock tracking, low-stock alerts, and restock management are coming soon. You'll be able to monitor ingredients and supplies in real time.
        </p>
      </div>
    </div>
  );
}
