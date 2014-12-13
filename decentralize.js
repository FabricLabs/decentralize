var Maki = require('maki');
var decentralize = new Maki({
  services: {
    http: {
      port: 9201
    }
  }
});

var Recording = decentralize.define('Recording', {
  attributes: {
    title: { type: String }
  },
  /*/source: 'http://decentral.fm/recordings'/*/
  source: 'http://localhost:15005/recordings'/**/
});

decentralize.start();
