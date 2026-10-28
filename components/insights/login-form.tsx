"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/insights/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (res.ok) {
        router.refresh();
        return;
      }
      setError(res.status === 401 ? "Incorrect passcode." : "Could not sign in. Please try again.");
    } catch {
      setError("Could not sign in. Please try again.");
    }
    setBusy(false);
  };

  return (
    <div className="flex h-full items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="flex size-10 items-center justify-center rounded-full bg-secondary">
          <LockIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground">Enter the passcode to see how the assistant is being used.</p>
        </div>
        <Input
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Passcode"
          aria-label="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
        />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={busy || !passcode}>
          {busy ? "Checking…" : "Open Insights"}
        </Button>
      </form>
    </div>
  );
}
