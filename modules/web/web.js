var express = require('express'),
    passport = require('passport'),
    passHash = require('password-hash'),
    flash = require('connect-flash'),
    _ = require('underscore')._,
    fs = require('fs'),
    cookieParser = require('cookie-parser'),
    bodyParser = require('body-parser'),
    expressSession = require('express-session'),
    methodOverride = require('method-override'),
    LocalStrategy = require('passport-local').Strategy;

var webInterface = function(dbot) {
    this.config = dbot.config.modules.web;
    this.indexLinks = {};
    this.pub = 'public';
    this.app = express();

    this.app.use(express.static(this.pub));
    this.app.set('view engine', 'jade');
    this.app.use(cookieParser());
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ 'extended': true }));
    this.app.use(methodOverride());
    this.app.use(expressSession({ 'secret': 'wat' }));
    this.app.use(flash());

    this.app.use(passport.initialize());
    this.app.use(passport.session());

    passport.serializeUser(function(user, done) {
        done(null, user.id);
    });

    passport.deserializeUser(function(id, done) {
        dbot.api.users.getUser(id, function(err, user) {
            done(null, user);
        });
    });

    passport.use(new LocalStrategy(function(username, password, callback) {
        var splitUser = username.split('@'),
            server = splitUser[1],
            username = splitUser[0];

        if(!server || !username) return callback(null, false, { 'message':
            'Please provide a username in the format of name@server (Servers: ' +
            _.keys(dbot.config.servers).join(', ') + ')' });
        if(!_.has(dbot.config.servers, server)) return callback(null, false, { 'message':
            'Please provide a valid server (Servers: ' +
            _.keys(dbot.config.servers).join(', ') + ')' });

        dbot.api.users.resolveUser(server, username, function(err, user) {
            if(user) {
                this.api.getWebUser(user.id, function(webUser) {
                    if(webUser) {
                        if(passHash.verify(password, webUser.password)) {
                            return callback(null, user); 
                        } else {
                            return callback(null, false, { 'message': 'Incorrect password.' });
                        }
                    } else {
                        return callback(null, false, { 'message': 'Use ~setwebpass to set up your account for web login.' });
                    }
                });
            } else {
                return callback(null, false, { 'message': 'Unknown user' });
            }
        }.bind(this)); 
    }.bind(this)));

    var server = this.app.listen(this.config.webPort);

    this.reloadPages = function() {
        var pages = dbot.pages;
        for(var p in pages) {
            if(_.has(pages, p)) {
                var func = pages[p],
                    mod = func.module;

console.log('adding ' + p);
                this.app.get(p, this.api.hasAccess, (function(req, resp) {
                    // Crazy shim to seperate module views.
                    var shim = Object.create(resp);
                    shim.render = (function(view, one, two) {
                        // Render with express.js
                        _.extend(one, { 
                            'name': dbot.config.name,
                            'user': req.user,
                            'routes': dbot.modules.web.indexLinks
                        });
                        resp.render(this.module + '/' + view, one, two);
                    }).bind(this);
                    shim.render_core = resp.render;
                    this.call(this.module, req, shim);
                }).bind(func));
            }
        }
    }.bind(this);

    this.onLoad = function() {
        this.reloadPages();
        var routes = _.pluck(_.without(_.pluck(this.app._router.stack, 'route'), undefined), 'path'),
            moduleNames = _.keys(dbot.modules);

        _.each(moduleNames, function(moduleName) {
            var modulePath = '/' + moduleName;
            if(_.include(routes, modulePath)) {
                moduleName = moduleName.charAt(0).toUpperCase() +
                    moduleName.slice(1);
                this.indexLinks[modulePath] = moduleName;
            }
        }.bind(this));


        this.app.get('/', function(req, res) {
            res.render('index', { 
                'name': dbot.config.name,
                'user': req.user,
                'routes': this.indexLinks
            });
        }.bind(this));

        this.app.get('/login', function(req, res) {
            res.render('login', {
                'user': req.user,
                'message': req.flash('error'),
		'routes': this.indexLinks
            });
        }.bind(this));

        this.app.post('/login', passport.authenticate('local', {
            'failureRedirect': '/login', 
            'failureFlash': true,
            'routes': this.indexLinks
        }), function(req, res) {
            if(req.body.redirect) {
                res.redirect(req.body.redirect);
            } else {
                res.redirect('/');
            }
        });

        this.app.get('/logout', function(req, res) {
            req.logout(); 
            res.redirect('/');
        });

        if(_.has(dbot.modules, 'log')) {
            dbot.api.log.ignoreCommand('setwebpass');
        }
    }.bind(this);

    this.onDestroy = function() {
        server.close();
    };

    this.commands = {
        '~setwebpass': function(event) {
            var newPass = event.input[1];
            this.api.getWebUser(event.rUser.id, function(webUser) {
                if(!webUser) {
                    webUser = {
                        'id': event.rUser.id,
                        'password': false
                    }
                } 
                webUser.password = passHash.generate(newPass);

                this.db.save('web_users', webUser.id, webUser, function(result) {
                    event.reply(dbot.t('web_pass_set')); 
                });
            }.bind(this));
        }
    };
    this.commands['~setwebpass'].regex = [/^setwebpass ([^ ]+)$/, 2]
};

exports.fetch = function(dbot) {
    return new webInterface(dbot);
};
