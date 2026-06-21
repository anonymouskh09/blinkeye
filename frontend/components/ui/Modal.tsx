"use client";



import { cn } from "@/lib/utils";

import { X } from "lucide-react";

import { useEffect } from "react";

import Button from "./Button";



interface ModalProps {

  open: boolean;

  onClose: () => void;

  title: string;

  children: React.ReactNode;

  size?: "sm" | "md" | "lg" | "xl";

}



export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {

  useEffect(() => {

    if (open) document.body.style.overflow = "hidden";

    else document.body.style.overflow = "";

    return () => { document.body.style.overflow = ""; };

  }, [open]);



  if (!open) return null;



  const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" };



  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">

      <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] transition-opacity animate-modal-backdrop" onClick={onClose} />

      <div className={cn("relative bg-white rounded-2xl shadow-modal w-full animate-modal-panel border border-gray-200/50", sizes[size])}>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">

          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">

            <X className="h-5 w-5" />

          </button>

        </div>

        <div className="px-6 py-5">{children}</div>

      </div>

    </div>

  );

}



interface ConfirmDialogProps {

  open: boolean;

  onClose: () => void;

  onConfirm: () => void;

  title: string;

  message: string;

  confirmLabel?: string;

  loading?: boolean;

}



export function ConfirmDialog({

  open, onClose, onConfirm, title, message, confirmLabel = "Delete", loading,

}: ConfirmDialogProps) {

  return (

    <Modal open={open} onClose={onClose} title={title} size="sm">

      <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>

      <div className="flex justify-end gap-3">

        <Button variant="outline" onClick={onClose}>Cancel</Button>

        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>

      </div>

    </Modal>

  );

}

