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