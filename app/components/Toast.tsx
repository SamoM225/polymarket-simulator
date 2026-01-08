"use client";

import { useEffect, useState } from "react";

// Ikony
const CheckIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const InfoIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LoadingIcon = () => (
  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

export type ToastType = "success" | "error" | "info" | "loading";

interface ToastProps {
  message: string;
  type?: ToastType;
  onDismiss: () => void;
  autoDismiss?: number; // ms, 0 = no auto dismiss
}

// Mapovanie správ na user-friendly texty
const MESSAGE_MAP: Record<string, { text: string; type: ToastType }> = {
  "Nacitavam data...": { text: "Načítavam zápasy...", type: "loading" },
  "Data nacitane zo Supabase.": { text: "Zápasy načítané", type: "success" },
  "Cooldown 1s medzi stavkami.": { text: "Počkaj sekundu pred ďalšou stávkou", type: "info" },
  "Zadaj kladnu sumu.": { text: "Zadaj platnú sumu", type: "error" },
  "Mas otvorene 3 pozicie. Najprv jednu zavri.": { text: "Máš už 3 otvorené pozície. Najprv niektorú zavri.", type: "error" },
  "Nedostatok prostriedkov.": { text: "Nedostatok prostriedkov na účte", type: "error" },
  "Suma po fee je prilis mala.": { text: "Suma je príliš malá", type: "error" },
  "Transakcia zlyhala (LMSR).": { text: "Stávka sa nepodarila, skús znova", type: "error" },
  "Prihlas sa, az potom mozes vsadit.": { text: "Pre stavenie sa najprv prihlás", type: "info" },
  "Prihlas sa, az potom mozes uzavriet poziciu.": { text: "Pre zatvorenie pozície sa najprv prihlás", type: "info" },
  "Cakaj na synchronizaciu pozicie so Supabase, potom ju zavri.": { text: "Počkaj na potvrdenie pozície...", type: "loading" },
  "Zapis do Supabase zlyhal, stavka vratena.": { text: "Stávka sa nepodarila uložiť", type: "error" },
  "Stavka bola uspesne ulozena.": { text: "Stávka úspešne umiestnená! 🎉", type: "success" },
  "Pozicia bola uzavreta.": { text: "Pozícia uzavretá", type: "success" },
  "Edge funkcia zlyhala.": { text: "Niečo sa pokazilo, skús znova", type: "error" },
  "Nedostatok prostriedkov v DB. Obnov stranku.": { text: "Nedostatok prostriedkov - obnov stránku", type: "error" },
  "Pozicia uz neexistuje.": { text: "Táto pozícia už neexistuje", type: "error" },
  "Market nebol najdeny.": { text: "Zápas sa nenašiel", type: "error" },
  "Odhlásený": { text: "Bol si odhlásený", type: "info" },
  "Vitaj v simulatore - vyber zapas a vsad.": { text: "Vitaj! Vyber si zápas a začni stavať 🏆", type: "success" },
};

function parseMessage(message: string): { text: string; type: ToastType } {
  // Check direct mapping
  if (MESSAGE_MAP[message]) {
    return MESSAGE_MAP[message];
  }

  // Check for partial matches
  if (message.includes("Stavka") && message.includes("Cakam na potvrdenie")) {
    return { text: "Spracovávam stávku...", type: "loading" };
  }
  if (message.includes("Pozicia uzatvarana")) {
    return { text: "Zatvárám pozíciu...", type: "loading" };
  }
  if (message.includes("Max jedna stavka je")) {
    const match = message.match(/(\d+)/);
    return { text: `Maximálna stávka je ${match?.[0] ?? "100"} €`, type: "info" };
  }

  // Default
  return { text: message, type: "info" };
}

export function Toast({ message, type, onDismiss, autoDismiss = 4000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const parsed = parseMessage(message);
  const finalType = type ?? parsed.type;
  const finalText = parsed.text;

  // Reset animation state when message changes
  useEffect(() => {
    setIsVisible(false);
    setIsLeaving(false);
    requestAnimationFrame(() => setIsVisible(true));
  }, [message]);

  useEffect(() => {
    // Auto dismiss for non-loading toasts, or loading toasts after 8s max
    const dismissTime = finalType === "loading" ? 8000 : autoDismiss;
    
    if (dismissTime > 0) {
      const timer = setTimeout(() => {
        setIsLeaving(true);
        setTimeout(onDismiss, 300);
      }, dismissTime);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss, finalType, message]);

  const handleDismiss = () => {
    setIsLeaving(true);
    setTimeout(onDismiss, 300);
  };

  const styles = {
    success: "bg-gradient-to-r from-emerald-500 to-teal-500 text-white",
    error: "bg-gradient-to-r from-rose-500 to-pink-500 text-white",
    info: "bg-gradient-to-r from-blue-500 to-indigo-500 text-white",
    loading: "bg-gradient-to-r from-slate-600 to-slate-700 text-white",
  };

  const icons = {
    success: <CheckIcon />,
    error: <XIcon />,
    info: <InfoIcon />,
    loading: <LoadingIcon />,
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-5 py-4 shadow-2xl transition-all duration-300 ${styles[finalType]} ${
        isVisible && !isLeaving
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0"
      }`}
    >
      <span className="shrink-0">{icons[finalType]}</span>
      <span className="text-sm font-medium">{finalText}</span>
      {finalType !== "loading" && (
        <button
          onClick={handleDismiss}
          className="ml-2 shrink-0 rounded-full p-1 transition hover:bg-white/20"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
