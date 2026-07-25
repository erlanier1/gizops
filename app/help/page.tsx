import Link from 'next/link';
import {
  BookOpen,
  Building2,
  CalendarDays,
  CircleHelp,
  CreditCard,
  FileText,
  Package,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';

const guides = [
  {
    title: 'Company workspace',
    description: 'Choose the correct company before reviewing or changing company records.',
    icon: Building2,
    steps: [
      'Open the Company Workspace menu in the sidebar.',
      'Choose the company you want to work with.',
      'Confirm the company name shown beneath the GizOps logo.',
    ],
  },
  {
    title: 'Team access',
    description: 'Owners can invite users and assign the access level appropriate for their work.',
    icon: Users,
    steps: [
      'Select the company workspace.',
      'Open Team under Admin.',
      'Invite the user and choose Owner, Manager, or Staff.',
    ],
  },
  {
    title: 'Bookings and proposals',
    description: 'Track inquiries, event details, proposals, deposits, and booking progress.',
    icon: CalendarDays,
    steps: [
      'Create or open the customer booking.',
      'Keep its stage and event details current.',
      'Use Proposals for pricing, terms, and acceptance status.',
    ],
  },
  {
    title: 'Payments',
    description: 'Use PayPal payment links and invoices; GizOps does not store card details.',
    icon: CreditCard,
    steps: [
      'Open the relevant booking or meal-prep customer.',
      'Create the deposit link or invoice.',
      'Confirm the payment status after PayPal completes the payment.',
    ],
  },
  {
    title: 'Inventory and receipts',
    description: 'Keep supply counts current and retain purchase documentation for review.',
    icon: Package,
    steps: [
      'Update quantities whenever supplies are received or used.',
      'Upload purchase files from Receipts.',
      'Mark each receipt as reviewed or flagged after checking it.',
    ],
  },
  {
    title: 'Compliance and documents',
    description: 'Store operational files and monitor permits, licenses, and expiration dates.',
    icon: FileText,
    steps: [
      'Add permits and enter their expiration dates.',
      'Upload supporting files in Documents.',
      'Review upcoming expirations from the dashboard and Compliance page.',
    ],
  },
];

const quickLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: BookOpen },
  { href: '/bookings', label: 'Bookings', icon: CalendarDays },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/receipts', label: 'Receipts', icon: Receipt },
];

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Help & User Guide"
        description="Quick instructions for the most common GizOps workflows."
      />

      <section className="mb-8 rounded-xl border border-ember/30 bg-ember/10 p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <div>
            <h2 className="font-semibold text-cream">Start in the correct company workspace</h2>
            <p className="mt-1 text-sm leading-6 text-mist">
              Company records, modules, branding, contacts, and reports depend on the workspace selected in the sidebar. ACIRE admins should confirm the company before entering or changing information.
            </p>
          </div>
        </div>
      </section>

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border border-line bg-smoke p-4 text-sm font-medium text-cream transition-colors hover:border-ember/50 hover:bg-hover"
          >
            <Icon className="h-4 w-4 text-ember" />
            {label}
          </Link>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {guides.map(({ title, description, icon: Icon, steps }) => (
          <section key={title} className="rounded-xl border border-line bg-smoke p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="rounded-lg bg-ember/10 p-2 text-ember">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-cream">{title}</h2>
                <p className="mt-1 text-sm leading-5 text-mist">{description}</p>
              </div>
            </div>
            <ol className="space-y-2">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-5 text-mist">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coal text-[11px] font-semibold text-ember">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-smoke p-5">
        <div className="flex items-start gap-3">
          <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <div>
            <h2 className="font-semibold text-cream">Before reporting a problem</h2>
            <p className="mt-1 text-sm leading-6 text-mist">
              Confirm the selected company, note the page and action that caused the problem, and copy any error message shown on screen. Do not include passwords, API keys, or payment-card details.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
