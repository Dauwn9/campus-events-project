"use client";

import { createContext, useContext, useState } from "react";

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  function show(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      {message && (
        <div className="fixed bottom-4 left-4 z-50 rounded-control bg-text px-4 py-2 text-white shadow-modal">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  );
}