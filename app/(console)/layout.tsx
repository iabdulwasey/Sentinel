import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppShell } from "@/components/app-shell/app-shell";

export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const markets = await db.market.findMany({
    where: { deletedAt: null },
    orderBy: { country: "asc" },
    select: { code: true, country: true, cities: true },
  });

  return (
    <Suspense>
      <AppShell user={user} markets={markets.map((m) => ({ code: m.code, country: m.country, cities: (m.cities as string[]) ?? [] }))}>
        {children}
      </AppShell>
    </Suspense>
  );
}
