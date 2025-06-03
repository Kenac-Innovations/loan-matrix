export interface LeadLocalStorageData {
  leadId: string;
  formData: Record<string, any>;
  timestamp: number;
  step: "lead" | "client";
}

export class LeadLocalStorage {
  private static readonly STORAGE_KEY = "loan_matrix_lead_draft";

  static save(data: LeadLocalStorageData): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save lead data to localStorage:", error);
    }
  }

  static load(): LeadLocalStorageData | null {
    if (typeof window === "undefined") return null;

    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;

      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to load lead data from localStorage:", error);
      return null;
    }
  }

  static clear(): void {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error("Failed to clear lead data from localStorage:", error);
    }
  }

  static exists(): boolean {
    if (typeof window === "undefined") return false;

    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data !== null;
    } catch (error) {
      console.error("Failed to check lead data in localStorage:", error);
      return false;
    }
  }

  static getLeadId(): string | null {
    const data = this.load();
    return data?.leadId || null;
  }

  static isExpired(maxAgeHours: number = 24): boolean {
    const data = this.load();
    if (!data) return true;

    const now = Date.now();
    const ageHours = (now - data.timestamp) / (1000 * 60 * 60);

    return ageHours > maxAgeHours;
  }
}
