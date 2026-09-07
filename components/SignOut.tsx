"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOut() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <button
      onClick={async () => {
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="rounded-md px-2.5 py-1.5 text-sm text-ink-soft transition-colors hover:text-signal"
    >
      Sign out
    </button>
  );
}
