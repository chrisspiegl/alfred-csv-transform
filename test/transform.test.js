import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { test } from 'node:test'
import {
  buildTransformItems,
  parseTransformPayload,
  resultToken,
  skippedResult,
  transformedResult,
  transformFiles,
} from '../src/transform.js'

function tempDirectory() {
  return mkdtempSync(path.join(tmpdir(), 'alfred-csv-transform-'))
}

function writeCsv(filePath, contents) {
  writeFileSync(filePath, contents)
}

test('preview arg is one string for every selected file', () => {
  const root = tempDirectory()
  try {
    const firstPath = path.join(root, 'a.csv')
    const secondPath = path.join(root, 'b.csv')
    writeCsv(firstPath, 'name,age\nAda,36\n')
    writeCsv(secondPath, 'name,age\nGrace,40\n')

    const semicolon = buildTransformItems([firstPath, secondPath], `${firstPath}\t${secondPath}`)
      .find(item => item.match === 'Convert to Semicolon-separated')

    assert.equal(typeof semicolon.arg, 'string')
    const files = JSON.parse(semicolon.arg)
    assert.equal(files.length, 2)
    assert.equal(files[0].filenameAfter, 'a.semicolon.csv')
    assert.equal(files[1].filenameAfter, 'b.semicolon.csv')
    assert.equal(semicolon.arg.includes('a.semicolon.csv'), true)
    assert.equal(Array.isArray(semicolon.arg), false)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('missing text_to_add does not throw', () => {
  const root = tempDirectory()
  const previous = process.env.text_to_add
  delete process.env.text_to_add
  try {
    const filePath = path.join(root, 'a.csv')
    writeCsv(filePath, 'name,age\nAda,36\n')

    assert.doesNotThrow(() => {
      const items = buildTransformItems([filePath], filePath)
      assert.ok(items.length > 0)
      assert.equal(parseTransformPayload(undefined), null)
    })
  }
  finally {
    if (previous === undefined)
      delete process.env.text_to_add
    else
      process.env.text_to_add = previous
    rmSync(root, { recursive: true, force: true })
  }
})

test('transforms a file and skips the success token when nothing was written', async () => {
  const root = tempDirectory()
  try {
    const filepathBefore = path.join(root, 'data.csv')
    const filepathAfter = path.join(root, 'data.semicolon.csv')
    writeCsv(filepathBefore, 'name,age\nAda,36\n')

    const transformedCount = await transformFiles([{
      filepathBefore,
      filepathAfter,
      detectedDelimiter: ',',
      targetDelimiter: ';',
    }])

    assert.equal(transformedCount, 1)
    assert.equal(resultToken(transformedCount), transformedResult)
    assert.match(readFileSync(filepathAfter, 'utf8'), /name;age/)

    await assert.rejects(() => transformFiles([{
      filepathBefore: path.join(root, 'missing.csv'),
      filepathAfter: path.join(root, 'missing.semicolon.csv'),
      detectedDelimiter: ',',
      targetDelimiter: ';',
    }]))
    assert.equal(resultToken(0), skippedResult)
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})
