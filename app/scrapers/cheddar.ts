// --- minimal protobuf reader (no schema needed) ---
type Fields = Map<number, any[]>;

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0, shift = 0, b: number;
  do {
    b = buf[pos++];
    result += (b & 0x7f) * 2 ** shift;
    shift += 7;
  } while (b & 0x80);
  return [result, pos];
}

function decode(buf: Uint8Array): Fields {
  const out: Fields = new Map();
  let pos = 0;
  while (pos < buf.length) {
    let tag: number;
    [tag, pos] = readVarint(buf, pos);
    const field = Math.floor(tag / 8), wireType = tag % 8;
    let val: any;
    if (wireType === 0) [val, pos] = readVarint(buf, pos);
    else if (wireType === 2) {
      let len: number;
      [len, pos] = readVarint(buf, pos);
      val = buf.subarray(pos, pos + len);
      pos += len;
    } else if (wireType === 1) { val = buf.subarray(pos, pos + 8); pos += 8; }
    else if (wireType === 5) { val = buf.subarray(pos, pos + 4); pos += 4; }
    else throw new Error(`Unsupported wire type ${wireType}`);
    if (!out.has(field)) out.set(field, []);
    out.get(field)!.push(val);
  }
  return out;
}

const td = new TextDecoder();
const str = (b?: Uint8Array) => (b ? td.decode(b) : undefined);
const first = (m: Fields, f: number) => m.get(f)?.[0];

// --- scraper ---
export async function fetchCheddarBrands() {
  const res = await fetch(
    "https://mobileapi.chddr.net/twirp/cheddar.mobile_api.Cheddar/ListOffersV2",
    {
      method: "POST",
      body: new Uint8Array(0),
      headers: {
        authorization: `Bearer ${process.env.CHEDDAR_TOKEN}`,
        "content-type": "application/protobuf",
        "x-cheddar-build": "277",
        "x-cheddar-version": "3.10.6",
        "x-platform": "ios",
        "x-platform-version": "26.6.2",
        "x-device-id": process.env.CHEDDAR_DEVICE_ID!,
        "x-device-info": "iPhone%20iPhone",
        "user-agent": "cheddar-ios/3.10.6+277/ios 26.6.2",
        mutating_request: "false",
      },
    }
  );
  if (!res.ok) throw new Error(`Cheddar failed: ${res.status} ${await res.text()}`);

  const top = decode(new Uint8Array(await res.arrayBuffer()));

  // Categories (field 2): find the "boosted" one and its offer IDs (field 8)
  const boostedIds = new Set<string>();
  for (const catBytes of top.get(2) ?? []) {
    const cat = decode(catBytes);
    if (str(first(cat, 4)) === "boosted") {
      for (const id of cat.get(8) ?? []) boostedIds.add(str(id)!);
    }
  }

  // Offers (field 3), gift card offers are wrapped in sub-field 2
  const results = [];
  for (const wrapperBytes of top.get(3) ?? []) {
    const offerBytes = first(decode(wrapperBytes), 2);
    if (!offerBytes) continue; // not a gift card offer
    const o = decode(offerBytes);

    const id = str(first(o, 1))!;
    const rateMsg = first(o, 5);
    const cashbackPct = rateMsg ? parseFloat(str(first(decode(rateMsg), 1)) ?? "0") : 0;

    const tierRates = (o.get(27) ?? [])
      .map((t: Uint8Array) => first(decode(t), 2))
      .filter(Boolean)
      .map((m: Uint8Array) => parseFloat(str(first(decode(m), 1)) ?? "0"));

    const methods = Array.from((first(o, 10) as Uint8Array) ?? []); // 1 = in-store, 2 = online

    results.push({
      app: "cheddar",
      brandId: str(first(o, 18)) ?? str(first(o, 16)), // Tillo slug, matches EverUp ids
      name: str(first(o, 21)) ?? str(first(o, 2)),
      cashbackPct,
      bestTierPct: tierRates.length ? Math.max(...tierRates) : null,
      boosted: boostedIds.has(id),
      supplier: str(first(o, 17)),
      online: methods.includes(2),
      instore: methods.includes(1),
    });
  }
  return results;
}