import {NatType, Node} from './node'
import gateway from './gateway'
import logger from "./logger";

const natType = process.env.NAT ? NatType.OpenInternet : NatType.EndpointDependentMapping
const node = new Node(natType);

gateway(3000, node);


const stop = async () => {
    logger.info('Stopping...');
    await node.stop();
    process.exit(0)
}

process.on('SIGTERM', stop)
process.on('SIGINT', stop)