import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface ShiftSetup {
  routeId: string | null;
  busId: string | null;
  busCodeOverride: string | null;
  shiftId: string | null;
}

interface ShiftSetupContextValue extends ShiftSetup {
  setRoute: (routeId: string) => void;
  setBus: (busId: string | null, busCodeOverride: string | null) => void;
  setShift: (shiftId: string) => void;
  reset: () => void;
}

const initial: ShiftSetup = {
  routeId: null,
  busId: null,
  busCodeOverride: null,
  shiftId: null,
};

const ShiftSetupContext = createContext<ShiftSetupContextValue>({
  ...initial,
  setRoute: () => {},
  setBus: () => {},
  setShift: () => {},
  reset: () => {},
});

export function ShiftSetupProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ShiftSetup>(initial);

  const value = useMemo<ShiftSetupContextValue>(
    () => ({
      ...state,
      setRoute: (routeId) =>
        setState((prev) => ({ ...prev, routeId, busId: null, busCodeOverride: null, shiftId: null })),
      setBus: (busId, busCodeOverride) =>
        setState((prev) => ({ ...prev, busId, busCodeOverride })),
      setShift: (shiftId) => setState((prev) => ({ ...prev, shiftId })),
      reset: () => setState(initial),
    }),
    [state],
  );

  return <ShiftSetupContext.Provider value={value}>{children}</ShiftSetupContext.Provider>;
}

export function useShiftSetup(): ShiftSetupContextValue {
  return useContext(ShiftSetupContext);
}
