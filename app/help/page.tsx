import Link from 'next/link';
import {
  BookOpen,
  Building2,
  CalendarDays,
  CircleHelp,
  CreditCard,
  Clock3,
  FileText,
  Package,
  Receipt,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';

const guides = [
  {
    title: 'Company workspace',
    description: 'Choose the correct company before reviewing or changing company records.',
    icon: Building2,
    steps: [
      'Owners, managers, and staff are automatically placed in their assigned company.',
      'ACIRE administrators should choose a company from Company Workspace in the sidebar.',
      'Confirm the company name shown beneath the GizOps logo before changing records.',
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
      'Use Owner for company administration, Manager for daily operations and workforce review, and Staff for limited operational access.',
    ],
  },
  {
    title: 'Employee ID and PIN access',
    description: 'Managers and staff can clock in and enter their permitted GizOps workspace without entering a password each time.',
    icon: ShieldCheck,
    steps: [
      'The owner first creates the person under Team and assigns Manager or Staff.',
      'Open Staff & PINs, create the staff login, and use the same email and corresponding role as the Team account.',
      'Give the employee their ID and temporary password privately. On first login, they create a personal 6-digit PIN.',
      'Future Employee ID and PIN logins clock the employee in and open the dashboard automatically.',
    ],
  },
  {
    title: 'Clocking in and out',
    description: 'Clock activity is tied to the employee, work location, and active shift.',
    icon: Clock3,
    steps: [
      'Open Staff ID / PIN Login from the main login page.',
      'Choose the company, work type, and location or event, then enter Employee ID and PIN.',
      'Use the dashboard clock card or Time Card menu to review status and clock out.',
      'From the Time Card screen, select Open Dashboard to return to regular app functions.',
    ],
  },
  {
    title: 'Scheduling and timesheet approval',
    description: 'Owners and managers can plan shifts and approve completed time entries by week.',
    icon: CalendarDays,
    steps: [
      'Open Scheduling & Timesheets under Operations and select the week beginning date.',
      'Choose an employee, location, start and end time, then add the shift.',
      'Review completed clock entries, recorded hours, and pending approval totals.',
      'Approve one entry or use Approve all pending for the selected week.',
    ],
  },
  {
    title: 'Phone, tablet, and installed app',
    description: 'GizOps is mobile-ready and can be installed as an app from a supported browser.',
    icon: Smartphone,
    steps: [
      'Open www.gizops.com in Safari, Chrome, or Edge on the device.',
      'Choose Add to Home Screen or Install App from the browser menu.',
      'Open GizOps from the new home-screen icon and sign in normally.',
      'Use the menu button at the top of a phone or tablet to open and close navigation.',
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
  { href: '/workforce', label: 'Scheduling & Timesheets', icon: Clock3 },
  { href: '/inventory', label: 'Inventory', icon: Package },
  { href: '/staff', label: 'Time Card', icon: Receipt },
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

      <section className="mb-8 overflow-hidden rounded-xl border border-line bg-smoke">
        <div className="border-b border-line p-4"><h2 className="font-semibold text-cream">Role access at a glance</h2></div>
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <div className="bg-smoke p-4"><p className="font-semibold text-ember">Owner</p><p className="mt-1 text-sm leading-6 text-mist">All company operations, team and PIN administration, settings, schedules, and timesheet approval.</p></div>
          <div className="bg-smoke p-4"><p className="font-semibold text-ember">Manager</p><p className="mt-1 text-sm leading-6 text-mist">POS, inventory, meal prep, bookings, contacts, documents, reports, schedules, and timesheet approval.</p></div>
          <div className="bg-smoke p-4"><p className="font-semibold text-ember">Staff</p><p className="mt-1 text-sm leading-6 text-mist">Simplified dashboard, assigned operational areas, POS, meal-prep schedule, and personal Time Card.</p></div>
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
