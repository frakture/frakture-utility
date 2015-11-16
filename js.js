var vm = require('vm'), moment=require("moment-timezone"),numeral=require("numeral");
/*
	Useful js functions
*/

//Format numbers, also accepts object of numbers
exports.format=function(n,s){	
	if (typeof n!='object'){
		//only format numbers
		if(parseFloat(n)!=n) return n;
		 return numeral(n).format(s);
	}
	var o={};
	for (i in n){
		o[i]=exports.format(n[i],s);
	}
	return o;
}

//Unformat numbers
exports.unformat=function(n){
	if(!n) return n;
	if (typeof n=='number') return n;
	if (typeof n=='string') return parseFloat(n.replace(/[^0-9.-]/g,""))
	if (typeof n!='object') return null;
	var o={};
	for (i in n){
		o[i]=exports.unformat(n[i]);
	}
	return o;
}

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

/* Split a string or an array into unique items */
exports.split=function(o,delimiter){
	if (!o) return [];
	var delim=delimiter||",";
	if (typeof o=='string') o=[o];
	var r=[];
	o.forEach(function(i){r=r.concat(i.split(delim));})
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

//Takes an object, and returns back an object with the keys sorted
exports.sortKeys=function(obj) {
    var o={};
    Object.keys(obj).sort().forEach(function(d){o[d]=obj[d]})
    return o;
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
	extends two objects such that the result contains arrays of unique objects, or single values
*/
function unique(value, index, self) { 
    return self.indexOf(value) === index;
}

exports.extendDistinct=function(a,b){
	if (!a) a={};
	for (i in b){
		if (!a[i]){a[i]=b[i]; continue;}
		if (!Array.isArray(a[i])) a[i]=[a[i]];
		a[i]=a[i].concat(b[i]).filter(unique);
		if (a[i].length==1) a[i]=a[i][0];
	}
	return a;
}



/*
	Safe eval takes either a string of operations to run on a sandbox, which is then returned.
	
	Alternatively, if passed an object (string that starts with '{') it will return the eval'd version of that string
*/
exports.safeEval=function(script,callback){
	if (!script){
		if (!callback) throw "No content to eval";
		return callback("No content to eval");
	}
	
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
		//console.error("Error eval'ing "+script);
		console.error(e);
		
		//The error SHOULD be of type error, but it's not.  Create a new error, and add the stack and message
		var correctedError=new Error();
		correctedError.stack=e.stack;
		correctedError.message=e.message;
		
		if (!callback) throw correctedError;
		return callback(correctedError);
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



/*
	
	Safely evaluate a function against an input object, returning null if there's no function specified, or the results of the function
	
*/
	
exports.safeFunctionEval=function(functionString,input,callback){
		//Process functions
		var f=functionString;
		if (typeof functionString=='function'){
			f=functionString.toString();
		}else if (functionString._bsontype=='Code'){
			//Stupid bson "CODE" type :(
			f=functionString.code;
		}
		
		if (functionString){
			//Bug fix -- unicode line feeds do not get handled well -- replace with \r
			var stringInput=JSON.stringify(input).replace(/\u2028/gm,"\\r");
			
			var e="var input="+stringInput+";";
			//debug("Running options function with keys "+JSON.stringify(Object.keys(input)));
			
			e+="var func="+f+"; var output=null; try{output=func(input);}catch(e){throw new Error(e);}";
			
			exports.safeEval(e,function(err,data){
				if (err){
					 debug("Error executing string function, with input:");
					 debug(util.inspect(input));
					 debug(f);
					 err.message="Bad options string function: "+err.message;
					 return callback(err);
				}
				
				//Could be false -- bot's a valid response.  Just can't be undefined!!
				if (data.output==undefined) return callback("String function error -- no values were returned from the string function");
				debug("Completed string function, returning output with keys "+((typeof data.output=='object')?JSON.stringify(Object.keys(data.output)):data.output));
				callback(null,data.output);
			});
		}else{
			debug("No function, returning input");
			callback(null,null);
		}
}







exports.escapeRegExp= function(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
};

exports.parseRegExp=function(o){
	switch(typeof o){
		case 'object':
			for (i in o){
				o[i]=exports.parseRegExp(o[i]);
			}
			return o;
			
		case 'string':
			if (o.indexOf('/')==0 && o.lastIndexOf('/')>0){
				var r=o.slice(1,o.lastIndexOf('/'));
				var g=o.slice(o.lastIndexOf('/')+1);
				var re=new RegExp(r,g);
				return re;
			}
			
		default: return o;
	}
}

exports.replaceAll=function(find, replace, str) {
  return str.replace(new RegExp(exports.escapeRegExp(find), 'g'), replace);
}


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
	Compression function that removes all x===0 keys
	//Ignores keys in the ignoreArray
*/
exports.dezero = function(o,ignore) {
	if (typeof o=='object'){
		ignore=ignore || [];
		for (i in o){
			if (o[i]===0 &&!Array.isArray(o)
				&& ignore.indexOf(i)<0)  delete o[i];
					
			exports.dezero(o[i],ignore);
		}
	}
	return o;
};




/*
	Useful function for parsing yes/no/true/false values and strings.
	* Returns true for "y"/"yes"/"Yes"/"true"/"t"/"True"/true/non-zero Number/Object	
	* Return default value for empty string, undefined, null (default value is 'false')
	and false for everything else
	
*/
exports.bool=function (x,defaultVal){
	if (defaultVal===undefined) defaultVal=false;
	if (x===undefined || x===null || x==="") return defaultVal;
	if (typeof x!='string') return !!x;
	var y=x.toLowerCase();
	return !!(y.indexOf('y')+1) || !!(y.indexOf('t')+1)
}




exports.zeroPad=function(num, numZeros) {
	var n = Math.abs(num);
	var zeros = Math.max(0, numZeros - Math.floor(n).toString().length );
	var zeroString = Math.pow(10,zeros).toString().substr(1);
	if( num < 0 ) {
		zeroString = '-' + zeroString;
	}

	return zeroString+n;
}


/*
	serializes a javascript object, including functions, and stringifies regular expressions.  Also includes protections for
	stringifying endless loops
	
*/


exports.serialize=function(obj){
var cache = [];

  var s=JSON.stringify(obj,function(key, value) {
    if (typeof value === 'object' && value !== null) {
        if (cache.indexOf(value) !== -1) {
            // Circular reference found, discard key
            console.error("js.js: Circular reference found for key "+key);
            return "[Circular]";
        }
        // Store value in our collection
        cache.push(value);
    }
      return (typeof value==='function' || value instanceof RegExp || (value && value.constructor && value.constructor.toString().indexOf('RegExp')>0))?value.toString():value
	},4);
  cache = null; // Enable garbage collection
  
  return s;
}

/*
gets unique array elements
*/
exports.getUnique=function(arr){
   var u = {}, a = [];
   for(var i = 0, l = arr.length; i < l; ++i){
   	 key = JSON.stringify(arr[i]);
      if(u.hasOwnProperty(key)) {
         continue;
      }
      a.push(arr[i]);
      u[key] = 1;
   }
   return a;
}


/*
	Function that supports relative date calculations, like "-3d" for 3 days ago, etc
*/
exports.relativeDate=function(s,initialDate){
	if (!s || s=="none") return null;
	if (typeof s.getMonth === 'function') return s;
	
	if (initialDate){
		initialDate=new Date(initialDate);
	}else{
		initialDate=new Date();
	}
	
	var r=s.match(/^([+-]{1})([0-9]+)([YyMwdhms]{1})([.a-z]*)$/);
	if (r){
		var period=null;
		switch(r[3]){
			case "Y":
			case "y": period="years"; break;
			
			case "M": period="months"; break;
			case "w": period="weeks"; break;
			case "d": period="days"; break;
			case "h": period="hours"; break;
			case "m": period="minutes"; break;
			case "s": period="seconds"; break;
		}
		var d=moment.utc(initialDate);
		
		if (r[1]=="+"){
			 d=d.add(parseInt(r[2]),period)
		}else{
			d=d.subtract(parseInt(r[2]),period)
		}
		if (d.toDate()=='Invalid Date') throw "Invalid date configuration:"+r;
		if (r[4]){
			var opts=r[4].split(".").filter(Boolean);
			if (opts[0]=="start") d=d.startOf(opts[1]||"day");
			else if (opts[0]=="end") d=d.endOf(opts[1]||"day");
			else throw "Invalid relative date,unknown options:"+r[4]
		}
		
		return d.toDate();
	}else{
		var r=moment.utc(new Date(s)).toDate();
		if (r=='Invalid Date') throw "Invalid Date: "+s;
		return r;
	}
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

var sift=require("sift");

/* Extensions to Arrays to allow for find and findOne methods, leveraging mongoc */
exports.addArrayFindPrototype=function(){
	if (Array.prototype.findOne) return;
	Object.defineProperty(Array.prototype, "findOne", {value:function(object){
		var func=sift(object);
		if (func.test) func=func.test;
		for (i=0; i<this.length; i++){if (func(this[i])) return this[i];}
		return null;
	},enumerable:false
	});
	
	//Find the first index in the array that matches the query
	Object.defineProperty(Array.prototype, "findIndex", {value:function(object){
		var func=sift(object);
		if (func.test) func=func.test;
		for (i=0; i<this.length; i++){if (func(this[i])) return i;}
		return -1;
	},enumerable:false
	});
	
	
	Object.defineProperty(Array.prototype, "find", {value:function(object){
		return sift(object,this);
	},enumerable:false});
	/* Provides a distinct set based on the string value */
	Object.defineProperty(Array.prototype, "distinct", {value:function(){
		return exports.getUnique(this);
	},enumerable:false});
}


exports.assign=function(obj, prop, value) {
    if (typeof prop === "string")
        prop = prop.split(".");

    if (prop.length > 1) {
        var e = prop.shift();
        exports.assign(obj[e] =
                 Object.prototype.toString.call(obj[e]) === "[object Object]"
                 ? obj[e]
                 : {},
               prop,
               value);
    } else
        obj[prop[0]] = value;
    return obj;
}



function abbrNum(number, decPlaces) {
	if (!Number(number)) return 0;
	if (number<1 && number>0){return Number(number).toFixed(1);}
	
    // 2 decimal places => 100, 3 => 1000, etc
    decPlaces = Math.pow(10,decPlaces);

    // Enumerate number abbreviations
    var abbrev = ["", "k", "m", "b", "t" ];

    // Go through the array backwards, so we do the largest first
    for (var i=abbrev.length-1; i>=0; i--) {

        // Convert array index to "1000", "1000000", etc
        var size = Math.pow(10,(i)*3);

        // If the number is bigger or equal do the abbreviation
        if(size <= number) {
             // Here, we multiply by decPlaces, round, and then divide by decPlaces.
             // This gives us nice rounding to a particular decimal place.
             number = Math.round(number*decPlaces/size)/decPlaces;

             // Handle special case where we round up to the next abbreviation
             if((number == 1000) && (i < abbrev.length - 1)) {
                 number = 1;
                 i++;
             }

             // Add the letter for the abbreviation
             number += abbrev[i];

             // We are done... stop
             break;
        }
    }
    return number;
}

//turn numbers into abbreviated numbers, strings to shortened strings, etc
exports.humanize=function(o,chars){
	if (o==Infinity) return "n/a";
	chars=chars || 100;
	switch (typeof o){
		case 'string': return o.slice(0,chars);
		case 'NaN': return "n/a";
		case 'number': return abbrNum(o,1);
		case 'object': 
		var n={};
		for (i in o){
			if (i.slice(-3)!="_id"){
				n[i]=exports.humanize(o[i],chars);
			}else{
				n[i]=o[i];
			}
		}
		default:
			return n;
	}
}

exports.getIntArray=function(s,nonZeroLength){
	var a=s || [];
	if (typeof a=='number') a=[a];

	if (typeof s=='string') a=s.split(",");
	a= a.map(function(s){return parseInt(s)}).filter(function(s){return !!s});
	if (nonZeroLength && a.length==0) a=[0];
	return a;
}

/* 
	Microsoft date functions -- a number which is the count of days since some specific date.  Grr.
*/
exports.msdate=function(n,ignoreTimezone){
	 if (n==null || n==Infinity || n==undefined || n=="") return "";
	 
	 if (typeof n=='string') n=new Date(n);
	 
	var returnDateTime = null;
	if (ignoreTimezone){
		returnDateTime=25569.0 + ((n.getTime() - (n.getTimezoneOffset() * 60 * 1000)) / (1000 * 60 * 60 * 24));
	}else{
		returnDateTime=25569.0 + ((n.getTime()) / (1000 * 60 * 60 * 24));
	}
	
	return returnDateTime.toString().substr(0,20);
}

exports.fromMSDate=function(date){
  return new Date(Math.round((Number(date) - 25569)*86400*1000));
}








exports.base58 = require('encdec').create();

// base32 encoding
exports.base32 = require('encdec').create('abcdefghijklmnopqrstuvwxyz234567');

//to handle longer strings, we can split numbers
exports.base58toN=function(n,s){
	var split=Math.floor(s.length/2);
	var a=base58.decode(s.substring(0,split)).toString(n);
	var b=base58.decode(s.substring(split)).toString(n);
	return a+b;
}

exports.baseNto58=function(n,s){
	if (!s) return "-1";
	if (typeof s=='number') s=Number(s).toString();
	if (typeof s!='string') s=s.toString();
	var split=Math.floor(s.length/2);
	var a=base58.encode(parseInt(s.substring(0,split),n));
	var b=base58.encode(parseInt(s.substring(split),n));
	return a+b;
}



/*
	deserializes a javascript object, including functions and dates
*/

exports.deserialize=function(str){
  return JSON.parse(str,dateFunctionReviver);
}
