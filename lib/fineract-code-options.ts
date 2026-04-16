import { fetchFineractAPI } from "@/lib/api";

export type FineractCodeOption = {
  id: number;
  name: string;
  description: string | null;
};

async function fetchCodeValuesByName(
  codeName: string
): Promise<FineractCodeOption[]> {
  const codesResponse = await fetchFineractAPI("/codes");
  const codes = Array.isArray(codesResponse)
    ? codesResponse
    : codesResponse?.data || codesResponse || [];

  const code = codes.find(
    (c: { name?: string }) => c.name?.toLowerCase() === codeName.toLowerCase()
  );

  if (!code?.id) {
    return [];
  }

  const data = await fetchFineractAPI(`/codes/${code.id}/codevalues`);
  const codeValues = Array.isArray(data) ? data : data?.data || [];

  return codeValues
    .filter((cv: { active?: boolean; isActive?: boolean }) => {
      if ("active" in cv && cv.active === false) return false;
      if ("isActive" in cv && cv.isActive === false) return false;
      return true;
    })
    .map((cv: { id: number; name: string; description?: string }) => ({
      id: cv.id,
      name: cv.name,
      description: cv.description ?? null,
    }));
}

export async function getPepStatusOptions(): Promise<FineractCodeOption[]> {
  return fetchCodeValuesByName("PEP_STATUS");
}

export async function getControlStructureDeclarationOptions(): Promise<
  FineractCodeOption[]
> {
  return fetchCodeValuesByName("CONTROL_STRUCTURE_DECLARATION");
}
