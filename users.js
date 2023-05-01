const { db } = require("./db");

const getUsers = (req, res) => {
  db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
      return res.status(500).json({
        status: 500,
        success: false,
        error: "Internal Server Error",
      });
    }

    if (!rows || rows.length < 1) {
      return res.status(404).json({
        status: 404,
        success: false,
        error: "No users",
      });
    }

    return res.status(200).json({
      status: 200,
      success: true,
      data: rows,
    });
  });
};

const postUser = (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Username is required",
      });
    }

    // check if user exists
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
      if (err) {
        return res.status(400).json({
          status: 500,
          success: false,
          error: "Something went wrong",
        });
      }

      if (row) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: "User with that username already exists.",
        });
      }

      db.run(
        "INSERT INTO users(username) VALUES (?)",
        [username],
        function (err) {
          if (err) {
            return res.status(500).json({
              status: 500,
              success: false,
              error: "Internal Server Error",
            });
          }

          db.get(
            `SELECT * FROM users WHERE id = ?`,
            this.lastID,
            (err, row) => {
              if (err) {
                return res.status(500).json({
                  status: 500,
                  success: false,
                  error: "Internal Server Error",
                });
              }

              return res.status(200).json({
                status: 200,
                success: true,
                data: row,
              });
            }
          );
        }
      );
    });
  } catch (error) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: "Bad Request",
    });
  }
};

module.exports = {
  getUsers,
  postUser,
};
