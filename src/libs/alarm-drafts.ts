import type { AlarmDraft } from "../schemas/alarm";
import type { ParseInput } from "../schemas/requests";

export function fillMissingAlarmDates(
  drafts: AlarmDraft[],
  context: ParseInput["context"],
): AlarmDraft[] {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: context.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(context.currentDateTime));
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  const currentDate = `${values.year}-${values.month}-${values.day}`;

  return drafts.map((draft) =>
    draft.date === null ? { ...draft, date: currentDate } : draft,
  );
}
