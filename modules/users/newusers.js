/**
 * Name: Users
 * Description: Track known users
 */
var _ = require('underscore')._;

var users = function(dbot) {
    /*** Internal API ***/

    this.internalAPI = {
        // Create new user record
        'createUser': function(server, nick, callback) {
            var id = nick + '.' + server; 
            this.db.create('users', id, {
                'id': id,
                'server': server,
                'primaryNick': nick,
                'currentNick': nick
            }, function(err, result) {
                if(!err) {
                    dbot.api.event.emit('new_user', [ result ]);
                    callback(null, result);
                } else {
                    callback(true, null);
                }
            });
        },

        // Add new user alias
        'createAlias': function(alias, user, callback) {
            var id = alias + '.' + user.server;
            this.db.create('user_aliases', id, {
                'id': id,
                'alias': alias,
                'user': user.id
            }, function(err, result) {
                if(!err) {
                    dbot.api.event.emit('new_user_alias', [ event.rUser, event.newNick ]);
                    callback(null, result);
                } else {
                    callback(true, null);
                }
            });
        },

        'updateCurrentNick': function(user, newNick, callback) {
            user.currentNick = newNick;
            this.db.save('users', user.id, user, function(err, result) {
                if(!err) {
                    dbot.api.event.emit('new_current_nick', [ user, newNick ]);
                    callback(null, result);
                } else {
                    callback(true, null);
                }
            });
        }
    };

    /*** Listener ***/

    // Track nick changes
    this.listener = function(event) {
        // Update current nick
        this.internalAPI.updateCurrentNick(event.rUser, event.newNick, function(){});

        // Add new alias record if nick is not already claimed
        this.api.resolveUser(event.server, event.newNick, function(err, user) {
            if(!user) {
                this.internalAPI.createAlias(event.newNick, event.rUser, function(){});
            }
        }.bind(this));
    }.bind(this);
    this.on = ['NICK'];

    /*** Pre-emit ***/
    this.onLoad = function() {
        // Create non-existing users and update current nicks
        var checkUser = function(done) {
            this.api.resolveUser(event.server, event.user, function(err, user) {
                if(!user) {
                    this.internalAPI.createUser(event.server, event.user, done);
                } else {
                    this.internalAPI.updateCurrentNick(user, event.user, done);
                }
            }.bind(this));
        };

        dbot.instance.addPreEmitHook(function(event, callback) {
            if(event.user && _.include(['JOIN', 'PRIVMSG'], event.action)) {
                checkUser(callback);
            }
        });
    };
};
