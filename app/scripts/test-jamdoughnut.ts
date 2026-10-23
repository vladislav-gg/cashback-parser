import { fetchJamDoughnutBrands } from "../scrapers/jamdoughnut";

async function main() {
  const brands = await fetchJamDoughnutBrands();
  console.log(`Got ${brands.length} brands`);
  console.table(brands.sort((a, b) => b.cashbackPct - a.cashbackPct).slice(0, 15));
}

main().catch((e) => { console.error(e); process.exit(1); });