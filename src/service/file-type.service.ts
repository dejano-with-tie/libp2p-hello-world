import {singleton} from "tsyringe";
import FileType from 'file-type';

const readChunk = require('read-chunk');


@singleton()
export class FileTypeService {

  public async type(filePath: string): Promise<{ ext: string; mime: string }> {
    const buffer = readChunk.sync(filePath, 0, 4100);
    const type = await FileType.fromBuffer(buffer);
    if (type) {
      return {ext: type.ext, mime: type.mime};
    }

    return {ext: 'bin', mime: 'application/x-binary'};
  }

}
