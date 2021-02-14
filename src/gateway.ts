import express from 'express';
import * as http from 'http';

import * as winston from 'winston';
import * as expressWinston from 'express-winston';
import debug from 'debug';
import {Node} from "./node";
import logger from "./logger";

const app: express.Application = express();
const server: http.Server = http.createServer(app);
const port: Number = 3000;
const routes = [];
const log: debug.IDebugger = debug('app');
// Let's make our express `Router` first.
const router = express.Router();
router.get('/error', function (req, res, next) {
    // here we cause an error in the pipeline so we see express-winston in action.
    return next(new Error("This is an error and it should be logged to the console"));
});

// express-winston logger makes sense BEFORE the router
app.use(expressWinston.logger({
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
    )
}));

// Now we can tell the app to use our routing code:
app.use(router);

// express-winston errorLogger makes sense AFTER the router.
app.use(expressWinston.errorLogger({
    transports: [
        new winston.transports.Console()
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
    )
}));

function listen(port: number, node: Node) {
    router.get('/', (req: express.Request, res: express.Response) => {
        res.status(200).send(`Server up and running!`);
    });

    router.get('/whoami', (req: express.Request, res: express.Response) => {
        res.send(node.whoAmI());
    });


    router.get('/publish/:name', async (req: express.Request, res: express.Response) => {
        const name = req.params['name'];
        console.log(`publish ${name}`);

        try {
            if (await node.publish(name)) {
                res.status(200).send({
                    message: `published ${name}`
                });
                return;
            }
        } catch (e) {
            res.status(400).send({
                message: `failed to publish ${name}`
            });
            logger.error(e);
        }
    });

    router.get('/find/:name', async (req: express.Request, res: express.Response) => {
        const name = req.params['name'];
        console.log(`find ${name}`);

        try {
            const providers = await node.find(name);
            logger.info(providers);
            res.send(providers);
        } catch (e) {
            res.status(404).send({
                message: `No one has ${name}`
            });
            logger.error(e);
        }
    });

    router.get('/events', async (req, res) => {
        console.log('Got /events');
        res.set({
            'Cache-Control': 'no-cache',
            'Content-Type': 'text/event-stream',
            'Connection': 'keep-alive'
        });
        res.flushHeaders();

        // Tell the client to retry every 10 seconds if connectivity is lost
        res.write('retry: 10000\n\n');

        node.eventEmitter.on('app:event', (details) => {
            res.write(`data: ${JSON.stringify(details)}\n\n`);
        })
    })

    app.listen(3000, () => {
        logger.info(`API Gateway available at http://localhost:${3000}`);
    });
}

export default listen;