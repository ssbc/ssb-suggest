const normalise = require('./normalise')
const startsWith = require('./starts-with')

module.exports = function reduceMatches (text, matches) {
  const exactMatches = matches
    .filter(m => m.name === text)
    .sort((a, b) => compareBool(isPreferredName(a), isPreferredName(b)))

  const normText = normalise(text)

  const partialPreferredNameMatch = matches
    .filter(isPreferredName)
    .filter(m => startsWith(normalise(m.name), normText, false))

  const exactNormalisedMatches = matches
    .filter(m => normalise(m.name) === normText)
    .sort((a, b) => compareBool(isPreferredName(a), isPreferredName(b)))

  const partialExactMatches = matches
    .filter(m => startsWith(m.name, text, false))
    .sort((a, b) => compareBool(isPreferredName(a), isPreferredName(b)))

  const partialNormalisedMatches = matches
    .filter(m => startsWith(normalise(m.name), normText, false))
    .sort((a, b) => compareBool(isPreferredName(a), isPreferredName(b)))

  const dreggs = matches

  const prioritisedMatches = [
    ...exactMatches,
    ...partialPreferredNameMatch,
    ...exactNormalisedMatches,
    ...partialExactMatches,
    ...partialNormalisedMatches,
    ...dreggs
  ]

  var seenIds = new Set()

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
