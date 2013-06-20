//Some utilities for request/response, etc
var mongo=require('mongoskin');

exports.validateObject=function(input,fieldArray){
	var res={};

	var errs=[];
	fieldArray.forEach(function(d){
		switch(typeof d){
			case 'string': if (!input[d]){ errs.push("You must specify a "+d);}else{res[d]=input[d];}
								break;
			case 'object': 
				if (!d.name){ errs.push("Invalid validateObject configuration -- name is a required parameter in "+JSON.stringify(d)); return;}
				var val=input[d.name];
				if (val==undefined){ errs.push("You must specify a '"+d.name+"'"); return;}
				if (d.match && d.type!='string_array'){
					if (!val.match(d.match)){ errs.push("Invalid '"+d.name+"'");return;}
				}
				
				switch(d.type){
					//Mongo objectId
					case 'objectid': try{
						res[d.name]=mongo.ObjectID.createFromHexString(val);
					}catch(e){
						errs.push("Invalid :"+d.name+", not a valid ObjectId");
					}
					break;
					
					case 'number': 
						if (isNaN(Number(val))){errs.push("Invalid "+d.name+": Not a Number");return;}else{res[d.name]=Number(val);}  break;
					
					case 'date': switch(typeof val){

						case 'object': if (val.getTime){ res[d.name]=val;}else{errs.push("Invalid '"+d.name+"': not a valid date");}
											break;
						case 'string':
						case 'number':
							 val=new Date(val); if (val=='Invalid Date'){errs.push("Invalid '"+d.name+"': not a valid date");}else{res[d.name]=val;} break;
					}
					break;
					
					case 'string_array':	
						val=val.split(d.delimiter || ",");
						if (d.match){
							for (i in val){
								var v=val[i];
								if (!v.match(d.match)){
									errs.push("Invalid '"+d.name+"': "+v);
								}
							}
						}
						res[d.name]=val;
					break;
					
					default:res[d.name]=val;
				}
			break;
		}
	});
	

	if (errs.length>0){
		throw errs;
	}else{
		return res;
	}
}


