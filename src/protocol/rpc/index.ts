import PeerId from "peer-id";
import {MessageHandler} from "./handlers";
import {Message} from "../proto/proto";
import {singleton} from "tsyringe";
import {isAsyncIterator} from "../../utils";
import pipe from "it-pipe";
import lengthPrefixed from "it-length-prefixed";
import {map} from "streaming-iterables";

@singleton()
export class Rpc {
  constructor(private messageHandler: MessageHandler) {
  }

  public async* handleMessage(peerId: PeerId, message: Message): AsyncGenerator<Message> {
    try {
      const handler = this.messageHandler.getHandler(message.type);
      const response = await handler.handle(peerId, message);

      if (!isAsyncIterator(response)) {
        yield response;
        return;
      }

      yield* response;
    } catch (e) {
      console.error(e);
      const errResponse = new Message(message.type);
      errResponse.error = e.toString();
      yield errResponse;
    }
  }

  public async* sendMessage(request: Message, stream: any): AsyncIterable<Message> {
    return yield* pipe(
      [request.serialize()],
      lengthPrefixed.encode(),
      stream,
      lengthPrefixed.decode(),
      map((chunk: Uint8Array) => Message.deserialize(chunk.slice())),
    );
  }
}
