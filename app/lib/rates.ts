import { cacheLife } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { appBrands, brands, rates, scrapeRuns } from "../db/schema";

export type AppOffer = {
  app: string;
  cashbackPct: number;
  bestTierPct: number | null;
  boosted: boolean;
  boostEndsAt: string | null;
  online: boolean | null;
  instore: boolean | null;
};

export type RetailerRow = {
  key: string;
  name: string;
  offers: AppOffer[];
  bestCashbackPct: number;
  bestApp: string;
};

export type RatesData = {
  retailers: RetailerRow[];
  apps: string[];
  lastFetchedAt: string | null;
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function getLatestSuccessfulRunIds(): Promise<number[]> {
  const latestRunPerApp = await db
    .select({ runId: sql<number>`max(${scrapeRuns.id})`.mapWith(Number) })
    .from(scrapeRuns)
    .where(eq(scrapeRuns.ok, true))
    .groupBy(scrapeRuns.app);

  return latestRunPerApp.map((run) => run.runId);
}

export async function getLatestRates(): Promise<RatesData> {
  "use cache";
  cacheLife("minutes");

  const runIds = await getLatestSuccessfulRunIds();
  if (runIds.length === 0) {
    return { retailers: [], apps: [], lastFetchedAt: null };
  }

  const rateRecords = await db
    .select({
      app: appBrands.app,
      appBrandName: appBrands.name,
      canonicalBrandName: brands.name,
      cashbackPct: rates.cashbackPct,
      bestTierPct: rates.bestTierPct,
      boosted: rates.boosted,
      boostEndsAt: rates.boostEndsAt,
      online: rates.online,
      instore: rates.instore,
      fetchedAt: rates.fetchedAt,
    })
    .from(rates)
    .innerJoin(appBrands, eq(appBrands.id, rates.appBrandId))
    .leftJoin(brands, eq(brands.id, appBrands.brandId))
    .where(inArray(rates.runId, runIds));

  const retailersByKey = new Map<string, RetailerRow>();
  const apps = new Set<string>();
  let lastFetchedAtMs = 0;

  for (const record of rateRecords) {
    apps.add(record.app);
    lastFetchedAtMs = Math.max(lastFetchedAtMs, record.fetchedAt.getTime());

    const retailerName = record.canonicalBrandName ?? record.appBrandName;
    // Match retailers across apps by name; JamDoughnut isn't linked to `brands` yet.
    const retailerKey = normalizeName(retailerName);

    const offer: AppOffer = {
      app: record.app,
      cashbackPct: Number(record.cashbackPct),
      bestTierPct: record.bestTierPct === null ? null : Number(record.bestTierPct),
      boosted: record.boosted,
      boostEndsAt: record.boostEndsAt ? record.boostEndsAt.toISOString() : null,
      online: record.online,
      instore: record.instore,
    };

    const retailer = retailersByKey.get(retailerKey) ?? {
      key: retailerKey,
      name: retailerName,
      offers: [],
      bestCashbackPct: 0,
      bestApp: "",
    };
    retailer.offers.push(offer);
    retailersByKey.set(retailerKey, retailer);
  }

  const retailers = [...retailersByKey.values()].map((retailer) => {
    const bestOffer = retailer.offers.reduce((best, offer) =>
      offer.cashbackPct > best.cashbackPct ? offer : best
    );
    return {
      ...retailer,
      bestCashbackPct: bestOffer.cashbackPct,
      bestApp: bestOffer.app,
    };
  });
  retailers.sort((a, b) => b.bestCashbackPct - a.bestCashbackPct);

  return {
    retailers,
    apps: [...apps].sort(),
    lastFetchedAt: lastFetchedAtMs ? new Date(lastFetchedAtMs).toISOString() : null,
  };
}
