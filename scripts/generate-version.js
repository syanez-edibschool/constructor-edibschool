import { writeFileSync } from 'fs'
writeFileSync('public/version.json', JSON.stringify({ build: Date.now().toString() }))
