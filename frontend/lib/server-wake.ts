"use client";

import { useEffect, useState } from "react";
import { isServerAwake } from "./api";

export { wakeServer } from "./api";

export const WAKING_NOTE = "NestPath is waking up. This can take up to a minute.";

/** True once `active` has stayed true for `ms`, and the server hasn't been
 * seen awake: the moment a wait is long enough to explain. */
export function useWakingNote(active: boolean, ms: number): boolean {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!active) return;
    const id = setTimeout(() => setLate(true), ms);
    return () => {
      clearTimeout(id);
      setLate(false);
    };
  }, [active, ms]);
  return active && late && !isServerAwake();
}
