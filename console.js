var async=require("async"),
optimist=require("optimist"),
	prompt=require("prompt");
/*
        Create a bot that uses a local account_id,and logs to the console
*/
exports.getBot=function(path){
        if (!process.env.FRAKTURE_ACCOUNT_ID) throw "FRAKTURE_ACCOUNT_ID environment variable is required";

        var bot=new (module.parent.parent.require(path))();
        bot.account_id=process.env.FRAKTURE_ACCOUNT_ID;
        bot.log=console.log;
        return bot;
}


/*
        Generic callback function for testing
*/

exports.callback=function(err,d,progress){
        require("./main.js").mongo.getDB().close();
        if (err){console.error("**** ERROR *****"); console.error(err);}
        if (progress){return console.log(progress);}
        console.log(JSON.stringify(d,null,4));
        console.log("\nFinished.");
}

/*
        Sample call
        if (require.main === module){
                utilities.console.makeRunnable(Bot);
        }
        
        utilities.console.makeRunnable(Bot,{accounts:false,confirm:false});
        
        Also allows for command line options
*/
exports.makeRunnable=function(Bot,options){
        if (!process.env.FRAKTURE_ACCOUNT_ID) throw "FRAKTURE_ACCOUNT_ID environment variable is required";
        options=options ||{};
        
        prompt.override = optimist.argv;
        
        var db=require("./main.js").mongo.getDB();
        
        prompt.start();
        var methods=[];
        
        for (i in Bot.prototype){
                if (typeof Bot.prototype[i]=='function' && Bot.prototype[i].metadata){
                        methods.push({name:i,metadata:Bot.prototype[i].metadata});
                }
        };
        if (methods.length==0){
                console.error("There are no available method for this bot, with prototype items:"+Object.keys(Bot.prototype));
                return;
        }
        
        
        function confirm(opts,callback){
                if (options.confirm==false) return callback(null,{confirm:'y'});
                        prompt.get({properties:{confirm:{description:opts.label,required:true}}},callback);
        }
        
        function getBotConfig(botFilter,account_id,callback){
                //Check if we need some bot data for permissions, etc
                if (!botFilter){
                        console.log("No specific bot instance necessary, continuing");
                        return callback(null,{});
                }

                var filter={};
                if (typeof botFilter=='object') filter=botFilter;

                filter.account_id=account_id.toString();
                console.log("Retrieving bots with "+JSON.stringify(filter));
                
                db.collection("bot").find(filter).sort({_id:1}).toArray(function(err,bots){
                        if (bots.length==0) return "Could not find bots with these conditions";
                        console.log(bots.map(function(a,i){return "Bot "+i+". " +a.label+": "+a.path+" ("+a._id+")"}).join("\r\n"));
                        prompt.get({
                                properties:{
                                        bot_index:{
                                                description:"Enter bot index",
                                                pattern: /^[0-9]+$/,
                                                message: 'bot index must be a number',
                                                required: true,
                                                default:0
                                          }
                                }
                                },function(err,result){
                                        if (err) return callback(err);
                                        var bot=bots[parseInt(result.bot_index)];
                                        if (!bot) return callback("Could not find bot "+result.bot_index);
                                        
                                        if (bot.auth){
                                                 bot.auth=JSON.parse(require("./main.js").crypt.decrypt(bot.auth));
                                                 console.log("Retrieved auth information for "+Object.keys(bot.auth));
                                        }
                                        
                                        bot.configuration=bot.configuration || {};
                                        bot.bot_id=bot._id.toString();
                                        
                                        
                                        delete bot._id;
                                        delete bot.label;
                                        delete bot.path;
                                        
                                        return callback(null,bot);
                                });
                });
        }
        
        prompt.start();
        
        function getAccounts(opts,callback){
                if (opts.accounts===false) return callback(null,[{name:"All",_id:""}]);
                
                db.collection("account").find().sort({_id:1}).toArray(function(err,accounts){
                
                        console.log(accounts.map(function(a,i){return i+". " +a.name+": "+a._id}).join("\r\n"));
        
                        prompt.get({
                                properties:{
                                        account_index:{
                                                description:"Enter account indexes seperated by commas",
                                                pattern: /^[0-9,\*]+$/,
                                                message: 'account index must be a set of numbers',
                                                required: true
                                          }
                                }
                        },function(err,result){
                                if (result.account_index=='*') result.account_index=accounts.map(function(d,i){return i}).join(",");
                                var indexes=result.account_index.split(",").map(function(d){return Number(d)});
                                var accountList=accounts.filter(function(d,i){return indexes.indexOf(i)>=0});
                                
                                callback(null,accountList);                        
                        });
                });
        }
                
                var methodOpts={type:'string',description:"Method",required:true,enum:methods.map(function(d){return d.name})};
                methodOpts.default=methods[methods.length-1].name;
                
                
                
                getAccounts(options,function(err,accountList){
                
						console.log("Available methods:"+methods.map(function(m){return m.name;}).join(","));                
                        prompt.get({
                        properties:{
                                method:methodOpts
                                }
                        },function(err,result){
                        
                                if (err) throw(err);
                        
                                var methodName=result.method;
                                
                                var method=methods.filter(function(m){return m.name==methodName});
                                if (method.length==0) throw "Could not find method "+method;
                                method=method[0];
                                
                                var conf={label:"Apply "+methodName+" to "+accountList.map(function(a){return a.name}).join(",")+"? (y/n)"};
                                
                                confirm(conf,function(err,confirmVals){
                                        if (err) throw err;
                                        if (!confirmVals.confirm || confirmVals.confirm.toLowerCase().indexOf('y')!=0) throw "You must confirm with 'y' or 'yes'";

                                        prompt.get({
                                                properties:method.metadata.options
                                                },function(err,options){
                                                        if (err) return callback(err);
                                                        async.eachSeries(accountList,function(account,accountCallback){
                                                        console.log("Applying to "+account.name);
                                                        
                                                        getBotConfig(method.metadata.bot,account._id,function(err,botConfig){
                                                                if (err) throw err;
                                                                var bot=new Bot();
                                                                for (i in botConfig){
                                                                        bot[i]=botConfig[i];
                                                                }
                                                                
                                                                bot.log=console.log;
                                                                bot.account_id=account._id.toString();
                                                        
                                                                bot[methodName](options,function(err,d,progress){
                                                                                if (err) return accountCallback(err);
                                                                                if (progress){return console.log(progress);}
                                                                                console.log(JSON.stringify(d,null,4));
                                                                                accountCallback();
                                                                });
                                                        });
                                                },function(err){
                                                		
                                                        require("./main.js").mongo.getDB().close();
                                                        if (err){
                                                        	 console.error("**** There was an error during command line operation *****");
                                                        	 console.error(err);
                                                        }
                                                        console.log("\nFinished.");
                                                });
                                        });
                                });
                });
        });
}