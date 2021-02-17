import express, {Router} from 'express';
import logger from "../../../logger";

const router = Router();

// Preload user profile on routes with ':username'
router.param('username', function (req, res, next, username) {
    // ...
});

router.get('/publish/:path', async (req: express.Request, res: express.Response) => {
    const path = req.params['path'];

    try {
        await res.locals.node.publish(path);
        res.status(200).send({
            message: `published ${path}`
        });
        return;
    } catch (e) {
        res.status(400).send({
            message: `failed to publish ${path}`
        });
        logger.error(e.toString());
    }
});

router.get('/find/:name', async (req: express.Request, res: express.Response) => {
    const name = req.params['name'];
    try {
        const providers = await res.locals.node.find(name);
        logger.info(providers);
        res.send(providers);
    } catch (e) {
        res.status(404).send({
            message: `No one has ${name}`
        });
        logger.error(e.toString());
    }
});

router.get('/events', async (req: express.Request, res: express.Response) => {
    console.log('Got /events');
    res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();

    // Tell the client to retry every 10 seconds if connectivity is lost
    res.write('retry: 10000\n\n');

    res.locals.node.eventEmitter.on('app:event', (details: any) => {
        res.write(`data: ${JSON.stringify(details)}\n\n`);
    })
})

export default router;