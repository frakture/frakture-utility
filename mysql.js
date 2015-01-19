/*
Utility class for handling mysql connections, including pooling

This library supports N instances of MySQL, and maintains a pool for each one

*/

var async=require('async');
var generic_pool = require('generic-pool');
var mysql = require('mysql');

/*
	Reconnect delay is a gradually increasing time when the database isn't available
*/
var minReconnectDelay=500;
var maxReconnectDelay=5*60*1000;
var currentReconnectDelay=minReconnectDelay;

var dbs=[];

var createFunc=function(callback) {
	var pool_index=this.pool_index;
	var conn=mysql.createConnection(
		dbs[pool_index]
	);

	conn.connect(function(err){
		if(err){
			//Wait 5 seconds, try again
			conn.end();
			currentReconnectDelay*=1.2; if (currentReconnectDelay>maxReconnectDelay)currentReconnectDelay=maxReconnectDelay;
			console.log("Error connecting to database, trying again in "+currentReconnectDelay/1000+" seconds") ;
			setTimeout(function(){createFunc(callback)},currentReconnectDelay);
		}else{
			//reset the reconnect delay
			currentReconnectDelay=minReconnectDelay;
			conn.pool_index=pool_index;
			callback(err,conn);
		}
	});
 }
  
//Array of pools
var pools=[];
for (var i in dbs){
	pools[i]=generic_pool.Pool({
	    name: 'mysql_'+i,
    	min:0,
	    max: 25,
	    pool_index:i,
    	create: createFunc,
		destroy: function(conn) {
        	conn.end();
    	}
	});
}

exports.getInstanceCount=function(){	return pools.length;}

exports.getConnection=function(callback){
	pool.acquire(function(err,conn){
		if (err){
			//Hmm -- issue with the connection -- wait a little bit before returning?
			console.log(err);
			pool.destroy(conn);
			return;
		 }
		 callback(err,conn);
	});
}

exports.release=function(obj){pools[obj.pool_index].release(obj);}
exports.destroy=function(obj){pools[obj.pool_index].destroy(obj);}

exports.drainAll=function(){
	for (var i in pools){
		pools[i].drain(function() { pools[i].destroyAllNow();});
	}
}

/*
	Run 1 query across multiple databases
*/
exports.batchQuery=function(query,fields, eachQueryCallback, allCompleteCallback){
	var completeCounter=0;
	for (var i in pools){
			pools[i].acquire(function(err,conn){
	//		console.log("Acquired connection from pool "+conn.pool_index);
			if (err){
				//Hmm -- issue with the connection -- wait a little bit before returning?
				console.log(err);
				pools[i].destroy(conn);
				return;
			 }
			 
			 conn.query(query, fields, function(err,data){
				var d=(data||[])[0];
				exports.release(conn);
				eachQueryCallback(err,d);
				completeCounter++;
				if (completeCounter==pools.length && typeof allCompleteCallback=='function'){
					allCompleteCallback();
				}
			 });
		});
	}
}

/*
	
	options
	type:
	max
	min
	value_counts
	max_length
	min_length
	
*/
exports.getType=function(options){
	var a=options;
	switch(a.type){
			case 'integer':
					if (a.max && a.min!==undefined && a.max<=127 && a.min>-127){ return "TINYINT"; break;}
					if (a.max && a.min!==undefined && a.max<=2147483647 && a.min>-2147483647){ return "INT"; break;}
					return  "BIGINT"; break;
			case 'float':
				return "FLOAT"; break;
			case 'date':
				return "DATETIME";break;
			
			case 'string':
			default:
				 if (a.value_counts){
						 return "ENUM('"+a.value_counts.map(function(v){return v.label.replace(/'/g,"''")}).join("','")+"')";
					}else if (a.max_length && a.max_length==a.min_length){
						return "CHAR("+a.max_length+")";
					}else if (a.max_length){
						return "VARCHAR("+a.max_length+")";
					}else{
						return "TEXT";
					}
		}
}

/* Stupid mysql doesn't accept iso8601 dates - check for them here and remove the Z 

*/
var isoRegex=/[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:.]{12}Z/;

exports.convertISO8601ToSQL=function(s){
	if (s && s.length==24 && (typeof s=='string') && s.match(isoRegex)) return s.slice(0,23);
	return s;
}

/*

	Run a series of queries in an array, back to back, and call the callback with the final result when complete
	The query list can either be strings, 
	["insert ....",
		"select ...."
	], 
	or a series of objects with q (query) and d (data) attributes.  d can be an array of objects, or a function that returns an array based on results from the previous query
	[
		{q:"insert into foo select ? from bar",d:["val"]},
		{q:"select count() _count from foo",d:[]},
		{q:"insert into counts values (?)",d:function(lastResults){return [lastResults[0]._count]}}
	]
	
	lastResults is an array of the results from the previous query.
	
	Parameters are:
		queryList -- array of queries
		callback(err,lastResult) -- callback to run when all queries are complete

*/
function getConnection(config,callback){
	var connection;

	function handleDisconnect() {
	  connection = mysql.createConnection(config); // Recreate the connection, since
													  // the old one cannot be reused.

	  connection.connect(function(err) {              // The server is either down
		if(err) {                                     // or restarting (takes a while sometimes).
		  console.log('error when connecting to db:', err);
		  return setTimeout(handleDisconnect, 2000); // We introduce a delay before attempting to reconnect,
		} 
		callback(null,connection)                                    // to avoid a hot loop, and to allow our node script to
	  });                                     // process asynchronous requests in the meantime.
	  connection.on('error', function(err) {
	  	console.log("Error handler called");
		console.log('db error', err);
		if(err.code === 'PROTOCOL_CONNECTION_LOST') { // Connection to the MySQL server is usually
			console.log("MySQL connection lost, trying to reconnect");
		  handleDisconnect();                         // lost due to either server restart, or a
		} else {                                      // connnection idle timeout (the wait_timeout
		  throw err;                                  // server variable configures this)
		}
	  });
	}
	handleDisconnect();
}


exports.runQueryArray=function(queryList,callback,log){
	if (!log) log=console.log;
	var lastResult=null;
	if (!Array.isArray(queryList)){
		 return callback(new Error("queryList must be an array"));
	}
	
	getConnection(process.env.MYSQL_URI,function(err,conn){
		if (err) return callback(err);
		async.eachSeries(queryList,function(query,queryListCallback){
				if (!query) return queryListCallback(new Error("Empty query"));
				var q=null;
				var parameters=[];
				if (typeof query=='string'){
					q=query;
				}else{
					q=query.sql;
					 if (query.values){
						if (typeof query.values=='function') parameters=query.values(lastResult[0]);
						else if (Array.isArray(query.values)) parameters=query.values;
					}
				}
				
				log("SQL: "+exports.getSQLString({sql:q,values:parameters}));
				
				conn.query(q, parameters, function(err,data){
						if (err){
							log(err);
							if (err.toString().indexOf('ER_DUP_KEYNAME')>0 || err.toString().indexOf('ER_DUP_FIELDNAME')>0){
								//Totally okay if columns already exist
							}else{
								return queryListCallback(err);
							}
							data={};
						}
						if (q.toLowerCase().trim().indexOf('select')==0){
							log("SQL RESULT: "+data.length+" rows");
						}else{
							log("SQL RESULT: "+JSON.stringify(data));
						}
						
						lastResult=data;	
						queryListCallback();
					});	
			},function(err){
				if (conn) conn.destroy();
				if (err) return callback(err);
				callback(null,lastResult);
		});
	});
}

/*
	Improved version of run QueryArray, that returns all results as an array, AND supports passed in connection options
*/
exports.mapQueries=function(opts, callback){
	if (Array.isArray(opts)) return callback("first parameter must be an object");

	var log=opts.log;
	if (!log) log=console.log;
	
	var queryList=opts.queries;
	
	var lastResult=null;
	if (!Array.isArray(queryList)){
		 return callback(new Error("queries must be an array"));
	}

	getConnection(opts.mysql_uri || process.env.MYSQL_URI,function(err,conn){
		if (err){return callback(err);}
	
		async.mapSeries(queryList,function(query,queryListCallback){
				if (!query) return queryListCallback(new Error("Empty query"));
				var q=null;
				var parameters=[];
				if (typeof query=='string'){
					q=query;
				}else{
					q=query.sql;
					 if (query.values){
						if (typeof query.values=='function') parameters=query.values(lastResult[0]);
						else if (Array.isArray(query.values)) parameters=query.values;
					}
				}
				
				log("SQL: "+exports.getSQLString({sql:q,values:parameters}));
				
				conn.query(q, parameters, function(err,data){
						if (err){
							log("Error during query execution:"+err);
							if (err.toString().indexOf('ER_DUP_KEYNAME')>0 || err.toString().indexOf('ER_DUP_FIELDNAME')>0){
								data={exists:true,code:err.code};//Totally okay if columns already exist
							}else{
								return queryListCallback(err);
							}
						}
						if (q.toLowerCase().trim().indexOf('select')==0){
							log("SQL RESULT: "+data.length+" rows");
						}else{
							log("SQL RESULT: "+JSON.stringify(data));
						}
						
						lastResult=data;	
						data.query=q;
						data.parameters=parameters;
						queryListCallback(null,data);
					});	
			},function(err,results){
				if (conn) conn.destroy();
				if (err){
					console.error(err);
					console.log("MySQL error:"+err);
					 return callback(err);
				}
				callback(null,results);
			} );
	});
}




exports.getSQLString=function(o,timeZone){
	if (typeof o=='string') return o;
	if (!o.sql) throw "No query sql in :"+JSON.stringify(o);
	if (o.sql.indexOf('?')<0) return o.sql;
	
	//Coped from mysql lib SQLString
	o.values = [].concat(o.values);

	 return o.sql.replace(/\?/g, function(match) {
		if (!o.values.length) {
		  return match;
		}
		var v=o.values.shift();

		return mysql.escape(v, false, timeZone);
	  });
};

exports.escapeId=mysql.escapeId;

/*
function test(){
	async.forever(function(cb){
		setTimeout(function(){
			
			
			//getConnection(process.env.MYSQL_URI,function(e,conn){
			//	if (e) return cb(e);
			//	conn.query("SELECT 1", function(e,d){console.log(e,d); conn.destroy(); cb(e);})
			//})
			
			
			exports.mapQueries({queries:["SELECT 1"]},cb);
		},5);
	},function(e){
		console.error(e);
	});
}

test();
*/

