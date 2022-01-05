const b4a = require('b4a')

module.exports = class ThreadRPC {
  constructor (port, { syncBufferSize = 4096 } = {}) {
    this.port = port
    this.syncBufferSize = syncBufferSize

    if (typeof this.port.on === 'function') this.port.on('message', this._onmessagedata.bind(this))
    else this.port.onmessage = this._onmessage.bind(this)

    this._id = 1

    this._sync = null
    this._syncBuf = null
    this._syncInt = null

    this._resync = new Map()
    this._responses = new Map()
    this._responders = new Map()
  }

  _onmessage (e) {
    this._onmessagedata(e.data)
  }

  _onmessagedata (data) {
    if (data.method) this._onrequest(data)
    else if (data.sync) this._onresync(data)
    else this._onresponse(data)
  }

  async _onrequest ({ method, params, id, sync }) {
    const opts = { sync: !!sync, transferList: [] }

    let result = null
    let error = null

    const r = this._responders.get(method)

    if (r) {
      try {
        result = await r(params, opts)
      } catch (err) {
        error = err.message
      }
    } else {
      error = 'Unknown method: ' + method
    }

    if (sync) {
      const i = new Int32Array(sync.buffer, 0, 2)
      const b = b4a.from(sync.buffer, 8, sync.buffer.byteLength - 8)

      let type = 0
      let buf

      if (error) {
        buf = encodeString(error, i, b)
        type = 1
      } else if (typeof result === 'string') {
        buf = encodeString(result, i, b)
        type = 2
      } else if (b4a.isBuffer(result)) {
        i[1] = result.byteLength
        if (i[1] < b.byteLength) b4a.copy(result, b)
        else buf = result
        type = 3
      } else {
        buf = encodeString(JSON.stringify(result), i, b)
        type = 4
      }

      if (buf.byteLength > b.byteLength) {
        this._resync.set(id, { type, buf })
      }

      i[0] = type

      Atomics.notify(i, 0)
      return
    }

    this.port.postMessage({ result, error, id }, opts.transferList)
  }

  _onresponse ({ result, error, id }) {
    const r = this._responses.get(id)
    if (!r) return

    this._responses.delete(id)
    if (error) r[1](new Error(error))
    else r[0](result)
  }

  _onresync ({ id, sync }) {
    const r = this._resync.get(id)
    if (!r) return

    this._resync.delete(id)

    const i = new Int32Array(sync.buffer, 0, 2)
    const b = b4a.from(sync.buffer, 8, sync.buffer.byteLength - 8)

    b4a.copy(r.buf, b)
    i[1] = r.buf.byteLength
    i[0] = r.type

    Atomics.notify(i, 0)
  }

  _alloc () {
    const buffer = new SharedArrayBuffer(this.syncBufferSize)

    this._sync = {
      buffer,
      byteOffset: 0
    }

    this._syncInt = new Int32Array(buffer, 0, 2)
    this._syncBuf = b4a.from(buffer, 8, buffer.byteLength - 8)
  }

  _postSync (method, params, id, transferList) {
    this.port.postMessage({ method, params, id, sync: this._sync }, transferList)
    this._syncInt[0] = 0

    Atomics.wait(this._syncInt, 0, 0)
  }

  respond (method, fn) {
    this._responders.set(method, fn)
  }

  requestSync (method, params = null, transferList) {
    if (!this._sync) this._alloc()

    const id = this._id++

    this._postSync(method, params, id, transferList)

    const bytesNeeded = this._syncBuf.byteOffset + this._syncInt[1]

    if (bytesNeeded > this.syncBufferSize) {
      while (bytesNeeded > this.syncBufferSize) this.syncBufferSize *= 2
      this._alloc()
      this._postSync(null, null, id, undefined)
    }

    const [type, len] = this._syncInt

    if (type === 1) {
      throw new Error(b4a.toString(this._syncBuf, 'utf-8', 0, len))
    }
    if (type === 2) {
      return b4a.toString(this._syncBuf, 'utf-8', 0, len)
    }
    if (type === 3) {
      const buf = this._syncBuf.subarray(0, len)
      this._syncBuf = this._syncBuf.subarray(len)
      return buf
    }

    return JSON.parse(b4a.toString(this._syncBuf, 'utf-8', 0, len))
  }

  request (method, params = null, transferList) {
    const id = this._id++
    return new Promise((resolve, reject) => {
      this._responses.set(id, [resolve, reject])
      this.port.postMessage({ method, params, id }, transferList)
    })
  }
}

function encodeString (s, i, b) {
  i[1] = b4a.byteLength(s)

  if (i[1] > b.byteLength) return b4a.from(s)

  b4a.write(b, s)
  return b
}
