'use client';

import Link from 'next/link';
import {
  BarChart3,
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ModuleGate } from '@/components/ModuleGate';

const reports = [
  {
    id: 'operations-overview',
    title: 'Operations Overview',
    description: 'Snapshot of bookings, confirmed revenue, permits, and document counts.',
    icon: BarChart3,
  },
  {
    id: 'booking-pipeline',
    title: 'Booking Pipeline',
    description: 'Bookings grouped by status with event dates, client details, and quoted value.',
    icon: CalendarDays,
  },
  {
    id: 'revenue-summary',
    title: 'Revenue Summary',
    description: 'Confirmed booking value, deposits expected, and deposit payment status.',
    icon: TrendingUp,
  },
  {
    id: 'permit-compliance',
    title: 'Permit Compliance',
    description: 'Permit inventory with expiration status and renewal urgency.',
    icon: ShieldCheck,
  },
  {
    id: 'document-inventory',
    title: 'Document Inventory',
    description: 'Uploaded operational documents grouped by type and upload date.',
    icon: FolderOpen,
  },
];

const formats = [
  { key: 'word', label: 'Word', icon: FileText },
  { key: 'excel', label: 'Excel', icon: FileSpreadsheet },
  { key: 'pdf', label: 'PDF', icon: Download },
];

export default function ReportsPage() {
  return (
    <ModuleGate moduleKey="reports">
    <div>
      <PageHeader
        title="Reports"
        description="Export standard operations reports in Word, Excel, or PDF formats."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {reports.map(report => {
          const Icon = report.icon;

          return (
            <section key={report.id} className="rounded-xl bg-smoke border border-line p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ember/15 border border-ember/30">
                  <Icon className="h-5 w-5 text-ember" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-cream">{report.title}</h2>
                  <p className="mt-1 text-xs leading-5 text-mist/70">{report.description}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {formats.map(format => {
                      const FormatIcon = format.icon;

                      return (
                        <Link
                          key={format.key}
                          href={`/api/reports/${report.id}?format=${format.key}`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-mist hover:bg-hover hover:text-cream transition-colors"
                        >
                          <FormatIcon className="h-3.5 w-3.5" />
                          {format.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-smoke p-5">
        <p className="text-sm font-semibold text-cream mb-1">Report data sources</p>
        <p className="text-xs leading-5 text-mist/70">
          Reports pull from bookings, permits, and documents. Payment status uses booking deposit fields and Stripe webhook updates where a booking is linked to the payment.
        </p>
      </div>
    </div>
    </ModuleGate>
  );
}
