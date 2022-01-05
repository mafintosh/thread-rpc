import { parentPort } from 'worker_threads'
import RPC from '../index.js'

// process.stdout.isTTY = true

const rpc = new RPC(parentPort)

const a = await rpc.request('hello')

console.log('a', a)

const b = rpc.requestSync('echo', 'world')

console.log('b', b)

const c = rpc.requestSync('hello-massive')

console.log('c', c)
