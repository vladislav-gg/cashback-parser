import { fetchCheddarBrands } from "../scrapers/cheddar";

async function main() {
  const brands = await fetchCheddarBrands();
  console.log(`Got ${brands.length} brands`);
  console.table(brands.sort((a, b) => b.cashbackPct - a.cashbackPct).slice(0, 15));
}

main().catch((e) => { console.error(e); process.exit(1); });