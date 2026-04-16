export type HistoryEntry<T> = {
  snapshot: T;
  label: string;
};

export type HistoryState<T> = {
  past: HistoryEntry<T>[];
  future: HistoryEntry<T>[];
};

export function createHistoryState<T>(): HistoryState<T> {
  return {
    past: [],
    future: []
  };
}

export function clearHistory<T>(history: HistoryState<T>): void {
  history.past = [];
  history.future = [];
}

export function canUndoHistory<T>(history: HistoryState<T>): boolean {
  return history.past.length > 0;
}

export function canRedoHistory<T>(history: HistoryState<T>): boolean {
  return history.future.length > 0;
}

export function pushHistoryEntry<T>(
  history: HistoryState<T>,
  entry: HistoryEntry<T>
): void {
  history.past.push(entry);
  history.future = [];
}

export function popUndoHistory<T>(
  history: HistoryState<T>,
  currentSnapshot: T
): HistoryEntry<T> | null {
  const entry = history.past.pop();
  if (!entry) {
    return null;
  }

  history.future.push({
    snapshot: currentSnapshot,
    label: entry.label
  });
  return entry;
}

export function popRedoHistory<T>(
  history: HistoryState<T>,
  currentSnapshot: T
): HistoryEntry<T> | null {
  const entry = history.future.pop();
  if (!entry) {
    return null;
  }

  history.past.push({
    snapshot: currentSnapshot,
    label: entry.label
  });
  return entry;
}
