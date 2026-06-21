"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Pagination, { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import api from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, Interview, PaginatedData } from "@/types";

export default function InterviewsPage() {
  const [data, setData] = useState<PaginatedData<Interview> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [editInterview, setEditInterview] = useState<Interview | null>(null);
  const [editForm, setEditForm] = useState({ status: "", interview_date: "", interview_time: "" });

  const fetchInterviews = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, page_size: 20 };
      if (status) params.status = status;
      const res = await api.get<ApiResponse<PaginatedData<Interview>>>("/interviews", { params });
      setData(res.data.data);
    } catch {
      toast.error("Failed to load interviews");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => { fetchInterviews(); }, [fetchInterviews]);

  const openEdit = (i: Interview) => {
    setEditInterview(i);
    setEditForm({ status: i.status, interview_date: i.interview_date, interview_time: i.interview_time });
  };

  const handleUpdate = async () => {
    if (!editInterview) return;
    try {
      await api.put(`/interviews/${editInterview.id}`, editForm);
      toast.success("Interview updated");
      setEditInterview(null);
      fetchInterviews();
    } catch {
      toast.error("Failed to update");
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await api.delete(`/interviews/${id}`);
      toast.success("Interview cancelled");
      fetchInterviews();
    } catch {
      toast.error("Failed to cancel");
    }
  };

  const statusColor = (s: string) => {
    if (s === "scheduled") return "bg-primary-100 text-primary-800";
    if (s === "completed") return "bg-green-100 text-green-800";
    if (s === "cancelled") return "bg-red-100 text-red-800";
    return "bg-yellow-100 text-yellow-800";
  };

  return (
    <PageWrapper>
      <Header title="Interviews" subtitle="Manage scheduled interviews" />

      <div className="mb-6 w-48">
        <Select options={[
          { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" }, { value: "rescheduled", label: "Rescheduled" },
        ]} placeholder="All Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
      </div>

      {loading ? <TableSkeleton rows={8} cols={8} /> : !data?.items?.length ? (
        <EmptyState title="No interviews found" description="Schedule interviews from candidate profiles." />
      ) : (
        <>
          <TableWrapper>
            <thead>
              <tr>
                <Th>Candidate</Th><Th>Job</Th><Th>Client</Th><Th>Date & Time</Th>
                <Th>Type</Th><Th>Interviewer</Th><Th>Status</Th><Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((i) => (
                <Tr key={i.id}>
                  <Td>{i.candidate_name}</Td>
                  <Td>{i.job_title}</Td>
                  <Td>{i.client_name}</Td>
                  <Td>{formatDateTime(i.interview_date, i.interview_time)}</Td>
                  <Td className="capitalize">{i.interview_type}</Td>
                  <Td>{i.interviewer_name}</Td>
                  <Td><Badge className={statusColor(i.status)}>{i.status}</Badge></Td>
                  <Td>
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(i)} className="text-primary hover:underline text-sm">Edit</button>
                      {i.status === "scheduled" && (
                        <button onClick={() => handleCancel(i.id)} className="text-red-600 hover:underline text-sm">Cancel</button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrapper>
          <Pagination page={page} totalPages={data.total_pages} onPageChange={setPage} />
        </>
      )}

      <Modal open={!!editInterview} onClose={() => setEditInterview(null)} title="Edit Interview">
        <div className="space-y-4">
          <Select label="Status" options={[
            { value: "scheduled", label: "Scheduled" }, { value: "completed", label: "Completed" },
            { value: "cancelled", label: "Cancelled" }, { value: "rescheduled", label: "Rescheduled" },
          ]} value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} />
          <Input label="Date" type="date" value={editForm.interview_date}
            onChange={(e) => setEditForm({ ...editForm, interview_date: e.target.value })} />
          <Input label="Time" type="time" value={editForm.interview_time}
            onChange={(e) => setEditForm({ ...editForm, interview_time: e.target.value })} />
          <div className="flex gap-3">
            <Button onClick={handleUpdate}>Save</Button>
            <Button variant="outline" onClick={() => setEditInterview(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </PageWrapper>
  );
}
