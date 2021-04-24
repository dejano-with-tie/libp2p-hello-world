import express from "express";
import {singleton} from "tsyringe";
import {FindFilesUseCase} from "../../usecase/find-files-use.case";

@singleton()
export class SearchController {

  private findProviderUseCase: FindFilesUseCase;

  constructor(findProviderUseCase: FindFilesUseCase) {
    this.findProviderUseCase = findProviderUseCase;
  }

  search = async (req: express.Request, res: express.Response) => {
    // const dto: FindProviderRequest = req.body;
    // await this.findProviderUseCase.execute(dto);
    // // const providers = await res.locals.node.find(req.params['name']);
    // // logger.info(providers);
    // res.json('ok');
    const it = this.demo();
    let r = it.next();
    r = it.next();
    r = it.next();

    const number1 = await this.printNumber1();
    const number2 = await this.printNumber2();
    console.log(number1);
    console.log(number2);

    const promise1 = this.printNumber1();
    const promise2 = this.printNumber2();
    const number1p = await promise1;
    const number2p = await promise2;
    console.log(number1p);
    console.log(number2p);
  }

  *demo() {
    var res = yield 10;
    console.log(res);
    yield 20;
    return 400;
  }

  printNumber1() {
    return new Promise((resolve,reject) => {
      setTimeout(() => {
        console.log("Number1 is done");
        resolve(10);
      },1000);
    });
  }

  printNumber2() {
    return new Promise((resolve,reject) => {
      setTimeout(() => {
        console.log("Number2 is done");
        resolve(20);
      },500);
    });
  }
}
