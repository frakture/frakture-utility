var js=require("./js.js");
var func='function(output){return new Array(57).fill(0).map((d,i)=>{return {filename:"/tmp/whyy/interactions_2018_05_04."+i+".txt"}});}';
js.safeFunctionEval(func,{},(e,o)=>{
	if (e) throw e;
	console.log(o);
});