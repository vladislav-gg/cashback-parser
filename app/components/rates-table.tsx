"use client";

import { useMemo, useState } from "react";
import type { AppOffer, RatesData, RetailerRow } from "../lib/rates";

const APP_DISPLAY_NAMES: Record<string, string> = {
  everup: "Everup",
  jamdoughnut: "Jam Doughnut",
  cheddar: "Cheddar",
};

type SortOrder = "highestRate" | "name";

function appDisplayName(app: string): string {
  return APP_DISPLAY_NAMES[app] ?? app;
}

function formatPercent(value: number): string {
  return `${parseFloat(value.toFixed(2))}%`;
}

function formatRedemptionMethods(offer: AppOffer): string {
  const methods: string[] = [];
  if (offer.online) methods.push("online");
  if (offer.instore) methods.push("in-store");
  return methods.join(" · ");
}

function OfferCell({ offer, isBestOffer }: { offer: AppOffer; isBestOffer: boolean }) {
  const hasHigherTier = offer.bestTierPct !== null && offer.bestTierPct > offer.cashbackPct;

  return (
    <td className="px-4 py-3">
      <span
        className={
          isBestOffer
            ? "rounded-md bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400"
            : "font-medium"
        }
      >
        {formatPercent(offer.cashbackPct)}
      </span>
      {hasHigherTier && (
        <span className="ml-2 text-xs text-foreground/50">
          up to {formatPercent(offer.bestTierPct!)}
        </span>
      )}
      {offer.boosted && (
        <span
          title={
            offer.boostEndsAt
              ? `Ends ${new Date(offer.boostEndsAt).toLocaleDateString()}`
              : undefined
          }
          className="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400"
        >
          Boosted
        </span>
      )}
      <div className="mt-0.5 text-xs text-foreground/50">{formatRedemptionMethods(offer)}</div>
    </td>
  );
}

function RetailerTableRow({ retailer, apps }: { retailer: RetailerRow; apps: string[] }) {
  const isOnMultipleApps = retailer.offers.length > 1;

  return (
    <tr className="border-t border-foreground/10">
      <td className="px-4 py-3 font-medium">{retailer.name}</td>
      {apps.map((app) => {
        const offer = retailer.offers.find((candidate) => candidate.app === app);
        if (!offer) {
          return (
            <td key={app} className="px-4 py-3 text-foreground/30">
              —
            </td>
          );
        }
        const isBestOffer = isOnMultipleApps && offer.cashbackPct === retailer.bestCashbackPct;
        return <OfferCell key={app} offer={offer} isBestOffer={isBestOffer} />;
      })}
    </tr>
  );
}

export function RatesTable({ retailers, apps }: Pick<RatesData, "retailers" | "apps">) {
  const [searchText, setSearchText] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("highestRate");
  const [showBoostedOnly, setShowBoostedOnly] = useState(false);
  const [showMultiAppOnly, setShowMultiAppOnly] = useState(false);

  const visibleRetailers = useMemo(() => {
    const searchTerm = searchText.trim().toLowerCase();

    const matching = retailers.filter((retailer) => {
      const matchesSearch = !searchTerm || retailer.name.toLowerCase().includes(searchTerm);
      const matchesBoosted = !showBoostedOnly || retailer.offers.some((offer) => offer.boosted);
      const matchesMultiApp = !showMultiAppOnly || retailer.offers.length > 1;
      return matchesSearch && matchesBoosted && matchesMultiApp;
    });

    if (sortOrder === "name") {
      matching.sort((a, b) => a.name.localeCompare(b.name));
    }
    return matching;
  }, [retailers, searchText, sortOrder, showBoostedOnly, showMultiAppOnly]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="Search retailers…"
          className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40 sm:max-w-xs"
        />
        <select
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          className="rounded-lg border border-foreground/15 bg-background px-3 py-2 text-sm"
        >
          <option value="highestRate">Highest rate</option>
          <option value="name">Name A–Z</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showBoostedOnly}
            onChange={(event) => setShowBoostedOnly(event.target.checked)}
          />
          Boosted only
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showMultiAppOnly}
            onChange={(event) => setShowMultiAppOnly(event.target.checked)}
          />
          On multiple apps
        </label>
        <span className="ml-auto text-sm text-foreground/60">
          {visibleRetailers.length} retailers
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-foreground/[.04] text-left text-xs uppercase tracking-wide text-foreground/60">
            <tr>
              <th className="px-4 py-3 font-medium">Retailer</th>
              {apps.map((app) => (
                <th key={app} className="px-4 py-3 font-medium">
                  {appDisplayName(app)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRetailers.map((retailer) => (
              <RetailerTableRow key={retailer.key} retailer={retailer} apps={apps} />
            ))}
            {visibleRetailers.length === 0 && (
              <tr>
                <td
                  colSpan={apps.length + 1}
                  className="px-4 py-10 text-center text-foreground/50"
                >
                  No retailers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
