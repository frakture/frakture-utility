var js=require("./js.js"),
	handlebars=require("handlebars");

handlebars.registerHelper('date', function(d,format,options) {
		console.error("d=",d,"format=",format,"options=",options);
		
		if (!d) return "";
		
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
