const normalise = require('./normalise')
const startsWith = require('./starts-with')

module.exports = function sort (text, matches) {
  const normText = normalise(text)
  var seenIds = new Set()

  return matches
    // for each person, bubble up the option where the match.name is the best match to search
    .sort((a, b) => {
      // if text+name are exact match
      if (a.name === text) return -1
      if (b.name === text) return +1

      const normA = normalise(a.name)
      const normB = normalise(b.name)

      // where normalised text+name are exact match
      if (normA === normText) return -1
      if (normB === normText) return +1

      // where name is matching exactly so far
      if (startsWith(a.name, text, false)) return -1
      if (startsWith(b.name, text, false)) return +1

      // where name is matching exactly so far (case insensitive)
      if (startsWith(normA, text)) return -1
      if (startsWith(normB, text)) return +1
    })

    .filter((el, i, arr) => {
      if (i === 0) {
        console.log('////////////////////////////////////////')
        console.log(1)
        console.log(arr.map(m => (m.avatar.id + m.name)))
      }
      return true
    })

    // bubble up names where typed word matches our name for them
    .sort((a, b) => {
      if (a.avatar.id !== b.avatar.id) return 0

      return compareBool(isPreferredName(a), isPreferredName(b))
    })

    .filter((el, i, arr) => {
      if (i === 0) {
        console.log(2)
        console.log(arr.map(m => (m.avatar.id + m.name)))
      }
      return true
    })

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
