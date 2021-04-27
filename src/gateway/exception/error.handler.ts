import express from "express";
import {singleton} from "tsyringe";

@singleton()
export class ErrorHandler {

  constructor() {
  }

  public static notFound(req: express.Request, res: express.Response, next: express.NextFunction) {
    const err = new Error('Not Found');
    // @ts-ignore
    err.status = 404;
    next(err);
  }

  public static general(err: any, req: express.Request, res: express.Response, next: express.NextFunction) {
    console.error(err.stack);
    res.status(err.status || 500);
    res.json({
      'errors': {
        message: err.message,
        error: err
      }
    });
  };

  /**
   * A wrapper to workaround async errors not being transmitted correctly.
   *
   * @param fn
   */
  public static catchAsync = (fn: ((req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>)) => {
    return async function (req: express.Request, res: express.Response, next: express.NextFunction) {
      try {
        await fn(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }
}
