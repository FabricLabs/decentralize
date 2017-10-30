var config = require('./config');
var DECENTRALIZE = require('./lib/decentralize');
var decentralize = new DECENTRALIZE(config);

decentralize.start();
