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

  async sse(id: any, content: any): Promise<void> {
    emitOnEach(this.sockets, id, content);
  }

  async sseEnd(id: any, content: any[]): Promise<void> {
    await emitOnEach(this.sockets, id, content, true);
  }

}
