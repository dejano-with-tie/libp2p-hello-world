import {Builder} from "builder-pattern";
import {Config, defaultConfigBuilder, libp2pConfig} from "./config";
import {discover} from "./nat";
import {Node} from './node';
import {run as gateway} from "./gateway";
import {Db} from './models';
import "reflect-metadata";
import {container, instanceCachingFactory} from "tsyringe";
import {ConnectionManager, useContainer} from "typeorm";


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
    const node = await Node.run(config, db);
    gateway(node);
  }
}

const singleNode = async () => {
  const natType = await discover();
  const config = await libp2pConfig(builderFromEnv().build(), natType);

  // @ts-ignore
  container.register<Config>(Config, {useValue: config});
  container.register<Config>("Config", {useValue: config});
  // Register TypeORM's connection manager as singleton
// TypeORM does not register anything itself with TSyringe and therefore would get a new ConnectionManager every time
//   container.register<ConnectionManager>(ConnectionManager, {useFactory: instanceCachingFactory(() => new ConnectionManager())});
// // configure TypeORM to use a dependency injection container
//   useContainer(
//     // wrapper because TypeORM expects `get` function from IoC container
//     {get: Db => container.resolve(Db as any)},
//   );

  const db = await Db.createAndConnect(config.file.db);
  // @ts-ignore
  container.register<Db>(Db, {useValue: db});
  container.register<Db>("Db", {useValue: db});

  const node = await Node.run(config, db);
  container.register<Node>("Node", {useValue: node});

  gateway(node);
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
