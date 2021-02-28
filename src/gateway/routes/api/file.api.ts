import express, {Router} from 'express';
import logger from "../../../logger";
import {DownloadRequest} from "../../../node";

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

async function publish(req: express.Request, res: express.Response, _next: any) {
    const path = req.params['path'];
    await res.locals.node.publish(path);
    res.status(200).send({
        message: `published ${path}`
    });
}

async function allPublished(req: express.Request, res: express.Response, _next: any) {
    const published = await res.locals.node.getAllPublished();
    published.forEach((file: any) => file.hashes.forEach((tag: any) => delete tag.files));
    res.status(200).send(published);
}


async function find(req: express.Request, res: express.Response) {
    const providers = await res.locals.node.find(req.params['name']);
    logger.info(providers);
    res.send(JSON.stringify([...providers]));
}

async function resume(req: express.Request, res: express.Response) {
    res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();

    // Tell the client to retry every 10 seconds if connectivity is lost
    res.write('retry: 10000\n\n');

    await res.locals.node.resume(req.params['id'], res);

    res.end();
}

async function pause(req: express.Request, res: express.Response) {
    await res.locals.node.pauseDownload(Number(req.params['id']));
    res.status(200).end();
}


async function download(req: express.Request, res: express.Response) {
// const providers = await res.locals.node.download(req.params['provider'], req.params['fileId']);
// logger.info(providers);
// res.send(providers);
// TODO: by file id
    const payload: DownloadRequest = req.body;
    res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive'
    });
    res.flushHeaders();

    // Tell the client to retry every 10 seconds if connectivity is lost
    res.write('retry: 10000\n\n');

    await res.locals.node.download(payload, res);

    res.end();
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

router.post('/download', catchAsync(download));
router.get('/pause/:id', catchAsync(pause));
router.get('/resume/:id', catchAsync(resume));
router.get('/event', catchAsync(events));
router.get('/find/:name', catchAsync(find));
router.get('/publish/:path', catchAsync(publish));
router.get('/publish', catchAsync(allPublished));
export default router;