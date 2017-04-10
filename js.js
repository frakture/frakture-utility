var vm = require('vm'),
	util=require("util");

/*
	Useful js functions
*/


/* Returns number of millis since last time this was called */
var last=new Date().getTime();
exports.timer=function(l){
	var t=new Date().getTime();
	//console.error(l,last-t);
	var l=t-last;
	last=t;
	return l;
}

//Format numbers, also accepts object of numbers
exports.format=function(n,s){	
	if (typeof n!='object'){
		//only format numbers
		if(parseFloat(n)!=n) return n;
		 return require("numeral")(n).format(s);
	}
	var o={};
	for (i in n){
		o[i]=exports.format(n[i],s);
	}
	return o;
}

exports.reduceObject=function(a,b){
	var o=a;
	for (i in b){
		var v=b[i];
		if (!o[i]){
		 o[i]=b[i];
		 continue;
		}
		
		if (typeof v=='number' && typeof o[i]=='number'){
			o[i]=o[i]+v;
			continue;
		}
		o[i]=[].concat(o[i],v);
	}
	return o;
}

/*
	Filter down to just the sum of the numbers, no strings or objects  Remember to call reduce with the second argument as "{}", because single element reduce will never call this function
*/
exports.reduceNumbers=function(a,b){
	var o=a;
	for (i in b){
		var v=b[i] ||0;
		if (typeof v!='number') continue;
		o[i]=(o[i]||0)+v;
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
	
	context is optional second attribute that is an object of context items.
	
	
*/
exports.safeEval=function(script,context,callback){
	if (typeof context!='object'){
		callback=context;
		context=null;
	}
	
	if (!script){
		if (!callback) throw "No content to eval";
		return callback("No content to eval");
	}
	
	var sandbox={log:console.log};
	
	if (context){
		for (i in context) sandbox[i]=context[i];
	}

	script=require("strip-json-comments")(script.toString()).trim();
	
	
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

	//Make strings, etc local
	result=exports.extend(true,{},sandbox.value);
	
	// RegExp are created in the other context, so they don't match "instanceof" in this context, which causes
	// chain effects down the line in some libraries (like sift) not recognizing RegExp matches
	for (i in result){
		if (result[i] && typeof result[i]=='object' && result[i].constructor && result[i].constructor.toString().indexOf("RegExp")>=0){
			result[i]=new RegExp(result[i].source,result[i].flags);
		}
	}
	
	if (callback){
		callback(null,result);
	}else{
		return result;
	}
}

exports.testSafeEval=function(){
	var s="{a:/foo/}";
	var safe=exports.safeEval(s);
	var ev=eval("("+s+")");
	console.log("Safe:",safe,safe.a instanceof RegExp,safe.a.constructor,"foo".match(safe.a));
	console.log("Unsafe:",ev,ev.a instanceof RegExp,ev.a.constructor,"foo".match(ev.a));
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
				if (data.output==undefined){
					console.error("Error with function:"+functionString)
					console.error("Response value is:",data.output);
					return callback("String function error -- no values were returned from the string function");
				}
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

exports.parseRegExp=function(o,opts){
	if (o instanceof RegExp) return o;
	try{
		switch(typeof o){
			case 'object':
				for (i in o){
					o[i]=exports.parseRegExp(o[i],i,counter);
				}
				return o;
			
			case 'string':
				if (o.indexOf('/')==0 && o.lastIndexOf('/')>0){
					var r=o.slice(1,o.lastIndexOf('/'));
					var g=o.slice(o.lastIndexOf('/')+1);
					var flags=exports.getUnique((g+(opts||"")).split("")).join("")
					var re=new RegExp(r,flags);
					return re;
				}else{
					return new RegExp(o,opts||"i");
				}
			
			default:
				return o;
		}
	}catch(e){
		return o;
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

exports.truthify = function(o) {
	if (typeof o=='object'){
		for (i in o){
			if (!o[i])  delete o[i];
			exports.truthify(o[i]);
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

var lower=/[^a-z0-9]/g;

exports.lowerCaseObject=function(d){
	var o={};
	for (i in d){
		var k=i.toLowerCase().replace(lower,"");
		o[k]=d[i];
	}
	return o;
}
exports.matchesFilter=function (filter,data){
	//if no filter, everything matches!
	if (!filter || filter=="*") return true;
	
	data=data || {};
	if (typeof filter=="string"){
		try{
		 filter=JSON.parse(filter);
		 }catch(e){
		 	try{
		   		filter=exports.safeEval(filter);
		   	}catch(e){
		   		console.error(e);
		   		throw "Invalid filter:'"+filter+"'";
		   	}
		 }
		 if (!filter) throw "Invalid filter:"+filter;
	}
	var func=sift(filter);
	if (func.test) func=func.test;
	if (func(data)) return true;
	else return false;
}

exports.testMatch=function(){
	var data={ given_name: '',
     family_name: '',
     pbs_mvault_membership_id: '',
     pbs_mvault_provisional: '',
     pbs_mvault_start_date: '',
     pbs_mvault_expire_date: '',
     email: 'foo@bar.com',
     pbs_mvault_offer: '',
     amount: 60,
     country: 'US',
     remote_ip_address: '::ffff:10.69.198.55' };
	 var filter={ country: 'US', amount: { '$gte': 60 }, email: /@/ };
	 var stringfilter="{ country: 'US'}";
	 console.error(data);
	 console.error(exports.matchesFilter(filter,data));
	 console.error(exports.matchesFilter(stringfilter,data));
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
	var moment=require("moment-timezone");
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
	}else if (s=="now"){
		var r=moment.utc(new Date()).toDate();
		return r;
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

exports.sift=sift;

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
		if (typeof object=='function') return this.filter(object)[0];
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



/*
	Levenshtein closest match sorting
	arr.sort(function(a,b){
		return levDistance(a,term)-levDistance(y,term);
	});
	from
	http://stackoverflow.com/questions/11919065/sort-an-array-by-the-levenshtein-distance-with-best-performance-in-javascript
	
*/
exports.levDistance=function(s, t){
		var d = []; //2d matrix

		// Step 1
		var n = s.length;
		var m = t.length;

		if (n == 0) return m;
		if (m == 0) return n;

		//Create an array of arrays in javascript (a descending loop is quicker)
		for (var i = n; i >= 0; i--) d[i] = [];

		// Step 2
		for (var i = n; i >= 0; i--) d[i][0] = i;
		for (var j = m; j >= 0; j--) d[0][j] = j;

		// Step 3
		for (var i = 1; i <= n; i++) {
			var s_i = s.charAt(i - 1);

			// Step 4
			for (var j = 1; j <= m; j++) {

				//Check the jagged ld total so far
				if (i == j && d[i][j] > 4) return n;

				var t_j = t.charAt(j - 1);
				var cost = (s_i == t_j) ? 0 : 1; // Step 5

				//Calculate the minimum
				var mi = d[i - 1][j] + 1;
				var b = d[i][j - 1] + 1;
				var c = d[i - 1][j - 1] + cost;

				if (b < mi) mi = b;
				if (c < mi) mi = c;

				d[i][j] = mi; // Step 6

				//Damerau transposition
				if (i > 1 && j > 1 && s_i == t.charAt(j - 2) && s.charAt(i - 2) == t_j) {
					d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
				}
			}
		}

		// Step 7
		return d[n][m];
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
	try{
	if (o==Infinity) return "n/a";
	chars=chars || 200;
	switch (typeof o){
		case 'function':
			return "[Function]";
		case 'boolean':
			return o;
		case 'string': 
		if (o.length>chars){return o.slice(0,chars)+"...";}
		else return o;
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
			return n;
		default:
			return o;
	}
	}catch(e){
		console.error("Could not humanize object:",o);
		return "err!";
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

exports.getStringArray=function(s,nonZeroLength){
	var a=s || [];
	if (typeof a=='string') a=[a];

	if (typeof s=='string') a=s.split(",");
	a=a.map(s=>s.trim()).filter(Boolean);
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
