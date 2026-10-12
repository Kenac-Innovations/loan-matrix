export function buildJournalEntriesEndpoint(
  searchParams: URLSearchParams
): string {
  const query = searchParams.toString();

  if (!query) {
    return "/journalentries";
  }

  return `/journalentries?${query}`;
}
