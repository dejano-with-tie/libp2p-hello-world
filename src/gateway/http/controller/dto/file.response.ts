import {PeerDomain} from "../../../../libp2p-client/model";
import File from "../../../../models/file.model";
import * as proto from '../../../../libp2p-client/proto/proto'
import {FileRepository} from "../../../../repository/file.repository";

export class FileResponse {
  id: number;
  path: string;
  checksum: string;
  size: number;
  mime: string;
  createdAt?: string;
  updatedAt?: string;
  provider: PeerDomain;

  constructor(id: number, path: string, checksum: string, size: number, mime: string, createdAt: string, updatedAt: string, provider: PeerDomain) {
    this.id = id;
    this.path = path;
    this.checksum = checksum;
    this.size = size;
    this.mime = mime;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.provider = provider;
  }

  public static unreachable(provider: PeerDomain) {
    provider.reachable = false;
    provider.relayedConn = undefined;
    return new FileResponse(0, '', '', 0, '', '', '', provider);
  }

  public static fromModel(file: File, provider: PeerDomain) {
    return new FileResponse(file.id, file.advertisedPath(), file.checksum, file.size, file.mime, file.createdAt.toString(), file.updatedAt.toString(), provider);
  }

  public static fromProto(file: proto.File, peer: PeerDomain): FileResponse {
    return new FileResponse(file.id, file.path, file.checksum, file.size, file.mime, file.createdAt, file.updatedAt, {
      id: peer.id,
      multiaddrs: peer.multiaddrs,
      relayedConn: peer.relayedConn,
      isLocal: false,
      reachable: true
    });
  }
}
