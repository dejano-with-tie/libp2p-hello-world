import PeerId from "peer-id";
import Multiaddr from "multiaddr";
import CID from "cids";
import json from 'multiformats/codecs/json'
import {sha256} from 'multiformats/hashes/sha2'
import {DownloadStatus} from "../models/download.model";

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

  public async digest(): Promise<CidDomain> {
    const bytes = json.encode({name: this._name});
    const hash = await sha256.digest(bytes);
    this._value = new CID(1, json.code, hash.bytes);
    return this;
  }

  get value(): CID {
    return <CID>this._value;
  }

  public toString(): string {
    return <string>this._value?.toString();
  }

  get name(): string {
    return this._name;
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
