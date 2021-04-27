import PeerId from "peer-id";
import Multiaddr from "multiaddr";

export interface PeerDomain {
  id: PeerId;
  isLocal: boolean;
  multiaddrs: Multiaddr[];
}

export function remotePeer(peerId: string) {
  return {
    id: PeerId.createFromB58String(peerId),
    isLocal: false,
    multiaddrs: []
  }
}
