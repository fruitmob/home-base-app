import { db } from "@/lib/db";

export async function checkFlag(key: string): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });
  return flag?.enabled ?? false;
}

export async function loadFlagMap(keys: string[]): Promise<Record<string, boolean>> {
  if (keys.length === 0) return {};

  const flags = await db.featureFlag.findMany({
    where: { key: { in: keys } },
    select: { key: true, enabled: true },
  });

  return Object.fromEntries(flags.map((f) => [f.key, f.enabled]));
}
