import mysql from 'mysql2/promise'

const { DB_HOST, DB_USER, DB_PASS, DB_NAME, } = process.env

const db = mysql.createPool({
  host: DB_HOST,
  user: DB_USER,
  password: DB_PASS,
  database: DB_NAME,
  waitforConnections: true,
  connectLimit: 5,
  queueLimit: 0,
})

export default db