/*
Standard library for handling encryption
*/
var crypto = require('crypto');

var algorithm = 'aes256'; // or any other algorithm supported by OpenSSL

exports.encrypt=function(text){
	if (!process.env.CRYPT_KEY) throw "A CRYPT_KEY environment variable is required";
	if (typeof text!='string') throw "Only strings may be encrypted.  Try JSON.stringify";
	try{
		var cipher = crypto.createCipher(algorithm, process.env.CRYPT_KEY);  
		var encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
		return encrypted;
	}catch(e){
		throw "Error encrypting";
	}
}

exports.decrypt=function(encrypted){
	if (!process.env.CRYPT_KEY) throw "A CRYPT_KEY environment variable is required";
	var decrypted;
	try{
		var decipher = crypto.createDecipher(algorithm, process.env.CRYPT_KEY);
		decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
	}catch(e){
		throw "Invalid encrypted string";
	}
	return decrypted;
}

exports.generateSalt=function(len) {
  var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ',
      setLen = set.length,
      salt = '';
  for (var i = 0; i < len; i++) {
    var p = Math.floor(Math.random() * setLen);
    salt += set[p];
  }
  return salt;
}

exports.md5=function(source) {
  return crypto.createHash('md5').update(source).digest('hex');
}

