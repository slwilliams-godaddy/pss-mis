import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import configRouter from './routes/config.js'
import authRouter from './routes/auth.js'
import teamRouter from './routes/team.js'

const app = express()
const PORT = 3001

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/config', configRouter)
app.use('/api/team', teamRouter)

app.listen(PORT, () => {
  console.log(`PSS MIS server running on http://localhost:${PORT}`)
})
