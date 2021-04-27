import {Socket} from "socket.io";
import {container} from "tsyringe";
import {SearchIoHandler} from "./search.io-handler";
import {FindFilesUsecase} from "../../usecase/find-files.usecase";
import logger from "../../logger";
import {DownloadIoHandler} from "./download.io-handler";
import {DownloadFileFromPeerUsecase} from "../../usecase/download-file-from-peer.usecase";

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

export const wrapIoEvent = (id: string, content: any) => ({
  content,
  done: false,
  error: [],
  id: id
})

export const registerIoHandlers = (socket: Socket) => {
  container.register<Socket>(Socket, {useValue: socket});

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
