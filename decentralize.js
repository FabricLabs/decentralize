process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

var config = require('./config');
var procure = require('procure');

var Maki = require('maki');
var Soundcloud = require('./lib/Soundcloud');
var Engine = require('./lib/Engine');

var Sessions = require('maki-sessions');
var ProxAuth = require('maki-auth-proxy');
var Policies = require('maki-auth-tokens');

var rest = require('restler');

var home = 'https://' + config.service.authority;

var source = config.source;
source.authority = source.host;
if ([80, 443].indexOf( parseInt(source.port) ) === -1) {
  source.authority += ':' + source.port;
}

var decentralize = new Maki( config );
var soundcloud = new Soundcloud( config.soundcloud );

var policies = new Policies();
var sessions = new Sessions();

decentralize.use( sessions );

Show  = decentralize.define('Show',  require('./resources/Show') );
Index = decentralize.define('Index', require('./resources/Index') );

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
    decentralize.app.get('/shows/:showSlug/edit', function(req, res, next) {
      Show.get({ slug: req.param('showSlug') }, function(err, show) {
        return res.render('show-edit', {
          item: show
        });
      });
    });
    decentralize.app.post('/shows/:showSlug', function(req, res, next) {
      rest.patch( source.proto + '://' + source.authority + '/recordings/' + req.param('showSlug') , {
        headers: {
          Accept: 'application/json'
        },
        data: req.body
      }).on('complete', function(data, request) {
        if (request.statusCode !== 200) return res.error('Editing failed');
        req.flash('success', 'Content edited successfully!');
        return res.redirect('/shows/' + req.param('showSlug'));
      });
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
    
    var engine = new Engine( config , decentralize );

    setInterval(function() {
      engine.sync();
    }, /*/ 2500 /*/ 1 * 3600 * 1000 /**/ );
    engine.sync();
    engine.subscribe();

  });

});
