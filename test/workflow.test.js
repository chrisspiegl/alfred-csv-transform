import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import packageJson from '../package.json' with { type: 'json' }
import { transformedResult } from '../src/transform.js'

const plist = readFileSync(new URL('../info.plist', import.meta.url), 'utf8')
const runScriptUid = 'BE19905A-A482-4FEE-84CB-983571FD1ECC'
const notificationUid = '72D79816-B552-4F5A-A5F5-76E4DB667046'
const transformGateUid = 'C1A7E4B2-5D90-4F38-8A16-2E9B7C04D5F1'
const transformedOutputUid = '9B2D6F80-1C47-4A5E-B391-7D8E0A6C25B4'

test('plist metadata matches the csv transform workflow', () => {
  assert.match(plist, new RegExp(`<key>version</key>\\s*<string>${packageJson.version}</string>`))
  assert.match(plist, /<key>description<\/key>\s*<string>Alfred workflow to transform CSV files between comma, semicolon, and tab delimiters\.<\/string>/)
  assert.equal(packageJson.name, 'alfred-csv-transform')
  assert.equal(packageJson.repository, 'chrisspiegl/alfred-csv-transform')
  assert.match(plist, /<key>bundleid<\/key>\s*<string>com\.chrisspiegl\.alfred-csv-transform<\/string>/)
  assert.match(plist, /<key>name<\/key>\s*<string>alfred-csv-transform<\/string>/)
  assert.match(plist, /<key>keyword<\/key>\s*<string>csvt<\/string>/)
  assert.match(plist, /<key>webaddress<\/key>\s*<string>https:\/\/github\.com\/chrisspiegl\/alfred-csv-transform<\/string>/)
  assert.match(plist, /<key>readme<\/key>\s*<string>Alfred workflow to transform CSV files between comma, semicolon, and tab delimiters\./)
  assert.equal(plist.includes('alfred-rename'), false)
  assert.equal(plist.includes('alfred-transform'), false)
  assert.match(plist, /<key>title<\/key>\s*<string>Transformed<\/string>/)
  assert.equal(plist.includes('Slugified their names!'), false)
})

test('the success notification runs only after a transform', () => {
  const connections = plist.slice(
    plist.indexOf('<key>connections</key>'),
    plist.indexOf('<key>createdby</key>'),
  )
  const scriptKey = `<key>${runScriptUid}</key>`
  const scriptStart = connections.indexOf(scriptKey)
  const scriptBlock = connections.slice(scriptStart, connections.indexOf('</array>', scriptStart))

  assert.equal(scriptBlock.includes(notificationUid), false)
  assert.match(scriptBlock, new RegExp(transformGateUid))
  assert.match(plist, new RegExp(`<key>matchstring</key>\\s*<string>${transformedResult}</string>`))
  assert.match(
    connections,
    new RegExp(`<key>destinationuid</key>\\s*<string>${notificationUid}</string>[\\s\\S]*?<key>sourceoutputuid</key>\\s*<string>${transformedOutputUid}</string>`),
  )
  assert.match(plist, /<key>concurrently<\/key>\s*<false\/>/)
  assert.equal(plist.includes('./node_modules/.bin/run-node index.js'), true)
  assert.equal(plist.includes('/usr/local/bin/node'), false)
})
