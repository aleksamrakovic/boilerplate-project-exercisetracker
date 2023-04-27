const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

app.use(cors());
app.use(express.static("public"));

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

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

// get users
app.get("/api/users", (req, res) => {
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
});

app.post("/api/users", (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: "Username is required fields",
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

        db.get(`SELECT * FROM users WHERE id = ?`, this.lastID, (err, row) => {
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
        });
      }
    );
  } catch (error) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: "Bad Request",
    });
  }
});

app.post("/api/users/:id/exercises", (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { description, duration, date } = req.body;

    // Validate request body
    if (!description || !duration) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: "Description and duration are required fields",
      });
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

            console.log(row);

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
  } catch (error) {
    return res.status(400).json({
      status: 400,
      success: false,
      error: "Bad Request",
    });
  }
});

app.get("/api/users/:id/logs", (req, res) => {
  const userId = parseInt(req.params.id);

  // QUERIES
  const from = req.query.from;
  const to = req.query.to;
  const limit = req.query.limit || 10;

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
    sql += ` AND date BETWEEN ? AND ?`;
    params.push(from, to);
  } else if (from) {
    sql += ` AND date >= ?`;
    params.push(from);
  } else if (to) {
    sql += ` AND date <= ?`;
    params.push(to);
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
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
