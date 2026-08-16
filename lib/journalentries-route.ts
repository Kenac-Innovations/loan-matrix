import { buildJournalEntriesEndpoint } from "./journalentries-endpoint";

type JournalEntriesFetcher = (endpoint: string) => Promise<unknown>;

export async function getJournalEntriesData(
  request: Request,
  fetchJournalEntries: JournalEntriesFetcher
): Promise<unknown> {
  const { searchParams } = new URL(request.url);
  return fetchJournalEntries(buildJournalEntriesEndpoint(searchParams));
}
