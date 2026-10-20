import fs from 'node:fs'
import path from 'node:path'
import * as csv from 'fast-csv'
import { isFileActionCaseSensitive } from './utils.js'

export const transformedResult = 'transformed'
export const skippedResult = 'skipped'

const options = [
  {
    prefix: 'Convert to Comma-separated',
    to: ',',
    extension: 'csv',
    action: 'comma',
    mode: 'comma',
  },
  {
    prefix: 'Convert to Semicolon-separated',
    to: ';',
    extension: 'csv',
    action: 'semicolon',
    mode: 'semicolon',
  },
  {
    prefix: 'Convert to Tab-separated',
    to: '\t',
    extension: 'tsv',
    action: 'tab',
    mode: 'tab',
  },
]

export function resultToken(transformedCount) {
  return transformedCount > 0 ? transformedResult : skippedResult
}

export function parseTransformPayload(raw) {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed
    }

    if (typeof parsed === 'object' && parsed?.filepathBefore) {
      return [parsed]
    }
  }
  catch {
    // Script Filter input is a path list, not a transform payload.
  }

  return null
}

export function detectDelimiter(filePath) {
  const sample = fs.readFileSync(filePath, 'utf8').slice(0, 1024)
  const commaCount = (sample.match(/,/g) || []).length
  const semicolonCount = (sample.match(/;/g) || []).length
  const tabCount = (sample.match(/\t/g) || []).length

  if (tabCount > commaCount && tabCount > semicolonCount) {
    return '\t'
  }

  if (semicolonCount > commaCount) {
    return ';'
  }

  return ','
}

export function transformCsv(inputFile, outputFile, fromDelimiter, toDelimiter) {
  return new Promise((resolve, reject) => {
    const data = []
    const readStream = fs.createReadStream(inputFile)
    readStream.on('error', reject)

    readStream
      .pipe(csv.parse({ headers: true, delimiter: fromDelimiter }))
      .on('data', row => data.push(row))
      .on('end', () => {
        const ws = fs.createWriteStream(outputFile)
        const csvStream = csv.format({ headers: true, delimiter: toDelimiter })

        csvStream.pipe(ws)

        data.forEach((row) => {
          csvStream.write(row)
        })

        csvStream.end()

        ws.on('finish', () => resolve())
        ws.on('error', reject)
      })
      .on('error', reject)
  })
}

export async function transformFiles(files) {
  let transformedCount = 0
  for (const file of files) {
    await transformCsv(file.filepathBefore, file.filepathAfter, file.detectedDelimiter, file.targetDelimiter)
    transformedCount += 1
  }

  return transformedCount
}

export function buildTransformItems(filePaths, rawInput) {
  if (!isFileActionCaseSensitive(filePaths)) {
    return [{
      title: 'Input must be valid and existing CSV or TSV file(s)',
      valid: false,
      variables: {
        input: rawInput,
      },
    }]
  }

  return options.map((option) => {
    const files = filePaths
      .filter((filepath) => {
        const ext = path.extname(filepath).toLowerCase()
        return ext === '.csv' || ext === '.tsv'
      })
      .map((filepath) => {
        const detectedDelimiter = detectDelimiter(filepath)
        const filenameBefore = path.basename(filepath, path.extname(filepath))
        const filenameAfter = `${filenameBefore}.${option.action}.${option.extension}`
        const filepathBefore = path.resolve(filepath)
        const filepathAfter = path.resolve(path.dirname(filepath), filenameAfter)

        return {
          filenameBefore,
          filenameAfter,
          filepathBefore,
          filepathAfter,
          detectedDelimiter,
          targetDelimiter: option.to,
        }
      })
      .filter(element => element.detectedDelimiter !== element.targetDelimiter)

    if (files.length === 0) {
      return false
    }

    return {
      title: `${option.prefix}: ${files[0].filenameAfter}`,
      subtitle: `Convert ${files.length} file(s) to ${option.to === '\t' ? 'tab' : option.to} separated.`,
      match: option.prefix,
      valid: true,
      arg: JSON.stringify(files),
      variables: {
        action: 'transform',
      },
    }
  }).filter(element => Boolean(element))
}
