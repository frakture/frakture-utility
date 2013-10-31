var util=require("util");
var stream=require("stream");
/*
	Streams2 transformer that allows for manipulations of lines using a map() function
	
	options:{
		map:function(line,count){} //
	}
*/

function MapStream(options) {
  stream.Transform.call(this, options);
  this._linebuffer = [];
  this.counter=0;
  this.mapFunc=options.map || function(l){return l;};
  this.start=new Date().getTime();
}

util.inherits(MapStream, stream.Transform);
var newline="\r\n";
var split=/\r\n|\r|\n/g;

MapStream.prototype._transform = function(chunk, encoding, cb) {
if (Buffer.isBuffer(chunk)) {
if (encoding == 'buffer') {
  chunk = chunk.toString(); // utf8
}
else {
 chunk = chunk.toString(encoding || 'utf8'); 
}
}

var lines = chunk.split(split);

/*
	append to previous line
*/
if (this._linebuffer.length > 0) {
	this._linebuffer[this._linebuffer.length-1]+=lines[0];
	lines.shift();
}

this._linebuffer = this._linebuffer.concat(lines);
while (this._linebuffer.length > 1) {
		var line = this._linebuffer.shift();
		var val=this.mapFunc(line,this.counter);
		this.push(val+newline);
		//Logging
		if (this.counter++%1000==0){
			var t=(new Date().getTime()-this.start);
			 console.log("utility.MapStream: "+this.counter+":"+ t/1000+" secs --> " + (1000*this.counter/t).toFixed(2)+"/second");
		}
}
  cb();
};

MapStream.prototype._flush = function(cb) {
	while (this._linebuffer.length > 0) {
		var line = this._linebuffer.shift();
		var val=this.mapFunc(line,this.counter);
		this.push(this._linebuffer.length==0?val:val+newline);
		if (this._linebuffer.length>0) this.counter++;
	}
	cb();
};

exports.MapStream=MapStream;