import express from 'express'
import db from './mysql-connect.js'
import dayjs from 'dayjs'
import { z } from 'zod'

const router = express.Router()

// 白名單
router.use((req, res, next) => {
  // let whiteList = ["/", '/api']
  // let path = req.url.split('?')[0]
  // if (!whiteList.includes(path)) {
  //   if (!req.session.admin) {
  //     return res.redirect(`/login?u=${req.originalUrl}`)
  //   }
  // }
  next()
})

// getFullList函式開始
const getFullList = async (req) => {

  // 關鍵字優化
  let where = ' WHERE 1 ';
  let keyword = req.query.keyword || "";

  if (keyword) {
    let keywordEsc = db.escape('%' + keyword + '%')
    where += ` AND ( 
        \`name\` LIKE ${keywordEsc} 
        OR 
        \`email\` LIKE ${keywordEsc}
        ) `
  }

  // 時間搜尋優化-創建時間
  let timeFormat = "YYYY-MM-DD"
  let timeBegin = req.query.timeBegin || ""
  let timeEnd = req.query.timeEnd || ""

  if (dayjs(timeBegin, timeFormat, true).isValid()) {
    timeBegin = dayjs(timeBegin).format(timeFormat)
  } else {
    timeBegin = ""
  }

  if (timeBegin) {
    where += ` AND created_at >= '${timeBegin}'`
  }

  if (dayjs(timeEnd, timeFormat, true).isValid()) {
    timeEnd = dayjs(timeEnd).format(timeFormat)
  } else {
    timeEnd = ""
  }

  if (timeEnd) {
    where += ` AND created_at <= '${timeEnd}'`
  }

  // 時間搜尋優化-生日時間
  let bdBegin = req.query.bdBegin || ""
  let bdEnd = req.query.bdEnd || ""

  if (dayjs(bdBegin, timeFormat, true).isValid()) {
    bdBegin = dayjs(bdBegin).format(timeFormat)
  } else {
    bdBegin = ""
  }

  if (bdBegin) {
    where += ` AND birthday >= '${bdBegin}'`
  }

  if (dayjs(bdEnd, timeFormat, true).isValid()) {
    bdEnd = dayjs(bdEnd).format(timeFormat)
  } else {
    bdEnd = ""
  }

  if (bdEnd) {
    where += ` AND birthday <= '${bdEnd}'`
  }

  // 頁數優化
  const sql = `SELECT COUNT(1) mbList FROM mb_user ${where}`
  const [[{ mbList }]] = await db.query(sql)
  let totalPage = 0
  let rows = []
  const page = +req.query.page || 1
  const perPage = 10

  if (page < 1) {
    return { success: false, redirect: `?page=1` }
  }

  if (mbList) {
    totalPage = Math.ceil(mbList / perPage)

    if (page > totalPage) {
      const newQuery = { ...req.query, page: totalPage }
      const setQuery = new URLSearchParams(newQuery).toString()
      return { success: false, redirect: `?` + setQuery }
    }

    const content_sql = `SELECT * FROM mb_user ${where} ORDER BY user_id DESC LIMIT ${(page - 1) * perPage}, ${perPage}`;

    [rows] = await db.query(content_sql)

    rows.forEach(r => {
      r.birthday = dayjs(r.birthday).format("YYYY-MM-DD");
      r.created_at = dayjs(r.created_at).format("YYYY-MM-DD HH-mm-ss");
    })
  }

  // 傳出的資料
  return {
    success: true,
    totalPage,
    page,
    perPage,
    rows,
    mbList,
    query: req.query
  }
}

// 會員列表
router.get('/', async (req, res) => {
  res.locals.title = res.locals.title + "- 會員";
  res.locals.pageName = "memberList";
  const data = await getFullList(req);
  if (data.redirect) {
    return res.redirect(data.redirect)
  }

  if (req.session.admin) {
    res.render('member_content/list', data)
  } else {
    res.render('member_content/list-not-admin', data)
  }
})

router.get('/api', async (req, res) => {
  const data = await getFullList(req)
  res.json(data)
})

// 新增會員
router.get('/add', async (req, res) => {
  res.locals.title = res.locals.title + "- 新增";
  res.locals.pageName = "addMember";
  res.render('member_content/add')
})

router.post('/add', async (req, res) => {
  const output = {
    success: false,
    bodyData: req.body,
    errors: {},
  }

  let isPass = true

  // 設立條件
  const checkName = z.string().min(2, { message: "至少輸入兩個字" })
  const checkEmail = z.string().email({ message: "請輸入正確的信箱格式" })

  // 檢視條件：姓名、信箱
  const rowName = checkName.safeParse(req.body.name)
  if (!rowName.success) {
    isPass = false;
    output.errors.name = rowName.error.issues[0].message
  }

  const rowEmail = checkEmail.safeParse(req.body.email)
  if (!rowEmail.success) {
    isPass = false;
    output.errors.email = rowEmail.error.issues[0].message
  }

  // 檢視生日
  let birthday = req.body.birthday
  const timeFormat = "YYYY-MM-DD"

  if (birthday === "") {
    isPass = false;
    output.errors.birthday = "請輸入生日"
  }
  else if (dayjs(birthday, timeFormat, true).isValid()) {
    birthday = dayjs(birthday).format(timeFormat)
  } else {
    birthday = null;
  }
  req.body.birthday = birthday

  // 連結SQL、送出現在時間
  let result = {}
  if (isPass) {
    req.body.created_at = new Date();
    let check_sql = "INSERT INTO `mb_user` SET ? ";

    try {
      [result] = await db.query(check_sql, [req.body]);
      output.success = !!result.affectedRows;
    }
    catch (ex) { }
  }
  res.json(output)
})

// 刪除會員
router.delete('/:user_id', async (req, res, next) => {
  let user_id = +req.params.user_id || 0;
  let output = {
    success: false,
    user_id,
  }

  if (user_id >= 1) {
    let sql = `DELETE FROM mb_user WHERE user_id=${user_id}`
    let [result] = await db.query(sql)
    output.succsss = !!result.affectedRows
  }

  res.json(output)
})

// 編輯會員-路由(串前端)
router.get('/:user_id', async (req, res) => {
  let user_id = +req.params.user_id || 0;
  let sql = `SELECT * FROM mb_user WHERE user_id=? `
  let [result] = await db.query(sql, [user_id])

  if (!result.length) {
    return res.json({ success: false, mesage: "沒有該筆資料" })
  }

  const timeFormat = "YYYY-MM-DD"

  if (result[0].birthday) {
    result[0].birthday = dayjs(result[0].birthday).format(timeFormat)
  }

  if (result[0].created_at) {
    result[0].created_at = dayjs(result[0].created_at).format(timeFormat)
  }

  res.json({ success: true, data: result[0] })
})

// 編輯會員-編輯(連前端)
router.put('/edit/:user_id', async (req, res) => {
  let user_id = +req.params.user_id || 0;
  let sql = `UPDATE mb_user SET ? WHERE user_id=? `

  const output = {
    success: false,
    bodyData: req.body,
    error: "",
  }

  try {
    let [result] = await db.query(sql, [req.body, user_id])
    output.success = !!result.changedRows
  }
  catch (error) {
    console.error(error);
  }

  res.json(output)
})

// 編輯會員-路由(純後端)
// router.get('/edit/:user_id', async (req, res) => {
//   res.locals.title = res.locals.title + "- 編輯";
//   res.locals.pageName = "editMember";

//   let user_id = +req.params.user_id || 0;
//   let sql = `SELECT * FROM mb_user WHERE user_id=? `
//   let [result] = await db.query(sql, [user_id])

//   if (!result.length) {
//     return res.redirect("/member_content")
//   }

//   const timeFormat = "YYYY-MM-DD"

//   if (result[0].birthday) {
//     result[0].birthday = dayjs(result[0].birthday).format(timeFormat)
//   }

//   if (result[0].created_at) {
//     result[0].created_at = dayjs(result[0].created_at).format(timeFormat)
//   }

//   res.render('member_content/edit', result[0])
// })

// 編輯會員-編輯(純後端)
// router.put('/edit/:user_id', async (req, res) => {
//   let user_id = +req.params.user_id || 0;
//   let sql = `UPDATE mb_user SET ? WHERE user_id=? `
//   let [result] = await db.query(sql, [req.body, user_id])

//   let output = {
//     success: false,
//     bodyData: req.body,
//     error: "",
//   }

//   output.success = !!result.changedRows
//   res.json(output)
// })

export default router