export function formatDateDdMmYyyy(
  dateValue?: string | number | Date | null
): string {
  if (dateValue === null || dateValue === undefined || dateValue === "") {
    return "---";
  }

  if (typeof dateValue === "string") {
    const trimmed = dateValue.trim();

    const matchedDate = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
    if (matchedDate) {
      return `${matchedDate[1]}-${matchedDate[2]}-${matchedDate[3]}`;
    }

    const parsedStringDate = new Date(trimmed);
    if (!Number.isNaN(parsedStringDate.getTime())) {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
        .format(parsedStringDate)
        .replace(/\//g, "-");
    }

    return "---";
  }

  const parsedDate =
    dateValue instanceof Date ? dateValue : new Date(dateValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return "---";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
    .format(parsedDate)
    .replace(/\//g, "-");
}
