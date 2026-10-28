import { notFound } from "next/navigation";
import { SectionReader } from "@/components/archive/section-reader";
import { getManualSections, getManualVersion } from "@/lib/manual";

export function generateStaticParams() {
  return getManualSections().map((section) => ({ id: section.id }));
}

export default async function ArchiveSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const section = getManualSections().find((s) => s.id === id);
  if (!section) notFound();
  return <SectionReader section={section} version={getManualVersion()} />;
}
