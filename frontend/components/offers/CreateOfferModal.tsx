"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import api from "@/lib/api";
import type { ApiResponse, Offer } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  candidateId: number;
  candidateName: string;
  jobId: number;
  submissionId?: number | null;
  assignmentId?: number | null;
  onCreated?: (offer: Offer) => void;
};

export default function CreateOfferModal({
  open,
  onClose,
  candidateId,
  candidateName,
  jobId,
  submissionId,
  assignmentId,
  onCreated,
}: Props) {
  const [salary, setSalary] = useState("");
  const [startDate, setStartDate] = useState("");
  const [bonus, setBonus] = useState("");
  const [equity, setEquity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (acceptToo: boolean) => {
    const salaryNum = Number(salary);
    if (!salaryNum || salaryNum <= 0) {
      toast.error("Enter a valid salary");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post<ApiResponse<Offer>>("/offers", {
        candidate_id: candidateId,
        job_id: jobId,
        submission_id: submissionId || null,
        candidate_job_assignment_id: assignmentId || null,
        salary: salaryNum,
        start_date: startDate || null,
        bonus: bonus ? Number(bonus) : null,
        equity: equity || null,
        notes: notes || null,
        status: "sent",
      });
      let offer = res.data.data!;
      if (acceptToo && offer) {
        const accept = await api.post<ApiResponse<Offer & { invoice_id?: number }>>(
          `/offers/${offer.id}/accept`,
          { create_placement: true, auto_invoice: true },
        );
        offer = accept.data.data as Offer;
        toast.success(
          accept.data.data && (accept.data.data as { invoice_id?: number }).invoice_id
            ? "Offer accepted — placement + invoice created"
            : "Offer accepted — placement created",
        );
      } else {
        toast.success("Offer created");
      }
      onCreated?.(offer);
      onClose();
      setSalary("");
      setStartDate("");
      setBonus("");
      setEquity("");
      setNotes("");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create offer";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Create Offer — ${candidateName}`}>
      <div className="space-y-3">
        <Input
          label="Annual Salary *"
          type="number"
          value={salary}
          onChange={(e) => setSalary(e.target.value)}
          placeholder="120000"
        />
        <Input
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Bonus" type="number" value={bonus} onChange={(e) => setBonus(e.target.value)} />
          <Input label="Equity" value={equity} onChange={(e) => setEquity(e.target.value)} placeholder="0.5%" />
        </div>
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => submit(false)} disabled={saving}>
            Save Offer
          </Button>
          <Button onClick={() => submit(true)} disabled={saving}>
            {saving ? "Saving…" : "Accept & Invoice"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
