import express from "express";
import {inject, singleton} from "tsyringe";
import {FileRepository} from "../../../db/repository/file.repository";
import {GetAllSharedResponse} from "./dto/get-all-shared.response";
import path from "path";
import {Node} from "../../../node";
import {Config} from "../../../config";

@singleton()
export class ConfigController {

  constructor(
    @inject("Config") private config: Config,
  ) {
  }

  getAll = async (req: express.Request, res: express.Response, _: express.NextFunction) => {
    res.json(this.config);
  }
}
