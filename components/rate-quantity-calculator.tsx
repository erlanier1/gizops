'use client';

import { useState } from 'react';

export function RateQuantityCalculator({ onSubtotalChange }: { onSubtotalChange: (subtotal: string) => void }) {
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');
  const calculate = (nextQuantity: string, nextRate: string) => {
    const count = Number(nextQuantity);
    const price = Number(nextRate);
    if (nextQuantity && nextRate && Number.isInteger(count) && count > 0 && Number.isFinite(price) && price >= 0 && Number.isFinite(count * price)) {
      onSubtotalChange((Math.round(count * Math.round(price * 100)) / 100).toFixed(2));
    }
  };
  const inputClass = 'mt-1.5 w-full rounded-lg border border-line bg-coal px-3 py-2 text-sm text-cream focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember';
  return (
    <div className="rounded-lg border border-line p-3 md:col-span-2">
      <p className="mb-3 text-xs font-semibold text-cream">Quantity x rate calculator (internal only)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-mist">Quantity / number of people
          <input type="number" min="1" step="1" inputMode="numeric" value={quantity} onChange={event => { setQuantity(event.target.value); calculate(event.target.value, rate); }} placeholder="100" className={inputClass} />
        </label>
        <label className="text-xs font-medium text-mist">Rate per person (USD)
          <input type="number" min="0" step="0.01" inputMode="decimal" value={rate} onChange={event => { setRate(event.target.value); calculate(quantity, event.target.value); }} placeholder="25.00" className={inputClass} />
        </label>
      </div>
      <p className="mt-2 text-xs text-mist/70">Enter both values to fill Event Subtotal automatically. You can still edit the subtotal below. These calculator fields are not saved or shown on the customer invoice.</p>
    </div>
  );
}

