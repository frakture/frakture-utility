/*
        generate start and end date array for perfectly inclusive UTC queries
        options{
                start:Start Date
                end: End Date, inclusive,
                split:day || week || fortnight || month<default month>
        }
        returns array of start and end Dates, such as:
        
        [ { start: Tue Jun 04 2013 19:00:00 GMT-0500 (CDT),
    end: Sun Jun 30 2013 18:59:59 GMT-0500 (CDT) },
  { start: Sun Jun 30 2013 19:00:00 GMT-0500 (CDT),
    end: Wed Jul 31 2013 18:59:59 GMT-0500 (CDT) },
  { start: Wed Jul 31 2013 19:00:00 GMT-0500 (CDT),
    end: Sun Aug 04 2013 19:00:00 GMT-0500 (CDT) } ]
*/

exports.generateInclusiveArray=function(options){
        var start=options.start;
        if (start=="Invalid Date") throw "Invalid start:"+options.start;
        var end;
        switch(options.split){
                case "day":
                case "week":
                case "fortnight":
                        end=new Date(Date.UTC(start.getFullYear(),start.getMonth(),start.getDate()+2)); break;
                case "month":
                default:
                end=new Date(Date.UTC(start.getFullYear(),start.getMonth()+1,1));
        }
        var final=new Date(options.end);
        var res=[];
        while (end<final){
                res.push({start:start,end:new Date(end.getTime()-1)});
                start=new Date(end.getTime());
                switch(options.split){
                        case "day":end.setUTCDate(end.getUTCDate()+1); break;
                        case "week":end.setUTCDate(end.getUTCDate()+7); break;
                        case "fortnight":end.setUTCDate(end.getUTCDate()+14); break;
                        case "month":
                        default:
                                end.setUTCMonth(end.getUTCMonth()+1); break;
                }
        }
        res.push({start:start,end:final});
        return res;
}

/*
	
	Return a Date object if it's a Date, or if it's an ISO 8601 date string, or if it matches 
	
*/

exports.dateRegex= /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;
exports.dateRegexLegacy= /^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4}$/;
exports.checkDate=function(d){
	if (!d) return d;
	if (d instanceof Date) return d;
	if (typeof d=='string'){
		//things like 8943, 694, 21124 are really not dates.  Let's just assume they're not.
		if (d.length<6) return d;
		if (d.match(exports.dateRegex) || d.match(exports.dateRegexLegacy)){
			var newDate=new Date(d);
			if (newDate=="Invalid Date") return d;
			return newDate;
		}
	}
	return d;
}






//Samples
/*
console.log(exports.generateTimeSplits({
        start:new Date("2013-06-05"),
        end:new Date("2013-08-05")
}));
console.log(exports.generateTimeSplits({
        start:new Date("2013-06-05"),
        end:new Date("2013-08-05"),
        split:"month"
}));

console.log(exports.generateTimeSplits({
        start:new Date("2013-06-05"),
        end:new Date("2013-08-05"),
        split:"week"
}));
console.log(exports.generateTimeSplits({
        start:new Date("2013-06-05"),
        end:new Date("2013-08-05"),
        split:"day"
}));
*/