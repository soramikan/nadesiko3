import { NakoCompiler } from '/core/src/nako3.mjs'

self.postMessage({ type: 'ready' })

self.onmessage = async (event) => {
  try {
    const nako = new NakoCompiler()
    const result = await nako.runAsync(event.data, 'main.nako3')
    self.postMessage({ ok: true, log: result.log })
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error?.stack || error?.message || String(error)
    })
  }
}
