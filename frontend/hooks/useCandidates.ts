import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import type { ApiResponse, Candidate, PaginatedData } from "@/types";

export function useCandidates(params?: Record<string, string | number>) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<Candidate>>>("/candidates", {
        params: { page_size: 20, ...params },
      });
      setCandidates(res.data.data.items);
      setPagination({
        page: res.data.data.page,
        total_pages: res.data.data.total_pages,
        total: res.data.data.total,
      });
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  return { candidates, loading, pagination, refetch: fetchCandidates };
}
