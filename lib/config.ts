/** Konfigurácia poplatkov za transakcie */
export const FEES = {
  enabled: false,
  rate: 0.01,
};

/** Konfigurácia simulácie */
export const SIMULATION = {
  minAmount: 5,
  maxAmount: 45,
  botUserIds: [
    "f168def6-0358-4117-9257-15c8984aadf5",
    "c7b34e02-c76e-4a0a-b94d-95365adf05d6",
  ],
};

/** Konfigurácia seedovania */
export const SEEDING = {
  seedOnStart: process.env.NEXT_PUBLIC_SEED_ON_START === "true",
};

/** Použite Edge Functions namiesto priamych zápisov do Supabase */
export const SUPABASE_WRITE_THROUGH = true;

/** Názov Edge funkcie pre market zápisy */
export const EDGE_MARKET_WRITE = "market-index";
