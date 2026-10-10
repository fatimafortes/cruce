import Link from "next/link";
import type { ReactNode } from "react";

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="bg-[#16365c] text-white">
      <div className="mx-auto flex max-w-md items-center justify-between px-5 py-4">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Cru<span className="text-sky-400">ce</span>
        </Link>
        {children}
      </div>
    </header>
  );
}
