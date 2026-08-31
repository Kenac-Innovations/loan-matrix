"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  Boxes,
  ClipboardList,
  Loader2,
  PackagePlus,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Option = {
  value: string;
  label: string;
};

type BranchOption = {
  id: number;
  name: string;
};

type InventoryConfig = {
  units: Option[];
  currencies: Option[];
  branches: BranchOption[];
};

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  unitOfMeasure: string;
  defaultUnitValue: string;
  currencyCode: string;
  isActive: boolean;
};

type InventoryBalance = {
  id: string;
  fineractOfficeId: number;
  fineractOfficeName: string | null;
  currencyCode: string;
  quantityOnHand: string;
  quantityReserved: string;
  availableQuantity: string;
  stockValue: string;
  updatedAt: string;
  item: {
    sku: string;
    name: string;
    unitOfMeasure: string;
  };
};

type InventoryMovement = {
  id: string;
  type: string;
  fineractOfficeId: number;
  fineractOfficeName: string | null;
  currencyCode: string;
  quantityDelta: string;
  valueDelta: string;
  reason: string | null;
  actorUserName: string | null;
  createdAt: string;
  item: {
    sku: string;
    name: string;
    unitOfMeasure: string;
  };
};

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function formatQuantity(value: string, unit: string) {
  return `${numberValue(value).toLocaleString()} ${unit}`;
}

function formatValue(value: string | number, currencyCode = "") {
  const amount = numberValue(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return currencyCode ? `${currencyCode} ${amount}` : amount;
}

export default function InventoryPage() {
  const [config, setConfig] = useState<InventoryConfig>({
    units: [],
    currencies: [],
    branches: [],
  });
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [balances, setBalances] = useState<InventoryBalance[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const [receivingStock, setReceivingStock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newItem, setNewItem] = useState({
    sku: "",
    name: "",
    unitOfMeasure: "bag",
    defaultUnitValue: "",
    currencyCode: "USD",
    description: "",
  });

  const [receipt, setReceipt] = useState({
    inventoryItemId: "",
    fineractOfficeId: "",
    fineractOfficeName: "",
    quantity: "",
    value: "",
    currencyCode: "USD",
    reason: "",
  });

  const selectedReceiptItem = useMemo(
    () => items.find((item) => item.id === receipt.inventoryItemId),
    [items, receipt.inventoryItemId]
  );

  const totals = useMemo(
    () =>
      balances.reduce(
        (summary, balance) => ({
          onHand: summary.onHand + numberValue(balance.quantityOnHand),
          reserved: summary.reserved + numberValue(balance.quantityReserved),
          value: summary.value + numberValue(balance.stockValue),
        }),
        { onHand: 0, reserved: 0, value: 0 }
      ),
    [balances]
  );

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [configResponse, itemsResponse, balancesResponse, movementsResponse] =
        await Promise.all([
        fetch("/api/inventory/config"),
        fetch("/api/inventory/items"),
        fetch("/api/inventory/balances"),
        fetch("/api/inventory/movements"),
      ]);

      if (
        !configResponse.ok ||
        !itemsResponse.ok ||
        !balancesResponse.ok ||
        !movementsResponse.ok
      ) {
        throw new Error("Inventory information could not be loaded.");
      }

      const [configData, itemsData, balancesData, movementsData] =
        await Promise.all([
          configResponse.json(),
          itemsResponse.json(),
          balancesResponse.json(),
          movementsResponse.json(),
        ]);

      setConfig(configData);
      setItems(itemsData);
      setBalances(balancesData);
      setMovements(movementsData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Inventory load failed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    const firstItem = items[0];
    const firstBranch = config.branches[0];
    const firstCurrency = config.currencies[0]?.value ?? "USD";
    const firstUnit = config.units[0]?.value ?? "bag";

    if (!newItem.unitOfMeasure) {
      setNewItem((current) => ({ ...current, unitOfMeasure: firstUnit }));
    }

    if (!newItem.currencyCode) {
      setNewItem((current) => ({ ...current, currencyCode: firstCurrency }));
    }

    if (firstItem) {
      setReceipt((current) => ({
        ...current,
        inventoryItemId: current.inventoryItemId || firstItem.id,
        currencyCode: current.currencyCode || firstItem.currencyCode || firstCurrency,
      }));
    }

    if (firstBranch) {
      setReceipt((current) => ({
        ...current,
        fineractOfficeId: current.fineractOfficeId || String(firstBranch.id),
        fineractOfficeName: current.fineractOfficeName || firstBranch.name,
      }));
    }
  }, [config.branches, config.currencies, config.units, items, newItem.currencyCode, newItem.unitOfMeasure]);

  useEffect(() => {
    if (!selectedReceiptItem || receipt.quantity === "") return;

    const quantity = numberValue(receipt.quantity);
    const unitValue = numberValue(selectedReceiptItem.defaultUnitValue);
    if (quantity > 0 && unitValue > 0) {
      setReceipt((current) => ({
        ...current,
        value: String(quantity * unitValue),
        currencyCode: selectedReceiptItem.currencyCode,
      }));
    }
  }, [receipt.quantity, selectedReceiptItem]);

  async function createItem() {
    setSavingItem(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not create the stock item.");
      }

      setNewItem({
        sku: "",
        name: "",
        unitOfMeasure: config.units[0]?.value ?? "bag",
        defaultUnitValue: "",
        currencyCode: config.currencies[0]?.value ?? "USD",
        description: "",
      });
      setSuccess("Stock item created.");
      await loadInventory();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Stock item failed.");
    } finally {
      setSavingItem(false);
    }
  }

  async function receiveStock() {
    setReceivingStock(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/inventory/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receipt),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error ?? "Could not receive stock.");
      }

      setReceipt((current) => ({
        ...current,
        quantity: "",
        value: "",
        reason: "",
      }));
      setSuccess("Stock received into branch inventory.");
      await loadInventory();
    } catch (receiveError) {
      setError(receiveError instanceof Error ? receiveError.message : "Stock receipt failed.");
    } finally {
      setReceivingStock(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Inventory Control</h1>
          <p className="text-sm text-muted-foreground">
            Manage ARDA stock items, branch receipts, balances, and movement history.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/inventory/finances">
              <Banknote className="mr-2 h-4 w-4" />
              Inventory Finances
            </Link>
          </Button>
          <Button onClick={loadInventory} variant="outline" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-200">
          {success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Boxes className="h-4 w-4 text-blue-400" />
              Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{items.length}</div>
            <p className="text-sm text-muted-foreground">Catalogue records</p>
          </CardContent>
        </Card>
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Quantity On Hand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">
              {totals.onHand.toLocaleString()}
            </div>
            <p className="text-sm text-muted-foreground">
              {totals.reserved.toLocaleString()} reserved
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Stock Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{formatValue(totals.value)}</div>
            <p className="text-sm text-muted-foreground">Local inventory value</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Plus className="h-5 w-5 text-blue-400" />
              Create Stock Item
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Stock Code</Label>
                <Input
                  value={newItem.sku}
                  onChange={(event) =>
                    setNewItem((current) => ({ ...current, sku: event.target.value }))
                  }
                  placeholder="MAIZE-SEED-10KG"
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newItem.name}
                  onChange={(event) =>
                    setNewItem((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Maize Seed 10kg"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={newItem.unitOfMeasure}
                  onValueChange={(value) =>
                    setNewItem((current) => ({ ...current, unitOfMeasure: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {config.units.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={newItem.currencyCode}
                  onValueChange={(value) =>
                    setNewItem((current) => ({ ...current, currencyCode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {config.currencies.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.value} - {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Agreed Unit Value</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newItem.defaultUnitValue}
                  onChange={(event) =>
                    setNewItem((current) => ({
                      ...current,
                      defaultUnitValue: event.target.value,
                    }))
                  }
                  placeholder="25.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newItem.description}
                onChange={(event) =>
                  setNewItem((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional notes about this item"
              />
            </div>
            <Button onClick={createItem} disabled={savingItem} className="w-full">
              {savingItem ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Stock Item
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-[#1d2838]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <PackagePlus className="h-5 w-5 text-green-400" />
              Receive Stock
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Stock Item</Label>
                <Select
                  value={receipt.inventoryItemId}
                  onValueChange={(value) =>
                    setReceipt((current) => ({ ...current, inventoryItemId: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stock item" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.sku})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Branch</Label>
                <Select
                  value={receipt.fineractOfficeId}
                  onValueChange={(value) => {
                    const branch = config.branches.find(
                      (option) => String(option.id) === value
                    );
                    setReceipt((current) => ({
                      ...current,
                      fineractOfficeId: value,
                      fineractOfficeName: branch?.name ?? "",
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {config.branches.map((branch) => (
                      <SelectItem key={branch.id} value={String(branch.id)}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select
                  value={receipt.currencyCode}
                  onValueChange={(value) =>
                    setReceipt((current) => ({ ...current, currencyCode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    {config.currencies.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={receipt.quantity}
                  onChange={(event) =>
                    setReceipt((current) => ({ ...current, quantity: event.target.value }))
                  }
                  placeholder="100"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Total Value</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={receipt.value}
                  onChange={(event) =>
                    setReceipt((current) => ({ ...current, value: event.target.value }))
                  }
                  placeholder="2500"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea
                value={receipt.reason}
                onChange={(event) =>
                  setReceipt((current) => ({ ...current, reason: event.target.value }))
                }
                placeholder="Supplier delivery, stock correction, or branch opening stock"
              />
            </div>
            <Button
              onClick={receiveStock}
              disabled={receivingStock || items.length === 0 || config.branches.length === 0}
              className="w-full"
            >
              {receivingStock ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Receive Stock
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-[#1d2838]">
        <CardHeader>
          <CardTitle className="text-white">Branch Stock Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-muted-foreground">
                <tr>
                  <th className="py-3">Branch</th>
                  <th>Item</th>
                  <th>On Hand</th>
                  <th>Reserved</th>
                  <th>Available</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      Loading inventory...
                    </td>
                  </tr>
                ) : balances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      No branch stock balances yet.
                    </td>
                  </tr>
                ) : (
                  balances.map((balance) => (
                    <tr key={balance.id} className="border-b border-white/5">
                      <td className="py-3">
                        {balance.fineractOfficeName || `Office ${balance.fineractOfficeId}`}
                      </td>
                      <td>
                        <div className="font-medium text-white">{balance.item.name}</div>
                        <div className="text-xs text-muted-foreground">{balance.item.sku}</div>
                      </td>
                      <td>{formatQuantity(balance.quantityOnHand, balance.item.unitOfMeasure)}</td>
                      <td>{formatQuantity(balance.quantityReserved, balance.item.unitOfMeasure)}</td>
                      <td>{formatQuantity(balance.availableQuantity, balance.item.unitOfMeasure)}</td>
                      <td>{formatValue(balance.stockValue, balance.currencyCode)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1d2838]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ClipboardList className="h-5 w-5 text-blue-400" />
            Movement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-muted-foreground">
                <tr>
                  <th className="py-3">Date</th>
                  <th>Type</th>
                  <th>Branch</th>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Value</th>
                  <th>By</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
                      No inventory movements have been recorded yet.
                    </td>
                  </tr>
                ) : (
                  movements.map((movement) => (
                    <tr key={movement.id} className="border-b border-white/5">
                      <td className="py-3">
                        {new Date(movement.createdAt).toLocaleString()}
                      </td>
                      <td>{movement.type.replace(/_/g, " ")}</td>
                      <td>{movement.fineractOfficeName || `Office ${movement.fineractOfficeId}`}</td>
                      <td>
                        <div className="font-medium text-white">{movement.item.name}</div>
                        <div className="text-xs text-muted-foreground">{movement.item.sku}</div>
                      </td>
                      <td>{formatQuantity(movement.quantityDelta, movement.item.unitOfMeasure)}</td>
                      <td>{formatValue(movement.valueDelta, movement.currencyCode)}</td>
                      <td>{movement.actorUserName || "System"}</td>
                      <td className="max-w-xs truncate">{movement.reason || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
