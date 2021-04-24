import {CommonRoutesConfig} from './common.routes.config';
import express from 'express';
import {container} from "tsyringe";
import {SearchController} from "../controller/search.controller";

export class SearchRoutes extends CommonRoutesConfig {
  constructor(app: express.Application) {
    super(app, 'SearchRoutes');
  }

  configureRoutes() {
    const ctl = container.resolve(SearchController);
    this.app.route(`/search`)
      .get(ctl.search)
      .post((req: express.Request, res: express.Response) => {
        res.status(200).send(`Post to users`);
      });

    return this.app;
  }

}
