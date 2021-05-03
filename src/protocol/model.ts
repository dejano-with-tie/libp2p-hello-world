import PeerId from "peer-id";
import {Multiaddr} from "multiaddr";
import CID from "cids";
import * as json from 'multiformats/codecs/json'
import {DownloadStatus} from "../db/model/download.model";
import {container} from "tsyringe";

export interface PeerDomain {
  id: PeerId;
  isLocal: boolean;
  relayedConn: boolean | undefined;
  reachable: boolean;
  multiaddrs: Multiaddr[];
}

export function fromRemoteId(peerId: string, relayedConn: boolean = false) {
  return {
    id: PeerId.createFromB58String(peerId),
    isLocal: false,
    relayedConn: relayedConn,
    reachable: true,
    multiaddrs: []
  }
}


export class CidDomain {

  constructor(private _name: string, private _value?: CID) {
  }

  get value(): CID {
    return <CID>this._value;
  }

  get name(): string {
    return this._name;
  }

  public async digest(): Promise<CidDomain> {
    const hasher: any = container.resolve("hasher");
    const digest = await hasher.digest(await json.encode({name: this._name}))
    this._value = new CID(1, json.code, digest.bytes);
    return this;
  }

  public toString(): string {
    return <string>this._value?.toString();
  }
}


export interface DownloadState {
  id: number,
  percentage: number,
  /**
   * DownloadStatus
   */
  status: DownloadStatus,
  /**
   * offset in bytes
   */
  offset: number
}
