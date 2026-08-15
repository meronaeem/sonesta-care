export const MEETING_TYPES = [
  { value: "daily_briefing", label: "Daily Briefing" },
  { value: "management_meeting", label: "Management Meeting" },
  { value: "department_meeting", label: "Department Meeting" },
  { value: "it_meeting", label: "IT Meeting" },
  { value: "emergency_meeting", label: "Emergency Meeting" },
  { value: "followup_meeting", label: "Follow-up Meeting" },
  { value: "other", label: "Other" },
] as const;

export const ALLOWED_TIMES = [
  { value: "30m", label: "30 Minutes", minutes: 30 },
  { value: "1h", label: "1 Hour", minutes: 60 },
  { value: "2h", label: "2 Hours", minutes: 120 },
  { value: "4h", label: "4 Hours", minutes: 240 },
  { value: "8h", label: "8 Hours", minutes: 480 },
  { value: "1d", label: "1 Day", minutes: 1440 },
  { value: "2d", label: "2 Days", minutes: 2880 },
  { value: "3d", label: "3 Days", minutes: 4320 },
  { value: "1w", label: "1 Week", minutes: 10080 },
  { value: "custom", label: "Custom", minutes: null },
] as const;

export const ACTION_STATUSES = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting", label: "Waiting" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export const REMINDER_OPTIONS = [
  { value: 60, label: "1 hour before deadline" },
  { value: 120, label: "2 hours before deadline" },
  { value: 1440, label: "1 day before deadline" },
];

export const STATUS_BADGE: Record<string, string> = {
  open: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  in_progress: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  waiting: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200",
  overdue: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
  cancelled: "bg-slate-100 text-slate-500 line-through dark:bg-slate-800",
};

export const PRIORITY_BADGE: Record<string, string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  medium: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  high: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

export function allowedMinutes(option: string, custom?: number | null): number {
  if (option === "custom") return custom && custom > 0 ? custom : 60;
  return ALLOWED_TIMES.find((a) => a.value === option)?.minutes ?? 1440;
}

export function computeDue(assignedIso: string, option: string, custom?: number | null): string {
  const base = new Date(assignedIso).getTime();
  return new Date(base + allowedMinutes(option, custom) * 60000).toISOString();
}

/** ISO string -> value for <input type="datetime-local"> in the user's local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string {
  return new Date(v).toISOString();
}

/** yyyy-mm-dd (local) -> ISO timestamp at end of that day. */
export function dueFromDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 0, 0).toISOString();
}

/** ISO timestamp -> yyyy-mm-dd in local time, for <input type="date">. */
export function dateFromDue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function allowedLabel(option: string, custom?: number | null): string {
  if (option === "custom") return custom ? `${custom} min` : "Custom";
  return ALLOWED_TIMES.find((a) => a.value === option)?.label ?? option;
}

/** Live status: an unfinished action point past its deadline reads as overdue. */
export function effectiveStatus(status: string, dueIso: string): string {
  if (["open", "in_progress", "waiting"].includes(status) && new Date(dueIso).getTime() < Date.now()) return "overdue";
  return status;
}
