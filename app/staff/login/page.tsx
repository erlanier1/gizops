'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, MapPin, Truck, Utensils, CalendarDays, Loader2 } from 'lucide-react';

const input = 'w-full min-h-[52px] rounded-xl border border-line bg-coal px-4 text-base text-cream focus:border-ember focus:outline-none';
type Option = { id:string; name:string; type?:string };

export default function StaffLogin() {
  const router = useRouter();
  const [accounts,setAccounts]=useState<Option[]>([]), [locations,setLocations]=useState<Option[]>([]), [events,setEvents]=useState<Option[]>([]);
  const [accountId,setAccountId]=useState(''), [workType,setWorkType]=useState('restaurant'), [locationId,setLocationId]=useState(''), [eventId,setEventId]=useState('');
  const [code,setCode]=useState(''), [credential,setCredential]=useState(''), [trusted,setTrusted]=useState(false), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  useEffect(()=>{ fetch('/api/staff/options').then(r=>r.json()).then(x=>{setAccounts(x.accounts||[]); if(x.accounts?.length===1)setAccountId(x.accounts[0].id);}); },[]);
  useEffect(()=>{ if(!accountId)return;setError('');fetch(`/api/staff/options?account_id=${accountId}`).then(async r=>({ok:r.ok,body:await r.json()})).then(({ok,body:x})=>{if(!ok){setLocations([]);setEvents([]);setError(x.error||'Locations could not be loaded.');return}setLocations(x.locations||[]);setEvents(x.events||[]);}); },[accountId]);
  async function submit(e:FormEvent){e.preventDefault();setBusy(true);setError('');const r=await fetch('/api/staff/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account_id:accountId,employee_code:code,credential,work_type:workType,location_id:workType==='event'?null:locationId,event_id:workType==='event'?eventId:null,trusted_device:trusted})});const x=await r.json();setBusy(false);if(!r.ok){setError(x.error);return;}router.push(x.must_set_pin?'/staff/setup-pin':'/staff');}
  const types=[['restaurant','Restaurant',Utensils],['food_truck','Food Truck',Truck],['event','Event / Mobile',CalendarDays]] as const;
  return <main className="min-h-screen bg-coal px-4 py-8 text-cream flex items-center justify-center"><div className="w-full max-w-md">
    <div className="text-center mb-6"><span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ember"><Flame className="h-7 w-7"/></span><h1 className="mt-3 text-3xl font-bold text-ember">Zig’s Kitchen</h1><p className="text-mist">Staff clock-in & access</p></div>
    <form onSubmit={submit} className="rounded-2xl border border-line bg-hover p-5 sm:p-7 space-y-4 shadow-xl">
      <div><label className="text-xs text-mist">Company</label><select required value={accountId} onChange={e=>setAccountId(e.target.value)} className={input}><option value="">Select company</option>{accounts.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
      <div><label className="text-xs text-mist">Where are you working?</label><div className="grid grid-cols-3 gap-2 mt-1">{types.map(([id,label,Icon])=><button type="button" key={id} onClick={()=>{setWorkType(id);setTrusted(false)}} className={`min-h-[76px] rounded-xl border p-2 text-xs flex flex-col items-center justify-center gap-1 ${workType===id?'border-ember bg-ember/15 text-cream':'border-line text-mist'}`}><Icon className="h-5 w-5"/>{label}</button>)}</div></div>
      {workType==='event'?<div><label className="text-xs text-mist">Today’s event</label><select required value={eventId} onChange={e=>setEventId(e.target.value)} className={input}><option value="">Select event</option>{events.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>:<div><label className="text-xs text-mist">Location</label><select required value={locationId} onChange={e=>setLocationId(e.target.value)} className={input}><option value="">Select location</option>{locations.filter(x=>x.type===workType).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></div>}
      <input required value={code} onChange={e=>setCode(e.target.value)} placeholder="Employee ID" autoComplete="username" className={input}/><input required value={credential} onChange={e=>setCredential(e.target.value)} placeholder="6-digit PIN or temporary password" type="password" autoComplete="current-password" className={input}/>
      {workType!=='event'&&<label className="flex gap-3 items-start rounded-xl border border-line p-3 text-sm text-mist"><input type="checkbox" checked={trusted} onChange={e=>setTrusted(e.target.checked)} className="mt-1 accent-orange-500"/><span><b className="text-cream">Trusted work device</b><br/>Only use this on a company restaurant or food-truck tablet.</span></label>}
      {error&&<p role="alert" className="rounded-lg border border-red-800 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      <button disabled={busy} className="min-h-[54px] w-full rounded-xl bg-ember font-semibold text-white disabled:opacity-60">{busy?<Loader2 className="mx-auto animate-spin"/>:'Clock In & Enter'}</button>
      <a href="/login" className="block text-center text-xs text-mist hover:text-ember">Admin email/password login</a>
    </form></div></main>;
}
