import express from "express";
import {singleton} from "tsyringe";

@singleton()
export class ErrorHandler {

  constructor(app: express.Application) {
    app.use(this.handlerNotFound);
    app.use(this.handle);
  }

  public handlerNotFound(req: express.Request, res: express.Response, next: express.NextFunction) {
    const err = new Error('Not Found');
    // @ts-ignore
    err.status = 404;
    next(err);
  }

  public handle(err: { stack: any; status: any; message: any; }, req: any, res: { status: (arg0: any) => void; json: (arg0: { errors: { message: any; error: any; }; }) => void; }, next: any) {
    console.log(err.stack);
    res.status(err.status || 500);
    res.json({
      'errors': {
        message: err.message,
        error: err
      }
    });
  };
}
