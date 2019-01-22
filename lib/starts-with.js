var collator = new Intl.Collator('default', { sensitivity: 'base', usage: 'search' })

module.exports = function startsWith (text, target) {
  return collator.compare(text.slice(0, target.length), target) === 0
}
