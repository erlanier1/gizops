'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

export function InstallAppButton() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    setInstalled(Boolean(standalone));
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const markInstalled = () => setInstalled(true);
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', markInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', capture); window.removeEventListener('appinstalled', markInstalled); };
  }, []);

  if (installed) return null;

  async function install() {
    if (!prompt) { setShowHelp(true); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPrompt(null);
  }

  return <><button type="button" onClick={install} className="mt-4 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg border border-ember/60 bg-ember/10 px-4 text-sm font-semibold text-ember hover:bg-ember/20"><Download className="h-4 w-4"/>Install GizOps App</button>{showHelp&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"><div className="w-full max-w-sm rounded-2xl border border-line bg-smoke p-5 text-cream shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">Install GizOps</h2><p className="mt-1 text-sm leading-6 text-mist">On iPhone or iPad, tap the <Share className="inline h-4 w-4"/> Share button in Safari and choose <b className="text-cream">Add to Home Screen</b>. On Android or desktop, open the browser menu and choose <b className="text-cream">Install app</b> or <b className="text-cream">Add to Home Screen</b>.</p></div><button type="button" onClick={()=>setShowHelp(false)} aria-label="Close install instructions" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-mist hover:bg-hover"><X className="h-5 w-5"/></button></div></div></div>}</>;
}
