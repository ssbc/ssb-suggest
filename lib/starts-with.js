var flat = require('./normalise')
var collator = typeof Intl === 'object'
  ? new Intl.Collator('default', { sensitivity: 'base', usage: 'search' })
  : null

module.exports = function startsWith (rawText, rawTarget, normalise = true) {
  // some avatar.name are comming through as null
  if (!rawText || !rawTarget) return false

  const text = normalise ? flat(rawText) : rawText
  const target = normalise ? flat(rawTarget) : rawTarget

  if (collator) return collator.compare(text.slice(0, target.length), target) === 0
  else if (text.slice(0, target.length).localeCompare(target) === 0) return true
  else return text.startsWith(target)
}
