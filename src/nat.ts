import logger from "./logger";
import {AppEventEmitter, AppEventId} from "./service/app-event.emitter";
import path from "path";

const {setDelayedInterval, clearDelayedInterval} = require('set-delayed-interval');

const {spawn} = require('child_process');

export enum NatType {
  FullCone = 'FullCone',
  Unknown = 'Unknown',
}

interface NatDiscoverResponse {
  external_ip: string;
  external_port: number;
  type: string;
}

export class NatDiscovery {

  private _nat: NatType
  private _timeout: any;

  constructor(private _nodePort: number, private _appEventEmitter: AppEventEmitter) {
    this._nat = NatType.Unknown;
  }

  public _discover(): Promise<NatDiscoverResponse> {
    return new Promise<NatDiscoverResponse>((resolve, reject) => {
      const pyPath = path.resolve(__dirname, "./nat-discovery.py");
      logger.info(pyPath)
      const py = spawn('python2', [pyPath, "-j", `-p ${this._nodePort}`]);
      py.stdout.on('data', (data: any) => {
        console.error(data.toString());
        resolve(data);
      });
      py.stderr.on('data', (data: any) => {
        console.error(data);
        reject(data);
      });
    });
  }

  async discover(): Promise<NatType> {
    let response: NatDiscoverResponse;
    let nat: NatType;
    try {
      response = JSON.parse((await this._discover()).toString())
      logger.info(`NAT Discovery: ${response.type}`);
    } catch (e) {
      logger.error(e);
      this._nat = NatType.Unknown;
      return this._nat;
    }

    if ('Full Cone' == response.type || 'Open Internet (no NAT)' == response.type) {
      nat = NatType.FullCone;
    } else {
      nat = NatType.Unknown;
    }

    if (this._nat !== nat) {
      this._appEventEmitter.emit(AppEventId.NAT, nat);
      this._nat = nat;
    }

    return this._nat;
    // return NatType.Unknown;
  }

  public start() {
    // this._timeout = setDelayedInterval(async () => {
    //   await this.discover();
    // }, 60e3, 0);
  }

  public stop() {
    clearDelayedInterval(this._timeout);
  }
}
