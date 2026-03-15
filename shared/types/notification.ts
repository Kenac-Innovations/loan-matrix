export interface FineractNotification {
  id: number;
  objectType: string;
  objectId: number;
  action: string;
  actorId: number;
  content: string;
  isRead: boolean;
  isSystemGenerated: boolean;
  createdAt: string | number[];
  createdAtDate?: Date;
  tenantIdentifier?: string;
}

export interface NotificationsResponse {
  totalFilteredRecords: number;
  pageItems: FineractNotification[];
}

export interface NotificationState {
  notifications: FineractNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

export type NotificationCategory = 
  | "LOAN" 
  | "CLIENT" 
  | "DISBURSEMENT" 
  | "REPAYMENT" 
  | "SYSTEM" 
  | "OTHER";

export function getNotificationCategory(notification: FineractNotification): NotificationCategory {
  const objectType = notification.objectType?.toLowerCase() || "";
  const action = notification.action?.toLowerCase() || "";
  
  if (objectType.includes("loan") || action.includes("loan")) {
    if (action.includes("disburse")) return "DISBURSEMENT";
    if (action.includes("repayment") || action.includes("payment")) return "REPAYMENT";
    return "LOAN";
  }
  
  if (objectType.includes("client") || action.includes("client")) {
    return "CLIENT";
  }
  
  if (notification.isSystemGenerated) {
    return "SYSTEM";
  }
  
  return "OTHER";
}

export function formatNotificationDate(dateValue: string | number[]): string {
  let date: Date;
  
  if (Array.isArray(dateValue)) {
    // Fineract sometimes returns dates as arrays [year, month, day, hour, minute, second]
    const [year, month, day, hour = 0, minute = 0, second = 0] = dateValue;
    date = new Date(year, month - 1, day, hour, minute, second);
  } else {
    date = new Date(dateValue);
  }
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  
  return date.toLocaleDateString();
}
