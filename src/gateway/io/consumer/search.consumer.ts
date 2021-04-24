import {FindProviderRequest} from "../../controller/dto/find-provider.request";
import {FindFilesUseCase} from "../../../usecase/find-files-use.case";
import {injectable} from "tsyringe";

@injectable()
export class SearchConsumer {

  constructor(private findProviderUseCase: FindFilesUseCase) {
  }

  public async* onSearch(request: FindProviderRequest) {
    const providers = await this.findProviderUseCase.execute(request);
    for await(const provider of providers) {
      // TODO: Might transform response here
      yield provider;
    }
  }
}
