import {Socket} from "socket.io";
import {container} from "tsyringe";
import {SearchIoHandler} from "./search.io-handler";
import logger from "../../logger";
import {DownloadIoHandler} from "./download.io-handler";
import {wrapIoEvent} from "./io-handler";

const sockets: Socket[] = [];
container.register<Socket[]>('Socket[]', {useValue: sockets});
export const registerIoHandlers = (socket: Socket) => {
  sockets.push(socket);

  logger.info('socket connected');
  const register = (id: string, handler: any) => {
    socket.on(id, async (event) => {
      await handler(wrapIoEvent(id, event))
    });
  }

  const searchIoHandler = container.resolve(SearchIoHandler);
  const downloadIoHandler = container.resolve(DownloadIoHandler);

  register('search', searchIoHandler.search.bind(searchIoHandler));
  // register('download', downloadIoHandler.download.bind(searchIoHandler));

  setTimeout(() => {
    socket.emit('test', 'hello');
  }, 2000);

}
