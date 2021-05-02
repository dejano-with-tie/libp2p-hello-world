import {Socket} from "socket.io";
import {IoEventId, wrapIoEvent} from "../model";


/**
 * It might be UI is not used and socket is undefined, this method safely emits on socket
 * @param sockets
 * @param id
 * @param content
 * @param done
 */
export function emitOnEach(sockets: Socket[], id: IoEventId, content: any, done: boolean = false) {
  sockets.forEach(s => s.emit(id, wrapIoEvent(id, [content].flat(), done)))
}
