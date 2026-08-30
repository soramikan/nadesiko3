import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = dirname(fileURLToPath(import.meta.url))
const snakoPath = resolve(currentDir, '../command/snako.mjs')
const ansiPattern = /\x1B\[[0-?]*[ -/]*[@-~]/g

function runIsolated (code) {
  const result = spawnSync(process.execPath, [snakoPath, '-e', code], {
    encoding: 'utf8',
    timeout: 5000,
    killSignal: 'SIGKILL'
  })
  assert.equal(result.error, undefined, `子プロセスの実行に失敗しました: ${code}\n${result.error?.message || ''}`)
  assert.equal(result.signal, null, `パーサーがシグナルで停止しました: ${code} (${result.signal})`)
  return result
}

function outputOf (result) {
  return `${result.stdout || ''}${result.stderr || ''}`.replace(ansiPattern, '')
}

test('配列要素のカンマ省略でパーサーが停止しない #2436', () => {
  const result = runIsolated('A=[[0,0,0,0][0,0,0,0]];AをJSONエンコードして表示')
  assert.equal(result.status, 0, outputOf(result))
  assert.match(outputOf(result), /\[\[0,0,0,0\],\[0,0,0,0\]\]/)
})

test('空配列を並べてもパーサーが停止しない #2436', () => {
  const emptyArrays = runIsolated('A=[[][]];AをJSONエンコードして表示')
  assert.equal(emptyArrays.status, 0, outputOf(emptyArrays))
  assert.match(outputOf(emptyArrays), /\[\[\],\[\]\]/)
})

for (const code of ['A=[][0,0,0,0]', 'A=[]$', 'A=[[1]][0]$']) {
  test(`不正な後置アクセスでパーサーが停止しない #2436: ${code}`, () => {
    const result = runIsolated(code)
    assert.notEqual(result.status, 0, `不正な後置アクセスが成功しました: ${code}`)
    assert.match(outputOf(result), /文法エラー/)
  })
}
