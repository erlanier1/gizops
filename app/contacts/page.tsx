'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { ContactRound, Loader2, Mail, Phone, RefreshCw } from 'lucide-react';
import { ModuleGate } from '@/components/ModuleGate';
import { PageHeader } from '@/components/page-header';
import { Toast } from '@/components/ui/toast';
import { useEnabledModules } from '@/lib/modules';

type LeadStatus = 'new' | 'contacted' | 'quoted' | 'booked' | 'closed' | 'spam';

type ContactLead = {
  id: string;
  source: string | null;
  status: LeadStatus;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  service_interest: string | null;
  message: string | null;
  consent_to_contact: boolean;
  created_at: string;
};

const statusOptions: LeadStatus[] = ['new', 'contacted', 'quoted', 'booked', 'closed', 'spam'];
const inputClass = 'rounded-lg bg-coal border border-line px-3 py-2 text-sm text-cream focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember transition-colors';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function ContactsPage() {
  const supabase = createClientComponentClient();
  const { labelFor } = useEnabledModules();
  const [leads, setLeads] = useState<ContactLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | LeadStatus>('all');
  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('contact_leads')
      .select('id, source, status, contact_name, email, phone, company_name, service_interest, message, consent_to_contact, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      setToast({ message: error.message, type: 'error' });
      setLeads([]);
    } else {
      setLeads((data ?? []) as ContactLead[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = useMemo(() => {
    if (statusFilter === 'all') return leads;
    return leads.filter(lead => lead.status === statusFilter);
  }, [leads, statusFilter]);

  const updateStatus = async (lead: ContactLead, status: LeadStatus) => {
    setSavingStatus(prev => ({ ...prev, [lead.id]: true }));
    const { error } = await supabase
      .from('contact_leads')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', lead.id);
    setSavingStatus(prev => ({ ...prev, [lead.id]: false }));

    if (error) {
      setToast({ message: error.message, type: 'error' });
      return;
    }

    setLeads(prev => prev.map(item => item.id === lead.id ? { ...item, status } : item));
  };

  return (
    <ModuleGate moduleKey="contacts">
      <div>
        <PageHeader
          title={labelFor('contacts')}
          description="Review website inquiries, client contacts, and lead follow-up status."
        />

        <section className="rounded-xl border border-line bg-smoke">
          <div className="flex flex-col gap-3 border-b border-line px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-ember/30 bg-ember/15">
                <ContactRound className="h-5 w-5 text-ember" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-cream">Lead Inbox</h2>
                <p className="text-xs text-mist/60">{filteredLeads.length} visible of {leads.length} total contacts</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                className={inputClass}
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value as 'all' | LeadStatus)}
              >
                <option value="all">All statuses</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={fetchLeads}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-sm font-medium text-mist transition-colors hover:bg-hover hover:text-cream"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-ember" />
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="px-5 py-12 text-sm text-mist/70">
              No contacts match this view yet. Website forms can post leads to /api/contact-leads with this company account slug.
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filteredLeads.map(lead => (
                <article key={lead.id} className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-cream">{lead.contact_name || 'Unnamed contact'}</h3>
                        <span className="rounded-full border border-line bg-coal px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-mist/60">
                          {lead.source || 'website'}
                        </span>
                        <span className="rounded-full border border-ember/30 bg-ember/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ember">
                          {lead.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-mist/50">{formatDate(lead.created_at)}</p>
                      {(lead.company_name || lead.service_interest) && (
                        <p className="mt-2 text-sm text-mist">
                          {[lead.company_name, lead.service_interest].filter(Boolean).join(' - ')}
                        </p>
                      )}
                      {lead.message && (
                        <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-6 text-mist/75">{lead.message}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-mist/70">
                        {lead.email && (
                          <a className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-coal px-2.5 py-1.5 hover:text-cream" href={`mailto:${lead.email}`}>
                            <Mail className="h-3.5 w-3.5" />
                            {lead.email}
                          </a>
                        )}
                        {lead.phone && (
                          <a className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-coal px-2.5 py-1.5 hover:text-cream" href={`tel:${lead.phone}`}>
                            <Phone className="h-3.5 w-3.5" />
                            {lead.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="w-full lg:w-44">
                      <label className="mb-1.5 block text-xs font-medium text-mist" htmlFor={`status-${lead.id}`}>Follow-up status</label>
                      <select
                        id={`status-${lead.id}`}
                        className={`${inputClass} w-full`}
                        value={lead.status}
                        disabled={savingStatus[lead.id]}
                        onChange={event => updateStatus(lead, event.target.value as LeadStatus)}
                      >
                        {statusOptions.map(status => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      </div>
    </ModuleGate>
  );
}
