import {Builder} from "builder-pattern";
import {defaultConfigBuilder, libp2pConfig} from "./config";
import logger from "./logger";
import {discover} from "./nat";
import {Node} from './node';
import {run as gateway} from "./gateway";


const stop = (node: Node) => async () => {
    await node.stop();
    logger.info('Stopping...');
    process.exit(0);
}

const main = async () => {
    const natType = await discover();
    const config = await libp2pConfig(Builder(defaultConfigBuilder).alias("local").build(), natType);

    const node = await Node.run(config);
    gateway(node);
    process.on('SIGTERM', stop(node));
    process.on('SIGINT', stop(node));
};

(async () => {
    await main();
})();
