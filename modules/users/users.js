/**
 * Name: Users
 * Description: Track known users
 */
var _ = require('underscore')._,
    uuid = require('node-uuid');

var users = function(dbot) {

    /*** Internal API ***/
    this.internalAPI = {
        'createUser': function(server, nick, channel, callback) {
            var id = uuid.v4();
            this.db.create('users', id, {
                'id': id,
                'primaryNick': nick,
                'currentNick': nick,
                'server': server,
                'channels': [ channel ],
                'aliases': []
            }, function(err, result) {
                if(!err) {
                    dbot.api.event.emit('new_user', [ result ]);
                    callback(result);
                }
            });
        }.bind(this),

        'addChannelUser': function(user, channelName) {
            user.channels.push(channelName);
            this.db.save('users', user.id, user, function(err) {
                if(!err) {
                    this.api.getChannel(user.server, channelName, function(channel) {
                        channel.users.push(user.primaryNick);
                        this.db.save('channel_users', channel.id, channel, function(err) {
                            if(!err) {
                                dbot.api.event.emit('new_channel_user', [ user, channel]);
                            }
                        });
                    }.bind(this));
                }
            }.bind(this));
        }.bind(this), 

        'updateChannelPrimaryUser': function(server, oldUser, newUser) {
            this.db.search('channel_users', { 'server': server }, function(channel) {
                channel.users = _.without(channel.users, oldUser);
                if(!_.include(channel.users, newUser)) channel.users.push(newUser);
                this.db.save('channel_users', channel.id, channel, function(err) {
                    if(err) {
                        // QQ
                    }
                });
            }.bind(this), function(err) {
                if(err) {
                    // QQ
                }
            });
        }.bind(this)
    };

    this.listener = function(event) {
        if(event.action == 'JOIN' && event.user != dbot.config.name) {
            this.api.resolveUser(event.server, event.user, function(user) {
                if(!user) { // User does not yet exist 
                    this.internalAPI.createUser(event.server, event.user, event.channel, function(result) {
                        user = result;
                        if(!_.include(user.channels, event.channel)) { // User not yet channel user
                            this.internalAPI.addChannelUser(user, event.channel.name);
                        }
                    });
                } else {
                    if(!_.include(user.channels, event.channel)) { // User not yet channel user
                        this.internalAPI.addChannelUser(user, event.channel.name);
                    }

                    user.currentNick = event.user;
                    this.db.save(users, user.id, user, function(err) {
                        if(err) { 
                            // QQ
                        }
                    });
                }
            }.bind(this));
        } else if(event.action == 'NICK') {
            this.api.resolveUser(event.server, event.user, function(user) {
                this.api.isKnownUser(event.server, event.newNick, function(isKnown) {
                    user.currentNick = event.newNick;

                    if(!isKnown) {
                        user.aliases.push(event.newNick);
                    }

                    this.db.save('users', user.id, user, function(err) {
                        if(!err) {
                            dbot.api.event.emit('new_user_alias', [ user, event.newNick ]);
                        }
                    });
                }.bind(this));
            }.bind(this));
        }
    }.bind(this);
    this.on =  ['JOIN', 'NICK'];

    this.onLoad = function() {
        dbot.instance.addListener('366', 'users', function(event) {
            this.api.getChannel(event.server, event.channel.name, function(channel) {
                if(!channel) { // Channel does not yet exist
                    var id = uuid.v4();
                    this.db.create('channel_users', id, {
                        'id': id,
                        'server': event.server,
                        'name': event.channel.name,
                        'users': []
                    }, function(err, result) {
                        if(!err) {
                            channel = result;
                            dbot.api.event.emit('new_channel', [ channel ]);
                        }
                    });
                }

                _.each(event.channel.nicks, function(nick) {
                    var nick = nick.name;
                    this.api.resolveUser(event.server, nick, function(user) {
                        if(!user) {
                            this.internalAPI.createUser(event.server, nick, event.channel, function(result) {
                                user = result;
                                if(!_.include(user.channels, event.channel)) {
                                    this.internalAPI.addChannelUser(user, event.channel.name);
                                }
                            });
                        } else {
                            if(!_.include(user.channels, event.channel)) {
                                this.internalAPI.addChannelUser(user, event.channel.name);
                            }
                        }
                    }.bind(this));
                }, this);
            }.bind(this));
        }.bind(this));

        var connections = dbot.instance.connections;
        _.each(connections, function(connection) {
            connection.updateNickLists(); 
        });
    };
};

exports.fetch = function(dbot) {
    return new users(dbot);
};
