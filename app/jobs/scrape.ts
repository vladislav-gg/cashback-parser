import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { appBrands, brands, rates, scrapeRuns } from "../db/schema";
import { fetchEverupBrands } from "../scrapers/everup";
import { fetchJamDoughnutBrands } from "../scrapers/jamdoughnut";
import { fetchCheddarBrands } from "../scrapers/cheddar";

type Scraped = {
  app: string;
  brandId?: string | null;
  name?: string | null;
  cashbackPct: number;
  bestTierPct?: number | null;
  boosted: boolean;
  boostEndsAt?: Date | null;
  online?: boolean;
  instore?: boolean;
};

const SCRAPERS: Record<string, () => Promise<Scraped[]>> = {
  everup: fetchEverupBrands,
  jamdoughnut: fetchJamDoughnutBrands,
  cheddar: fetchCheddarBrands,
};

const TILLO_SLUG_APPS = ["everup", "cheddar"];

const pct = (n?: number | null) => (n == null || isNaN(n) ? null : n.toFixed(2));
const validDate = (d?: Date | null) => (d && !isNaN(d.getTime()) ? d : null);

async function runOne(app: string, scrape: () => Promise<Scraped[]>) {
  const [{ id: runId }] = await db
    .insert(scrapeRuns)
    .values({ app, startedAt: new Date() })
    .$returningId();

  try {
    const rows = (await scrape()).filter((r) => r.brandId && r.name);
    const now = new Date();

    // 1. Make sure every brand this app returned exists in app_brands
    await db
      .insert(appBrands)
      .values(rows.map((r) => ({ app, appBrandId: r.brandId!, name: r.name! })))
      .onDuplicateKeyUpdate({ set: { name: sql`values(${appBrands.name})` } });

    // 2. Auto-link Tillo-slug apps to a shared brand
    if (TILLO_SLUG_APPS.includes(app)) {
      await db
        .insert(brands)
        .values(rows.map((r) => ({ slug: r.brandId!, name: r.name! })))
        .onDuplicateKeyUpdate({ set: { slug: sql`slug` } }); 

      await db.execute(sql`
        UPDATE app_brands ab
        JOIN brands b ON b.slug = ab.app_brand_id
        SET ab.brand_id = b.id
        WHERE ab.app = ${app} AND ab.brand_id IS NULL
      `);
    }

    // 3. Map this app's brand IDs to app_brands row IDs
    const existing = await db
      .select({ id: appBrands.id, appBrandId: appBrands.appBrandId })
      .from(appBrands)
      .where(eq(appBrands.app, app));
    const idMap = new Map(existing.map((e) => [e.appBrandId, e.id]));

    // 4. Save this run's rates (in chunks to keep queries small)
    const rateRows = rows.map((r) => ({
      runId,
      appBrandId: idMap.get(r.brandId!)!,
      cashbackPct: pct(r.cashbackPct)!,
      bestTierPct: pct(r.bestTierPct),
      boosted: r.boosted,
      boostEndsAt: validDate(r.boostEndsAt),
      online: r.online ?? null,
      instore: r.instore ?? null,
      fetchedAt: now,
    }));
    for (let i = 0; i < rateRows.length; i += 500) {
      await db.insert(rates).values(rateRows.slice(i, i + 500));
    }

    await db
      .update(scrapeRuns)
      .set({ ok: true, finishedAt: new Date(), brandCount: rows.length })
      .where(eq(scrapeRuns.id, runId));
    console.log(`${app}: saved ${rows.length} rates`);
  } catch (err: any) {
    await db
      .update(scrapeRuns)
      .set({ ok: false, finishedAt: new Date(), error: String(err?.message ?? err) })
      .where(eq(scrapeRuns.id, runId));
    console.error(`${app}: ${err?.message ?? err}`);
  }
}

export async function runAllScrapers() {
  for (const [app, scrape] of Object.entries(SCRAPERS)) {
    await runOne(app, scrape); // one failing app doesn't stop the others
  }
}