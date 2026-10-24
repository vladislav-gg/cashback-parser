import { Suspense } from "react";
import { getLatestRates } from "./lib/rates";
import { RatesTable } from "./components/rates-table";

async function LatestRates() {
  const { retailers, apps, lastFetchedAt } = await getLatestRates();

  return (
    <>
      <p className="text-sm text-foreground/60">
        {lastFetchedAt ? `Updated ${new Date(lastFetchedAt).toUTCString()}` : "No data yet"}
      </p>
      <RatesTable retailers={retailers} apps={apps} />
    </>
  );
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Cashback rates</h1>
      <Suspense fallback={<p className="text-sm text-foreground/60">Loading rates…</p>}>
        <LatestRates />
      </Suspense>
    </main>
  );
}
