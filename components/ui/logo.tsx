import Image from "next/image";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/brand";

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/images/logo.jpg"
      alt={APP_NAME}
      width={512}
      height={512}
      priority
      className={cn("max-w-none shrink-0 object-contain", className)}
    />
  );
}
