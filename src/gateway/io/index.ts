import {Socket} from "socket.io";
import {container} from "tsyringe";
import {SearchIoHandler} from "./search.io-handler";
import {FindFilesUseCase} from "../../usecase/find-files-use.case";
import logger from "../../logger";

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

const registerIoHandlers = (socket: Socket) => {
  logger.info('socket connected');
  const register = (id: string, handler: any) => {
    socket.on(id, async (event) => {
      await handler(wrapIoEvent(id, event))
    });
  }

  const searchHandler = new SearchIoHandler(socket, container.resolve(FindFilesUseCase));

  register('search', searchHandler.search.bind(searchHandler));
  // register('search:providers', searchHandler.providers.bind(searchHandler));
  // register('search:files', searchHandler.files.bind(searchHandler));
}

export default registerIoHandlers;
