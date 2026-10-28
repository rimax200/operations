import { AppShell } from "@/components/app-shell";
import { getManualVersion } from "@/lib/manual";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell manualVersion={getManualVersion()}>{children}</AppShell>;
}
