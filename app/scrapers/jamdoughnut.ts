const BASE = "https://backend.jamdoughnut.com/api/v5/search";

function jdHeaders() {
  return {
    "access-token": process.env.JD_ACCESS_TOKEN!,
    client: process.env.JD_CLIENT!,
    uid: process.env.JD_UID!,
    "app-version": "1210",
    "app-version-semver": "12.1.0",
    "device-type": "ios_app",
    "user-agent": "JamDoughnut/4 CFNetwork/3860.700.2 Darwin/25.6.0",
    accept: "*/*",
    "accept-language": "en-GB,en;q=0.9",
  };
}

export async function fetchJamDoughnutBrands() {
  const items: any[] = [];
  let total = Infinity;

  for (let page = 1; page <= 50 && items.length < total; page++) {
    const res = await fetch(`${BASE}?page=${page}&sort_by=a_z_asc`, {
      headers: jdHeaders(),
    });
    if (!res.ok) throw new Error(`JamDoughnut page ${page} failed: ${res.status}`);

    const data = await res.json();
    total = data.all_items_count ?? 0;
    if (!data.all_items?.length) break; // no more pages
    items.push(...data.all_items);
  }

  return items.map((b) => ({
    app: "jamdoughnut",
    brandId: b.slug,
    tilloId: b.gift_card_id,
    name: b.name,
    cashbackPct: b.highest_discount,      // already a percentage
    cardCashbackPct: b.pumped_up?.card_discount ?? null,
    boosted: !!b.pumped_up,
    boostEndsAt: b.pumped_up?.ends_at ? new Date(b.pumped_up.ends_at * 1000) : null,
    online: b.redemption_methods.includes("Online"),
    instore: b.redemption_methods.includes("Instore"),
  }));
}