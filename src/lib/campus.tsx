import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCampusesFn } from "@/fns/campus";

export type Campus = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
};

type Ctx = {
  campuses: Campus[];
  loading: boolean;
  campusId: string | null;
  campus: Campus | null;
  setCampusId: (id: string) => void;
};

const KEY = "ena.activeCampusId";
const CampusCtx = createContext<Ctx | undefined>(undefined);

export function CampusProvider({ children }: { children: ReactNode }) {
  const [campusId, setIdState] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["campuses-all"],
    queryFn: () => getCampusesFn(),
  });

  useEffect(() => {
    if (!data || data.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const valid = (data as Campus[]).find((c) => c.id === stored);
    if (valid) setIdState(valid.id);
    else setIdState((data as Campus[])[0].id);
  }, [data]);

  const setCampusId = (id: string) => {
    setIdState(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  };

  const campusList = (data || []) as Campus[];
  const campus = campusList.find((c) => c.id === campusId) || null;

  return (
    <CampusCtx.Provider
      value={{
        campuses: campusList,
        loading: isLoading,
        campusId,
        campus,
        setCampusId,
      }}
    >
      {children}
    </CampusCtx.Provider>
  );
}

export function useCampus() {
  const ctx = useContext(CampusCtx);
  if (!ctx) throw new Error("useCampus must be inside CampusProvider");
  return ctx;
}
