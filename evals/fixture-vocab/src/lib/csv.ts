export function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(text)) return '"' + text.replaceAll('"', '""') + '"'
  return text
}

export function row(cells: unknown[]): string {
  return cells.map(escapeCell).join(',')
}

export function table(headers: string[], rows: unknown[][]): string {
  return [row(headers), ...rows.map(row)].join('\n')
}

export function parseLine(line: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"'
        i++
      } else if (ch === '"') inQuotes = false
      else cur += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else cur += ch
  }
  cells.push(cur)
  return cells
}

export function parse(text: string): string[][] {
  return text.split(/\r?\n/).filter(line => line.length > 0).map(parseLine)
}

export function fromObjects(rows: Record<string, unknown>[], headers: string[]): string {
  return table(headers, rows.map(row => headers.map(h => row[h])))
}

export function toObjects(text: string): Record<string, string>[] {
  const lines = parse(text)
  const headers = lines[0]
  if (!headers) return []
  return lines.slice(1).map(cells => {
    const row: Record<string, string> = {}
    for (let i = 0; i < headers.length; i++) row[headers[i]!] = cells[i] ?? ''
    return row
  })
}
