import CID from "cids";
import json from 'multiformats/codecs/json'
import {sha256} from 'multiformats/hashes/sha2'

export class CidDomain {

  private _value: CID | undefined;

  constructor(private _name: string) {
  }

  public async digest(): Promise<CidDomain> {
    const bytes = json.encode({name: this._name});
    const hash = await sha256.digest(bytes);
    this._value = new CID(1, json.code, hash.bytes);
    return this;
  }

  get value(): CID {
    return <CID>this._value;
  }

  public toString(): string {
    return <string>this._value?.toString();
  }

  get name(): string {
    return this._name;
  }
}
