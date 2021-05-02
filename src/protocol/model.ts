import PeerId from "peer-id";
import {Multiaddr} from "multiaddr";
import CID from "cids";
import * as json from 'multiformats/codecs/json'
import {DownloadStatus} from "../db/model/download.model";
import crypto from "crypto";
import {hasher} from "multiformats";

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
    // TODO: move to utils
    const sha256 = hasher.from({
      // As per multiformats table
      // https://github.com/multiformats/multicodec/blob/master/table.csv#L9
      name: 'sha2-256',
      code: 0x12,

      encode: (input) => new Uint8Array(crypto.createHash('sha256').update(input).digest())
    })
    const digest = await sha256.digest(await json.encode({name: this._name}))
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
