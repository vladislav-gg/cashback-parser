import {
  mysqlTable, int, bigint, varchar, decimal, boolean,
  datetime, text, uniqueIndex, index,
} from "drizzle-orm/mysql-core";

export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(), 
  name: varchar("name", { length: 255 }).notNull(),
});

export const appBrands = mysqlTable(
  "app_brands",
  {
    id: int("id").autoincrement().primaryKey(),
    app: varchar("app", { length: 32 }).notNull(), 
    appBrandId: varchar("app_brand_id", { length: 128 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    brandId: int("brand_id").references(() => brands.id), 
  },
  (t) => [uniqueIndex("app_brand_uq").on(t.app, t.appBrandId)]
);

export const scrapeRuns = mysqlTable("scrape_runs", {
  id: int("id").autoincrement().primaryKey(),
  app: varchar("app", { length: 32 }).notNull(),
  startedAt: datetime("started_at").notNull(),
  finishedAt: datetime("finished_at"),
  ok: boolean("ok").notNull().default(false),
  brandCount: int("brand_count"),
  error: text("error"),
});

export const rates = mysqlTable(
  "rates",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    runId: int("run_id").notNull().references(() => scrapeRuns.id),
    appBrandId: int("app_brand_id").notNull().references(() => appBrands.id),
    cashbackPct: decimal("cashback_pct", { precision: 5, scale: 2 }).notNull(),
    bestTierPct: decimal("best_tier_pct", { precision: 5, scale: 2 }),
    boosted: boolean("boosted").notNull().default(false),
    boostEndsAt: datetime("boost_ends_at"),
    online: boolean("online"),
    instore: boolean("instore"),
    fetchedAt: datetime("fetched_at").notNull(),
  },
  (t) => [index("rates_brand_time").on(t.appBrandId, t.fetchedAt)]
);