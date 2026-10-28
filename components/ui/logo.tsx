import Image from "next/image";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo.png"
      alt={APP_NAME}
      width={444}
      height={383}
      priority
      className={cn("max-w-none shrink-0 object-contain", className)}
    />
  );
}
