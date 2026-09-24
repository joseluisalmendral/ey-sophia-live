"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LabAssistantSettings } from "./engine";

/**
 * Lab-only settings exposed to everything rendered inside a /lab frame, so the
 * mascot host (E3) can read the assistant knobs and the keep-out debug flag
 * without new props through the production components.
 */

export interface LabFrameSettings {
  assistant: LabAssistantSettings;
  showKeepouts: boolean;
  reduced: boolean;
}

const LabSettingsContext = createContext<LabFrameSettings | null>(null);

export function LabSettingsProvider({
  value,
  children,
}: {
  value: LabFrameSettings;
  children: ReactNode;
}) {
  return <LabSettingsContext.Provider value={value}>{children}</LabSettingsContext.Provider>;
}

/** Null outside /lab — production never mounts the provider. */
export function useLabSettings(): LabFrameSettings | null {
  return useContext(LabSettingsContext);
}
