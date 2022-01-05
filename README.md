# thread-rpc

Run RPC over a MessagePort object from a Worker thread (or WebWorker)

```
npm install thread-rpc
```

## Usage

First in the parent thread

``` js
const ThreadRPC = require('thread-rpc')

// in the main process
const main = new ThreadRPC(workerThreadsInstance)

main.respond('echo', async function (data) {
  return {
    echo: data
  }
})
```

Then in the child thread

``` js
const child = new ThreadRPC(workerThreads.parentPort)

// Send a request
console.log(await child.request('echo', 'world'))

// Send a request synchronously
console.log(child.requestSync('echo', 'world'))
```

## API

#### `const rpc = new ThreadRPC(messagePort, [options])`

Create a new instance. `messagePort` should be a message port instance (ie has the postMessage API).
Options include:

``` js
{
  syncBufferSize: 4096 // initial size of the sync request shared array buffer
}
```

#### `rpc.respond(method, async onrequest (params, opts))`

Setup a responder for a method. Options include:

```
{
  transferList, // passed to postMessage's transferList
  sync: bool // true is this is from requestSync - mostly here for debugging
}
```

#### `const res = await rpc.request(method, params, [transferList])`

Send a request to the other side of the instance.

#### `const res = rpc.requestSync(method, params, [transferList])`

Same as above except it's synchronous, so it blocks the thread - use with care.

Note that currently this only supports JSON.stringify'able responses or a Buffer/Uint8Array response.

## License

MIT
