import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Campus = { id: string; name: string; city: string | null; address: string | null; is_active: boolean };

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
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campuses")
        .select("id, name, city, address, is_active")
        .order("name");
      if (error) throw error;
      return (data || []) as Campus[];
    },
  });

  useEffect(() => {
    if (!data || data.length === 0) return;
    const stored = typeof window !== "undefined" ? localStorage.getItem(KEY) : null;
    const valid = data.find((c) => c.id === stored);
    if (valid) setIdState(valid.id);
    else setIdState(data[0].id);
  }, [data]);

  const setCampusId = (id: string) => {
    setIdState(id);
    try { localStorage.setItem(KEY, id); } catch {}
  };

  const campus = data?.find((c) => c.id === campusId) || null;

  return (
    <CampusCtx.Provider value={{ campuses: data || [], loading: isLoading, campusId, campus, setCampusId }}>
      {children}
    </CampusCtx.Provider>
  );
}

export function useCampus() {
  const ctx = useContext(CampusCtx);
  if (!ctx) throw new Error("useCampus must be inside CampusProvider");
  return ctx;
}