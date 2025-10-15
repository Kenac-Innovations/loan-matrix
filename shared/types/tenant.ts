export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  domain?: string | null;
  settings?: any;
}
