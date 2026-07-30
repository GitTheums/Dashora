/** All durable timestamps are Unix epoch milliseconds (integer). */
export type EpochMillis = number;

export function nowEpochMillis(date: Date = new Date()): EpochMillis {
  return date.getTime();
}

export function assertEpochMillis(value: number, fieldName: string): EpochMillis {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer epoch millisecond timestamp`);
  }
  return value;
}
