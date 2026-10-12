"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { VolumeUnit } from "./tracker";

// ml or oz, remembered per browser (localStorage: it's a preference, not
// part of the session). Amounts are always stored in ml; this only changes
// how they're shown and entered. Falls back to ml when storage is blocked.

const KEY = "nestpath.volumeUnit";
const listeners = new Set<() => void>();
let memory: VolumeUnit = "ml";

function read(): VolumeUnit {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "ml" || stored === "oz") return stored;
  } catch {
    // storage blocked: the in-memory choice still works for this page
  }
  return memory;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useVolumeUnit(): [VolumeUnit, (unit: VolumeUnit) => void] {
  // The server renders ml; the stored choice applies after hydration.
  const unit = useSyncExternalStore(subscribe, read, () => "ml" as const);
  const setUnit = useCallback((next: VolumeUnit) => {
    memory = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // remembered for this page only
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [unit, setUnit];
}
