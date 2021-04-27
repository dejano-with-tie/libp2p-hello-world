import {error, ErrorCode} from "./gateway/exception/error.codes";

export const isProd = (): boolean => {
  return process.env.NODE_ENV === 'production';
}

/**
 * Iterates the given `asyncIterator` and runs each item through the given `asyncFn` in parallel.
 * Returns a promise that resolves when all items of the `asyncIterator` have been passed
 * through `asyncFn`.
 *
 * @template T
 * @template O
 *
 * @param {AsyncIterable<T>} asyncIterator
 * @param {(arg0: T) => Promise<O>} asyncFn
 */
exports.mapParallel = async function (asyncIterator: any, asyncFn: any) {
  const tasks = []
  for await (const item of asyncIterator) {
    tasks.push(asyncFn(item))
  }
  return Promise.all(tasks)
}

/**
 * Expects only one iterable and returns it.
 *
 * @throws if there is more then one interable
 * @param asyncIterator
 */
export async function oneOnly<T>(asyncIterator: AsyncIterable<any>): Promise<T> {
  const tasks = []
  for await (const item of asyncIterator) {
    tasks.push(item);
  }
  if (tasks.length > 1) {
    throw error(ErrorCode.ILLEGAL_STATE, {msg: 'expected exactly one yield from async iterator'});
  }

  const [first] = await Promise.all(tasks);
  return first;
}

export function isGenerator(fn: any) {
  return fn.constructor.name === 'GeneratorFunction';
}

export function isAsyncIterator(obj: any) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.asyncIterator] === 'function';
}
