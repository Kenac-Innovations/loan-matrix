export function parseInventoryFinanceDate(
  value: string | null,
  boundary: "start" | "end"
) {
  if (!value) return undefined;

  // The date picker represents a whole calendar day, not midnight only.
  const date = new Date(
    `${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`
  );

  return Number.isNaN(date.getTime()) ? undefined : date;
}
