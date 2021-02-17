import express from 'express';
import {Node} from "../node";
import cors from 'cors';
import bodyParser from "body-parser";
import logger from "../logger";
import routers from './routes';

const context = (node: Node) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.locals.node = node;
    next();
};
/// catch 404 and forward to error handler
const handle404 = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const err = new Error('Not Found');
    // @ts-ignore
    err.status = 404;
    next(err);
};

const errHandle = (err: { stack: any; status: any; message: any; }, req: any, res: { status: (arg0: any) => void; json: (arg0: { errors: { message: any; error: any; }; }) => void; }, next: any) => {
    console.log(err.stack);

    res.status(err.status || 500);

    res.json({
        'errors': {
            message: err.message,
            error: err
        }
    });
};

function configure(app: express.Application) {
    app.use(cors());

    app.use(require('morgan')('dev'));
    app.use(bodyParser.urlencoded({extended: false}));
    app.use(bodyParser.json());

    app.use(express.static(__dirname + '/public'));

    app.use(routers);
    app.use(handle404);
    app.use(errHandle);
}

export const run = (node: Node) => {
    const app: express.Application = express();

    app.use(context(node));

    configure(app);


    app.listen(node.config.file.gateway.port, () => {
        logger.info(`API Gateway available at http://localhost:${node.config.file.gateway.port}`);
    });
}