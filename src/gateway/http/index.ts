import express, {Router} from 'express';
import apiRoutes from './api';
import {container} from "tsyringe";
import {SearchController} from "./controller/search.controller";
import {ErrorHandler} from "../exception/error.handler";
import {DownloadController} from "./controller/download.controller";

export const registerRoutes = () => {
  const router = Router();
  router.use('/api', apiRoutes);

  const eh = ErrorHandler;

  const searchCtl = container.resolve(SearchController);
  router
    .get('/api/search/:query', eh.catchAsync(searchCtl.search));

  const downloadCtl = container.resolve(DownloadController);
  router
    .post('/api/download', eh.catchAsync(downloadCtl.queue))
    .get('/api/download', eh.catchAsync(downloadCtl.getAll));

  return router;
}
