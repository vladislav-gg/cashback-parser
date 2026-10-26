import {runAllScrapers} from "../jobs/scrape";
import {pool} from "../db";
import nodeCron from "node-cron";

async function main() {
  await runAllScrapers();
}

nodeCron.schedule("0 9 * * *", async () => {
  console.log("Running scheduled scrapers...");
  try {
    await main();
    console.log("Scheduled scrapers completed successfully.");
  } catch (error) {
    console.error("Error running scheduled scrapers:", error);
  }
});