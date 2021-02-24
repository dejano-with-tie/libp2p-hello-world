import {Builder} from "builder-pattern";
import {defaultConfigBuilder, libp2pConfig} from "./config";
import {discover} from "./nat";
import {Node} from './node';
import {run as gateway} from "./gateway";
import {Db} from './models';
import Hash from "./models/hash.model";


const main = async (single: boolean) => {
    if (single) {
        await singleNode();
    } else {
        await multiple(2);
    }
};

/**
 * Run N nodes
 */
const multiple = async (n: number) => {
    const natType = await discover();
    for await (const nodeIndex of Array(n).keys()) {
        const config = await libp2pConfig(Builder(defaultConfigBuilder)
            .alias(`local-${nodeIndex}`)
            .nodePort(8000 + nodeIndex)
            .gatewayPort(3000 + nodeIndex)
            .db(`./data-${nodeIndex}.sqlite`)
            .filePath(`./config/config.${nodeIndex}.json`)
            .build(), natType);

        const db = await Db.createAndConnect(config.file.db);
        const node = await Node.run(config, db);
        gateway(node);
    }
}

const singleNode = async () => {
    const natType = await discover();
    const config = await libp2pConfig(Builder(defaultConfigBuilder).alias("local").build(), natType);

    const db = await Db.createAndConnect(config.file.db);
    const node = await Node.run(config, db);
    gateway(node);
}

(async () => {
    // await main(!!process.env.SINGLE || false);
    await main(false);
})();
