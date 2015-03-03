/* Defines mongo connection information */
var db=null;

var common_mongo=require("./mongo_common.js"),
mongodb=require('mongodb'),js=require("./js.js"),
async=require("async"),
mysql=require("./mysql.js");

for (i in common_mongo){exports[i]=common_mongo[i];}

/*
	There are some legacy synchronous calls to get a database connection synchronously.  Thus the need for Fibers/sleep
*/


exports.getDB=function(callback){
	if (!process.env.MONGO_URI){
		return callback("MONGO_URI environment variable is required");
	}
	if (db!=null) return db;
	
	mongodb.MongoClient.connect(process.env.MONGO_URI+"&w=1",{auto_reconnect:true,maxPoolSize:10},function(err,d){
		if (err) throw err;
		db=d;
	});
	while(db===null){
		require('deasync').runLoopOnce();
	}
	
	return db;
}

/* For legacy reasons, have to make this a synchronous call */

exports.ObjectID=mongodb.ObjectID;

exports.getObjectID=function(v){
	return (typeof v=='string')?mongodb.ObjectID.createFromHexString(v):v;
}

exports.getObjectId=exports.getObjectID;


exports.convertOid=function(o){
	if (typeof o!='object') return o;
	for (i in o){
		if (!o[i]){
		}else if (typeof o[i]=='object' && o[i]["$oid"]){ o[i]=mongodb.ObjectID.createFromHexString(o[i]["$oid"]);
		}else{ 
		o[i]=exports.convertOid(o[i]);}
	}
	return o;
}

/* Converts a string date into a date object */
exports.convertDate=function(o){
	if (typeof o!='object') return o;
	for (i in o){
		if (!o[i]){
		}else if (typeof o[i]=='object' && o[i]["$date"]){ o[i]=new Date(o[i]["$date"]);
		}else{ 
			o[i]=exports.convertDate(o[i]);
		}
	}
	return o;
}




//Create a suitable '$set' object that doesn't clobber sub objects
//Currently only goes 1 level deep
exports.safeSet=function(update){
	var s=js.extend({},update);
	delete s._id;
	
	for (i in s){
		if (!Array.isArray(s[i]) && !(Object.prototype.toString.call(s[i]) === '[object Date]') && typeof s[i]=='object'){
			for (j in s[i]){
				s[i+"."+j]=s[i][j];
			}
			delete s[i];
		}
	}
	return {$set:s};
}


exports.insertIncrementalDocument=function(doc,targetCollection,callback,killCounter){
	if (doc._id) return callback("document already has an _id:"+doc._id+", cannot insert");
	if (typeof targetCollection=='string') targetCollection=db.collection(targetCollection);
	
	var name= targetCollection.collectionName;
   var ret = db.collection("counters").findAndModify({ _id:name },{},{ $inc: { seq: 1 } },{new: true}
	   ,function(err,d){
			if (err) return callback(err);
			
			//I think this is a driver bug, that sometimes returns back the full mongo response, not just the document
			if (d.lastErrorObject){
		   		d=d.value;
		   	}
			if (!d){
				console.log("No sequence named "+name);
				if (killCounter>10){
					console.error("Error inserting a "+targetCollection.collectionName+", killCounter exceeded 10.  Last error:");
					console.error(err);
					return callback(err);
				}
				killCounter=(killCounter || 0)+1;
				targetCollection.find({},{_id:1}).sort({_id:-1}).limit(1).toArray(function(err,i){
					if (err) return callback(err);
					var seq=0;
					if (i && i.length>0) seq=i[0]._id;
					if (typeof seq!='number') return callback("Error! Non number "+seq+" in collection "+name);
					db.collection("counters").save({_id:name,seq: seq},{safe:true},function(err){
						exports.insertIncrementalDocument(doc,targetCollection,callback,killCounter);
					});
				});
				return;
			}
			
			doc._id=d.seq;

			targetCollection.save(doc,function(err){
				if (err) return callback(err);
				return callback(null,doc);
			});
	   });
}

//Unsets invalid <field>_id from source collection
exports.trimLeaves=function(options,callback){
	if (typeof options.source!='string') return callback("source must be a valid string");
	var source=db.collection(options.source);
	var target=db.collection(options.target);
	var field=options.field;
	if (!field) return callback("field is required");
	
	var last=0;
	var counter=0;
	var fields={_id:1};
	fields[field]=1;
	function trim(cb){
		var q={};
		if (last) q={_id:{$gt:last}};
		q[field]={$exists:true}
		
		source.find(q,fields).sort({_id:1}).limit(1000).toArray(function(e,arr){
			if (e) return cb(e);
			if (arr.length==0){last=null; return cb();}
			
			last=arr[arr.length-1]._id;
			
			var ids=arr.map(function(d){return d[field]});
			target.find({_id:{$in:ids}},{_id:1}).toArray(function(e,targets){
				var existingTargets=targets.map(function(d){return d._id});
				var missing=arr.filter(function(d){return (existingTargets.indexOf(d[field])>=0)?false:true}).map(function(d){return d._id});
				
				if (missing.length==0) return cb();
				counter+=missing.length;
				var unset={$unset:{}};
				unset.$unset[field]=1;
				
				if (js.bool(options.remove)){
					source.remove({_id:{$in:missing}},cb);
				}else{
					source.update({_id:{$in:missing}},unset,{multi:true},cb);
				}
			});
		});
	}
	async.doWhilst(trim,function(){return !!last},function(e){
		if (e) return callback(e);
		else return callback(null,{updated:counter});
	});
}

/*
	Take an object or array of objects, generally from a query, goes through each one, looks for any <object>_id field, 
	//assumes it needs to be dereferenced, and
	// appends an object of name <object>
	Also supports account_id confirmation by default, if the first object has an account_id
	
	opts:{
		no_account_id:default false
	}
*/
exports.dereference=function(_objects,opts,callback){
	if (!_objects) return callback(null,null);
	opts=opts||{};
	if (typeof opts=='function'){ callback=opts; opts={};};
	
	var objects=_objects;
	if (!Array.isArray(_objects)) objects=[_objects];
	
	var account_id=(objects[0]||{}).account_id;
	var id_map={};
	objects.forEach(function(object){
		for (i in object){
			if (!object[i]) continue;
			if (i=='_id' || !js.endsWith(i,"_id")) continue;
			var o=i.slice(0,-3);

			id_map[o]=id_map[o]||{};
			id_map[o][object[i].toString()]=false;
		}
	});
	db=exports.getDB();
	async.eachSeries(Object.keys(id_map),function(o,oCallback){
	
		var q={_id:{$in:Object.keys(id_map[o]).map(function(d){
			if (parseInt(d)==d) return parseInt(d);
			if (typeof d=='string' && d.length==24) return exports.getObjectId(d);
			return d;
		})}};
		
		//Makes sure to filter by account_id, so you can't create an arbitrary object_id and get data about it
		if (account_id && !opts.no_account_id){
			if (o=='account'){}else{
			  q.account_id=account_id;
			}
		}
		
		db.collection(o).find(q).toArray(function(err,objects){
			if (err) return oCallback(err);
			objects.forEach(function(obj){
				id_map[o][obj._id.toString()]=obj;
			});
			oCallback();
		});
	},function(err){
		if (err) return callback(err);
		objects.forEach(function(object){
			for (i in object){
				if (!object[i]) continue;
				if (i=='_id' || !js.endsWith(i,"_id")) continue;
				var o=i.slice(0,-3);
				object[o]=id_map[o][object[i].toString()] ||{};
			}
		});

		var returnVal=objects;
		if (!Array.isArray(_objects)) returnVal=objects[0];
		callback(null,returnVal);
	});
}

/*
	Convert a query object to 
	
	object ready for a query
	e.g.:
	{
		"ts":{
			$gt:123,
			$lt:456
		},
	}
	-->
	{
		sql:"(`ts`>? AND `ts`<456)"
		values:[123,456]
	}

*/
exports.toSQL=function(q){
	var res={
		sql:"1=1",
		values:[]
	}
	for (i in q){
		var field=mysql.escapeId(i);
		var o=q[i];
		if (typeof o=='object'){
			for (j in o){
				switch(j){
					case "$gt":res.sql+=" AND "+field+">?"; break;
					case "$lt":res.sql+=" AND "+field+"<?"; break;
					case "$gte":res.sql+=" AND "+field+">=?"; break;
					case "$lte":res.sql+=" AND "+field+"<=?"; break;
					case "$like":res.sql+=" AND "+field+" LIKE ?"; break;
				}
				res.values.push(o[j]);
			}
		}else{
			sql+=" AND "+field+"=?";
			res.values.push(o);
		}
	}
	res.sql="("+res.sql+")";
	return res;
}
