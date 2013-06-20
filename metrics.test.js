var metrics=require('../metrics.js');
var assert = require('assert');
var mongo_util = require('../mongo_util.js');
var mysql_util=require("../mysql_util.js");


metrics.refresh({
		start:'2012-01-01',
		end:'2013-01-01',
		metric:"email_sent",
		segment_id:1006
},function(err, result){
		mysql_util.drainAll();
		mongo_util.getDB().close(function(){});
		
		assert.ok(!err);
		assert.ok(result);
		assert.ok(result.reported);
		assert.ok(result.reported.length!=mysql_util.getInstanceCount());
		
		console.log(result);
	});


