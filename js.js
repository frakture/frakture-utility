var vm = require('vm');

/*
	Useful js functions
*/
exports.toArray=function(obj){
	if (Array.isArray(obj)) return obj;
	if (typeof obj!='object') return [obj];
	var r=[];
	for (i in obj){
		if (obj.hasOwnProperty(i)){
			r.push(obj[i]);
		}
	}
	return r;
}


//Takes an object, and returns back an array sorted by the value of the object
exports.sortObject=function(obj) {
    var arr = [];
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            arr.push({
                'k': prop,
                'v': obj[prop]
            });
        }
    }
    arr.sort(function(a, b) { return a.v - b.v; });
    return arr; // returns array
}


//Deep extend
//Sourced from jQuery
exports.extend=function() {
    var options, name, src, copy, copyIsArray, clone, target = arguments[0] || {},
        i = 1,
        length = arguments.length,
        deep = false,
        toString = Object.prototype.toString,
        hasOwn = Object.prototype.hasOwnProperty,
        push = Array.prototype.push,
        slice = Array.prototype.slice,
        trim = String.prototype.trim,
        indexOf = Array.prototype.indexOf,
        class2type = {
          "[object Boolean]": "boolean",
          "[object Number]": "number",
          "[object String]": "string",
          "[object Function]": "function",
          "[object Array]": "array",
          "[object Date]": "date",
          "[object RegExp]": "regexp",
          "[object Object]": "object"
        },
        jQuery = {
          isFunction: function (obj) {
            return jQuery.type(obj) === "function"
          },
          isArray: Array.isArray ||
          function (obj) {
            return jQuery.type(obj) === "array"
          },
          isWindow: function (obj) {
            return obj != null && obj == obj.window
          },
          isNumeric: function (obj) {
            return !isNaN(parseFloat(obj)) && isFinite(obj)
          },
          type: function (obj) {
            return obj == null ? String(obj) : class2type[toString.call(obj)] || "object"
          },
          isPlainObject: function (obj) {
            if (!obj || jQuery.type(obj) !== "object" || obj.nodeType) {
              return false
            }
            try {
              if (obj.constructor && !hasOwn.call(obj, "constructor") && !hasOwn.call(obj.constructor.prototype, "isPrototypeOf")) {
                return false
              }
            } catch (e) {
              return false
            }
            var key;
            for (key in obj) {}
            return key === undefined || hasOwn.call(obj, key)
          }
        };
      if (typeof target === "boolean") {
        deep = target;
        target = arguments[1] || {};
        i = 2;
      }
      if (typeof target !== "object" && !jQuery.isFunction(target)) {
        target = {}
      }
      if (length === i) {
        target = this;
        --i;
      }
      for (i; i < length; i++) {
        if ((options = arguments[i]) != null) {
          for (name in options) {
            src = target[name];
            copy = options[name];
            if (target === copy) {
              continue
            }
            if (deep && copy && (jQuery.isPlainObject(copy) || (copyIsArray = jQuery.isArray(copy)))) {
              if (copyIsArray) {
                copyIsArray = false;
                clone = src && jQuery.isArray(src) ? src : []
              } else {
                clone = src && jQuery.isPlainObject(src) ? src : {};
              }
              // WARNING: RECURSION
              target[name] = exports.extend(deep, clone, copy);
            } else if (copy !== undefined) {
              target[name] = copy;
            }
          }
        }
      }
      return target;
    }

/*
	Safe eval takes either a string of operations to run on a sandbox, which is then returned.
	
	Alternatively, if passed an object (string that starts with '{') it will return the eval'd version of that string
*/
exports.safeEval=function(script,callback){
	var sandbox={log:console.log};

	script=script.toString();
	
	var isObject=false;
	if (script.indexOf('{')==0){
		isObject=true;
		script="this.value=("+script+");";
	}
	var result=null;
	try{
		vm.runInNewContext(script, sandbox, 'custom_script');
	}catch(e){
		console.error("Error eval'ing "+script);
		console.error("Calling error function from safeEval");
		console.error(e);
		if (!callback) throw e;
		return callback(e);
	}
	delete sandbox.log;
	if (isObject) result=sandbox.value;
	else result=sandbox;

	if (callback){
		callback(null,result);
	}else{
		return result;
	}
}

exports.escapeRegExp= function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
};


exports.endsWith=function(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
/*
	prepare content for shell execution
*/
exports.escapeShell = function(cmd) {
  return '"'+cmd.replace(/(["\s'$`\\])/g,'\\$1')+'"';
};

/*
	serializes a javascript object, including functions, and stringifies regular expressions
*/
function expandedStringify(key,value){
	return (typeof value==='function' || value instanceof RegExp || (value && value.constructor && value.constructor.toString().indexOf('RegExp')>0))?value.toString():value
}

exports.serialize=function(obj){
  return JSON.stringify(obj,expandedStringify,4);
}

/*
gets unique array elements
*/
exports.getUnique=function(arr){
   var u = {}, a = [];
   for(var i = 0, l = arr.length; i < l; ++i){
      if(u.hasOwnProperty(arr[i])) {
         continue;
      }
      a.push(arr[i]);
      u[arr[i]] = 1;
   }
   return a;
}

var dateRegex=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/;
function dateFunctionReviver(key, value) {
    if (typeof value === 'string') {
	    if (value && value.indexOf("function (")==0) return eval("("+value+")");
        var a = dateRegex.exec(value);
        if (a) {
            return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
        }
    }
    return value;
};

var mongoc=require("mongoc");

/* Extensions to Arrays to allow for find and findOne methods, leveraging mongoc */
exports.addArrayFindProtoype=function(){
	Array.prototype.findOne=function(object){
		var func=mongoc(object);
		for (i=0; i<this.length; i++){if (func(this[i])) return this[i];}
		return null;
	}

	Array.prototype.find=function(object){
		return this.filter(mongoc(object));
	}
}



/*
	deserializes a javascript object, including functions and dates
*/

exports.deserialize=function(str){
  return JSON.parse(str,dateFunctionReviver);
}
