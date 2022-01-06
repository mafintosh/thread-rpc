import { Worker } from 'worker_threads'
import RPC from '../index.js'

const w = new Worker('./thread.mjs')

const rpc = new RPC(w)

rpc.respond('echo', async function (data) {
  return { echo: data }
})

rpc.respond('hello', async function (data) {
  return { foo: true }
})

rpc.respond('hello-massive', async function (data) {
  return Buffer.alloc(9000)
})

w.on('exit', function () {
  console.log('(worker exited...)')
})
