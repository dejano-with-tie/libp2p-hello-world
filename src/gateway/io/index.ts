import {Socket} from "socket.io";
import {container} from "tsyringe";
import {IoEventId, wrapIoEvent} from "./model";
import {SearchIoHandler} from "./handlers/search.io-handler";
import logger from "../../logger";
import {AppEventEmitter} from "../../service/app-event.emitter";

// register sockets with IOC
const sockets: Socket[] = [];
container.register<Socket[]>('Socket[]', {useValue: sockets});
export const onSocket = (socket: Socket) => {
  sockets.push(socket);

  logger.info('socket connected');
  (async () => await container.resolve(AppEventEmitter).emitContext())();
  const register = (id: IoEventId, handler: any) => {
    socket.on(id, async (event) => {
      await handler(wrapIoEvent(id, event))
    });
  }

  const searchIoHandler = container.resolve(SearchIoHandler);

  register(IoEventId.SEARCH, searchIoHandler.handle.bind(searchIoHandler));
}
