const protons = require('protons');
import {fromString, toString} from 'uint8arrays';

const { Request } = protons(`
message Request {
  enum Type {
    PUBLISH = 1;
    FIND = 2;
  }
  
  required Type type = 1;
  optional PublishFile publish = 2;
  optional SearchForFile search = 3;
}

message PublishFile {
    required bytes id = 1;
    required string name = 2;
    required int64 size = 3;
}

message SearchForFile {
    required bytes name = 1;
}
`)