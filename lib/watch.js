var pull = require('pull-stream')
var ref = require('ssb-ref')
var pullCat = require('pull-cat')

module.exports = {
  newAbouts,
  recentAuthors,
  follows
}

function follows (ssb, state) {
  if (state.quiting) return

  if (ssb.patchwork && ssb.patchwork.contacts) {
    // use the public friend states for suggestions (not private)
    // so that we can find friends that we can still find ignored friends (privately blocked)
    pull(
      ssb.patchwork.contacts.stateStream({ live: true, feedId: ssb.id }),
      pull.drain(states => {
        Object.keys(states).forEach(key => {
          if (states[key] === true) {
            state.following.add(key)
            state.updateQueue.add(key)
          } else {
            state.following.delete(key)
          }
        })
      })
    )
    // TODO - add existing friends, e.g. run this source:
    // ssb.patchwork.contacts.stateStream({ reverse: true, feedId: ssb.id }),
  } else if (ssb.friends) {
    pull(
      ssb.friends.hopStream({ live: true, old: true }),
      pull.filter(d => !d.sync),
      pull.drain(d => {
        Object.keys(d)
          .filter(feedId => d[feedId] >= 0 && d[feedId] <= 1) // just people I follow
          .forEach(feedId => {
            state.following.add(feedId)
            state.updateQueue.add(feedId)
          })
      }, () => console.log('!!! hopStream ended !!!'))
    )
  }
}

function newAbouts (ssb, state) {
  if (state.quiting) return

  function isValidAbout(msg) {
    // TODO schema validation!
    return ref.isFeedId(msg.value.content.about) &&
      (typeof msg.value.content.name === 'string' || msg.value.content.image)
  }

  if (ssb.db) {
    const { and, type, live, toPullStream } = ssb.db.operators
    pull(
      ssb.db.query(
        and(type('about')),
        live(),
        toPullStream(),
        pull.filter(isValidAbout),
        pull.drain(msg => {
          state.updateQueue.add(msg.value.content.about)
        })
      )
    )
  } else {
    pull(
      ssb.backlinks.read({
        live: true,
        old: false,
        query: [{ $filter: {
          dest: { $prefix: '@' },
          value: { content: { type: 'about' } }
        } }]
      }),
      pull.filter(msg => !msg.sync),
      pull.filter(isValidAbout),
      pull.drain(msg => {
        state.updateQueue.add(msg.value.content.about)
      })
    )
  }
}

function recentAuthors (ssb, state) {
  if (state.quiting) return
  const howFarBack = 300

  function updateState(author) {
    if (!state.suggestCache[author]) {
      state.updateQueue.add(author)
    }

    // update recent authors
    var index = state.recentAuthors.indexOf(author)
    if (~index) state.recentAuthors.splice(index, 1) // pop from current position
    state.recentAuthors.push(author) // add to end
  }

  if (ssb.db) {
    const { and, type, live, paginate, descending, toPullStream } = ssb.db.operators

    pull(
      pullCat([
        pull(
          ssb.db.query(
            paginate(howFarBack),
            descending(),
            toPullStream()
          ),
          pull.take(1)
        ),
        ssb.db.query(
          live(),
          toPullStream()
        )
      ]),
      pull.drain((results) => {
        if (Array.isArray(results)) // non-live
          results.forEach(msg => updateState(msg.value.author))
        else if (results) // live
          updateState(results.value.author)
      })
    )
  } else {
    pull(
      pullCat([
        ssb.createLogStream({ reverse: true, limit: howFarBack }),
        ssb.createLogStream({ live: true, old: false })
      ]),
      pull.map(msg => msg.value.author),
      pull.drain(updateState)
    )
  }
}
