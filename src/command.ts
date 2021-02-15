import pipe from 'it-pipe';

// Define the codec of our chat protocol
const PROTOCOL = '/libp2p/command/1.0.0'

/**
 * A simple handler to print incoming messages to the console
 * @param {Object} params
 * @param {Connection} params.connection The connection the stream belongs to
 * @param {Stream} params.stream A stream to the peer
 */
async function handler ({ connection, stream }: ({ connection: any, stream: any })) {
    try {
        await pipe(
            stream,
            (source: any) => (async function * () {
                for await (const message of source) {
                    console.info(`${connection.remotePeer.toB58String().slice(0, 8)}: ${String(message)}`)

                    // Auto reply on the same stream
                    // yield AutoReplies[Math.floor(Math.random() * AutoReplies.length)]
                }
            })(),
            stream
        )
    } catch (err) {
        console.error(err)
    }
}

/**
 * Writes the `message` over the given `stream`. Any direct replies
 * will be written to the console.
 *
 * @param {Buffer|String} message The message to send over `stream`
 * @param {PullStream} stream A stream over the muxed Connection to our peer
 */
async function send (message: any, stream: any) {
    try {
        await pipe(
            [ message ],
            stream,
            async function (source: any) {
                for await (const message of source) {
                    console.info(String(message))
                }
            }
        )
    } catch (err) {
        console.error(err)
    }
}

export {
    PROTOCOL,
    handler,
    send
}
