var vm = require('vm');
var s = require('sandbox')();

var js = function(dbot) {
    var dbot = dbot;

    var commands = {
        '~js': function(data, params) {
            var q = data.message.valMatch(/^~js (.*)/, 2);
            s.run(q[1], function(output) {
                dbot.say(data.channel, output.result);
            });
        },

        '~ajs': function(data, params) {
            var q = data.message.valMatch(/^~ajs (.*)/, 2);
            if(data.user == dbot.admin) {
                dbot.say(data.channel, eval(q[1]));
            }
        }
    };

    return {
        'onLoad': function() {
            return commands;
        }
    };
};

exports.fetch = function(dbot) {
    return js(dbot);
};
