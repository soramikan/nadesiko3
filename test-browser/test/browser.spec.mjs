import { test, expect } from '@playwright/test'

/**
 * テストランナーHTMLページを開いて実行結果を取得するヘルパー関数
 * @param {import('@playwright/test').Page} page
 * @param {string} url - テストランナーHTMLのURL
 * @param {number} timeout - テスト完了待機タイムアウト（ms）
 */
async function runRunnerPage (page, url, timeout = 60000) {
  await page.goto(url)
  // ランナーが完了するまで待つ（window.__playwright_done__が設定されるまで）
  await page.waitForFunction(() => window.__playwright_done__ !== undefined, { timeout })
  return page.evaluate(() => window.__playwright_done__)
}

/**
 * テスト結果を検証してplaywrightのexpectに報告する
 * @param {object} result - runMochaPageの戻り値
 */
function assertNoFailures (result) {
  if (result.failures > 0) {
    const details = result.failures_detail
      .map((f) => `  - ${f.title}: ${f.error}`)
      .join('\n')
    throw new Error(`${result.failures}件のテストが失敗しました:\n${details}`)
  }
  expect(result.failures).toBe(0)
}

test('browser smoke test', async ({ page }) => {
  const result = await runRunnerPage(page, '/test-browser/test/html/browser-smoke-runner.html')
  assertNoFailures(result)
})

test('browser full test', async ({ page }) => {
  test.setTimeout(300000)
  // フルテストはより長いタイムアウトを使用する
  const result = await runRunnerPage(page, '/test-browser/test/html/browser-full-runner.html', 240000)
  assertNoFailures(result)
})

test('browser smoke parser progress #2436', async ({ page }) => {
  await page.goto('/test-browser/test/html/browser-smoke-runner.html')
  const result = await page.evaluate(async () => {
    const worker = new Worker('/test-browser/test/browser/parser_progress_worker.mjs', { type: 'module' })
    const waitMessage = (timeout, timeoutMessage) => new Promise((resolve, reject) => {
      const finish = (callback) => {
        clearTimeout(timer)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        callback()
      }
      const onMessage = (event) => finish(() => resolve(event.data))
      const onError = (event) => finish(() => reject(new Error(event.message || 'Web Workerの実行に失敗しました')))
      const timer = setTimeout(() => finish(() => reject(new Error(timeoutMessage))), timeout)
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
    })
    const run = async (code) => {
      const response = waitMessage(5000, `なでしこパーサーが制限時間内に完了しませんでした: ${code}`)
      worker.postMessage(code)
      return response
    }
    try {
      const ready = await waitMessage(15000, 'Web Workerの初期化が制限時間内に完了しませんでした')
      if (ready?.type !== 'ready') { throw new Error('Web Workerの初期化応答が不正です') }
      return {
        valid: await run('A=[[0,0,0,0][0,0,0,0]];AをJSONエンコードして表示'),
        invalidIndex: await run('A=[][0,0,0,0]'),
        invalidProp: await run('A=[]$')
      }
    } finally {
      worker.terminate()
    }
  })
  expect(result.valid).toEqual({ ok: true, log: '[[0,0,0,0],[0,0,0,0]]' })
  expect(result.invalidIndex).toEqual({ ok: false, error: expect.stringContaining('文法エラー') })
  expect(result.invalidProp).toEqual({ ok: false, error: expect.stringContaining('文法エラー') })
})
