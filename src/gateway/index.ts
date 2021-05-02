import express from 'express';
import * as http from 'http';
import cors from 'cors';
import bodyParser from 'body-parser';
import logger from '../logger';
import {Server} from 'socket.io';
import {ErrorHandler} from "./exception/error.handler";
import {registerRoutes} from './http';
import {onSocket} from "./io";
import {Config} from "../config";

export const run = (config: Config) => {
  const app: express.Application = express();
  const server: http.Server = http.createServer(app);
  const io: Server = require('socket.io')(server, {
    path: '/socket.io',
    cors: {
      origin: '*',
      methods: '*'
    }
  });
  io.on('connection', onSocket);

  app.use(cors());
  app.use(require('morgan')('dev'));
  app.use(bodyParser.urlencoded({extended: false}));
  app.use(bodyParser.json());

  app.use(registerRoutes());
  // this is a simple route to make sure everything is working properly
  app.get('/', (req: express.Request, res: express.Response) => {
    res.status(200).json({status: 'ok'})
  });

  app.use(ErrorHandler.notFound);
  app.use(ErrorHandler.general);

  server.listen(config.file.gateway.port, () => {
    logger.info(`API Gateway available at http://localhost:${config.file.gateway.port}`);
  });
}
