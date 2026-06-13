/** The two household members, keyed by Firebase Auth UID (D15). Names only — no PII in the repo. */
export const PEOPLE: Record<string, { name: string }> = {
  LDl4A6ilzUdGJOsgVLq5CWUg2PA2: { name: "Sergiu" },
  B2eHoIgwDqhPDZvu1P8iC3Gpefq2: { name: "Ana" },
};
export const MEMBER_UIDS = Object.keys(PEOPLE);
export const nameFor = (uid: string) => PEOPLE[uid]?.name ?? "Someone";
