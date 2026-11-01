import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from "@aws-sdk/client-cognito-identity-provider";

const cognito = new CognitoIdentityProviderClient({ region: "eu-west-1" });

async function getEverupTokens() {
  const res = await cognito.send(
    new InitiateAuthCommand({
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: process.env.EVERUP_CLIENT_ID!,
      AuthParameters: {
        REFRESH_TOKEN: process.env.EVERUP_REFRESH_TOKEN!,
        DEVICE_KEY: process.env.EVERUP_DEVICE_KEY!,
      },
    })
  );
  return res.AuthenticationResult!;
}

type EverupApiBrand = {
  id: string;
  name: string;
  unavailable?: boolean;
  total_rewards_perc: number;
  valid_boost_factor?: number;
  boost_expiration?: string | null;
  detail?: {
    redemption_methods?: string[];
  };
};

export type EverupOffer = {
  app: "everup";
  brandId: string;
  name: string;
  cashbackPct: number;
  boosted: boolean;
  boostEndsAt: Date | null;
  online: boolean;
  instore: boolean;
};

export async function fetchEverupBrands(): Promise<EverupOffer[]> {
  const { AccessToken } = await getEverupTokens();

  const res = await fetch("https://api.everup.uk/v1/gift-card/brands", {
    headers: {
      token: AccessToken!,
      "eup-app-version": "1.7.5",
      "eup-app-build-number": "3301",
      "eup-app-platform": "2",
      "eup-timezone": "Europe/London",
      "user-agent": "everup/3301 CFNetwork/3860.700.2 Darwin/25.6.0",
      accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`EverUp brands failed: ${res.status}`);

  const brands = (await res.json()) as EverupApiBrand[] | { items: EverupApiBrand[] };
  const list = Array.isArray(brands) ? brands : brands.items;

  return list
    .filter((b) => !b.unavailable)
    .map((b) => ({
      app: "everup",
      brandId: b.id,
      name: b.name,
      cashbackPct: Math.round(b.total_rewards_perc * 10000) / 100,
      boosted: (b.valid_boost_factor ?? 0) > 0,
      boostEndsAt: b.boost_expiration ? new Date(b.boost_expiration) : null,
      online: b.detail?.redemption_methods?.includes("Online") ?? false,
      instore: b.detail?.redemption_methods?.includes("Instore") ?? false,
    }));
}