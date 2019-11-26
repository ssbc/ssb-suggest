var collator = typeof Intl === 'object' ? 
  new Intl.Collator('default', { sensitivity: 'base', usage: 'search' }) : 
  null

module.exports = function startsWith (text, target) {
  if (collator) return collator.compare(text.slice(0, target.length), target) === 0
  else return text.slice(0, target.length).localeCompare(target) === 0
}
