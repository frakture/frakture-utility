/* Defines mongo connection information */
var db=null;

var common_mongo=require("./mongo_common.js");
var mongoskin=require('mongoskin');
var js=require("./js.js");
var async=require("async");
var mysql=require("./mysql.js");

for (i in common_mongo){exports[i]=common_mongo[i];}


exports.getDB=function(){
	if (db==null){
		db=require('mongoskin').db((process.env.MONGOLAB_URI || 'mongodb://localhost:27017/frakture'),
			{auto_reconnect:true,maxPoolSize:10,safe:true});
	}
	return db;
}

exports.getObjectID=function(v){
	return (typeof v=='string')?mongoskin.ObjectID.createFromHexString(v):v;
}
exports.getObjectId=exports.getObjectID;


exports.convertOid=function(o){
	if (typeof o!='object') return o;
	for (i in o){
		if (typeof o[i]=='object' && o[i]["$oid"]){ o[i]=mongoskin.ObjectID.createFromHexString(o[i]["$oid"]);
		}else{ o[i]=exports.convertOid(o[i]);}
	}
	return o;
}

//Create a suitable '$set' object that doesn't clobber sub objects
//Currently only goes 1 level deep
exports.safeSet=function(update){
	var s=js.extend({},update);
	delete s._id;
	
	for (i in s){
		if (typeof s[i]=='object'){
			for (j in s[i]){
				s[i+"."+j]=s[i][j];
			}
			delete s[i];
		}
	}
	return {$set:s};
}


//This function inserts a new document with an incremental key
exports.insertIncrementalDocument=function(doc, targetCollection,callback) {
        targetCollection.find( {}, { _id: 1 }).sort({ _id: -1}).limit(1).toArray(function(err,arr){
        	if (err) throw err;
        	if (arr[0] && Number(arr[0]._id)!=arr[0]._id) return  callback(new Error("Collection '"+targetCollection.collectionName+"' has non-numerical entries.  Cannot insert an incremental document."));
			var seq = (arr && arr[0]) ? arr[0]._id + 1 : 1;
			doc._id = seq;

			targetCollection.insert(doc,{safe:true},function(err,results){
				if( err && err.code ) {
					if( err.code == 11000 /* dup key */ ){
						//try again
						exports.insertIncrementalDocument(doc,targetCollection,callback);
						return;
					}else{
						return callback(new Error("unexpected error inserting data: " + JSON.stringify( err )));
					}
				}
				callback(null,doc);
			});
		});
}

//Take an object or array of objects, generally from a query, goes through each one, looks for any <object>_id field, assumes it needs to be dereferenced, and
// appends an object of name <object>
exports.dereference=function(_objects,callback){
	if (!_objects) return callback(null,null);
	var objects=_objects;
	if (!Array.isArray(_objects)) objects=[_objects];
	var id_map={};
	objects.forEach(function(object){
		for (i in object){
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
			if (typeof d=='string') return exports.getObjectId(d);
		})}};
		console.log(o);
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
