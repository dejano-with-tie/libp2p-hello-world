import logger from "../../logger";

const errcode = require('err-code')

export enum ErrorCode {
  NOT_IMPLEMENTED = 'Not implemented',
  ILLEGAL_STATE = 'Illegal state',
  BAD_REQUEST = 'Bad request',
  RESOURCE_NOT_FOUND = 'Resource not found',
  DOWNLOAD_FILE_ALREADY_EXIST = 'File already exist',
  DOWNLOAD_IN_PROGRESS = 'There is already download in progress',
  DOWNLOAD_PAUSE = 'Download paused',
  PROTOCOL__UNKNOWN_MESSAGE_HANDLER = 'Protocol err; Unknown message handler',
  PROTOCOL__NO_MESSAGE_RECEIVED = 'Protocol err; no message received',
  PROTOCOL__RESPONSE_ERROR_MESSAGE = 'Protocol err; peer responded with error',
  PROTOCOL__RECEIVED_INVALID_MESSAGE = 'Protocol err; received invalid message',
}

// TODO: Need (http) status codes

function getEnumKeyByEnumValue<T extends { [index: string]: string }>(myEnum: T, enumValue: string): keyof T | null {
  let keys = Object.keys(myEnum).filter(x => myEnum[x] == enumValue);
  return keys.length > 0 ? keys[0] : null;
}

export const error = (error: ErrorCode, context?: any) => {
  if (context) {
    logger.error(context);
  }
  return errcode(new Error(error), getEnumKeyByEnumValue(ErrorCode, error), {context});
}
