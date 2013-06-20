var assert = require('assert');
var validate= require('../validation.js');

var validator=[
 	{name:'a',type:'number'},
	{name:'b',type:'date'},
	{name:'c',type:'date'},
	{name:'d',type:'date'},
	"e",
	{name:'f',type:'string',match:/[a-z]+/},
 ];
 
 var now=new Date(new Date().toString());

var res=validate.validateObject({a:'123',b:now,c:now.toString(),d:now.getTime(),e:"exists", f:"goodtext"},validator);
assert.ok(res.a===123);
assert.ok(res.b==now);
assert.ok(res.c.getTime()==now.getTime());
assert.ok(res.d.getTime()==now.getTime());
assert.ok(res.e=='exists');
assert.ok(res.f=='goodtext');

//console.log(exports.validateObject({a:'foo23',b:{},c:"bad date",d:"", e:"123bad123"},validator));
