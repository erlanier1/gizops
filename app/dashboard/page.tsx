'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { PermitModal } from '@/components/permits/permit-modal';
import { BookingModal } from '@/components/bookings/booking-modal';
import { Toast } from '@/components/ui/toast';
import { ManagerAndAbove } from '@/components/RoleGuard';
import { useUser } from '@/lib/auth-context';
import {
  CalendarDays, FileText, FolderOpen, TrendingUp, AlertCircle,
  Flame, Plus, Clock, CheckCircle2, X, Package, Building2,
} from 'lucide-react';
import Link from 'next/link';

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-ember" />
    </div>
  );
}

function DashboardContent() {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const { profile, isStaff, isSuperAdmin } = useUser();

  const [permitOpen, setPermitOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const [data, setData] = useState({
    permitCount: 0,
    bookingCount: 0,
    docCount: 0,
    confirmedValue: 0,
    upcomingBookings: [] as any[],
    expiringPermits: [] as any[],
  });

  // Access denied banner — auto-dismiss after 5 s
  useEffect(() => {
    if (searchParams.get('error') === 'access_denied') {
      setAccessDenied(true);
      const t = setTimeout(() => setAccessDenied(false), 5000);
      return () => clearTimeout(t);
    }
  }, [searchParams]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [permitsRes, bookingsRes, docsRes] = await Promise.all([
      supabase.from('permits').select('id, name, expiration_date'),
      supabase.from('bookings').select('id, client_name, event_date, event_type, status, quote_amount'),
      supabase.from('documents').select('id'),
    ]);

    const permits  = permitsRes.data  ?? [];
    const bookings = bookingsRes.data ?? [];
    const docs     = docsRes.data     ?? [];
    const now      = Date.now();
    const in60Days = now + 60 * 86_400_000;
    const in30Days = now + 30 * 86_400_000;

    const expiringPermits = permits
      .filter(p => p.expiration_date && new Date(p.expiration_date).getTime() <= in60Days)
      .sort((a, b) => new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime())
      .slice(0, 4);

    const upcomingBookings = bookings
      .filter(b => {
        if (!b.event_date || b.status !== 'confirmed') return false;
        const t = new Date(b.event_date + 'T00:00:00').getTime();
        return t >= now && t <= in30Days;
      })
      .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
      .slice(0, 4);

    const confirmedValue = bookings
      .filter(b => b.status === 'confirmed')
      .reduce((sum, b) => sum + (b.quote_amount ?? 0), 0);

    setData({ permitCount: permits.length, bookingCount: bookings.length, docCount: docs.length, confirmedValue, upcomingBookings, expiringPermits });
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const daysLeft = (d: string) => Math.floor((new Date(d).getTime() - Date.now()) / 86_400_000);
  const isEmpty = !loading && data.permitCount === 0 && data.bookingCount === 0 && data.docCount === 0;

  // Personalized greeting
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.full_name?.split(' ')[0];
  const pageTitle = firstName ? `${timeGreeting}, ${firstName}!` : 'Dashboard';

  return (
    <div>
      {/* Access denied banner */}
      {accessDenied && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-amber-900/30 border border-amber-700/50 px-4 py-3">
          <p className="text-sm text-amber-200">You don't have permission to view that page.</p>
          <button onClick={() => setAccessDenied(false)} className="shrink-0 text-amber-400 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <PageHeader
        title={pageTitle}
        description={
          isSuperAdmin
            ? 'ACIRE Platform — Zig\'s Kitchen operations hub.'
            : "Welcome to GizOps — your operations hub for Zig's Kitchen."
        }
        action={
          <div className="flex items-center gap-2">
            {isSuperAdmin && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded bg-purple-900/60 border border-purple-700/60 text-purple-300">
                ACIRE Platform
              </span>
            )}
            <ManagerAndAbove>
              <button
                onClick={() => setPermitOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Permit
              </button>
              <button
                onClick={() => setBookingOpen(true)}
                className="flex items-center gap-1.5 rounded-lg bg-ember px-3 py-2 text-xs font-medium text-white hover:bg-ember-dark transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add Booking
              </button>
            </ManagerAndAbove>
          </div>
        }
      />

      {/* ── Staff simplified view ── */}
      {isStaff ? (
        <div className="space-y-6">
          {/* Upcoming confirmed events — no amounts */}
          <div className="rounded-xl bg-smoke border border-line p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-cream flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-ember" /> Upcoming Events
              </h2>
            </div>
            {loading ? <Spinner /> : data.upcomingBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hover mb-3">
                  <CalendarDays className="h-6 w-6 text-mist/40" />
                </div>
                <p className="text-sm font-medium text-cream mb-1">No upcoming events</p>
                <p className="text-xs text-mist/50 max-w-[200px]">Confirmed events in the next 30 days will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.upcomingBookings.map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg bg-coal border border-line px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-cream">{b.client_name}</p>
                      <p className="text-xs text-mist mt-0.5">{b.event_type?.replace('_', ' ')} · {fmtDate(b.event_date)}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-green-900/30 border-green-800 text-green-400 font-medium">Confirmed</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's deliveries — placeholder */}
          <div className="rounded-xl bg-smoke border border-line p-5">
            <h2 className="text-sm font-semibold text-cream flex items-center gap-2 mb-4">
              <Flame className="h-4 w-4 text-ember" /> Today's Deliveries
            </h2>
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hover mb-3">
                <Flame className="h-6 w-6 text-mist/40" />
              </div>
              <p className="text-sm font-medium text-cream mb-1">No deliveries scheduled today</p>
              <p className="text-xs text-mist/50 max-w-[220px]">Scheduled deliveries for today will appear here once the Meal Prep module is set up.</p>
            </div>
          </div>

          {/* Low stock alerts — placeholder */}
          <div className="rounded-xl bg-smoke border border-line p-5">
            <h2 className="text-sm font-semibold text-cream flex items-center gap-2 mb-4">
              <Package className="h-4 w-4 text-ember" /> Low Stock Alerts
            </h2>
            <div className="flex items-center gap-3 rounded-lg bg-green-900/20 border border-green-800/40 px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <p className="text-sm text-green-400">No low stock alerts at this time.</p>
            </div>
          </div>
        </div>
      ) : (
        /* ── Full view for manager / owner / super admin ── */
        <>
          {/* Stats row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard
              title="Bookings"
              value={loading ? '—' : data.bookingCount}
              subtitle={data.upcomingBookings.length > 0 ? `${data.upcomingBookings.length} confirmed upcoming` : 'No bookings yet'}
              icon={CalendarDays}
              trend="neutral"
            />
            <StatCard
              title="Active Permits"
              value={loading ? '—' : data.permitCount}
              subtitle={data.expiringPermits.length > 0 ? `${data.expiringPermits.length} expiring within 60 days` : 'All permits current'}
              icon={FileText}
              trend={data.expiringPermits.length > 0 ? 'down' : 'neutral'}
            />
            <StatCard
              title="Documents"
              value={loading ? '—' : data.docCount}
              subtitle={data.docCount > 0 ? `${data.docCount} files stored` : 'No documents uploaded'}
              icon={FolderOpen}
              trend="neutral"
            />
            <StatCard
              title="Confirmed Value"
              value={loading ? '—' : data.confirmedValue > 0 ? `$${data.confirmedValue.toLocaleString()}` : '$0'}
              subtitle="From confirmed bookings"
              icon={TrendingUp}
              trend={data.confirmedValue > 0 ? 'up' : 'neutral'}
            />
          </div>

          {/* Super admin operator count */}
          {isSuperAdmin && (
            <div className="mb-6 rounded-xl bg-smoke border border-line p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-900/40 shrink-0">
                <Building2 className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-mist mb-0.5">Operators on ACIRE Platform</p>
                <p className="text-2xl font-bold text-cream">1</p>
                <p className="text-xs text-mist/50 mt-0.5">Zig's Kitchen</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Upcoming Bookings */}
            <div className="rounded-xl bg-smoke border border-line p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-cream flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-ember" /> Upcoming Bookings
                </h2>
                <Link href="/bookings" className="text-xs text-mist hover:text-cream transition-colors">View all →</Link>
              </div>
              {loading ? <Spinner /> : data.upcomingBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hover mb-3">
                    <CalendarDays className="h-6 w-6 text-mist/40" />
                  </div>
                  <p className="text-sm font-medium text-cream mb-1">No upcoming bookings</p>
                  <p className="text-xs text-mist/50 mb-4 max-w-[200px]">Confirmed bookings in the next 30 days appear here.</p>
                  <ManagerAndAbove>
                    <button onClick={() => setBookingOpen(true)} className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-white hover:bg-ember-dark transition-colors">
                      Add Booking
                    </button>
                  </ManagerAndAbove>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.upcomingBookings.map((b: any) => (
                    <div key={b.id} className="flex items-center justify-between rounded-lg bg-coal border border-line px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-cream">{b.client_name}</p>
                        <p className="text-xs text-mist mt-0.5">{b.event_type?.replace('_', ' ')} · {fmtDate(b.event_date)}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full border bg-green-900/30 border-green-800 text-green-400 font-medium">Confirmed</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Permit Status */}
            <div className="rounded-xl bg-smoke border border-line p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-cream flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-ember" /> Permit Status
                </h2>
                <Link href="/permits" className="text-xs text-mist hover:text-cream transition-colors">View all →</Link>
              </div>
              {loading ? <Spinner /> : data.permitCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-hover mb-3">
                    <FileText className="h-6 w-6 text-mist/40" />
                  </div>
                  <p className="text-sm font-medium text-cream mb-1">No permits tracked</p>
                  <p className="text-xs text-mist/50 mb-4 max-w-[200px]">Add your permits to get expiry alerts before they lapse.</p>
                  <ManagerAndAbove>
                    <button onClick={() => setPermitOpen(true)} className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-white hover:bg-ember-dark transition-colors">
                      Add Permit
                    </button>
                  </ManagerAndAbove>
                </div>
              ) : data.expiringPermits.length === 0 ? (
                <div className="flex items-center gap-3 rounded-lg bg-green-900/20 border border-green-800/40 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                  <p className="text-sm text-green-400">All {data.permitCount} permits are current.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.expiringPermits.map((p: any) => {
                    const days = daysLeft(p.expiration_date);
                    return (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-coal border border-line px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {days <= 30
                            ? <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                            : <Clock className="h-4 w-4 text-amber-400 shrink-0" />}
                          <p className="text-sm font-medium text-cream truncate">{p.name}</p>
                        </div>
                        <span className={`text-xs font-medium shrink-0 ml-3 ${days < 0 ? 'text-red-400' : days <= 30 ? 'text-red-400' : 'text-amber-400'}`}>
                          {days < 0 ? 'Expired' : `${days}d`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Get started banner */}
          {isEmpty && (
            <div className="mt-6 rounded-xl border border-ember/30 bg-ember/10 p-5 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ember shrink-0">
                <Flame className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-cream">Get started with GizOps</p>
                <p className="text-xs text-mist mt-0.5">Add your permits, log your first booking, and upload compliance documents to unlock your full dashboard.</p>
              </div>
            </div>
          )}
        </>
      )}

      <PermitModal
        open={permitOpen}
        onClose={() => setPermitOpen(false)}
        onSaved={(msg) => { setToast({ message: msg, type: 'success' }); fetchAll(); }}
      />
      <BookingModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onSaved={(msg) => { setToast({ message: msg, type: 'success' }); fetchAll(); }}
      />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
