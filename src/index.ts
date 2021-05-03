import "reflect-metadata";
import {Builder} from "builder-pattern";
import {Config, defaultConfigBuilder, libp2pConfig} from "./config";
import {discover} from "./nat";
import {run as gateway} from "./gateway";
import {Db} from './db';
import {container} from "tsyringe";
import {FileService} from "./service/file.service";
import crypto from "crypto";
import {hasher} from "multiformats";
import {Node} from "./node";
import {AppEventEmitter} from "./service/app-event.emitter";


const main = async (runMultiple: boolean) => {
  if (runMultiple) {
    await multiple(3);
  } else {
    await singleNode();
  }
};

/**
 * Run N nodes
 */
const multiple = async (n: number) => {
  const natType = await discover();

  for await (const nodeIndex of Array(n).keys()) {
    const basePort = 3000 + nodeIndex;
    const config = await libp2pConfig(Builder(defaultConfigBuilder)
      .alias(`local-${basePort}`)
      .gatewayPort(basePort)
      .nodePort(basePort + 5000)
      .db(`./data-${basePort}.sqlite`)
      .filePath(`./config/config.json`)
      .peerIdFilePath(`./config/id.${basePort}.json`)
      .build(), natType);

    const db = await Db.createAndConnect(config.file.db);
    gateway(config);
  }
}

const singleNode = async () => {
  const natType = await discover();
  const config = await libp2pConfig(builderFromEnv().build(), natType);

  // NOTE: container.register is used in src/index, src/db/index (repos) and src/gateway/io/index (socket)
  // @ts-ignore
  container.register<Config>(Config, {useValue: config});
  container.register<Config>("Config", {useValue: config});

  const db = await Db.createAndConnect(config.file.db);
  // @ts-ignore
  container.register<Db>(Db, {useValue: db});
  container.register<Db>("Db", {useValue: db});
  const sha256 = hasher.from({
    name: 'sha2-256',
    code: 0x12,
    encode: (input) => new Uint8Array(crypto.createHash('sha256').update(input).digest())
  });
  container.register("hasher", {useValue: sha256});

  const node = new Node(config, container.resolve(FileService), container.resolve(AppEventEmitter));
  container.register(Node, {useValue: node});
  await node.start();
  gateway(config);
}

function builderFromEnv() {
  const builder = Builder(defaultConfigBuilder);

  if (process.env.GATEWAY_PORT) {
    builder.gatewayPort(Number(process.env.GATEWAY_PORT));
  }

  if (process.env.NODE_PORT) {
    builder.nodePort(Number(process.env.NODE_PORT));
  }

  if (process.env.ALIAS) {
    builder.alias(process.env.ALIAS);
  }

  if (process.env.DB_PATH) {
    builder.db(process.env.DB_PATH);
  }

  if (process.env.PEER_ID) {
    builder.peerIdFilePath(process.env.PEER_ID);
  }
  return builder;
}

(async () => {
  await main(process.env.MULTIPLE === 'true');
})();
