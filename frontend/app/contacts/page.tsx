"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Contact, Users } from "lucide-react";
import toast from "react-hot-toast";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Input from "@/components/ui/Input";
import { TableWrapper, Th, Td, Tr } from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useRequireRole } from "@/hooks/useAuth";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ApiResponse, ContactGuestItem } from "@/types";

type Tab = "contacts" | "guests";

export default function ContactsPage() {
  useRequireRole("admin");
  const [tab, setTab] = useState<Tab>("contacts");
  const [contacts, setContacts] = useState<ContactGuestItem[]>([]);
  const [guests, setGuests] = useState<ContactGuestItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<ApiResponse<{ contacts: ContactGuestItem[]; guests: ContactGuestItem[] }>>(
        "/recruitment/contacts-guests",
        { params: search ? { search } : {} },
      );
      setContacts(res.data.data.contacts);
      setGuests(res.data.data.guests);
    } catch {
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "contacts", label: "Contacts", count: contacts.length },
    { id: "guests", label: "Guests", count: guests.length },
  ];

  const items = tab === "contacts" ? contacts : guests;

  return (
    <PageWrapper>
      <Header title="Contacts and Guests" subtitle="All client contacts and guest users" />

      <div className="content-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 border-b border-gray-100">
        <div className="flex gap-1 bg-gray-100/80 p-1 rounded-xl w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900",
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        </div>

        <div className="p-5">
          {loading ? <TableSkeleton rows={8} cols={5} /> : !items.length ? (
            <EmptyState
              title={tab === "contacts" ? "No contacts found" : "No guests found"}
              description="Add contacts and guests from client profiles."
              icon={tab === "contacts" ? <Contact className="w-8 h-8" /> : <Users className="w-8 h-8" />}
            />
          ) : (
            <TableWrapper>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  {tab === "contacts" && <Th>Phone</Th>}
                  {tab === "contacts" && <Th>Title</Th>}
                  <Th>Client</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <Tr key={item.id}>
                    <Td className="font-medium">{item.name}</Td>
                    <Td>{item.email || "—"}</Td>
                    {tab === "contacts" && <Td>{item.phone || "—"}</Td>}
                    {tab === "contacts" && <Td>{item.title || "—"}</Td>}
                    <Td>
                      <Link href={`/clients/${item.client_id}`} className="text-primary hover:underline">
                        {item.client_name || `Client #${item.client_id}`}
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </TableWrapper>
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
