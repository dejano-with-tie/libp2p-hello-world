import {Socket} from "socket.io";
import {inject, injectable} from "tsyringe";
import {emitOnEach} from "./index";

/**
 * Socket.io that emits server side events
 */
@injectable()
export class SseIoHandler {
  constructor(
    @inject("Socket[]") private sockets: Socket[],
  ) {
  }

  sse(id: any, content: any): void {
    emitOnEach(this.sockets, id, content);
  }

  sseEnd(id: any, content: any[]): void {
    emitOnEach(this.sockets, id, content, true);
  }

}
