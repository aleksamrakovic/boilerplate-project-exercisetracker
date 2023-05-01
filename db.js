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

module.exports = { db };
