import {Socket} from "socket.io";
import {IoHandler} from "./io-handler";
import {IoEvent, wrapIoEvent} from "./index";
import {DownloadFileFromPeerUsecase} from "../../usecase/download-file-from-peer.usecase";
import {delay, inject, injectable} from "tsyringe";

/**
 * Socket.io handler for all events starting with 'download*'
 */
@injectable()
export class DownloadIoHandler extends IoHandler {
  constructor(@inject(delay(() => Socket)) socket: Socket, private downloadFileFromPeerUsecase: DownloadFileFromPeerUsecase) {
    super(socket);
  }

  async progress(event: IoEvent<number>): Promise<void> {
    const download = await this.downloadFileFromPeerUsecase.execute(event.content);
    for await(const progress of download) {
      console.log(progress);
      if (this.socket.emit) {
        this.socket.emit(event.id, wrapIoEvent(event.id, {progress}));
      }
    }

    this.socket.emit(event.id, {...event, ...{done: true}});
  }

  async download(event: IoEvent<any>): Promise<void> {
    console.log('hello download');
  }
}
