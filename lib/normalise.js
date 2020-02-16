module.exports = function normalise (word) {
  return word.toLocaleLowerCase().replace(/(\s|-|_)/g, '')
}
