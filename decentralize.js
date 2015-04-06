process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var config = require('./config');
var procure = require('procure');

var Maki = require('maki');
var Soundcloud = require('./lib/Soundcloud');
var Engine = require('./lib/Engine');
var WebSocket = require('ws');

var jsonpatch = require('fast-json-patch');

var home = 'https://' + config.service.authority;

var source = config.source;
source.authority = source.host + (([80, 443].indexOf( parseInt(source.port) ) === -1) ? ':' + source.port : '');

var decentralize = new Maki( config );
var soundcloud = new Soundcloud( config.soundcloud );

Show = decentralize.define('Show', {
  attributes: {
    title: { type: String , slug: true },
    slug: { type: String },
    recorded: { type: Date },
    released: { type: Date , default: Date.now , required: true },
    description: { type: String },
    audio: { type: String }
  },
  names: { get: 'item' },
  source: source.proto + '://' + source.authority + '/recordings',
  icon: 'sound'
});

Index = decentralize.define('Index', {
  name: 'Index',
  routes: { query: '/' },
  templates: { query: 'index' },
  requires: {
    'Show': {
      filter: {}
    }
  },
  static: true,
  internal: true
});

procure( source.proto + '://' + source.authority + '/shows/decentralize', function(err, show) {
  if (err) return console.error(err);

  // TODO: catch error
  config.show = JSON.parse( show );
  config.show.source = source;
  config.show.home = home;

  decentralize.start(function() {
    decentralize.app.locals.show = config.show;

    decentralize.app.get('/about', function(req, res, next) {
      res.render('about');
    });
    decentralize.app.get('/contact', function(req, res, next) {
      res.render('contact');
    });
    decentralize.app.get('/:somePath', function(req, res, next) {
      Show.get({ slug: req.param('somePath') }, function(err, show) {
        if (show) return res.redirect('/shows/' + show.slug );
        next();
      });
    });
    decentralize.app.get('/shows', function(req, res, next) {
      if (req.accepts('application/rss+xml')) {
        return res.redirect('/feed');
      } else {
        return next();
      }
    });
    decentralize.app.get('/rss', function(req, res, next) {
      res.redirect( 301 , '/feed' );
    });
    decentralize.app.get('/feed', function(req, res, next) {
      Show.query({}, function(err, shows) {
        res.set('Content-Type', 'application/rss+xml');
        res.render('feed', {
          resource: Show,
          collection: shows
        });
      });
    });
    
    // subscribe to updates to important things.
    // mainly, recordings
    var ws = new WebSocket(source.sockets + source.authority + '/recordings');
    ws.on('error', function(err) {
      console.error( err );
    });
    ws.on('message', function(data) {
      console.log('DATAGRAM:' , data );
      var msg = JSON.parse( data );
      if (msg.method === 'patch') {
        if (msg.params.channel === '/recordings') {
          jsonpatch.apply( decentralize.resources['Show'].data , msg.params.ops );
        }
        
        if (msg.params.channel.match(/\/recordings\/(.*)/)) {
          var recordings = decentralize.resources['Show'].data;
          for (var i = 0; i < recordings.length; i++) {
            if (msg.params.channel === '/recordings/' + recordings[ i ].slug ) {
              jsonpatch.apply( recordings[ i ] , msg.params.ops );
            }
          }
        }
        
      }
    });
    
    var engine = new Engine( config );

    setInterval(function() {
      engine.sync();
    }, /*/ 2500 /*/ 1 * 3600 * 1000 /**/ );
    engine.sync();

  });

});
