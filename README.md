# ssb-suggest

A plugin for `ssb-server`.

Requires other plugins :
- `ssb-backlinks`,
- `ssb-about`
- EITHER `ssb-friends` OR patchwork!

This module was extracted from patchwork, originally written by Matt Mckegg

## Example usage

```js
var Server = require('ssb-server')
  .use(require('ssb-server/plugins/master'))
  .use(require('ssb-suggest'))

var Config = require('ssb-config')

var server = Server(Config()) // just use default config

server.suggest.profile({ text: 'mi' }, (err, matches) => {
  if (err) console.log('OH no!', err)

  // do something with matches
})
```

## API

### `server.suggest.profile(opts, cb)`

`opts` is an Object with properties:
- `text` (optional), the text you're searching profiles names by. If not provided, then, falls back to offering `defaultIds` (if provided) or a sample of the most recent message authors.
` - `defaultIds` (optional), an array of feedIds that are important in the current context. They could be people present in the current thread for example. These will be fallback matches, but also be prioritised in any matches to `text`.
- `limit` (optional), how many results you want back _Default: 20_


- `cb` is a callback with signature `(err, matches)` where `matches` is an Array of objects of form:
```js
{
  id: FeedId,
  matchedName: String, // the name your search matched (within name / names)
  name: String, // the name you know this person by
  names: Array, // the names people you follow have given this person
  image: Blob,
  following: Boolean // whether you currently follow them
}
```
