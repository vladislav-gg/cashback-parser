import { fetchEverupBrands } from "../scrapers/everup";

async function main() {
  const brands = await fetchEverupBrands();
  console.log(`Got ${brands.length} brands`);
  console.table(
    brands
      .sort((a, b) => b.cashbackPct - a.cashbackPct)
      .slice(0, 15)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});