export const INVENTORY_UNITS = [
  { value: "bag", label: "Bag" },
  { value: "kg", label: "Kilogram" },
  { value: "tonne", label: "Tonne" },
  { value: "litre", label: "Litre" },
  { value: "box", label: "Box" },
  { value: "unit", label: "Unit" },
] as const;

export const INVENTORY_CURRENCIES = [
  { value: "USD", label: "United States Dollar" },
  { value: "ZMW", label: "Zambian Kwacha" },
  { value: "ZWL", label: "Zimbabwe Dollar" },
] as const;

export type InventoryBranchOption = {
  id: number;
  name: string;
};

export function normalizeInventoryBranches(offices: unknown): InventoryBranchOption[] {
  if (!Array.isArray(offices)) return [];

  return offices
    .map((office) => {
      const value = office as Record<string, unknown>;
      const id = Number(value.id);
      const name = String(value.name ?? "").trim();

      return Number.isInteger(id) && id > 0 && name ? { id, name } : null;
    })
    .filter((office): office is InventoryBranchOption => office !== null)
    .sort((left, right) => left.name.localeCompare(right.name));
}
