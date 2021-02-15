import * as fs from 'fs';
import Libp2p from "libp2p";
import CID from "cids";
import json from 'multiformats/codecs/json'
import {sha256} from 'multiformats/hashes/sha2'
import path from 'path';
import logger from "./logger";
import PeerId from "peer-id";
import Multiaddr from "multiaddr";
import {PROTOCOL} from "./command";
import {Connection} from 'libp2p/src/dialer';
import pipe from "it-pipe";

const {publicAddressesFirst} = require('libp2p-utils/src/address-sort');
// import Connection from 'libp2p'

const protons = require('protons');

const {Request} = protons(`
message Request {
  enum Type {
    PUBLISH = 1;
    FIND = 2;
  }
  
  required Type type = 1;
  optional PublishFile publish = 2;
  optional SearchForFile search = 3;
}

message PublishFile {
    required bytes id = 1;
    required string name = 2;
    required int64 size = 3;
}

message SearchForFile {
    required bytes name = 1;
}
`);

export class Protocol {
    private node: Libp2p;
    private shared = new Map<CID, any>();


    constructor(node: Libp2p) {
        this.node = node;
    }

    private static async createCid(name: string): Promise<CID> {
        const bytes = json.encode({name: name});
        const hash = await sha256.digest(bytes);
        return new CID(1, json.code, hash.bytes);
    }

    private static async details(filePath: string) {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            throw new Error(`Only files are shareable. ${filePath} is not a file`);
        }

        const extName = path.extname(filePath);
        const name = path.basename(filePath, extName);
        const cid = await Protocol.createCid(name);
        return {
            size: stat.size,
            cid,
            path: filePath,
            extName,
            name,
        }
    }

    async publish(filePath: string) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`File ${filePath} does not exist`);
        }
        const details = await Protocol.details(filePath);

        this.shared.set(details.cid, details);
        await this.node.contentRouting.provide(details.cid);
        logger.info(`published [${details.cid.toString()}] ${filePath}`);
    }

    async find(name: string): Promise<{ id: PeerId, multiaddrs: Multiaddr[] }[]> {
        const cid = await Protocol.createCid(name);
        logger.info(`searching for [${cid.toString()}]`);

        const arr = [];
        // if there are providers, ask them to give details about file
        console.log('trace0')
        // findProviders(CID) throws
        try {
            const providers = await this.node?.contentRouting.findProviders(cid);
            console.log('trace1');
            // @ts-ignore
            for await(const provider of providers) {
                arr.push(provider);
                console.log('trace 2');
                console.log(provider);
                const addresses = publicAddressesFirst(provider.multiaddrs.map(a => {
                    return {multiaddr: a, isCertified: false}
                }));

                // this.node.connectionManager.start
                // const connection = this.node.connectionManager.get(provider.id)
                // if (!connection) return

                try {
                    const {stream} = await this.node.dialProtocol(addresses[0].multiaddr, [PROTOCOL]);
                    // const {stream} = await conn.newStream([PROTOCOL]);
                    try {
                        await pipe(
                            [`please provide me details of ${name}`],
                            stream,
                            async function (source: any) {
                                for await (const message of source) {
                                    console.info(String(message))
                                }
                            }
                        )
                    } catch (err) {
                        console.error(err)
                    }
                } catch (err) {
                    console.error('Could not negotiate chat protocol stream with peer', err)
                }
            }
        } catch (e) {
            console.error(e);
        }

        return arr;
    }

    async download(provider: any, cid: CID) {
        // download
        // store
        // say to network that I also have this file now
    }
}