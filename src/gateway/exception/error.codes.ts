const errcode = require('err-code')

export enum ErrorCode {
  NOT_IMPLEMENTED = 'Not implemented'
}

function getEnumKeyByEnumValue<T extends { [index: string]: string }>(myEnum: T, enumValue: string): keyof T | null {
  let keys = Object.keys(myEnum).filter(x => myEnum[x] == enumValue);
  return keys.length > 0 ? keys[0] : null;
}

export const throwError = (error: ErrorCode) => {
  throw errcode(new Error(ErrorCode.NOT_IMPLEMENTED), getEnumKeyByEnumValue(ErrorCode, error))
}
