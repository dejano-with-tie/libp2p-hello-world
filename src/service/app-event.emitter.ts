import EventEmitter from "events";
import {delay, inject, singleton} from "tsyringe";
import Download from "../db/model/download.model";
import {SseIoHandler} from "../gateway/io/handlers/sseIoHandler";
import {DownloadFile} from "../usecase/download-file";
import {NatType} from "../nat";

const {setDelayedInterval, clearDelayedInterval} = require('set-delayed-interval')


export enum AppEventId {
  MONITOR = 'monitor',
  NAT = 'nat',
  CONTEXT = 'context',
  DOWNLOAD_QUEUED = 'download:status:queued',
  DOWNLOAD_COMPLETED = 'download:status:completed',
  DOWNLOAD_RESUMED = 'download:status:resumed',
}

@singleton()
export class AppEventEmitter extends EventEmitter {

  private context = {
    status: 'offline',
    connections: 0,
    nat: NatType[NatType.Unknown],
    id: ''
  };
  private _ctxTimeout: any;

  constructor(
    @inject(delay(() => SseIoHandler)) private sseHandler: SseIoHandler,
    @inject(delay(() => DownloadFile)) private downloadFile: DownloadFile,
  ) {
    super({});
    this.on(AppEventId.DOWNLOAD_RESUMED, async (data: Download) => {
      await this.sseHandler.sse(AppEventId.DOWNLOAD_RESUMED, data);
      await downloadFile.download(data.id);
    });

    this.on(AppEventId.NAT, async (nat: NatType) => {
      this.context = {...this.context, ...{nat: NatType[nat]}};
    });
  }

  // @ts-ignore
  async emit(event: string | symbol, ...args): boolean {
    if (event == AppEventId.MONITOR) {
      this.sseHandler.sse(event, args);
    }

    if (event == AppEventId.CONTEXT) {
      this.context = {...this.context, ...args[0]};
    }
    return super.emit(event, ...args);
  }

  public start(): void {
    this._ctxTimeout = setDelayedInterval(() => {
        this.sseHandler.sse(AppEventId.CONTEXT, this.context)
      }, 5e3, 3e3
    )
  }

  public stop(): void {
    clearDelayedInterval(this._ctxTimeout);
  }
}
