import {PeerDomain} from "./libp2p.domain";

export class FileDomain {
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
}
