import {Builder} from "builder-pattern";
import "reflect-metadata";
import { defaultConfigBuilder, libp2pConfig} from "./config";
import {run as gateway} from "./gateway";
import {Db} from './db';
import {container} from "tsyringe";
import {FileService} from "./service/file.service";
import crypto from "crypto";
import {hasher} from "multiformats";
import {Node} from "./node";
import {AppEventEmitter} from "./service/app-event.emitter";

const main = async () => {
  const config = await libp2pConfig(builderFromEnv().build());

  // NOTE: container.register is used in src/index, src/db/index (repos) and src/gateway/io/index (socket)
  // @ts-ignore
  container.register("Config", {useValue: config});

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
  if (process.env.BOOTSTRAP) {
    builder.bootstrap(process.env.BOOTSTRAP);
  }
  return builder;
}

(async () => {
  await main();
})();
