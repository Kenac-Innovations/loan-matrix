export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-ZM", {
    style: "currency",
    currency: "ZMW",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
};