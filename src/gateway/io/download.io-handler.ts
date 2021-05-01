import {Socket} from "socket.io";
import {IoEvent, IoHandler} from "./io-handler";
import {delay, inject, injectable} from "tsyringe";
import {DownloadService} from "../../service/download.service";

/**
 * Socket.io handler for all events starting with 'download*'
 */
@injectable()
export class DownloadIoHandler extends IoHandler {
  constructor(
    @inject("Socket[]") sockets: Socket[],
    @inject(delay(() => DownloadService)) private downloadService: DownloadService
  ) {
    super(sockets);
  }

  async progress(event: IoEvent<number>): Promise<void> {
    const download = await this.downloadService.download(event.content);
    for await(const progress of download) {
      console.log(progress);
      this.emit(event.id, progress);
    }

    this.emit(event.id, [], true);
  }

  async download(event: IoEvent<any>): Promise<void> {
    console.log('hello download');
  }
}
