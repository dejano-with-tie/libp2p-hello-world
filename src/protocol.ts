import * as fs from 'fs';
import Libp2p from "libp2p";
import CID from "cids";
import json from 'multiformats/codecs/json'
import {sha256} from 'multiformats/hashes/sha2'
import path from 'path';
import logger from "./logger";
import pipe from "it-pipe";
import first from 'it-first';

const errcode = require('err-code');
// import errorcode from 'err';

const {publicAddressesFirst} = require('libp2p-utils/src/address-sort');
// import Connection from 'libp2p'

const protons = require('protons');
const PROTOCOL = '/libp2p/file/1.0.0'

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
        this.node.handle(PROTOCOL, this.handle)
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

    async find(name: string): Promise<any> {
        const cid = await Protocol.createCid(name);
        console.log(cid);
        logger.info(`searching for [${cid.toString()}]`);

        const arr: any = [];
        // if there are providers, ask them to give details about file
        console.log('trace0')
        // findProviders(CID) throws
        try {
            // NOTE: This does not work when providers are not stored locally but rather fetched from other peers.
            // returned data contains only peer id and not the multiaddrs
            // will fail on `storeAddresses(source, this.libp2p.peerStore)`
            const providers = await this.node?.contentRouting.findProviders(cid);
            console.log('trace1');

            // @ts-ignore
            for await(const provider of providers) {
                console.log(provider);
                const {stream} = await this.node?.dialProtocol(provider.id, PROTOCOL);
                const response = await pipe(
                    // Source data
                    [`${name}`],
                    // Write to the stream, and pass its output to the next function
                    stream,
                    // Sink function
                    async (source: any) => {
                        const buf: any = await first(source)

                        if (buf) {
                            return buf.slice()
                        }
                    }


                    // async function (source: any) {
                    //     // For each chunk of data
                    //     for await (const data of source) {
                    //         // Output the data
                    //         console.log('received echo:', data.toString())
                    //     }
                    // }
                )

                if (response.length === 0) {
                    throw errcode(new Error('No message received'), 'ERR_NO_MESSAGE_RECEIVED')
                }
            }
        } catch (e) {
            console.error(e);
        }

        return arr;
    }

    async handle({connection, stream}: ({ connection: any, stream: any })) {
        try {
            await pipe(
                stream,
                (source: any) => (async function* () {
                    for await (const message of source) {
                        console.info(`[RECV] ${connection.remotePeer.toB58String().slice(0, 8)}: ${String(message)}`)
                        yield `allright, received '${message}' and returning this`;
                    }
                })(),
                stream
            )
        } catch (err) {
            console.error(err)
        }
    }

    async download(provider: any, cid: CID) {
        // download
        // store
        // say to network that I also have this file now
    }

    // async writeReadMessage (stream, msg) {
    //     const res = await pipe(
    //         [msg],
    //         lp.encode(),
    //         stream,
    //         lp.decode(),
    //         /**
    //          * @param {AsyncIterable<Uint8Array>} source
    //          */
    //         async source => {
    //             const buf = await first(source)
    //
    //             if (buf) {
    //                 return buf.slice()
    //             }
    //         }
    //     )
    //
    //     if (res.length === 0) {
    //         throw errcode(new Error('No message received'), 'ERR_NO_MESSAGE_RECEIVED')
    //     }
    //
    //     return Message.deserialize(res)
    // }
}