import express from 'express'
import upload from './upload-image.js'
import session, { Store } from 'express-session'
import db from './route/mysql-connect.js'
import exampleRouter from './route/memberFromSQL.js'
import bcrypt from 'bcryptjs'
import mySQLsession from 'express-mysql-session'
import cors from 'cors'

let app = express()
let sqlStore = mySQLsession(session)
let sessionStore = new sqlStore({}, db)

app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// cors
const corsOptions = {
  credentials: true,
  origin: (origin, callback) => {
    callback(null, true)
  }
}
app.use(cors(corsOptions));

// Session
app.use(session({
  saveUninitialized: false,
  resave: false,
  secret: "aj;flkej;alkfje",
  session: sessionStore,
}))

// Session測試
app.get('/try-sess', (req, res) => {
  req.session.number = req.session.number || 0,
    req.session.number++
  res.json(req.session);
})

// 伺服器連線
app.get('/try-connect', async (req, res) => {
  const sql = "SELECT * FROM live_answer_tab LIMIT 3"
  const [rows] = await db.query(sql)
  res.json(rows)
})

// 首頁文字
app.use((req, res, next) => {
  res.locals.title = "作品"
  res.locals.pageName = ""
  res.locals.session = req.session
  res.locals.originalUrl = req.originalUrl
  next()
})

app.get('/', (req, res) => {
  res.locals.title = res.locals.title + "- 首頁";
  res.locals.pageName = "homePage";
  res.render('homePage', { content: "航海吧，水手" })
})

// 登入頁面
app.get('/login', (req, res) => {
  res.locals.title = res.locals.title + "- 登入";
  res.locals.pageName = "login";

  if (req.session.admin) {
    return res.redirect("/")
  }

  res.render('login')
})

// 處理登入資料
app.post('/login', upload.none(), async (req, res) => {

  let { account, password } = req.body || {}
  let output = {
    success: false,
    postData: req.body,
    error: {},
    code: 0,
  }

  if (!account || !password) {
    output.error = "請輸入帳號密碼";
    output.code = 401;
    return res.json(output)
  }

  account = account.trim()
  password = password.trim()

  const sql = `SELECT * FROM mb_user WHERE email=?`
  let [rows] = await db.query(sql, [account])

  if (!rows.length) {
    output.error = "此帳號不存在"
    output.code = 402
    return res.json(output)
  }

  let result = await bcrypt.compare(password, rows[0].password_hash)

  if (result) {
    output.success = true;
    req.session.admin = {
      id: rows[0].user_id,
      email: account,
      name: rows[0].name
    }
  } else {
    output.error = "帳號或密碼錯誤"
    output.code = 402
  }

  output.result = result

  res.json(output)
})

// 登出頁面
app.get('/logout', (req, res) => {
  if (req.session?.admin) {
    delete req.session.admin
  }

  if (req.query.u) {
    res.redirect(req.query.u)
  } else {
    res.redirect('/')
  }
})

// 單圖上傳
app.post('/try-upload', upload.single('image'), (req, res) => {
  res.json({
    file: req.file,
    body: req.body,
  })
})

// 多圖上傳
app.post('/try-uploads', upload.array('images', 3), (req, res) => {
  res.json(
    req.files,
  )
})

// MySQL連線
app.use('/member_content', exampleRouter)

// 靜態內容
app.use(express.static('html'))

// 錯誤訊息
app.use((req, res) => {
  res.type('text/html')
  res.status(404)
  res.send(`you have the wrong access`)
})

// 使用哪個伺服器
let port = process.env.WEB_PORT || 3002;

app.listen(port, () => {
  console.log(`you have listent to a ${port}`);
})