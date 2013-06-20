/*
	calculate Metrics
*/

var mongo_util = require('./mongo.js');
var validation = require('./validation.js');

var db = mongo_util.getDB();

/*
	Validate that one particular account has access or not to a given segment
*/
exports.validateSegment=function(obj,callback){
	var obj=validation.validateObject(obj,[{name:"account_id",type:'string'},{name:"_id",type:'number'}]);
	db.collection("segment").findOne(obj,function(err,data){
		if (err){
			callback(err);
			return;
		}else if (!data){
			 callback("Account "+obj.account_id+" does not have access to segment "+obj.segment_id);
		}else{
			callback(null,data);
		}
	});
}
