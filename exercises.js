const { db } = require("./db");
const moment = require("moment");

const postExercise = (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { description, date } = req.body;
    const duration = parseInt(req.body.duration);

    // Validate user id
    if (!userId || !description || !duration) {
      return res.status(400).json({
        status: 400,
        success: false,
        error: "Missing required params",
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

      // Check if duration is number and not negative
      if (isNaN(duration) || duration < 0) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: "Duration must be a number and cannot be negative",
        });
      }

      // validate the date format
      if (date && !moment(date, "YYYY-MM-DD", true).isValid()) {
        return res.status(400).json({
          status: 400,
          success: false,
          error: "Invalid date format",
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

    // add order by date in descending order
    sql += ` ORDER BY date ASC`;
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

module.exports = {
  postExercise,
  getLogs,
};
