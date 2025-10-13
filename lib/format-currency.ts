export const formatCurrency = (amount: number | undefined, currencyCode: string = "USD") => {
  if (amount === undefined || amount === null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(amount);
};