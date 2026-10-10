import { INVENTED_LABEL } from "@/lib/sample";

export function InventedBadge() {
  return (
    <span className="inline-block self-start rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold tracking-wide text-amber-800">
      {INVENTED_LABEL}
    </span>
  );
}
