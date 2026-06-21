"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import type { ApiResponse, MatchItem } from "@/types";

export default function MatchesPage() {
  const [items, setItems] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<{ items: MatchItem[] }>>("/recruitment/matches");
      setItems(res.data.data.items);
    } catch {
      toast.error("Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMatches(); }, [fetchMatches]);

  const scoreColor = (score: number) => {
    if (score >= 70) return "bg-green-100 text-green-800";
    if (score >= 50) return "bg-primary-100 text-primary-800";
    return "bg-yellow-100 text-yellow-800";
  };

  return (
    <PageWrapper>
      <Header
        title="Matches"
        subtitle="AI-suggested candidate and job matches based on skills"
      />

      {loading ? <TableSkeleton rows={8} cols={5} /> : !items.length ? (
        <EmptyState
          title="No matches found"
          description="Add required skills to jobs and skills to candidates to see matches."
          icon={<GitBranch className="w-8 h-8" />}
        />
      ) : (
        <div className="content-panel p-1">
          <TableWrapper>
          <thead>
            <tr>
              <Th>Candidate</Th>
              <Th>Job</Th>
              <Th>Client</Th>
              <Th>Match Score</Th>
              <Th>Matched Skills</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((m) => (
              <Tr key={`${m.candidate_id}-${m.job_id}`}>
                <Td>
                  <Link href={`/candidates/${m.candidate_id}`} className="text-primary hover:underline font-medium">
                    {m.candidate_name}
                  </Link>
                  {m.candidate_title && (
                    <p className="text-xs text-gray-500 mt-0.5">{m.candidate_title}</p>
                  )}
                </Td>
                <Td>
                  <Link href={`/jobs/${m.job_id}`} className="text-primary hover:underline">
                    {m.job_title}
                  </Link>
                </Td>
                <Td>{m.client_name || "—"}</Td>
                <Td>
                  <Badge className={scoreColor(m.match_score)}>{m.match_score}%</Badge>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {m.matched_skills.slice(0, 4).map((s) => (
                      <span key={s} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                        {s}
                      </span>
                    ))}
                    {m.matched_skills.length > 4 && (
                      <span className="text-xs text-gray-400">+{m.matched_skills.length - 4}</span>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableWrapper>
        </div>
      )}
    </PageWrapper>
  );
}
