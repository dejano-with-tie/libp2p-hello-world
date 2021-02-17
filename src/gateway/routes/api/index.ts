import express, {Router} from 'express';
import fileRoutes from './file';

const router = Router();

router.get('/whoami', (req: express.Request, res: express.Response) => {
    res.send(res.locals.node.whoAmI());
});

router.use('/file', fileRoutes);

export default router;