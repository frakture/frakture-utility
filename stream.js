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
		if (val!==null) this.push(val+newline);
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





/**
 * Create a buffered, rate-limited Writable Stream.
 * Based on 
 * https://github.com/sevko/batch-request-stream
 *
 *  but extended to allow for an "end" event
 * @param options Configuration object, which must contain the following
 *      mandatory keys and may contain the optional ones (note JSDoc `[]`
 *      syntax for optional values).
 *
 *      {function(batch, requestCompleted)} request The function to execute
 *          on each buffered batch of data. Must accept two arguments:
 *
 *          {array} batch An array of objects written to the Stream. Will be of
 *          length `batchSize` unless it's the last and the number of objects
 *          sent in is not evenly divisible by `batchSize`.
 *
 *          {function} requestCompleted Must be called by the callback sent to
 *          the asynchronous request made by `request()`. This is used to track
 *          the number of live concurrent requests, and thus manage
 *          rate-limiting.
 *
 *      {int} [batchSize=100] The number of items in each batch.
 *      {int} [maxLiveRequests=100] The maximum number of incomplete requests
 *          to keep open at any given time.
 *      {Object} [streamOptions] Options sent to `stream.Writable()`;
 *          for example: `{objectMode: true}`.
 */
function createStream(options){
	var writeStream = new stream.Writable(options.streamOptions);

	var batchSize = options.batchSize || 100;
	var batch = [];

	// Used to rate-limit the number of open requests.
	var liveRequests = 0;
	var maxLiveRequests = options.maxLiveRequests || 100;
	var streamPaused = false;

	/**
	 * Signals the completion of a request. Used to decrement `liveRequests`
	 * and manage rate-limiting.
	 */
	function requestCompleted(){
		writeStream.emit("requestCompleted");
	}

	writeStream.on("requestCompleted", function updateLiveRequests(){
		liveRequests--;
		if(streamPaused && liveRequests < maxLiveRequests){
			streamPaused = false;
			writeStream.emit("resumeStream");
		}
	});

	writeStream._write = function _write(data, enc, next){
		batch.push(data);
		if(batch.length == batchSize){
			liveRequests++;
			options.request(batch, requestCompleted);
			batch = [];

			if(liveRequests >= maxLiveRequests){
				streamPaused = true;
				this.once("resumeStream", next);
				return;
			}
		}
		next();
	};

	writeStream.on("finish", function (){
		if(batch.length > 0){
			//Run one last time
			options.request(batch, function(){
				writeStream.emit("end");
			});
		}else{
			writeStream.emit("end");
		}
	});

	return writeStream;
}

exports.BatchStream=createStream;




