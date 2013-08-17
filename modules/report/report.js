var _ = require('underscore')._,
    uuid = require('node-uuid'),
    async = require('async');

var report = function(dbot) {
    if(!dbot.db.pending) dbot.db.pending = {};
    if(!dbot.db.pNotify) dbot.db.pNotify = {};
    this.pending = dbot.db.pending;
    this.pNotify = dbot.db.pNotify;

    this.api = {
        'notify': function(server, channel, message) {
            var channel = dbot.instance.connections[server].channels[channel]; 
            var ops = _.filter(channel.nicks, function(user) {
                if(this.config.notifyVoice) {
                    return user.op || user.voice;
                } else {
                    return user.op; 
                }
            }, this);

            dbot.api.users.resolveChannel(server, channel, function(channel) {
                if(channel) {
                    var perOps = channel.op;
                    if(this.config.notifyVoice) pOps = _.union(perOps, channel.voice);

                    async.eachSeries(ops, function(nick, next) {
                        dbot.api.users.resolveUser(server, nick, function(user) {
                            perOps = _.without(perOps, user.id); next();
                        }); 
                    }, function() {
                        offlineUsers = perOps;
                        console.log(offlineUsers);
                        _.each(offlineUsers, function(id) {
                            if(!this.pending[id]) this.pending[id] = [];
                            this.pending[id].push({
                                'time': new Date().getTime(),
                                'message': message
                            });
                            this.pNotify[id] = true;
                        }.bind(this));
                    }.bind(this)); 
                }
            }.bind(this));

            var i = 0;
            var notifyChannel = function(ops) {
                if(i >= ops.length) return;
                dbot.say(server, ops[i].name, message);
                setTimeout(function() {
                    i++; notifyChannel(ops);
                }, 1000);
            };
            notifyChannel(ops);
        }
    };

    this.listener = function(event) {
        if(_.has(this.pending, event.rUser.id) && this.pNotify[event.rUser.id] === true) {
            dbot.say(event.server, event.user, dbot.t('missed_notifies', {
                'user': event.rUser.primaryNick,
                'link': dbot.api.web.getUrl('report/' + event.server +
                    '/missing/' + event.rUser.primaryNick)
            }));
            this.pNotify = false;
        }
    }.bind(this);
    this.on = 'JOIN';

    var commands = {
        '~clearmissing': function(event) {
            if(_.has(this.pending, event.rUser.id)) {
                var count = this.pending[event.rUser.id].length;
                delete this.pending[event.rUser.id];
                event.reply(dbot.t('cleared_notifies', { 'count': count }));
            } else {
                event.reply(dbot.t('no_missed_notifies'));
            }
        },

        '~report': function(event) {
            var channelName = event.input[1],
                nick = event.input[2],
                reason = event.input[3].trim();

            if(reason.charAt(reason.length - 1) != '.') reason += '.';

            dbot.api.users.resolveUser(event.server, nick, function(reportee) {
                if(_.has(event.allChannels, channelName)) {
                    if(reportee) {
                        this.api.notify(event.server, channelName, dbot.t('report', {
                            'reporter': event.user,
                            'reported': nick,
                            'channel': channelName,
                            'reason': reason
                        }));
                        event.reply(dbot.t('reported', { 'reported': nick }));
                    } else {
                        event.reply(dbot.t('user_not_found', { 
                            'reported': nick,
                            'channel': channelName 
                        }));
                    }
                } else {
                    event.reply(dbot.t('not_in_channel', { 'channel': channelName }));
                }
            }.bind(this));
        },

        '~notify': function(event) {
            var channelName = event.input[1],
                message = event.input[2];

            if(_.has(event.allChannels, channelName)) {
                this.api.notify(event.server, channelName, dbot.t('notify', {
                    'channel': channelName,
                    'notifier': event.user,
                    'message': message
                }));

                var id = uuid.v4();
                this.db.save('notifies', id, {
                    'id': id,
                    'server': event.server,
                    'channel': channelName,
                    'user': event.user,
                    'time': new Date().getTime(),
                    'message': message
                }, function() {});

                event.reply(dbot.t('notified', {
                    'user': event.user,
                    'channel': channelName
                }));
            } else {
                event.reply(dbot.t('not_in_channel', { 'channel': channelName }));
            }
        }
    };
    commands['~report'].regex = [/^~report ([^ ]+) ([^ ]+) (.+)$/, 4];
    commands['~notify'].regex = [/^~notify ([^ ]+) (.+)$/, 3];
    this.commands = commands;
};

exports.fetch = function(dbot) {
    return new report(dbot);
};
