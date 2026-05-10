import { Router } from 'express'
import { createHmac } from 'crypto'

const router = Router()

export const makeToken = (password) =>
  createHmac('sha256', password).update('pss-mis-supervisor').digest('hex')

export const requireAuth = (req, res, next) => {
  const password = process.env.SUPERVISOR_PASSWORD
  if (!password) return next()
  const provided = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7) : null
  if (provided !== makeToken(password)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.post('/', (req, res) => {
  const { password } = req.body
  const expected = process.env.SUPERVISOR_PASSWORD
  if (!expected) return res.json({ token: 'no-auth' })
  if (password !== expected) {
    return res.status(401).json({ error: 'Incorrect password' })
  }
  res.json({ token: makeToken(password) })
})

export default router
