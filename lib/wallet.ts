import { privateKeyToAccount } from "viem/accounts";

export const account = privateKeyToAccount(
  process.env.PRIVATE_KEY as `0x${string}`,
);
