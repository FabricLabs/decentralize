var config = require('./config');
var procure = require('procure');

var Maki = require('maki');
var show = procure('http://decentral.fm/shows/decentralize', function(err, data) {
  
  var decentralize = new Maki( config );

  var Recording = decentralize.define('Recording', {
    attributes: {
      title: { type: String },
      recorded: { type: Date },
      released: { type: Date , default: Date.now , required: true },
      description: { type: String }
    },
    /*/source: 'http://decentral.fm/recordings'/*/
    source: 'http://localhost:15005/recordings'/**/,
    icon: 'sound'
  });

  decentralize.start();
});
