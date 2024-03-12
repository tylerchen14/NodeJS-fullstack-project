import multer from 'multer';
import { v4 } from 'uuid';

const checkfile = {
  'image/png': ".png",
  'image/webp': ".webp",
  'image/jpeg': ".jpeg",
}

const filefilter = (req, file, callback) => {
  callback(null, !!checkfile[file.mimetype])
}

const storage = multer.diskStorage(
  {
    destination: (req, file, callback) => {
      callback(null, 'imgLocation/img')
    },
    filename: (req, file, callback) => {
      const fn = v4() + checkfile[file.mimetype]
      callback(null, fn)
    }
  })

const upload = multer({
  filefilter, storage
})

export default upload