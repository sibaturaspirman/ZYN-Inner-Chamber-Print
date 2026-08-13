"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        // Ambil update SW cepat di kiosk.
        void reg.update();
      } catch (error) {
        console.warn("SW register failed", error);
      }
    };

    void register();
  }, []);

  return null;
}
