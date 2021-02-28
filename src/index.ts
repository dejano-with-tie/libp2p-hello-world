import {Builder} from "builder-pattern";
import {defaultConfigBuilder, libp2pConfig} from "./config";
import {discover} from "./nat";
import {Node} from './node';
import {run as gateway} from "./gateway";
import {Db} from './models';


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

    const db = await Db.createAndConnect(config.file.db);
    const node = await Node.run(config, db);
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
