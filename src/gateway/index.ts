import express from 'express';
import * as http from 'http';
import {Node} from '../node';
import cors from 'cors';
import bodyParser from 'body-parser';
import logger from '../logger';
import {CommonRoutesConfig} from './routes/common.routes.config';
import {SearchRoutes} from './routes/search.routes.config';
import {Server, Socket} from 'socket.io';
import {ErrorHandler} from "./exception/error.handler";
import {SearchIoHandler} from "./io/search.io-handler";
import router from './routes';
import {container} from "tsyringe";
import {FindFilesUseCase} from "../usecase/find-files-use.case";
import registerIoHandlers from "./io";

// TODO: remove
const context = (node: Node) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.locals.node = node;
  next();
};

export const run = (node: Node) => {
  const app: express.Application = express();
  const server: http.Server = http.createServer(app);
  const routes: Array<CommonRoutesConfig> = [];
  const io: Server = require('socket.io')(server, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: '*'
    }
  });

  app.use(context(node));

  app.use(cors());
  app.use(require('morgan')('dev'));
  app.use(bodyParser.urlencoded({extended: false}));
  app.use(bodyParser.json());
  app.use(router);
  // this is a simple route to make sure everything is working properly
  app.get('/', (req: express.Request, res: express.Response) => {
    res.status(200).json({status: 'ok'})
  });

  routes.push(new SearchRoutes(app));

  io.on('connection', registerIoHandlers);

  const _ = new ErrorHandler(app);

  server.listen(node.config.file.gateway.port, () => {
    logger.info(`API Gateway available at http://localhost:${node.config.file.gateway.port}`);
    routes.forEach((route: CommonRoutesConfig) => {
      logger.debug(`Routes configured for ${route.getName()}`);
    });
  });
}
