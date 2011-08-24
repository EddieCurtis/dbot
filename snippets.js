Array.prototype.random = function() {
    return this[Math.floor((Math.random()*this.length))];
};

Array.prototype.each = function(fun) {
    for(var i=0;i<this.length;i++) {
        fun(this[i]);
    }
};

Array.prototype.collect = function(fun) {
    var collect = [];
    for(var i=0;i<this.length;i++) {
        collect.push(fun(this[i]));
    }
};

Array.prototype.include = function(value) {
    var includes = false;
    for(var i=0;i<this.length;i++) {
        if(this[i] == value) {
            includes = true;
            break;
        }
    }

    return includes;
};

/*** String ***/

String.prototype.endsWith = function(needle) {
    var end = this.slice(this.length - needle.length);
    if(needle === end) {
        return true;
    } else {
        return false;
    }
};

String.prototype.startsWith = function(needle) {
    var start = this.slice(0, needle.length);
    if(needle === start) {
        return true;
    } else {
        return false;
    }
};

/*** Object ***/

Object.prototype.isFunction = function(obj) {
    if(typeof(obj) == 'function') {
        return true;
    } else {
        return false;
    }
};

Object.prototype.isArray = function(obj) {
    if(Object.prototype.toString.call(obj) === '[object Array]') {
        return true;
    } else {
        return false;
    }
};
