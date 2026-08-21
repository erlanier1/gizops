'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock3, Loader2 } from 'lucide-react';

export function ManagerClockCard() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/staff/session', { cache: 'no-store' });
    setSession(response.ok ? await response.json() : null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function clock(action: 'in' | 'out') {
    setWorking(true);
    setMessage('');
    const response = await fetch('/api/staff/clock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    const result = await response.json();
    setMessage(response.ok ? (action === 'in' ? 'You are clocked in.' : 'You are clocked out.') : result.error);
    await load();
    setWorking(false);
  }

  if (loading) return <div className="mb-6 flex min-h-28 items-center justify-center rounded-xl border border-line bg-smoke"><Loader2 className="h-5 w-5 animate-spin text-ember" /></div>;

  if (!session) return <section className="mb-6 flex flex-col gap-4 rounded-xl border border-line bg-smoke p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-hover"><Clock3 className="h-5 w-5 text-ember" /></span><div><h2 className="font-semibold text-cream">Manager Time Card</h2><p className="mt-1 text-sm text-mist">Use your Employee ID and PIN to clock in and connect this dashboard to your shift.</p></div></div><Link href="/staff/login" className="flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-ember px-5 text-sm font-semibold text-white">Open Staff Login</Link></section>;

  const openEntry = session.openEntry;
  return <section className="mb-6 rounded-xl border border-line bg-smoke p-5"><div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${openEntry?'bg-green-900/30':'bg-hover'}`}><Clock3 className={`h-5 w-5 ${openEntry?'text-green-400':'text-ember'}`} /></span><div><h2 className="font-semibold text-cream">{openEntry ? 'Clocked In' : 'Not Clocked In'}</h2><p className="mt-1 text-sm text-mist">{openEntry ? `Since ${new Date(openEntry.clocked_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Start your shift when you are ready.'}</p></div></div><button disabled={working} onClick={() => clock(openEntry ? 'out' : 'in')} className={`min-h-12 w-full rounded-xl px-7 font-semibold sm:w-auto ${openEntry?'bg-cream text-coal':'bg-ember text-white'} disabled:opacity-60`}>{working ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : openEntry ? 'Clock Out' : 'Clock In'}</button></div>{message&&<p role="status" className="mt-3 text-sm text-mist">{message}</p>}</section>;
}
