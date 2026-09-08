const response = require("../utils/response.utils");

module.exports = (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    return response.error(res, 403, "Admin access required");
  }
  next();
};

