export enum IoEventId {
  SEARCH = "search:details",
  DOWNLOAD = "download:progress",
  MONITOR = "monitor",
}

export interface IoError {
  id: string;
  message: string;
}

export interface IoEvent<T> {
  id: IoEventId;
  content: T;
  done: boolean;
  error: IoError[];
}

export const wrapIoEvent = (id: IoEventId, content: any, done: boolean = false) => ({
  content,
  done,
  error: [],
  id: id
});

