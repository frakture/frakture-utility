var async=require("async"),
optimist=require("optimist"),
	prompt=require("prompt"),
	js=require("./js.js"),
	util=require("util");
	
/*
	On production, don't use log coloring, because it appends content to console.out, which is used for input to other scripts
*/

if (process.env.LOG_COLOR){
	console=require("tracer").colorConsole();
}
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

exports.callback=function(err,d){
        require("./main.js").mongo.getDB().close();
        if (err){console.error("**** ERROR *****"); console.error(err);}
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

        options=options ||{};
        
        prompt.override = optimist.argv;
        
        var db=null;
        
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
                        return callback(null,{});
                }
                
                function cleanBot(bot){
                	 if (bot.auth){
							 bot.auth=JSON.parse(require("./main.js").crypt.decrypt(bot.auth));
							 console.log("Retrieved auth information for "+Object.keys(bot.auth));
					}
					
					bot.configuration=bot.configuration || {};
					bot.bot_id=bot._id.toString();
					
					
					delete bot._id;
					delete bot.label;
					delete bot.path;
					return bot;
                }

               
                if (optimist.argv.bot_id){
                	try{
						db.collection("bot").findOne({account_id:account_id,_id:utilities.mongo.getObjectID(optimist.argv.bot_id)},function(e,bot){
							if (e) return callback(e);
							if (!bot) return callback("Could not find bot "+optimist.argv.bot_id);
							return callback(null,cleanBot(bot));
						})
					}catch(e){
						return callback(e);
					}
		            return;
		        }
               
                var filter={};
                if (botFilter===true){
                	var path=(Bot.metadata||{}).bot_path;
                	if (!path) throw "Bot.metadata.bot_path is required for this particular method";
                	filter={path:new RegExp(path)}
                }else if (typeof botFilter=='object') filter=botFilter;

                filter.account_id=account_id.toString();
                console.log("Retrieving bots with "+js.serialize(filter));
                if (db==null) db=require("./main.js").mongo.getDB();
                db.collection("bot").find(filter).sort({_id:1}).toArray(function(err,bots){
	                	if (err) return callback(err);
                        if (bots.length==0) return callback("Could not find any bots with these conditions");
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
                                        console.log("Using bot "+bot._id);
                                        
                                       
                                        
                                        return callback(null,cleanBot(bot));
                                });
                });
        }
        
        prompt.start();
        
        function getAccounts(opts,callback){
                if (opts.accounts===false) return callback(null,[{name:"All",_id:""}]);
                
                 if (db==null) db=require("./main.js").mongo.getDB();
                 db.on("error",function(err){
                 	console.error(err.stack || err);
                 	process.exit();
                 });
                db.collection("account").find().sort({_id:1}).toArray(function(err,accounts){
                
		                if (optimist.argv.account_id){
		                	var ids=optimist.argv.account_id.split(",");
		                	 return callback(null,accounts.filter(function(d){return (ids.indexOf(d._id.toString())!=-1) }));
		                }
                
                        console.log(accounts.map(function(a,i){return i+". " +a.name+": "+a._id}).join("\r\n"));
        
                        prompt.get({
                                properties:{
                                        account_index:{
                                                description:"Enter account ids or indexes seperated by commas",
                                                required: true
                                          }
                                }
                        },function(err,result){
	                        	if (err) return callback(err);
                                if (result.account_index=='*') result.account_index=accounts.map(function(d,i){return i}).join(",");
                                var indexes=result.account_index.split(",");
                                var accountList=accounts.filter(function(d,i){return indexes.indexOf(""+i)>=0 || indexes.indexOf(d._id)>=0});
                                
                                callback(null,accountList);                        
                        });
                });
        }
                
                var methodOpts={type:'string',description:"Method",required:true,enum:methods.map(function(d){return d.name})};
                methodOpts.default=methods[methods.length-1].name;
                
                
                
                if (optimist.argv.method){
	                var targetMethod=methods.filter(function(m){return m.name==optimist.argv.method});
	                if (targetMethod && targetMethod[0] && targetMethod[0].metadata){
	                	if (targetMethod[0].metadata.accounts===false){
		                	options.accounts=false;
		                }
		                if (targetMethod[0].metadata.confirm===false){
			                options.confirm=false;
		                }
	                }
                }
                
                getAccounts(options,function(err,accountList){
                
						if (!optimist.argv.method) console.log("Available methods:"+methods.map(function(m){return m.name;}).join(","));                
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
                                        
                                        /* if there's a method specified, delete all non-required options with no command line values */
                                        var opts=method.metadata.options||{};
                                        if (optimist.argv.method){
                                        	for (i in opts){
                                        		if (!opts[i].required && !optimist.argv[i]) delete opts[i];
                                        	}
                                        }
                                        method.metadata.options=method.metadata.options || {};
                                        
                                        //Type is NOT respected on the command line -- 'prompt' is too specific on boolean and dates
                                        for (i in method.metadata.options){
                                        	delete method.metadata.options[i].type;
                                        }
                                        
                                        prompt.get({
                                                properties:method.metadata.options
                                                },function(err,options){
                                                        if (err) throw err;
                                                        
                                                        for (i in optimist.argv){
                                                        	if (optimist.argv[i] && !options[i]) options[i]=optimist.argv[i];
                                                        }
                                                        
                                                        //handle boolean values truthiness
                                                        for (i in options){
                                                        	if (options[i]=='false') options[i]=false;
                                                        }
                                                        if (accountList.length==0) throw "No accounts match";
                                                        
                                                        async.eachSeries(accountList,function(account,accountCallback){
                                                        if (account.name!='All') console.log("Applying to "+account.name);
                                                        
                                                        getBotConfig(method.metadata.bot,account._id,function(err,botConfig){
                                                                if (err) throw err;
                                                                var bot=new Bot();
                                                                for (i in botConfig){
                                                                        bot[i]=botConfig[i];
                                                                }
                                                                
                                                                bot.log=console.log;
                                                                bot.progress=function(p){console.log(p);}
                                                                bot.warn=bot.progress;
                                                                
                                                                bot.account_id=account._id.toString();
                                                                //Don't log anything -- may be part of a script that requires an output!
                                                        		//console.error("Running "+methodName);
                                                        		
                                                        		//Remove account_id, and other things that are possible on the command line
                                                        		delete options.account_id;
                                                        		delete options.method;
                                                        		delete options._;
                                                        		delete options["$0"];
                                                        		
                                                        		function run(){
																	bot[methodName](options,function(err,d,progress,update){
																			if (err) return accountCallback(err);
																			if (progress){
																				console.error("*** WARNING! PROGRESS CALLBACKS ARE DEPRECATED *** ");
																				return console.log(progress);
																			}
																			if (update){
																				var timeout=5000;
																				if (update.start_after_timestamp){
																					timeout=(new Date(update.start_after_timestamp).getTime()-new Date().getTime())
																				}
																				if (update.options) options=update.options;
																				if (!optimist.argv.method) console.log("Job Status was updated, retrying in  "+~~(timeout/1000)+" seconds");
																				setTimeout(run,timeout);
																				return;
																			}
																			
																			if (typeof d=='object') console.log(util.inspect(d,{depth:null}));
																			else console.log(d);
																			
																			if (!optimist.argv.method){
																				//If method is specified, don't write anything -- for scripts
																				console.error("*** Job complete ***");
																			}
																			accountCallback();
																	});
                                                                }
                                                                run();
                                                        });
                                                },function(err){
                                                        require("./main.js").mongo.getDB().close();
                                                        
                                                        if (err){
                                                        	 console.error("**** There was an error during command line operation *****");
                                                        	 if (err.stack) console.error(err.stack);
                                                        	 else console.error(util.inspect(err));
                                                        	 process.exit(1);
                                                        }
                                                        //use process exit, because there might be setTimeout and polling calls
                                                        process.exit();
                                                });
                                        });
                                });
                });
        });
}