var collator = typeof Intl === 'object' ?
  new Intl.Collator('default', { sensitivity: 'base', usage: 'search' }) :
  null

module.exports = function startsWith (rawText, rawTarget) {
  const text = rawText.toLocaleLowerCase()
  const target = rawTarget.toLocaleLowerCase()
  if (collator) return collator.compare(text.slice(0, target.length), target) === 0
  else if (text.slice(0, target.length).localeCompare(target) === 0) return true
  else return text.startsWith(target)
}
