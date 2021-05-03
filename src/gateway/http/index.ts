import {Router} from 'express';
import {container} from "tsyringe";
import {SearchController} from "./controller/search.controller";
import {ErrorHandler} from "../exception/error.handler";
import {DownloadController} from "./controller/download.controller";
import {ShareController} from "./controller/share.controller";
import {ConfigController} from "./controller/config.controller";

export const registerRoutes = () => {
  const router = Router();
  const eh = ErrorHandler;

  const searchCtl = container.resolve(SearchController);
  router
    .get('/api/search/:query', eh.catchAsync(searchCtl.search));

  const downloadCtl = container.resolve(DownloadController);
  router
    .get('/api/download', eh.catchAsync(downloadCtl.getAll))
    .post('/api/download', eh.catchAsync(downloadCtl.queue))
    .post('/api/download/:id', eh.catchAsync(downloadCtl.changeState))
    .delete('/api/download/:id', eh.catchAsync(downloadCtl.delete))

  const shareCtl = container.resolve(ShareController);
  router
    .get('/api/share', eh.catchAsync(shareCtl.shared));

  const configCtl = container.resolve(ConfigController);
  router
    .get('/api/config', eh.catchAsync(configCtl.getAll));

  return router;
}
