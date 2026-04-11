const jwt = require("jsonwebtoken");

function JWTMiddleware({ jwtSecret = process.env.JWT_SECRET, logger = console } = {}) {
    return function jwtMiddleware(req, res, next) {
        // JWT disabled: attach mock user and skip validation
        req.user = {
            user_id: "admin",
            role: "ADMIN",
        };
        return next();
    };
}

module.exports = JWTMiddleware;
