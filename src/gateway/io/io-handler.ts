import {Socket} from "socket.io";

export abstract class IoHandler {
  sockets: Socket[];

  protected constructor(sockets: Socket[]) {
    this.sockets = sockets
  }

  /**
   * It might be UI is not used and socket is undefined, this method safely emits on socket
   * @param id
   * @param content
   * @param done
   * @protected
   */
  public emit(id: string, content: any, done: boolean = false) {
    this.sockets.forEach(s => s.emit(id, wrapIoEvent(id, [content].flat(), done)))
  }

}

export interface IoError {
  id: string;
  message: string;
}

export interface IoEvent<T> {
  id: string;
  content: T;
  done: boolean;
  error: IoError[];
}

export const wrapIoEvent = (id: string, content: any, done: boolean = false) => ({
  content,
  done,
  error: [],
  id: id
});
