'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, FileText, CalendarDays, FolderOpen, Flame,
  ChevronRight, ChefHat, Users, CreditCard, Package, BarChart3,
  Settings, LogOut, Loader2, UserCog, FileSignature, Building2, ContactRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/lib/auth-context';
import { RoleGuard } from '@/components/RoleGuard';
import { useBusinessProfile } from '@/lib/business-profile';
import { useEnabledModules } from '@/lib/modules';
import { useAccountScope } from '@/lib/account-scope';

const ROLE_COLOR: Record<string, string> = {
  super_admin: '#9E4AE8',
  owner:       '#E8521A',
  manager:     '#D4A84B',
  staff:       '#8A7560',
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'ACIRE Owner',
  owner:       'Owner',
  manager:     'Manager',
  staff:       'Staff',
};

function NavItem({ href, icon: Icon, label }: { href: string; icon: React.ElementType; label: string }) {
  const pathname = usePathname();
  const isActive = href === '/dashboard'
    ? pathname === '/dashboard'
    : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
        isActive
          ? 'bg-ember text-white shadow-lg shadow-ember/20'
          : 'text-mist hover:bg-hover hover:text-cream'
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0 transition-colors', isActive ? 'text-white' : 'text-mist/60 group-hover:text-cream')} />
      <span className="flex-1">{label}</span>
      {isActive && <ChevronRight className="h-3.5 w-3.5 text-white/60" />}
    </Link>
  );
}

function NavSection({ label }: { label: string }) {
  return (
    <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-mist/40">
      {label}
    </p>
  );
}

export function Sidebar() {
  const { profile, role, loading, signOut, isSuperAdmin } = useUser();
  const { business } = useBusinessProfile();
  const { shouldShowModule, labelFor } = useEnabledModules();
  const { accounts, selectedAccount, selectedAccountId, setSelectedAccountId } = useAccountScope();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const initials = profile?.full_name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  const avatarColor = role ? (ROLE_COLOR[role] ?? '#8A7560') : '#8A7560';

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar border-r border-line">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ember shrink-0">
          <Flame className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-cream leading-tight">GizOps</p>
            {isSuperAdmin && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-900/60 border border-purple-700/60 text-purple-300">
                ACIRE Admin
              </span>
            )}
          </div>
          <p className="text-xs text-mist">{isSuperAdmin ? 'ACIRE Platform' : business.business_name}</p>
          <p className="text-[10px] text-mist/50 leading-tight mt-0.5">
            {isSuperAdmin ? (selectedAccount ? `Viewing ${selectedAccount.name}` : 'Platform owner console') : business.brand_tagline}
          </p>
        </div>
      </div>

      {isSuperAdmin && accounts.length > 0 && (
        <div className="border-b border-line px-4 py-3">
          <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-mist/40" htmlFor="admin-company-scope">
            Company Workspace
          </label>
          <select
            id="admin-company-scope"
            value={selectedAccountId ?? ''}
            onChange={event => setSelectedAccountId(event.target.value)}
            className="w-full rounded-lg border border-line bg-coal px-3 py-2 text-xs text-cream focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember"
          >
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.name}{account.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[10px] leading-4 text-mist/50">
            Controls company branding, modules, contacts, and company-aware views.
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <NavItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" />

        {shouldShowModule('meal_prep') && (
          <>
            <NavSection label={labelFor('meal_prep')} />
            <NavItem href="/meal-prep/schedule" icon={ChefHat} label="Schedule" />
            <RoleGuard roles={['owner', 'manager', 'super_admin']}>
              <NavItem href="/meal-prep/clients" icon={Users} label="Clients" />
              <NavItem href="/meal-prep/payments" icon={CreditCard} label="Payments" />
            </RoleGuard>
          </>
        )}

        <RoleGuard roles={['staff', 'owner', 'manager', 'super_admin']}>
          <NavSection label="Operations" />
        </RoleGuard>
        <RoleGuard roles={['owner', 'manager', 'super_admin']}>
          {shouldShowModule('contacts') && <NavItem href="/contacts" icon={ContactRound} label={labelFor('contacts')} />}
          {shouldShowModule('permits') && <NavItem href="/permits" icon={FileText} label={labelFor('permits')} />}
          {shouldShowModule('bookings') && <NavItem href="/bookings" icon={CalendarDays} label={labelFor('bookings')} />}
          {shouldShowModule('proposals') && <NavItem href="/proposals" icon={FileSignature} label={labelFor('proposals')} />}
          {shouldShowModule('inventory') && <NavItem href="/inventory" icon={Package} label={labelFor('inventory')} />}
          {shouldShowModule('documents') && <NavItem href="/documents" icon={FolderOpen} label={labelFor('documents')} />}
        </RoleGuard>
        <RoleGuard roles={['staff', 'owner', 'manager', 'super_admin']}>
          {shouldShowModule('pos') && <NavItem href="/pos" icon={CreditCard} label={labelFor('pos')} />}
        </RoleGuard>

        <RoleGuard roles={['owner', 'super_admin']}>
          <NavSection label="Admin" />
          {shouldShowModule('reports') && <NavItem href="/reports" icon={BarChart3} label={labelFor('reports')} />}
          <RoleGuard roles={['super_admin']}>
            <NavItem href="/platform/companies" icon={Building2} label="Companies" />
          </RoleGuard>
          <NavItem href="/settings/users" icon={UserCog}   label="Team" />
          <NavItem href="/settings"       icon={Settings}  label="Settings" />
        </RoleGuard>
      </nav>

      {/* User footer */}
      <div className="border-t border-line px-4 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: avatarColor }}
          >
            {loading ? '…' : initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-cream truncate">
              {profile?.full_name ?? '—'}
            </p>
            {role && (
              <span
                className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded mt-0.5"
                style={{
                  backgroundColor: avatarColor + '22',
                  border: `1px solid ${avatarColor}44`,
                  color: avatarColor,
                }}
              >
                {ROLE_LABEL[role]}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-line py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream disabled:opacity-60 transition-colors"
        >
          {signingOut ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Signing out…</>
          ) : (
            <><LogOut className="h-3.5 w-3.5" /> Sign Out</>
          )}
        </button>
      </div>
    </aside>
  );
}
