var config = require('./config');
var request = require('request');
var procure = require('procure');
var async = require('async');
var rest = require('restler');
var _ = require('lodash');

var Maki = require('maki');
var Soundcloud = require('./lib/Soundcloud');
var Form = require('form-data');
var WebSocket = require('ws');

var jsonpatch = require('fast-json-patch');

/*/var base = 'http://decentral.fm/'; var host = 'decentral.fm'; var authority = 'decentral.fm';/*/
var base = 'http://localhost:15005/'; var host = 'localhost'; var authority = 'localhost:15005';/**/
var home = 'http://' + config.service.authority;

/**/var source = {
  host: 'localhost',
  port: '15005'
};/*/
var source = {
  host: 'decentral.fm',
  port: '80'
}
/**/

var decentralize = new Maki( config );
var soundcloud = new Soundcloud( config.soundcloud );

var Show = decentralize.define('Show', {
  attributes: {
    title: { type: String , slug: true },
    slug: { type: String },
    recorded: { type: Date },
    released: { type: Date , default: Date.now , required: true },
    description: { type: String },
    audio: { type: String }
  },
  names: { get: 'item' },
  source: base + 'recordings',
  icon: 'sound'
});

var Index = decentralize.define('Index', {
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

procure( base + 'shows/decentralize', function(err, show) {

  // TODO: catch error
  show = JSON.parse( show );
  show.base = base;
  show.home = home;

  decentralize.start(function() {
    console.log('show:', show);
    
    decentralize.app.locals.show = show;
    decentralize.app.get('/about', function(req, res, next) {
      res.render('about');
    });
    decentralize.app.get('/contact', function(req, res, next) {
      res.render('contact');
    });
    
    var ws = new WebSocket('ws://' + source.host +':'+ source.port + '/recordings');
    ws.on('message', function(data) {
      console.log('DATAGRAM:' , data );
      var msg = JSON.parse( data );
      if (msg.method === 'patch') {
        if (msg.params.channel === '/recordings') {
          jsonpatch.apply( decentralize.resources['Show'].data , msg.params.ops );
        }
      }
    });
    
    setInterval(function() {
      updateFromSoundcloud();
    }, /*/ 2500 /*/ 6 * 3600 * 1000 /**/ );
    updateFromSoundcloud();

  });
  
  function updateFromSoundcloud() {
    soundcloud.get('users/decentralyze/tracks', function(err, tracks) {
      tracks = JSON.parse( tracks ).reverse();
      Show.query({}, function(err, recordings) {
        async.mapSeries( tracks , function(track, done) {
          var episode = _.find( recordings , function(e) { return e.title === track.title; });
          if (episode) return done( null , episode );
          console.log('no episode wat');
          var streamURL = track.download_url + '?client_id=' + config.soundcloud.clientID;
          var form = new Form();
          form.append( '_show' , show._id );
          form.append( 'title' , track.title );
          form.append( 'released' , Date.parse( track.created_at ) );
          form.append( 'description' , track.description );
          form.append( 'audio', request.get( streamURL ) );
          form.submit({
            method: 'post',
            host: source.host,
            port: source.port,
            path: '/recordings'
          }, function(err, res) {
            res.resume();
            console.log('form submitted', err , res.statusCode );
            return done( null , res.body );
          });

        }, function(err, results) {
          if (err) console.error( err );
          if (results && results.length) return console.log('updated some tracks.', decentralize.resources['Show'].data );
        });
      });
    });
  }

});
