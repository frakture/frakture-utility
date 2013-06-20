/*
Standard library for handling encryption
*/
var crypto = require('crypto');

var algorithm = 'aes256'; // or any other algorithm supported by OpenSSL
var key = process.env.CRYPT_KEY;
if (!key) throw "A CRYPT_KEY environment variable is required";


//648a6633a87146033fc8dfda4a777f418829eae6c672cb7afbc5fbc0c328483d761063b7077855023aba8a7e219ab0fb68ddc035c775400b3940d49894228e626e8f3fb694f28365c77447fc6f5f7aae2038c7f20511ab93d6751332058b509cb942d0888e40f20caa740dd040e99d44
exports.encrypt=function(text){
	if (typeof text!='string') throw "Only strings may be encrypted.  Try JSON.stringify";
	try{
		var cipher = crypto.createCipher(algorithm, key);  
		var encrypted = cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
		return encrypted;
	}catch(e){
		throw "Error encrypting";
	}
}

exports.decrypt=function(encrypted){
	var decrypted;
	try{
		var decipher = crypto.createDecipher(algorithm, key);
		decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
	}catch(e){
		throw "Invalid encrypted string";
	}
	return decrypted;
}