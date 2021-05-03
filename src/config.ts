import PeerId from "peer-id";
import fsPath from "path";
import path from "path";
import fs from "fs";
import logger from './logger';
import {Libp2pOptions,} from "libp2p";
import {NatType} from "./nat";
import {NOISE} from "libp2p-noise";
import Bootstrap from "libp2p-bootstrap";
import Gossipsub from "libp2p-gossipsub";

const mkdirp = require('mkdirp');
const PubsubPeerDiscovery = require('libp2p-pubsub-peer-discovery')

const TCP = require('libp2p-tcp');
const Mplex = require('libp2p-mplex');
const KadDHT = require('libp2p-kad-dht');
const MulticastDNS = require('libp2p-mdns');

export interface SharedDir {
  path: string;
  advertisedPath: string;
}

export interface ConfigBuilder {
  alias?: string;
  db?: string;
  nodePort?: number;
  gatewayPort?: number;
  filePath: string;
  peerIdFilePath: string;
  bootstrap?: string;
  downloadDirPath: string;
  sharedDirs: SharedDir[];
}

export const defaultConfigBuilder: ConfigBuilder = {
  filePath: './config/config.json',
  peerIdFilePath: './config/id.json',
  downloadDirPath: 'libp2p/downloads',
  sharedDirs: [{path: 'libp2p/share', advertisedPath: '/'}]
};

export interface Config {
  file: FileConfig,
  natType: NatType,
  libp2p: Libp2pOptions
}

export interface FileConfig {
  alias: string;
  db: string;
  network: Network;
  gateway: Gateway;
  peerIdFilePath: string;
  downloadDirPath: string;
  shareDirs: SharedDir[];
}

interface Network {
  bootstrapPeers: string[];
  port: number;
}

interface Gateway {
  port: number
}

const os = require('os');

async function createDirs(fileConfig: FileConfig) {
  for (const dir of [fileConfig.downloadDirPath, ...fileConfig.shareDirs.map(d => d.path).flat()]) {
    await mkdirp(dir);
    logger.debug(dir);
  }
}

function updateDirPathsRelativeToHomedir(fileConfig: FileConfig) {
  fileConfig.downloadDirPath = path.join(os.homedir(), fileConfig.downloadDirPath);
  fileConfig.shareDirs = fileConfig.shareDirs.map(dir => ({
    path: path.join(os.homedir(), dir.path),
    advertisedPath: dir.advertisedPath
  }));
}

export const libp2pConfig = async (builder: ConfigBuilder): Promise<Config> => {
  const fileConfig: FileConfig = await from(builder);
  const peer = await peerId(builder.peerIdFilePath);

  updateDirPathsRelativeToHomedir(fileConfig);
  await createDirs(fileConfig);

  const libp2pConfig = {
    peerId: peer,
    addresses: {
      listen: [
        `/ip4/0.0.0.0/tcp/${fileConfig.network.port}`,
      ]
    },
    metrics: {
      enabled: false
    },
    dialer: {
      dialTimeout: 5e3,
    },
    modules: {
      transport: [TCP],
      streamMuxer: [Mplex],
      connEncryption: [NOISE],
      peerDiscovery: [Bootstrap, PubsubPeerDiscovery, MulticastDNS],
      dht: KadDHT,
      pubsub: Gossipsub
    },
    config: {
      nat: {
        pmp: {
          enabled: true
        }
      },
      peerDiscovery: {
        [PubsubPeerDiscovery.tag]: {
          interval: 1e3,
          enabled: true
        },
        [Bootstrap.tag]: {
          enabled: true,
          list: fileConfig.network.bootstrapPeers
        },
        [MulticastDNS.tag]: {
          interval: 20e3,
          enabled: true
        }
      },
      dht: {
        enabled: true,
        randomWalk: {
          enabled: true
        }
      },
      relay: {
        enabled: true,
        autoRelay: {
          enabled: true,
        },
        advertise: {
          enabled: false,
        },
        hop: {
          enabled: false,
          active: false,
        }
      }
    }
  } as any;


  return {
    libp2p: libp2pConfig,
    file: fileConfig,
    natType: NatType.Unknown
  };
}

export const updateRelayConfig = (config: Config, natType: NatType) => {
  const relayCapable = [NatType.FullCone].indexOf(natType) > -1;
  if (relayCapable) {
    logger.info('Acting as relay');
  }
  config.natType = natType;
  // @ts-ignore
  config.libp2p.config.relay = {
    enabled: true,
    autoRelay: {
      enabled: true,
    },
    advertise: {
      enabled: relayCapable,
    },
    hop: {
      enabled: relayCapable,
      active: relayCapable,
    }
  }
}
const from = async (builder: ConfigBuilder): Promise<FileConfig> => {
  const configFilePath = fsPath.join(__dirname, '..', builder.filePath);
  const fileConfig: FileConfig = loadFile(configFilePath);

  fileConfig.network.port = builder.nodePort || fileConfig.network.port;
  fileConfig.gateway.port = builder.gatewayPort || fileConfig.gateway.port;
  fileConfig.alias = builder.alias || fileConfig.alias;
  fileConfig.db = builder.db || fileConfig.db;
  fileConfig.peerIdFilePath = builder.peerIdFilePath || fileConfig.peerIdFilePath;
  fileConfig.downloadDirPath = builder.downloadDirPath || fileConfig.downloadDirPath;
  fileConfig.shareDirs = builder.sharedDirs || fileConfig.shareDirs;
  fileConfig.network.bootstrapPeers = builder.bootstrap ? [builder.bootstrap] : fileConfig.network.bootstrapPeers;

  return fileConfig;
};

const loadFile = (configFilePath: string): FileConfig => {
  return (JSON.parse(fs.readFileSync(configFilePath).toString()) as FileConfig);
};

async function peerId(peerIdFilePath: string): Promise<PeerId> {
  if (fs.existsSync(peerIdFilePath)) {
    const text = JSON.parse(fs.readFileSync(peerIdFilePath).toString());
    return await PeerId.createFromJSON(text);
  }

  const id = await PeerId.create();
  logger.info(`Generated new peer ID: ${id.toB58String()}`);
  fs.writeFileSync(peerIdFilePath, JSON.stringify(id.toJSON(), null, 4));
  return id;
}
