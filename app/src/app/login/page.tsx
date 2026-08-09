"use client";

// Page to test google oauth

import LoginWithGoogle from "@/lib/components/GoogleLogin";
import { supabase } from "@/lib/supabase/client";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      console.log('Update', event, session);
    });
  }, []);

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main>
        <LoginWithGoogle />
      </main>
    </div>
  );
}