"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Send, ListOrdered } from "lucide-react";
import PageWrapper from "@/components/layout/PageWrapper";
import Header from "@/components/layout/Header";
import Button from "@/components/ui/Button";
import GmailConnectCard from "@/components/outreach/GmailConnectCard";
import { CardSkeleton } from "@/components/ui/Skeleton";

export default function OutreachPage() {
  return (
    <PageWrapper>
      <Header
        title="Candidate Outreach"
        subtitle="Connect Gmail and run personalized email sequences to candidates"
        actions={
          <Link href="/outreach/sequences">
            <Button><ListOrdered className="h-4 w-4 mr-1.5" /> View Sequences</Button>
          </Link>
        }
      />

      <div className="space-y-6 max-w-4xl">
        <Suspense fallback={<CardSkeleton />}>
          <GmailConnectCard />
        </Suspense>

        <div className="content-panel p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary flex items-center justify-center">
              <Send className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Outreach sequences</h3>
              <p className="text-sm text-gray-500 mt-1">
                Build multi-step email sequences, enroll candidates, and track sent/failed logs.
                Each user sends from their own connected Gmail account.
              </p>
              <Link href="/outreach/sequences" className="inline-block mt-4">
                <Button variant="outline" size="sm">Go to Sequences</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
