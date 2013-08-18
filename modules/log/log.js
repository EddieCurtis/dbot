/**
 * Name: Log
 * Description: Log commands to a channel.
 */
var _ = require('underscore')._;

var log = function(dbot) {
    this.ignoredCommands = [];

    this.api = {
        'log': function(server, user, message) {
            var logChannel = this.config.logChannel[server];
            dbot.say(server, logChannel, dbot.t('log_message', {
                'time': new Date().toUTCString(),
                'command': message,
                'user': user
            }));
        },

        'ignoreCommand': function(commandName) {
            this.ignoredCommands.push(commandName);    
        }
    };

    this.onLoad = function() {
        dbot.api.event.addHook('command', function(event) {
            var logChannel = this.config.logChannel[event.server];
            if(logChannel && !_.include(this.ignoredCommands, command.split(' ')[0])) {
                dbot.say(event.server, logChannel, dbot.t('log_message', {
                    'time': new Date().toUTCString(),
                    'command': event.message,
                    'user': event.user
                }));
            }
        }.bind(this));
    }.bind(this);
};

exports.fetch = function(dbot) {
    return new log(dbot);
};
