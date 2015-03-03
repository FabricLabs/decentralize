process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

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
var contentDisposition = require('content-disposition');

var home = 'https://' + config.service.authority;
var soundcloudSlug = 'decentralize-podcast';

/**/
var source = {
  sockets: 'ws://',
  proto: 'http',
  host: 'localhost',
  port: '15005'
};
/*/
var source = {
  sockets: 'wss://',
  proto: 'https',
  host: 'decentral.fm',
  port: '443'
}
/**/
source.authority = source.host + ((!~[80, 443].indexOf( source.port )) ? ':' + source.port : '');
console.log('authority', source.authority);

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
  source: source.proto + '://' + source.authority + '/recordings',
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

procure( source.proto + '://' + source.authority + '/shows/decentralize', function(err, show) {

  // TODO: catch error
  show = JSON.parse( show );
  show.source = source;
  show.home = home;

  decentralize.start(function() {
    decentralize.app.locals.show = show;

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
    decentralize.app.get('/rss', function(req, res, next) {
      res.redirect( 301 , '/shows' );
    });
    
    // subscribe to updates to important things.
    // mainly, recordings
    var ws = new WebSocket(source.sockets + source.authority + '/recordings');
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
    
    setInterval(function() {
      updateFromSoundcloud();
    }, /*/ 2500 /*/ 6 * 3600 * 1000 /**/ );
    updateFromSoundcloud();

  });
  
  function updateFromSoundcloud() {
    soundcloud.get('users/' + soundcloudSlug + '/tracks', function(err, tracks) {
      if (err) {
        console.log(err);
        return;
      }
      try {
        tracks = JSON.parse( tracks ).reverse();
      } catch (e) {
        console.log(e);
        return;
      }
      Show.query({}, function(err, recordings) {
        async.mapSeries( tracks , function(track, done) {
          var episode = _.find( recordings , function(e) { return e.title === track.title; });
        
          jsonpatch.apply( episode , [
            { op: 'add', path: '/remotes', value: { soundcloud: {} } },
            { op: 'add', path: '/remotes/soundcloud/id', value: track.id },
            { op: 'add', path: '/type', value: 'soundcloud' },
          ]);
        
          if (episode) return done( null , episode );
          if (!track.download_url) return console.log('track not downloadable:' , track.title );
          console.log('no episode found on decentral.fm for show: "'+track.title+'"!  initiating upload...');

          if (track.release_year && track.release_month && track.release_day) {
            var releaseDate = [
              track.release_year,
              track.release_month,
              track.release_day
            ].join('-') + ' 15:00:00 +0000';
          }

          var form = new Form();
          form.append( '_show' , show._id );
          form.append( 'title' , track.title );
          form.append( 'released' , Date.parse( releaseDate || track.created_at ) );
          form.append( 'description' , track.description );
          
          var streamURL = track.download_url + '?client_id=' + config.soundcloud.clientID;

          var r = request.get( streamURL );
          r.on('response', function(response) {
            var disposition = contentDisposition.parse( response.headers['content-disposition'] );
            var filename = disposition.parameters.filename;

            form.append( 'media', response , {
              filename: filename,
              contentType: response.headers['content-type']
            });
            form.submit({
              method: 'post',
              protocol: (source.proto === 'https') ? 'https' : undefined,
              host: source.host,
              port: source.port,
              path: '/recordings',
              headers: {
                Accept: 'application/json'
              }
            }, function(err, res) {
              if (err) console.error(err);
              res.resume();
              console.log('recording submitted', err , res.statusCode );
              return done( null , res.body );
            });
          });

        }, function(err, results) {
          if (err) console.error( err );
          if (results && results.length) return console.log('updated some tracks.', decentralize.resources['Show'].data );
        });
      });
    });
  }

});
