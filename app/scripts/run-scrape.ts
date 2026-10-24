import { runAllScrapers } from "../jobs/scrape";
import { pool } from "../db";

async function main() {
  await runAllScrapers();
  await pool.end(); 
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});