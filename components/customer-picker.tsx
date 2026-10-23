'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Contact = { name: string; email: string };

export function CustomerPicker({ accountId, onSelect }: { accountId: string; onSelect: (contact: Contact) => void }) {
  const supabase = useMemo(() => createClientComponentClient(), []);
  const [result, setResult] = useState<{ accountId: string; contacts: Contact[]; error: boolean } | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setQuery('');
    async function load() {
      const sources = [
        { table: 'invoices', name: 'customer_name', email: 'customer_email' },
        { table: 'catering_proposals', name: 'client_name', email: 'client_email' },
        { table: 'bookings', name: 'client_name', email: 'client_email' },
      ];
      const results = await Promise.all(sources.map(async source => {
        const { data, error } = await supabase.from(source.table)
          .select(`${source.name}, ${source.email}`).eq('account_id', accountId);
        return { source, data, error };
      }));
      const contacts = new Map<string, Contact>();
      for (const { source, data } of results) {
        for (const row of (data ?? []) as unknown as Record<string, string | null>[]) {
          const name = row[source.name]?.trim();
          const email = row[source.email]?.trim() || '';
          if (name) {
            const key = `${name.toLowerCase()}\u0000${email.toLowerCase()}`;
            contacts.set(key, { name, email });
          }
        }
      }
      if (!cancelled) setResult({ accountId, contacts: Array.from(contacts.values()).sort((a, b) => a.name.localeCompare(b.name)), error: results.some(item => !!item.error) });
    }
    load().catch(() => { if (!cancelled) setResult({ accountId, contacts: [], error: true }); });
    return () => { cancelled = true; };
  }, [accountId, supabase]);

  const current = result?.accountId === accountId ? result : null;
  const contacts = current?.contacts ?? [];
  const matches = contacts.filter(contact => `${contact.name} ${contact.email}`.toLowerCase().includes(query.toLowerCase()));
  const inputClass = 'mt-1.5 w-full rounded-lg border border-line bg-coal px-3 py-2.5 text-sm text-cream';
  return (
    <div className="mb-4 rounded-lg border border-line p-3">
      <label className="block text-xs font-medium text-mist">Find a repeat customer
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search saved names or email addresses" className={inputClass} />
      </label>
      <label className="mt-3 block text-xs font-medium text-mist">Use saved customer
        <select value="" disabled={!current} className={inputClass} onChange={event => { const contact = matches[Number(event.target.value)]; if (contact) onSelect(contact); }}>
          <option value="">{!current ? 'Loading customers.' : 'Choose a customer to fill in their details'}</option>
          {matches.map((contact, index) => <option key={`${contact.name}\u0000${contact.email}`} value={index}>{contact.name}{contact.email ? ` - ${contact.email}` : ''}</option>)}
        </select>
      </label>
      <p className="mt-2 text-xs text-mist/70">Names and emails are saved with invoices, proposals, and bookings for reuse in this business.</p>
      {current?.error && <p role="status" className="mt-2 text-xs text-amber-300">Some saved customers could not be loaded. You can still enter their details below.</p>}
      {current && !current.error && !matches.length && <p className="mt-2 text-xs text-mist/70">No matching saved customers. Enter a new customer below.</p>}
    </div>
  );
}

