var _ = require('underscore')._,
    moment = require('moment');

var commands = function(dbot) {
    var commands = {
        '~ncount': function(event) {
            var chanCounts = {},
                total = 0,
                offString = event.params[1] || null;
                offset = moment().subtract(offString, 1).valueOf() || null;

                console.log(offset);

            /*if(!offset || !offset.isValid()) {
                event.reply('Invalid timescale. Try \'week\'');
                return;
            }*/

            this.db.scan('notifies', function(notify) {
                if(notify.user == event.rUser.id) {
                    if(!offString) {
                        if(!_.has(chanCounts, notify.channel)) chanCounts[notify.channel] = 0;
                        chanCounts[notify.channel]++;
                        total++;
                    } else {
                    console.log(offset);
                    console.log(notify.time);
                    console.log();
                        if(notify.time > offset) {
                            if(!_.has(chanCounts, notify.channel)) chanCounts[notify.channel] = 0;
                            chanCounts[notify.channel]++;
                            total++;
                        }
                    }
                }
            }, function() {
                var cCounts = _.chain(chanCounts)
                    .pairs()
                    .sortBy(function(p) { return p[1]; })
                    .reverse()
                    .first(10)
                    .value();

                var cString = '';
                for(var i=0;i<cCounts.length;i++) {
                    cString += cCounts[i][0] + " (" + cCounts[i][1] + "), ";
                }
                cString = cString.slice(0, -2);

                if(offString) {
                    event.reply(dbot.t('timed_notifies', {
                        'user': event.user,
                        'count': total,
                        'offString': offString,
                        'cString': cString
                    }));
                } else {
                    event.reply(dbot.t('total_notifies', {
                        'user': event.user,
                        'count': total,
                        'cString': cString
                    }));
                }
            });
        },

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
            var channelName = (event.input[1].trim() || event.channel),
                nick = event.input[2],
                reason = event.input[3].trim();

            if(channelName == event.user) {
                channelName = dbot.config.servers[event.server].admin_channel;
            }

            if(reason.charAt(reason.length - 1) != '.') reason += '.';

            dbot.api.users.resolveUser(event.server, nick, function(reportee) {
                if(_.has(event.allChannels, channelName)) {
                    if(reportee) {
                        this.api.notify('report', event.server, event.rUser,
                        channelName, dbot.t('report', {
                            'reporter': event.rUser.primaryNick,
                            'reportee': nick,
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
                if(this.config.firstHost) {
                    var first = message.split(' ')[0];
                    dbot.api.users.resolveUser(event.server, first, function(user) {
                        if(user && _.include(this.config.host_lookup, channelName)) {
                            dbot.api.nickserv.getUserHost(event.server, first, function(host) {
                                message = message.replace(first, first + ' [' + host + ']'); 
                                this.api.notify('notify', event.server, event.rUser, channelName, message);
                            }.bind(this)); 
                        } else {
                            this.api.notify('notify', event.server, event.rUser, channelName, message);
                        }
                    }.bind(this));
                } else {
                    this.api.notify('notify', event.server, event.rUser, channelName, message);
                }

                event.reply(dbot.t('notified', {
                    'user': event.user,
                    'channel': channelName
                }));
            } else {
                event.reply(dbot.t('not_in_channel', { 'channel': channelName }));
            }
        },

        '~nunsub': function(event) {
            var cName = event.input[1];
            
            dbot.api.users.resolveChannel(event.server, cName, function(channel) {
                if(channel) {
                    this.db.read('nunsubs', channel.id, function(err, nunsubs) {
                        if(!nunsubs) {
                            var nunsubs = {
                                'id': channel.id,
                                'users': []
                            }
                        } 

                        if(!_.include(nunsubs, event.rUser.id)) {
                            nunsubs.users.push(event.rUser.id); 
                            this.db.save('nunsubs', channel.id, nunsubs, function() {
                                var reply = dbot.t('nunsubbed', { 'cName': cName })
                                if(_.has(this.config.chan_redirs, cName)) {
                                    reply += dbot.t('n_also_found', { 'afaName' : this.config.chan_redirs[cName] });
                                }
                                event.reply(reply); 
                            }.bind(this));
                        } else {
                            event.reply(dbot.t('already_nunsubbed', { 'cName': cName }));
                        }
                    }.bind(this));
                } else {
                    event.reply('Channel not known.');
                }
            }.bind(this));
        },
        
        '~ununsub': function(event) {
            var cName = event.input[1];

            dbot.api.users.resolveChannel(event.server, cName, function(channel) {
                if(channel) {
                    this.db.read('nunsubs', channel.id, function(err, nunsubs) {
                        if(!_.isUndefined(nunsubs) && _.include(nunsubs.users, event.rUser.id)) {
                            nunsubs.users = _.without(nunsubs.users, event.rUser.id);
                            this.db.save('nunsubs', channel.id, nunsubs, function() {
                                event.reply(dbot.t('ununsubbed', { 'cName': cName }));
                            });
                        } else {
                            event.reply(dbot.t('not_nunsubbed', { 'cName': cName }));
                        }
                    }.bind(this));
                } else {
                    event.reply('Channel not known.');
                }
            }.bind(this));
        }
    };
    commands['~report'].regex = /^report (#[^ ]+ )?([^ ]+) (.*)$/;
    commands['~notify'].regex = [/^notify ([^ ]+) (.+)$/, 3];
    commands['~nunsub'].regex = [/^nunsub ([^ ]+)$/, 2];
    commands['~ununsub'].regex = [/^ununsub ([^ ]+)$/, 2];

    return commands;
};

exports.fetch = function(dbot) {
    return commands(dbot);
};
