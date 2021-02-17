import express, {Router} from 'express';
import fileRoutes from './file.api';
import db from '../../../models';

const router = Router();


// TODO: Err handling
// We create a wrapper to workaround async errors not being transmitted correctly.
function errHandler(handler: ((req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>)) {
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

// TODO: Temp
async function health(req: express.Request, res: express.Response, next: express.NextFunction) {
    const file = await db.File.create({
        path: '/tmp/omg',
        size: 123,
        mime: 'log',
        hash: 'temp',
    });
    res.send(file);
}

router.get('/health', errHandler(health));

// TODO: Err handling
router.use(function (err: any, req: any, res: any, next: any) {
    if (err.name === 'ValidationError') {
        return res.status(422).json({
            errors: Object.keys(err.errors).reduce(function (errors: any, key) {
                errors[key] = err.errors[key].message;

                return errors;
            }, {})
        });
    }

    return next(err);
});


router.use('/file', fileRoutes);

export default router;