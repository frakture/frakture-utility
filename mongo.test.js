var mongo_util=require("./mongo_util.js");

var a={
	a:1,
	af:"asdfa",
	b:{c:{$oid:"5151af6e82f58b0000000002"}},
	d:{e:[{$oid:"5151af6e82f58b0000000002"}]}
};
console.log(JSON.stringify(a,null,4));
console.log(a);
