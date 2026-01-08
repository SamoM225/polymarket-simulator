"use client";

import { useState } from "react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string) => Promise<string | null>;
}

/**
 * Modal pre prihlásenie používateľa cez email.
 * Účet sa vytvorí automaticky ak neexistuje.
 */
export function AuthModal({ isOpen, onClose, onLogin }: AuthModalProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async () => {
    if (!email.trim()) {
      setError("Zadaj email");
      return;
    }
    
    setLoading(true);
    setError(null);
    const err = await onLogin(email);
    setLoading(false);
    
    if (err) {
      setError(err);
    } else {
      // Úspešné prihlásenie - zatvor modal
      setEmail("");
      onClose();
    }
  };

  const handleClose = () => {
    setEmail("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-slate-900">Prihlásenie</h3>
        <p className="text-sm text-slate-600">
          Zadaj email pre prihlásenie.
        </p>
        
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <input
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          placeholder="tvoj@email.sk"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLogin();
          }}
        />
        
        <p className="mt-2 text-xs text-slate-500">
          Ak nemáš účet, automaticky sa vytvorí.
        </p>
        
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={handleClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            disabled={loading}
          >
            Zrušiť
          </button>
          <button
            onClick={handleLogin}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Prihlasujem..." : "Prihlásiť"}
          </button>
        </div>
      </div>
    </div>
  );
}
