const sqlite = require("sqlite3").verbose();
let sql;

const db = new sqlite.Database("users.db", sqlite.OPEN_READWRITE, (err) => {
  // error with db
  if (err) {
    console.error("Error opening database " + err.message);
  } else {
    // check if the users table already exists
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
      (err, row) => {
        if (err) {
          console.error("Error checking for table existence: " + err.message);
        } else if (!row) {
          // create a db
          sql = `CREATE TABLE users(ID INTEGER PRIMARY KEY, username TEXT)`;
          db.run(sql);
        }
      }
    );

    // check if the exercises table already exists
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='exercises'",
      (err, row) => {
        if (err) {
          console.error("Error checking for table existence: " + err.message);
        } else if (!row) {
          // create a db
          sql = `CREATE TABLE exercises (ID INTEGER PRIMARY KEY, userId INTEGER, description TEXT, duration INTEGER, date TEXT)`;
          db.run(sql);
        }
      }
    );
  }
});

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

const postExercise = (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { description, duration, date } = req.body;

    // Validate user id
    if (!userId) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: "User id is required param",
      });
    }

    // Check if user exists
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, row) => {
      if (err) {
        return res.status(500).json({
          status: 500,
          success: false,
          error: "Internal Server Error",
        });
      }
      if (!row) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: "User does not exist",
        });
      }

      // Validate request body
      if (!description || !duration) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: "Description and duration are required fields",
        });
      }

      // Check if duration is negative
      if (duration < 0) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: "Duration cannot be negative",
        });
      }

      // Check if date is provided and in the correct format (yyyy-mm-dd)
      if (date) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
          return res.status(400).json({
            status: 400,
            success: false,
            error: "Invalid date format. Date should be in yyyy-mm-dd format",
          });
        }
      }

      // Default to current date if not provided
      const exerciseDate = date ? new Date(date) : new Date();

      db.run(
        "INSERT INTO exercises(userId, description, duration, date) VALUES (?, ?, ?, ?)",
        [userId, description, duration, exerciseDate.toISOString()],
        function (err) {
          if (err) {
            return res.status(500).json({
              status: 500,
              success: false,
              error: "Internal Server Error",
            });
          }

          // Get the newly inserted exercise record
          db.get(
            `SELECT * FROM exercises WHERE id = ?`,
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
                data: {
                  exerciseId: row.ID,
                  userId: row.userId,
                  description: row.description,
                  duration: row.duration,
                  date: row.date,
                },
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

const getLogs = (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    // QUERIES
    const from = req.query.from;
    const to = req.query.to;
    const limit = req.query.limit || 100;

    if (!userId) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: "Invalid user ID parameter",
      });
    }

    let sql = `SELECT * FROM exercises WHERE userId = ?`;
    const params = [userId];

    // add optional date range and limit to the SQL query
    if (from && to) {
      // add one day to the "to" date to include logs up to and including that date
      const toDatePlusOneDay = new Date(
        new Date(to).getTime() + 24 * 60 * 60 * 1000
      );

      sql += ` AND date BETWEEN ? AND ?`;
      params.push(from, toDatePlusOneDay.toISOString());
    } else if (from) {
      sql += ` AND date >= ?`;
      params.push(from);
    } else if (to) {
      const toDatePlusOneDay = new Date(
        new Date(to).getTime() + 24 * 60 * 60 * 1000
      );

      sql += ` AND date <= ?`;
      params.push(toDatePlusOneDay.toISOString());
    }

    sql += ` LIMIT ?`;
    params.push(limit);

    db.all(sql, params, (err, rows) => {
      if (err) {
        return res.status(500).json({
          status: 500,
          success: false,
          error: "Internal Server Error",
        });
      }

      db.get("SELECT * FROM users WHERE id = ?", userId, (err, user) => {
        if (err) {
          return res.status(500).json({
            status: 500,
            success: false,
            error: "Internal Server Error",
          });
        }

        console.log(user, userId);

        if (!user) {
          return res.status(404).json({
            status: 404,
            success: false,
            error: "User not found",
          });
        }

        const logs = rows.map((log) => {
          return {
            id: log.ID,
            description: log.description,
            duration: log.duration,
            date: log.date,
          };
        });

        const responseData = {
          id: user.id,
          username: user.username,
          count: logs.length,
          log: logs,
        };

        return res.status(200).json({
          status: 200,
          success: true,
          data: responseData,
        });
      });
    });
  } catch (error) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: "Bad Request",
    });
  }
};

module.exports = { getUsers, postUser, postExercise, getLogs };
