import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import type { ApiResponse, Job, PaginatedData } from "@/types";

export function useJobs(params?: Record<string, string | number>) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<PaginatedData<Job>>>("/jobs", {
        params: { page_size: 20, ...params },
      });
      setJobs(res.data.data.items);
      setPagination({
        page: res.data.data.page,
        total_pages: res.data.data.total_pages,
        total: res.data.data.total,
      });
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  return { jobs, loading, pagination, refetch: fetchJobs };
}
