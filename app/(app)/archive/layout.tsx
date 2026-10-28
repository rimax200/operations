import { ArchiveShell } from "@/components/archive/archive-shell";
import { getManualSections } from "@/lib/manual";

export const metadata = { title: "Manual Archive" };

export default function ArchiveLayout({ children }: { children: React.ReactNode }) {
  return <ArchiveShell sections={getManualSections()}>{children}</ArchiveShell>;
}
