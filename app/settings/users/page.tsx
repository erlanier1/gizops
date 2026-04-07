'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { PageHeader } from '@/components/page-header';
import { Modal } from '@/components/ui/modal';
import { Toast } from '@/components/ui/toast';
import { useUser } from '@/lib/auth-context';
import {
  Plus, Loader2, UserCheck, UserX, Trash2, Mail, KeyRound,
  ShieldAlert, Clock, CheckCircle2, AlertCircle,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

type Role = 'super_admin' | 'owner' | 'manager' | 'staff';

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  is_active: boolean;
  last_sign_in_at:    string | null;
  invited_at:         string | null;
  email_confirmed_at: string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<Role, string> = {
  super_admin: '#9E4AE8',
  owner:       '#E8521A',
  manager:     '#D4A84B',
  staff:       '#8A7560',
};

const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  owner:       'Owner',
  manager:     'Manager',
  staff:       'Staff',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function getMemberStatus(m: TeamMember): 'active' | 'inactive' | 'invited' {
  if (!m.email_confirmed_at && m.invited_at) return 'invited';
  if (!m.is_active) return 'inactive';
  return 'active';
}

// Which roles a caller can assign to a target
function editableRoles(callerRole: Role, targetRole: Role): Role[] {
  if (callerRole === 'super_admin') return ['staff', 'manager', 'owner', 'super_admin'];
  if (callerRole === 'owner') {
    if (targetRole === 'owner' || targetRole === 'super_admin') return [];
    return ['staff', 'manager'];
  }
  return [];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ name, role, size = 9 }: { name: string; role: Role; size?: number }) {
  return (
    <div
      className={`flex h-${size} w-${size} shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`}
      style={{ backgroundColor: ROLE_COLOR[role] }}
    >
      {initials(name)}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full"
      style={{
        backgroundColor: ROLE_COLOR[role] + '22',
        border:          `1px solid ${ROLE_COLOR[role]}44`,
        color:           ROLE_COLOR[role],
      }}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function StatusBadge({ status }: { status: 'active' | 'inactive' | 'invited' }) {
  if (status === 'active')
    return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-green-900/30 border-green-800 text-green-400 font-medium"><CheckCircle2 className="h-3 w-3" />Active</span>;
  if (status === 'invited')
    return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-amber-900/30 border-amber-800 text-amber-400 font-medium"><Mail className="h-3 w-3" />Invited</span>;
  return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-red-900/30 border-red-800 text-red-400 font-medium"><UserX className="h-3 w-3" />Inactive</span>;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamPage() {
  const supabase = createClientComponentClient();
  const { user, profile, role: callerRole, isSuperAdmin } = useUser();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Invite form
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'staff' as 'manager' | 'staff' });
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Busy state per-member for async actions
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/team');
    if (res.ok) setMembers(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    setBusy(b => ({ ...b, [memberId]: true }));
    const { error } = await supabase
      .from('profiles').update({ role: newRole }).eq('id', memberId);
    if (error) {
      setToast({ message: `Failed to update role: ${error.message}`, type: 'error' });
    } else {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
      setToast({ message: 'Role updated.', type: 'success' });
    }
    setBusy(b => ({ ...b, [memberId]: false }));
  };

  const handleToggleActive = async (member: TeamMember) => {
    const newActive = !member.is_active;
    setBusy(b => ({ ...b, [member.id]: true }));
    const { error } = await supabase
      .from('profiles').update({ is_active: newActive }).eq('id', member.id);
    if (error) {
      setToast({ message: `Failed: ${error.message}`, type: 'error' });
    } else {
      setMembers(prev => prev.map(m => m.id === member.id ? { ...m, is_active: newActive } : m));
      setToast({
        message: newActive ? `${member.full_name} reactivated.` : `${member.full_name} deactivated.`,
        type: 'success',
      });
    }
    setBusy(b => ({ ...b, [member.id]: false }));
  };

  const handleRemove = async (member: TeamMember) => {
    if (!window.confirm(`Remove ${member.full_name} from GizOps? This cannot be undone.`)) return;
    setBusy(b => ({ ...b, [member.id]: true }));
    const res = await fetch(`/api/team/${member.id}`, { method: 'DELETE' });
    const body = await res.json();
    if (!res.ok) {
      setToast({ message: body.error ?? 'Failed to remove user.', type: 'error' });
      setBusy(b => ({ ...b, [member.id]: false }));
    } else {
      setMembers(prev => prev.filter(m => m.id !== member.id));
      setToast({ message: `${member.full_name} removed.`, type: 'success' });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setInviteError(null);
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inviteForm),
    });
    const body = await res.json();
    setInviting(false);
    if (!res.ok) {
      setInviteError(body.error ?? 'Invite failed.');
      return;
    }
    setInviteOpen(false);
    setInviteForm({ email: '', full_name: '', role: 'staff' });
    setToast({ message: `Invite sent to ${inviteForm.email}.`, type: 'success' });
    fetchMembers();
  };

  const handlePasswordReset = async () => {
    if (!profile?.email) return;
    await supabase.auth.resetPasswordForEmail(profile.email);
    setToast({ message: 'Password reset email sent.', type: 'success' });
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const currentMember = members.find(m => m.id === user?.id);
  const otherMembers  = members.filter(m => m.id !== user?.id);

  const inp = 'w-full rounded-lg bg-coal border border-line px-3 py-2.5 text-sm text-cream placeholder-mist/40 focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';
  const lbl = 'block text-xs font-medium text-mist mb-1.5';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Team"
        description="Manage team members, roles, and invitations."
        action={
          <button
            onClick={() => setInviteOpen(true)}
            className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors"
          >
            <Plus className="h-4 w-4" /> Invite User
          </button>
        }
      />

      {/* ── Current user card ── */}
      {currentMember && (
        <div className="rounded-xl bg-smoke border border-line p-5 mb-6 flex items-center gap-4">
          <Avatar name={currentMember.full_name} role={currentMember.role} size={12} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <p className="text-sm font-semibold text-cream">{currentMember.full_name}</p>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-ember/20 border border-ember/40 text-ember">
                This is you
              </span>
            </div>
            <p className="text-xs text-mist">{currentMember.email}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <RoleBadge role={currentMember.role} />
              <StatusBadge status={getMemberStatus(currentMember)} />
            </div>
          </div>
          <button
            onClick={handlePasswordReset}
            className="flex items-center gap-1.5 text-xs text-mist hover:text-cream transition-colors shrink-0"
          >
            <KeyRound className="h-3.5 w-3.5" /> Change password
          </button>
        </div>
      )}

      {/* ── Team table ── */}
      <div className="rounded-xl bg-smoke border border-line overflow-hidden">
        <div className="px-5 py-4 border-b border-line flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-ember" />
          <h2 className="text-sm font-semibold text-cream">All Team Members</h2>
          <span className="text-xs text-mist">({members.length})</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-ember" />
          </div>
        ) : otherMembers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-hover mb-4">
              <UserCheck className="h-7 w-7 text-mist/40" />
            </div>
            <p className="text-sm font-semibold text-cream mb-2">No other team members yet</p>
            <p className="text-xs text-mist/50 mb-6 max-w-xs">Invite a manager or staff member to give them access to GizOps.</p>
            <button
              onClick={() => setInviteOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-ember px-4 py-2 text-sm font-medium text-white hover:bg-ember-dark transition-colors"
            >
              <Plus className="h-4 w-4" /> Invite User
            </button>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-5 py-2.5 border-b border-line">
              {['Member', 'Role', 'Last Login', 'Status', 'Actions'].map(h => (
                <p key={h} className="text-[10px] font-semibold uppercase tracking-wider text-mist/50">{h}</p>
              ))}
            </div>

            {/* Rows */}
            <div className="divide-y divide-line">
              {otherMembers.map(member => {
                const status   = getMemberStatus(member);
                const isBusy   = busy[member.id] ?? false;
                const canEdit  = editableRoles(callerRole!, member.role);
                const isOwnerOrSA = callerRole === 'owner' || callerRole === 'super_admin';

                return (
                  <div
                    key={member.id}
                    className={`grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center px-5 py-4 hover:bg-hover/20 transition-colors ${!member.is_active ? 'opacity-50' : ''}`}
                  >
                    {/* Member */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={member.full_name} role={member.role} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-cream truncate">{member.full_name}</p>
                        <p className="text-xs text-mist truncate">{member.email}</p>
                      </div>
                    </div>

                    {/* Role */}
                    <div>
                      {canEdit.length > 0 ? (
                        <select
                          value={member.role}
                          disabled={isBusy}
                          onChange={e => handleRoleChange(member.id, e.target.value as Role)}
                          className="rounded-lg bg-coal border border-line px-2 py-1 text-xs text-cream focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors disabled:opacity-50 cursor-pointer"
                          style={{ color: ROLE_COLOR[member.role] }}
                        >
                          {canEdit.map(r => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      ) : (
                        <RoleBadge role={member.role} />
                      )}
                    </div>

                    {/* Last login */}
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-mist/40 shrink-0" />
                      <span className="text-xs text-mist">
                        {status === 'invited' ? 'Invite pending' : timeAgo(member.last_sign_in_at)}
                      </span>
                    </div>

                    {/* Status */}
                    <div><StatusBadge status={status} /></div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      {isBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin text-mist" />
                      ) : (
                        <>
                          {isOwnerOrSA && (
                            <button
                              onClick={() => handleToggleActive(member)}
                              title={member.is_active ? 'Deactivate' : 'Reactivate'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                member.is_active
                                  ? 'text-mist hover:text-amber-400 hover:bg-amber-900/20'
                                  : 'text-green-500 hover:text-green-400 hover:bg-green-900/20'
                              }`}
                            >
                              {member.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            </button>
                          )}
                          {/* Remove — owner only, not self */}
                          {callerRole === 'owner' || isSuperAdmin ? (
                            <button
                              onClick={() => handleRemove(member)}
                              title="Remove user"
                              className="p-1.5 rounded-lg text-mist hover:text-red-400 hover:bg-red-900/20 transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Invite modal ── */}
      <Modal
        open={inviteOpen}
        onClose={() => { setInviteOpen(false); setInviteError(null); }}
        title="Invite Team Member"
        description="They'll receive an email with a link to set their password and log in."
      >
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className={lbl}>Full name *</label>
            <input
              required
              className={inp}
              value={inviteForm.full_name}
              onChange={e => setInviteForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label className={lbl}>Email address *</label>
            <input
              required
              type="email"
              className={inp}
              value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              placeholder="jane@example.com"
            />
          </div>
          <div>
            <label className={lbl}>Role *</label>
            <select
              className={inp}
              value={inviteForm.role}
              onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as 'manager' | 'staff' }))}
            >
              <option value="staff">Staff</option>
              <option value="manager">Manager</option>
            </select>
            <p className="mt-1.5 text-[11px] text-mist/50">
              Owner accounts are created directly in Supabase.
            </p>
          </div>

          {inviteError && (
            <div className="rounded-lg bg-red-950/60 border border-red-800/60 px-3.5 py-2.5">
              <p className="text-xs text-red-400">{inviteError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => { setInviteOpen(false); setInviteError(null); }}
              className="flex-1 rounded-lg border border-line px-4 py-2.5 text-sm font-medium text-mist hover:bg-hover hover:text-cream transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviting}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white hover:bg-ember-dark disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {inviting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Mail className="h-4 w-4" /> Send Invite</>}
            </button>
          </div>
        </form>
      </Modal>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
    </div>
  );
}
