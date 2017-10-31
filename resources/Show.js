var source = require('../config').source;

module.exports = {
  attributes: {
    title: { type: String , slug: true },
    slug: { type: String },
    recorded: { type: Date },
    released: { type: Date , default: Date.now , required: true },
    description: { type: String , format: 'markdown' },
    audio: { type: String },
    // TODO: replace with a sources list.
    youtube: { type: String }
  },
  names: { get: 'item' },
  source: source.proto + '://' + source.authority + '/recordings',
  icon: 'sound'
}
