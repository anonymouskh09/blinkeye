"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy route — open the same Create Client slide-over as the Clients list. */
export default function NewClientPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/clients?create=1");
  }, [router]);

  return null;
}
