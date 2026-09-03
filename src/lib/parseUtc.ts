// A timestamp coming back from a `timestamptz` column always carries an
// explicit UTC offset (ends in "Z" or "+HH:MM"/"-HH:MM"), which `new Date()`
// parses correctly regardless of the browser's own timezone. One that
// carries no offset at all (from a plain `timestamp` column, or any other
// gap between what the DB stores and what gets serialized) gets silently
// treated as *local* time instead by the JS Date parser - shifting every
// display by however far the browser's zone currently sits from UTC (a
// full BST/GMT hour, for a UK user). Appending "Z" when there's no offset
// already present makes parsing correct in both cases.
export function parseUtc(value: string): Date {
  const hasOffset = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasOffset ? value : `${value}Z`);
}
