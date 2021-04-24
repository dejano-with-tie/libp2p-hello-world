import PeerId from "peer-id";
import Multiaddr from "multiaddr";

export interface PeerDomain {
  id: PeerId;
  isLocal: boolean;
  multiaddrs: Multiaddr[];
}
