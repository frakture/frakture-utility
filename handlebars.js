var js=require("./js.js"),
	handlebars=require("handlebars");


handlebars.registerHelper('contains', function(s,val,options) {
  if (!s) return options.inverse(this);
  s=s+'';
  if (s.indexOf(val)>=0) return options.fn(this)
  else return options.inverse(this);
});

	
handlebars.registerHelper("inc", function(value, options){
    return parseInt(value) + 1;
});

handlebars.registerHelper("encode",function( string ){return encodeURIComponent(string);});


handlebars.registerHelper('date', function(d,format,options) {
		//console.error("d=",d,"format=",format,"options=",options);
		
		if (!d) return "";
		if (typeof d!='string') throw "Not a string:"+typeof d+" : "+JSON.stringify(d);
		
		var moment=require("moment-timezone");
		var date=moment(js.relativeDate(d));
		
		if (typeof format=='string'){
			 return date.format(format);
		}else{
			return date.toISOString()
		}
	});
	 
	 handlebars.registerHelper('format', function(a,b,c) {
	 	if (!c) b=null;
		 return js.format(parseFloat(a),b)}
	);
	
	 handlebars.registerHelper('slice', function(s,format,options) {
	 	  if (!s) return "";
	 	  s=s+'';
	 	  if (!format) return s;
	 	  format=format+'';
	 	  var a=format.split(",").map(d=>d.trim());
	 	  if (a.length==1) return s.slice(parseInt(a[0]))
	 	  if (a.length>2) return "Invalid slice: "+format;
	 	  return s.slice(parseInt(a[0]),parseInt(a[1]));
	 	 }
	);
	
	 handlebars.registerHelper("json", function(context){ return JSON.stringify(context,null,4);});
	 
	 handlebars.registerHelper('ifCond', function (v1, operator, v2, options) {
	//	console.log("ifCond",v1,operator,v2,typeof this,this.value);

		if (!options) throw "Not enough values for {{#ifCond "+v1+" "+operator+" "+v2+"}}";
		switch (operator) {
			case '=':
			case '==':
				return (v1 == v2) ? options.fn(this) : options.inverse(this);
			case '!=':
				return (v1 != v2) ? options.fn(this) : options.inverse(this);
			case '!==':
				return (v1 !== v2) ? options.fn(this) : options.inverse(this);
			case '===':
				return (v1 === v2) ? options.fn(this) : options.inverse(this);
			case '<':
				return (v1 < v2) ? options.fn(this) : options.inverse(this);
			case '<=':
				return (v1 <= v2) ? options.fn(this) : options.inverse(this);
			case '>':
				return (v1 > v2) ? options.fn(this) : options.inverse(this);
			case '>=':
				return (v1 >= v2) ? options.fn(this) : options.inverse(this);
			case '&&':
				return (v1 && v2) ? options.fn(this) : options.inverse(this);
			case '||':
				return (v1 || v2) ? options.fn(this) : options.inverse(this);
			default:
				return options.inverse(this);
		}
	});

module.exports=handlebars;
