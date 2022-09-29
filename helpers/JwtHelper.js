const jwt = require('jsonwebtoken');
const fs = require('fs');

module.exports = {
    verify: function(request) {
        const token = request.headers['user-jwt'];
        const cert = fs.readFileSync('secrets/public.key');
        return jwt.verify(token, cert, { algorithms: ['RS256'] });
    },

    sign: function(data) {

        let privateKey = fs.readFileSync('secrets/private.key');
        const token = jwt.sign(data, privateKey, { algorithm: 'RS256'});
    
        // TODO: This is just a hard coded value for now, later this will be replaced with login flow
        // TODO: Or Might come from any other service(Identity)
        return token;
    }
}