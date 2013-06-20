/*
	 Retrieve information based on the person's IP address
*/
var mysql_util=require("./mysql.js");

exports.getIpInfo=function(req,callback){
		mysql_util.getConnection(function(err, conn) {

			var ip=exports.getRealClientIp(req);
			//localhost override for testing
			if (ip=='127.0.0.1' && req.query.ip) ip=req.query.ip;

			if (!ip){
				callback("Invalid ip data",null);
				return;
			}
			var parts=ip.split(".");
			var ipNum=(16777216*Number(parts[0]))+
			  			  (65536*Number(parts[1]))+
			  			  (256*Number(parts[2]))+
			  			  (Number(parts[3]));
			
			var results={ip:ip,ip_num:ipNum};
			var q="SELECT * FROM ip_block a left join ip_location b on (a.ip_location_id=b.ip_location_id) WHERE start_ip_num<=? and start_ip_num>?-1024 and end_ip_num>=? order by start_ip_num desc";
			conn.query(q, [ipNum,ipNum,ipNum], function(err,data){
				var d=(data||[])[0];
				mysql_util.release(conn);
				callback(err,d);
			});
		});
}

/*
	getRealClientIp Address from a request object, even if forwarded through a proxy
*/
exports.getRealClientIp=function(req) {
  var ipAddress;
  // Amazon EC2 / Heroku workaround to get real client IP
  //NOT req.header -- do not use that
  var forwardedIpsStr = req.headers['x-forwarded-for']; 

  if (forwardedIpsStr) {
	// 'x-forwarded-for' header may return multiple IP addresses in
	// the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
	// the first one
	var forwardedIps = forwardedIpsStr.split(',');
	ipAddress = forwardedIps[0];
  }
  
  if (!ipAddress) {
	// Ensure getting client IP address still works in
	// development environment
	ipAddress = req.connection.remoteAddress;
  }
  return ipAddress;
};
