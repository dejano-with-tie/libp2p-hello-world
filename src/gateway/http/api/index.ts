import express, {Router} from 'express';
import fileRoutes from './file.api';

const router = Router();

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

router.get('/whoami', (req: express.Request, res: express.Response) => {
    res.send(res.locals.node.whoAmI());
});

router.use('/file', fileRoutes);
router.use('/settings', fileRoutes);

export default router;