'use client';

import { useUser } from '@/lib/auth-context';

type Role = 'super_admin' | 'owner' | 'manager' | 'staff';

export function RoleGuard({
  roles,
  children,
  fallback = null,
}: {
  roles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { role, loading } = useUser();
  // While auth is resolving, show children so nav items don't flash away
  if (loading) return <>{children}</>;
  if (!role || !roles.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}

export const OwnerOnly = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard roles={['owner', 'super_admin']}>{children}</RoleGuard>
);

export const ManagerAndAbove = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard roles={['owner', 'manager', 'super_admin']}>{children}</RoleGuard>
);

export const SuperAdminOnly = ({ children }: { children: React.ReactNode }) => (
  <RoleGuard roles={['super_admin']}>{children}</RoleGuard>
);
