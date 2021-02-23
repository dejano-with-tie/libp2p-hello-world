import express, {Router} from 'express';
import logger from "../../../logger";

// We create a wrapper to workaround async errors not being transmitted correctly.
export const catchAsync = (handler: ((req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>)) => {
    return async function (req: express.Request, res: express.Response, next: express.NextFunction) {
        try {
            await handler(req, res, next);
        } catch (error) {
            next(error);
        }
    };
}

const router = Router();

async function publish(req: express.Request, res: express.Response, next: any) {
    const path = req.params['path'];
    await res.locals.node.publish(path);
    res.status(200).send({
        message: `published ${path}`
    });
}

async function find(req: express.Request, res: express.Response) {
    const providers = await res.locals.node.find(req.params['name']);
    logger.info(providers);
    res.send(providers);
}


async function download(req: express.Request, res: express.Response) {
    // TODO: by file id
    const providers = await res.locals.node.download(req.params['provider'], req.params['fileId']);
    logger.info(providers);
    res.send(providers);
}

async function events(req: express.Request, res: express.Response) {
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
}

router.get('/download/:fileId/:provider', catchAsync(download));
router.get('/events', catchAsync(events));
router.get('/find/:name', catchAsync(find));
router.get('/publish/:path', catchAsync(publish));
export default router;