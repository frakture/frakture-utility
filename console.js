var async=require("async"),
	optimist=require("optimist"),
	prompt=require("prompt"),
	js=require("./js.js"),
	util=require("util"),
	mongo=require("./mongo.js"),
	progress=require("debug")("progress"),
	debug=require("debug")("console"),
	fs=require("fs");
	
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
        bot.log=console.error;
        return bot;
}


/*
        Generic callback function for testing
*/

exports.callback=function(err,d){
        mongo.getDB().close();
        if (err){console.error("**** ERROR *****"); console.error(err);}
        console.log(JSON.stringify(d,null,4));
        console.log("\nFinished.");
}

/*
        Sample call
        if (require.main === module){
                utilities.console.makeRunnable(Bot);
        }
        
        utilities.console.makeRunnable(Bot,{accounts:false});
        
        Also allows for command line options
*/


exports.makeRunnable=function(Bot,options){

        options=options ||{};
        
        var stdInOptions={};
  
        
        function getStdIn(cb){
        	
        	//ttys used /dev/tty, which is NOT available when running a cron job, thus ttys does NOT work
        	//We must do EITHER TTY mode, or inline mode and throw errors
        	
        	if (process.stdin.isTTY){
        		 return cb();
        	}
			
        	process.stdin.resume();
			//process.stdin.setEncoding('utf8');
			var toParse="";
			process.stdin.on('data', function(data) {
				toParse+=data;
			});
	
			process.stdin.on('end', function() {
				if (toParse){
					require("./js.js").safeEval(toParse,function(e,d){
						if (e) throw e;
						stdInOptions=d;
					});
					return cb();
				}else{
					return cb();
				}
			});
        }
        
        getStdIn(function(e){
        	if (e) throw e;
        
			prompt.override = optimist.argv;
			//unhyphenated stuff can show up 
			if (!optimist.argv.method && optimist.argv._.length==1){
				prompt.override.method=optimist.argv._[0];
			}
			
			
			
			for (i in stdInOptions){
				//Std in can be trumped by command line
				if (!prompt.override[i]) prompt.override[i]=stdInOptions[i];
			}
			
		
			var stdin=process.stdin;
			var stdout=process.stdout;
			
			if (stdin.isTTY){
				prompt.start({stdin:stdin,stdout:stdout});
			}
			
			var db=null;
			function getDB(cb){
				if (db!=null) return cb();
				if (!process.env.MONGO_URI) return cb();
				
				require("./main.js").mongo.init(function(e,d){
					if (e){
						 console.error(e.stack||e);
						 process.exit(-2);
					}
					db=d;
					 db.on("error",function(err){
						console.error(err.stack || err);
						console.error("Exiting from Mongo error");
						process.exit(-2);
					 });
					 return cb();
				});
			}
		
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
		
		
			function log(){
				if (!optimist.argv.method) console.error.apply(this,arguments);
			}
		
			function getBotConfig(botFilter,account_id,callback){
					//Check if we need some bot data for permissions, etc
					if (!botFilter){
							return callback(null,{});
					}
				
					function cleanBot(bot){
						 if (bot.auth){
								 bot.auth=JSON.parse(require("./main.js").crypt.decrypt(bot.auth));
								 log("Retrieved auth information for "+Object.keys(bot.auth));
						}
					
						bot.configuration=bot.configuration || {};
						bot.bot_id=bot._id.toString();
					
					
						delete bot._id;
						delete bot.label;
						delete bot.path;
						return bot;
					}

			   
					if (prompt.override.bot_id){
						try{
							db.collection("bot").findOne({account_id:account_id,_id:mongo.getObjectID(prompt.override.bot_id)},function(e,bot){
								if (e) return callback(e);
								if (!bot) return callback("Could not find bot "+prompt.override.bot_id);
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
					log("Retrieving bots with "+js.serialize(filter));
					getDB(function(){
						db.collection("bot").find(filter).sort({_id:1}).toArray(function(err,bots){
								if (err) return callback(err);
								if (bots.length==0) return callback("Could not find any bots with these conditions:"+util.inspect(filter));
								if (bots.length==1){
									log("Using only matching bot:"+bots[0]._id);
									return callback(null,cleanBot(bots[0]))
								}else{
									console.log(bots.map(function(a,i){return "Bot "+i+". " +a.label+": "+a.path+" ("+a._id+")"}).join("\r\n"));
								}
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
											log("Using bot "+bot._id);
									
								   
									
											return callback(null,cleanBot(bot));
									});
						});
					});
			}
		
			
		
			function getAccounts(opts,callback){

					if (opts.accounts===false || !process.env.MONGO_URI) return callback(null,[{name:"All",_id:""}]);
					
					getDB(function(){

					db.collection("account").find().sort({_id:1}).toArray(function(err,accounts){
							if (prompt.override.account_id){
								var ids=prompt.override.account_id;
								if (Array.isArray(ids)) ids=ids.join(",");
								ids=ids.split(",").filter(Boolean);
								var a=accounts.filter(function(d){return (ids.indexOf(d._id.toString())!=-1) })
								return callback(null,a);
							}
							
							if (!stdin.isTTY) return callback("No organization specified, and not using TTY interface");
				
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
				});
			}
                
                getAccounts(options,function(err,accountList){
                	if (err) throw err;
                	
                	if (!stdin.isTTY && !prompt.override.method) throw("No method specified, and not using TTY interface");
                	
                	var metadata=Bot.metadata || {bot_path:"unknown",submodule:""};
                	log("Running "+metadata.bot_path+":"+metadata.submodule+" for: "+accountList.map(function(d){return d._id}).join());
                
                	
                	
					var methodOpts={type:'string',description:"Method",required:true};
					methodOpts.default=methods[methods.length-1].name;
				
					if (prompt.override.method){
						var targetMethod=methods.filter(function(m){return m.name.toLowerCase()==prompt.override.method.toLowerCase()});
						if (targetMethod && targetMethod[0] && targetMethod[0].metadata){
							if (targetMethod[0].metadata.accounts===false){
								options.accounts=false;
							}
						}
					}
                
						log("Available methods:"+methods.map(function(m){return m.name;}).join(","));
						
                        prompt.get({
                        properties:{
                                method:methodOpts
                                }
                        },function(err,result){
                        
                                if (err) throw(err);
                        
                                var methodName=result.method;
                                
                                var method=methods.filter(function(m){return m.name.toLowerCase()==methodName.toLowerCase()});
                                if (method.length==0) throw "Could not find method '"+methodName+"'";
                                
                                method=method[0];
                                methodName=method.name;
                                
                                        
                                        /* if there's a method specified, delete all non-required options with no command line values */
                                        var opts=method.metadata.options||{};
                                        if (prompt.override.method){
                                        	for (i in opts){
                                        		if (!opts[i].required && !prompt.override[i]) delete opts[i];
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
                                                        
                                                        
                                                        for (i in prompt.override){
                                                        	if (prompt.override[i] && !options[i]) options[i]=prompt.override[i];
                                                        }
                                                        
                                                        //handle boolean values truthiness
                                                        for (i in options){
                                                        	if (options[i]=='false') options[i]=false;
                                                        }
                                                        if (accountList.length==0) throw "No accounts match";
                                                        
                                                        async.eachSeries(accountList,function(account,accountCallback){
                                                        if (account.name!='All') log("Applying to "+account.name);
                                                        
	                                                        getBotConfig(method.metadata.bot,account._id,function(err,botConfig){
                                                                if (err) throw err;
                                                                var bot=new Bot();
                                                                for (i in botConfig){
                                                                        bot[i]=botConfig[i];
                                                                }
                                                                
                                                                bot.log=console.error;
                                                                bot.progress=function(){progress.apply(this,arguments);}
                                                                bot.warn=bot.progress;
                                                                
                                                                bot.account_id=account._id.toString();
                                                                //Don't log anything -- may be part of a script that requires an output!
                                                        		//console.error("Running "+methodName);
                                                        		
                                                        		//Remove account_id, and other things that are possible on the command line
                                                        		delete options.account_id;
                                                        		delete options._;
                                                        		delete options.method;
                                                        		delete options["$0"];
                                                        		
                                                        		bot.job={method:methodName};
                                                        		getDB(function(e){
                                                        			if (e) return callback(e);
																	function run(){
																		bot[methodName](options,function(err,d,update){
																				if (err) return accountCallback(err);
																				
																				if (update){
																					var timeout=5000;
																					if (update.start_after_timestamp){
																						timeout=(new Date(update.start_after_timestamp).getTime()-new Date().getTime())
																					}
																					if (update.options) options=update.options;
																					if (!prompt.override.method) console.error("Job Status was updated, retrying in  "+~~(timeout/1000)+" seconds");
																					setTimeout(run,timeout);
																					return;
																				}
																				
																				log("*** Job complete ***");
																			
																				if (typeof d=='object'){
																					console.log(JSON.stringify(d,null,4));
																				}else{
																					console.log(d);
																				}
																				
																				accountCallback();
																		});
																	}
																	run();
																});
                                                        });
                                                },function(err){
                                                
                                                		if (err){
                                                        	 console.error("**** There was an error during command line operation *****");
                                                        	 if (err.stack) console.error(err.stack);
                                                        	 else console.error(util.inspect(err));
                                                        }
                                                        
                                                		
                                                    	if (err){
                                                        	 process.exit(1);
                                                        }
                                                        //use process exit, because there might be setTimeout and polling calls
                                                        process.exit();
                                                        
                                                        if (db){
                                                			try{
		                                                    	db.close();
		                                                    }catch(e){
		                                                    }
	                                                    }

                                                });
                                        });
            	    });
        	});
        });
}