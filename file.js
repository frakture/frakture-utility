var fs=require("fs");

exports.mkdirp=require("mkdirp");

exports.validateFilename=function(s){
	if (s 
		&& s.match(/^[.a-zA-Z\/_0-9-]+$/)
		&& s.indexOf("..")<0
		){
		return true;
	}
	
	throw "Invalid filename:'"+s+"'";
}

/*
 Get a new, timestamp based filename, creating any necessary directories
 options: prefix/postfix
*/
exports.getTempFilename=function(options,callback){
	if (!callback && typeof options=='function'){callback=options;options={};}
	try{
		if (options.prefix) exports.validateFilename(options.prefix);
		if (options.postfix) exports.validateFilename(options.postfix);
	}catch(e){
		return callback(e);
	}
	var dir="/tmp/"+new Date().toISOString().substring(0,10);
	fs.mkdir(dir,
		function(err){if (err && err.code!='EEXIST') return callback(err);
		var path=dir+"/"+(options.prefix||"")+new Date().getTime()+(options.postfix||".txt");
		return callback(null,path);
	});
}

exports.getConfig=function(path,callback){
	fs.readFile(path,function(err,d){
		if (err){ return callback(err);}
		var lines=d.toString().split("\n");
		var config={};
		lines.forEach(function(l){
			var v=l.trim().split("=");
			if (v.length<2 || v[0].length==0 || v[0].indexOf('#')>=0) return;
			
			if (v[1].indexOf("#")>0) v[1]=v[1].substring(0,v[1].indexOf('#'));
			config[v[0]]=v[1];
		});
		
		callback(null,config);
	});
}

exports.walk = function(dir, done) {
  var results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + '/' + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          exports.walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};
