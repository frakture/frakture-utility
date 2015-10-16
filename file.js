var fs=require("fs"),
sf=require("slice-file");


/*
To find all crappy characters in a filename, and replace them

LC_ALL=C find . -name '*[! -~]*' | while read file; do N=$(echo $file | tr -cd '\11\12\40-\176'); echo mv "$file" "$N"; done

LC_ALL=C find . -name '*[! -~]*' | while read file; do N=$(echo $file | tr -cd '\11\12\40-\176'); mv "$file" "$N"; done
*/



exports.mkdirp=require("mkdirp");

exports.validateFilename=function(s){
	if (s 
		&& s.match(/^[.a-zA-Z\/_0-9:()- ]+$/)
		&& s.indexOf("..")<0
		){
		return true;
	}
	
	throw "Invalid filename:'"+s+"'";
}

/*
	takes a filename, and optional start & end lines
*/
exports.slice=function(options,callback){
	var bot=this;
	if (!options.filename) return callback("filename is required");
	var s=parseInt(options.start || 0);
	var e=options.end; if (e===undefined || e==="") e=10;
	e=parseInt(e);
	var xs=sf(options.filename);
	function cb(e,l){
		if (e) return callback(e);
		xs.close();
		return callback(null,l.map(function(d){return d.toString()}))
	}
	if (s<0){
		xs.slice(s,cb);
	}else{
		xs.slice(s,e,cb);
	}
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
