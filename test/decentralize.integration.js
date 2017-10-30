var assert = require('assert');
var expect = require('chai').expect;

var DECENTRALIZE = require('../');
var config = require('../config');

describe('DECENTRALIZE', function() {
  this.timeout(20000);
  
  it('should expose a constructor', function(){
    assert(typeof DECENTRALIZE, 'function');
  });
  
  it('should start successfully', function (done) {
    var app = new DECENTRALIZE(config);
    app.start(done);
  });
});
