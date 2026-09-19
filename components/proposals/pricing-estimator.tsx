'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calculator, Check, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';

type EstimateValues = { guestCount: number; total: number; deposit: number; summary: string };
type Props = { initialGuestCount?: string; eventDescription?: string; eventLocation?: string; eventDate?: string; onApply: (estimate: EstimateValues) => void };
type ServiceStyle = 'dropoff' | 'buffet' | 'family' | 'plated' | 'cocktail';
type MenuLevel = 'simple' | 'standard' | 'premium';
type Tier = { name: string; description: string; foodRate: number; staff: number; labor: number; rentals: number; markup: number; serviceCharge: number; tax: number; total: number; deposit: number };

const fieldClass = 'w-full rounded-lg border border-line bg-coal px-3 py-2 text-sm text-cream focus:border-ember focus:outline-none focus:ring-1 focus:ring-ember';
const labelClass = 'mb-1.5 block text-[11px] font-medium text-mist';
const styleLabels: Record<ServiceStyle, string> = { dropoff: 'Drop-off / delivery', buffet: 'Buffet service', family: 'Family-style service', plated: 'Plated service', cocktail: 'Cocktail reception' };

function number(value: string) { const parsed = Number.parseFloat(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : 0; }
function money(value: number) { return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }); }
function inferredStyle(description: string): ServiceStyle {
  const text = description.toLowerCase();
  if (text.includes('plated') || text.includes('wedding')) return 'plated';
  if (text.includes('cocktail') || text.includes('hors d')) return 'cocktail';
  if (text.includes('family style')) return 'family';
  if (text.includes('drop-off') || text.includes('drop off') || text.includes('delivery')) return 'dropoff';
  return 'buffet';
}

export function PricingEstimator({ initialGuestCount = '', eventDescription = '', eventLocation = '', eventDate = '', onApply }: Props) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [guests, setGuests] = useState(initialGuestCount);
  const [serviceStyle, setServiceStyle] = useState<ServiceStyle>(() => inferredStyle(eventDescription));
  const [menuLevel, setMenuLevel] = useState<MenuLevel>('standard');
  const [duration, setDuration] = useState('4');
  const [travel, setTravel] = useState('0');
  const [otherCosts, setOtherCosts] = useState('0');
  const [taxPercent, setTaxPercent] = useState('0');
  const [depositPercent, setDepositPercent] = useState('30');
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{ analysis: string; missingInformation: string[]; confidence: string } | null>(null);
  const [aiError, setAiError] = useState('');

  useEffect(() => setGuests(initialGuestCount), [initialGuestCount]);
  useEffect(() => { if (eventDescription) setServiceStyle(inferredStyle(eventDescription)); }, [eventDescription]);

  const analyzeEvent = async () => {
    setAnalyzing(true); setAiError(''); setSelected(null);
    try {
      const response = await fetch('/api/pricing-estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestCount: guests, eventDescription, eventLocation, eventDate }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'AI analysis failed.');
      const result = data.analysis;
      setServiceStyle(result.serviceStyle); setMenuLevel(result.menuLevel);
      setDuration(String(result.eventHours)); setTravel(String(result.travelEstimate)); setOtherCosts(String(result.otherFixedCosts));
      setTaxPercent(String(result.taxPercent)); setDepositPercent(String(result.depositPercent));
      setAiResult({ analysis: result.analysis, missingInformation: result.missingInformation, confidence: result.confidence });
    } catch (error) { setAiError(error instanceof Error ? error.message : 'AI analysis failed.'); }
    finally { setAnalyzing(false); }
  };

  const estimates = useMemo<Tier[]>(() => {
    const guestCount = Math.round(number(guests));
    const hours = Math.max(2, number(duration));
    const baseFood = { simple: 15, standard: 24, premium: 38 }[menuLevel];
    const staffRatio = { dropoff: 100, buffet: 30, family: 22, plated: 15, cocktail: 20 }[serviceStyle];
    const serviceHours = serviceStyle === 'dropoff' ? 2 : hours + 2;
    const baseRentals = { dropoff: 1, buffet: 5, family: 7, plated: 12, cocktail: 8 }[serviceStyle];
    const shared = number(travel) + number(otherCosts);
    const taxRate = number(taxPercent) / 100;
    const depositRate = number(depositPercent) / 100;
    const configs = [
      { name: 'Essential', description: 'Cost-conscious menu and streamlined service', multiplier: .82, laborRate: 24, markupRate: .20, serviceRate: .08 },
      { name: 'Standard', description: 'Balanced menu, staffing, and presentation', multiplier: 1, laborRate: 30, markupRate: .30, serviceRate: .12 },
      { name: 'Premium', description: 'Elevated menu, fuller staffing, and upgraded presentation', multiplier: 1.32, laborRate: 38, markupRate: .40, serviceRate: .18 },
    ];
    return configs.map(option => {
      const foodRate = baseFood * option.multiplier;
      const staff = serviceStyle === 'dropoff' ? 1 : Math.max(1, Math.ceil(guestCount / staffRatio * option.multiplier));
      const food = guestCount * foodRate;
      const labor = staff * serviceHours * option.laborRate;
      const rentals = guestCount * baseRentals * option.multiplier;
      const direct = food + labor + rentals + shared;
      const markup = direct * option.markupRate;
      const serviceCharge = (direct + markup) * option.serviceRate;
      const tax = (direct + markup + serviceCharge) * taxRate;
      const total = direct + markup + serviceCharge + tax;
      return { ...option, foodRate, staff, labor, rentals, markup, serviceCharge, tax, total, deposit: total * depositRate };
    });
  }, [depositPercent, duration, guests, menuLevel, otherCosts, serviceStyle, taxPercent, travel]);

  const apply = (tier: Tier) => {
    const guestCount = Math.round(number(guests));
    const summary = [
      `Pricing estimate for ${guestCount} guests — ${tier.name}`,
      `Service: ${styleLabels[serviceStyle]} · ${duration || 0} event hours · ${tier.staff} staff`,
      `Menu level: ${menuLevel} · Food allowance: ${money(tier.foodRate)} per guest`,
      `Labor: ${money(tier.labor)} · Rentals/equipment: ${money(tier.rentals)}`,
      `Markup: ${money(tier.markup)} · Service charge: ${money(tier.serviceCharge)} · Estimated tax: ${money(tier.tax)}`,
      `${eventLocation ? `Location: ${eventLocation} · ` : ''}Estimated total: ${money(tier.total)}`,
    ].join('\n');
    onApply({ guestCount, total: tier.total, deposit: tier.deposit, summary });
    setSelected(tier.name);
  };

  return <div className="mb-5 overflow-hidden rounded-xl border border-ember/40 bg-ember/5">
    <button type="button" onClick={() => setOpen(value => !value)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
      <span className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ember/15 text-ember"><Calculator className="h-4 w-4" /></span><span><span className="block text-sm font-semibold text-cream">Event Pricing Estimator</span><span className="block text-xs text-mist">Turn the event details into three price options.</span></span></span>
      {open ? <ChevronUp className="h-4 w-4 text-mist" /> : <ChevronDown className="h-4 w-4 text-mist" />}
    </button>
    {open && <div className="border-t border-line px-4 py-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-mist"><Sparkles className="h-3.5 w-3.5 text-ember" />Uses the proposal guest count, location, date, and menu notes.</div>
        <button type="button" onClick={analyzeEvent} disabled={analyzing || (!number(guests) && !eventDescription.trim())} className="inline-flex items-center gap-2 rounded-lg border border-ember/50 bg-ember/10 px-3 py-2 text-xs font-semibold text-ember hover:bg-ember/20 disabled:cursor-not-allowed disabled:opacity-50">
          {analyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{analyzing ? 'Analyzing event…' : 'Analyze event with AI'}
        </button>
      </div>
      {aiError && <div className="mb-3 flex gap-2 rounded-lg border border-red-800/50 bg-red-950/20 px-3 py-2 text-xs text-red-400"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{aiError}</div>}
      {aiResult && <div className="mb-4 rounded-lg border border-ember/30 bg-coal px-3 py-3 text-xs leading-5 text-mist"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-cream">AI event analysis</p><span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase">{aiResult.confidence} confidence</span></div><p className="mt-1">{aiResult.analysis}</p>{aiResult.missingInformation.length > 0 && <p className="mt-2"><span className="font-medium text-cream">Confirm before quoting:</span> {aiResult.missingInformation.join(' · ')}</p>}</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <NumberField label="Guests" value={guests} onChange={setGuests} step="1" />
        <SelectField label="Service style" value={serviceStyle} onChange={value => setServiceStyle(value as ServiceStyle)} options={Object.entries(styleLabels)} />
        <SelectField label="Menu level" value={menuLevel} onChange={value => setMenuLevel(value as MenuLevel)} options={[["simple", "Simple"], ["standard", "Standard"], ["premium", "Premium"]]} />
        <NumberField label="Event hours" value={duration} onChange={setDuration} />
        <NumberField label="Travel & delivery" value={travel} onChange={setTravel} />
        <NumberField label="Other fixed costs" value={otherCosts} onChange={setOtherCosts} />
        <NumberField label="Sales tax %" value={taxPercent} onChange={setTaxPercent} suffix="%" />
        <NumberField label="Deposit %" value={depositPercent} onChange={setDepositPercent} suffix="%" />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {estimates.map((tier, index) => <div key={tier.name} className={`relative rounded-xl border p-4 ${index === 1 ? 'border-ember bg-ember/10' : 'border-line bg-coal'}`}>
          {index === 1 && <span className="absolute right-3 top-3 rounded-full bg-ember px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">Recommended</span>}
          <p className="text-sm font-semibold text-cream">{tier.name}</p><p className="mt-1 min-h-8 text-[11px] leading-4 text-mist">{tier.description}</p>
          <p className="mt-3 text-2xl font-bold text-ember">{money(tier.total)}</p><p className="text-xs text-mist">{money(number(guests) ? tier.total / number(guests) : 0)} per guest</p>
          <div className="mt-3 space-y-1 border-t border-line pt-3 text-[11px] text-mist">
            <p className="flex justify-between"><span>Food allowance</span><span className="text-cream">{money(tier.foodRate)}/guest</span></p><p className="flex justify-between"><span>Staffing</span><span className="text-cream">{tier.staff} staff</span></p><p className="flex justify-between"><span>Deposit</span><span className="text-cream">{money(tier.deposit)}</span></p>
          </div>
          <button type="button" onClick={() => apply(tier)} disabled={tier.total <= 0} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ember px-3 py-2 text-xs font-semibold text-white hover:bg-ember-dark disabled:cursor-not-allowed disabled:opacity-50">{selected === tier.name ? <Check className="h-3.5 w-3.5" /> : <Calculator className="h-3.5 w-3.5" />}{selected === tier.name ? 'Applied' : `Use ${tier.name}`}</button>
        </div>)}
      </div>
      <p className="mt-3 text-[11px] leading-4 text-mist/70">These are planning estimates based on the event assumptions—not a final quote. Confirm menu costs, staffing, tax, rentals, and travel before sending.</p>
    </div>}
  </div>;
}

function NumberField({ label, value, onChange, step = '0.01', suffix }: { label: string; value: string; onChange: (value: string) => void; step?: string; suffix?: string }) {
  return <div><label className={labelClass}>{label}</label><div className="relative"><input aria-label={label} type="number" min="0" step={step} value={value} onChange={event => onChange(event.target.value)} className={`${fieldClass} ${suffix ? 'pr-8' : ''}`} placeholder="0" />{suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mist">{suffix}</span>}</div></div>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <div><label className={labelClass}>{label}</label><select aria-label={label} value={value} onChange={event => onChange(event.target.value)} className={fieldClass}>{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></div>;
}
