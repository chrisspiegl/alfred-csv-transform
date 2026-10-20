import process from 'node:process'
import alfy from 'alfy'
import {
  buildTransformItems,
  parseTransformPayload,
  resultToken,
  transformCsv,
} from './src/transform.js'
import { findFilter } from './src/utils.js'

function filterOutput(filter, output) {
  const filterParts = filter.split(' ')
  for (const filterPart of filterParts) {
    output = alfy.matches(filterPart, output, 'match')
  }

  return output
}

// A transform payload is the selected item arg. Anything else is Script Filter input.
const filesToTransform = parseTransformPayload(alfy.input);

(async () => {
  if (filesToTransform && filesToTransform.length > 0) {
    try {
      console.error(`Starting transformation of ${filesToTransform.length} file(s)`)
      let transformedCount = 0
      for (const file of filesToTransform) {
        console.error(`Transforming: ${file.filepathBefore} -> ${file.filepathAfter}`)
        await transformCsv(file.filepathBefore, file.filepathAfter, file.detectedDelimiter, file.targetDelimiter)
        transformedCount += 1
      }

      console.error(`Successfully transformed ${filesToTransform.length} file(s)`)
      process.stdout.write(resultToken(transformedCount))
      process.exit(0)
    }
    catch (error) {
      console.error('Error during transformation:', error)
      process.exit(1)
    }
  }

  const query = typeof alfy.input === 'string' ? alfy.input : ''
  const { inputWithoutFilter, foundFilter: filter } = findFilter(query)
  const input = inputWithoutFilter
    .replaceAll('\t', '\n')
    .split('\n')
    .map(element => element.trim())
  const output = buildTransformItems(input, query)
  if (output.length > 0) {
    alfy.output(filter ? filterOutput(filter, output) : output)
  }
  else {
    alfy.output([{
      title: 'No CSV files to transform…',
      subtitle: 'Please provide valid CSV or TSV files as input.',
    }])
  }
})()
