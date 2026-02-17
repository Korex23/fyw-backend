export const EVENT_DAYS = [
  { key: "MONDAY", label: "Monday - Corporate Day" },
  { key: "TUESDAY", label: "Tuesday - Denim Day" },
  { key: "WEDNESDAY", label: "Wednesday - Costume Day" },
  { key: "THURSDAY", label: "Thursday - Jersey Day" },
  { key: "FRIDAY", label: "Friday - Cultural Day/Owambe" },
] as const;

export type EventDayKey = (typeof EVENT_DAYS)[number]["key"];

export const EVENT_DAY_KEYS: EventDayKey[] = EVENT_DAYS.map((day) => day.key);

export const EVENT_DAY_LABEL_MAP: Record<EventDayKey, string> = EVENT_DAYS.reduce(
  (acc, day) => {
    acc[day.key] = day.label;
    return acc;
  },
  {} as Record<EventDayKey, string>,
);
