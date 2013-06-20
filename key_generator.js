var crypto=require("crypto");

/*
	generate a unique hexadecimal key
*/
exports.generateKey=function(opts){
	opts=opts || {};
	var method=opts.method || "sha1";
	var encoding=opts.encoding || "hex";
	var bytes=opts.bytes || 2048;
	return crypto.createHash(method).update(crypto.randomBytes(bytes)).digest(encoding);
}
