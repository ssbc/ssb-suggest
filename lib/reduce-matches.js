const normalise = require('./normalise')
const startsWith = require('./starts-with')

module.exports = function reduceMatches (text, matches) {
  var seenIds = new Set()

  const exactMatches = matches
    .filter(m => m.name === text)
    .sort((a, b) => compareBool(isPreferredName(a), isPreferredName(b)))
  exactMatches.forEach(m => seenIds.add(m.avatar.id))

  const normText = normalise(text)

  const partialPreferredNameMatch = matches
    .filter(m => !seenIds.has(m.avatar.id))
    .filter(isPreferredName)
    .filter(m => startsWith(normalise(m.name), normText, false))
  partialPreferredNameMatch.forEach(m => seenIds.add(m.avatar.id))

  const exactNormalisedMatches = matches
    .filter(m => !seenIds.has(m.avatar.id))
    .filter(m => normalise(m.name) === normText)
    .sort((a, b) => compareBool(isPreferredName(a), isPreferredName(b)))
  exactNormalisedMatches.forEach(m => seenIds.add(m.avatar.id))

  const partialExactMatches = matches
    .filter(m => !seenIds.has(m.avatar.id))
    .filter(m => startsWith(m.name, text, false))
    .sort((a, b) => compareBool(isPreferredName(a), isPreferredName(b)))
  partialExactMatches.forEach(m => seenIds.add(m.avatar.id))

  const partialNormalisedMatches = matches
    .filter(m => !seenIds.has(m.avatar.id))
    .filter(m => startsWith(normalise(m.name), normText, false))
    .sort((a, b) => compareBool(isPreferredName(a), isPreferredName(b)))
  partialNormalisedMatches.forEach(m => seenIds.add(m.avatar.id))

  const dreggs = matches.filter(m => !seenIds.has(m.avatar.id))

  const prioritisedMatches = [
    ...exactMatches,
    ...partialPreferredNameMatch,
    ...exactNormalisedMatches,
    ...partialExactMatches,
    ...partialNormalisedMatches,
    ...dreggs
  ]

  seenIds = new Set() // reset for another use!

  return prioritisedMatches

    // drop any duplicates of particular identities
    .reduce((soFar, match) => {
      if (seenIds.has(match.avatar.id)) return soFar

      seenIds.add(match.avatar.id)

      const aliases = Array.isArray(match.avatar.names) ? new Set(match.avatar.names) : new Set()
      aliases.delete(match.name)
      match.avatar.aliases = Array.from(aliases)

      soFar.push(match)
      return soFar
    }, [])

    // push tombstones accounts to the bottom
    // TODO replace once we have tombstones
    .sort((a, b) => compareBool(!isDead(a), !isDead(b)))
}

function compareBool (a, b) {
  if (a === b) return 0
  if (a) return -1
  if (b) return +1
  return 0
}

function isPreferredName (match) {
  return match.name === match.avatar.name
}

function isDead (match) {
  return match.avatar.name.startsWith('deprecated') ||
    match.avatar.name.startsWith('dead') ||
    match.avatar.names.find(name => name.startsWith('deprecated')) ||
    match.avatar.names.find(name => name.startsWith('dead'))
}
