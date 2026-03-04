
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env.local', 'utf8')
const getEnv = (key) => env.split('\n').find(l => l.startsWith(key))?.split('=')[1].trim()

const supabaseUrl = getEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY')

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function test() {
    const targetId = 'igb_17841479788144075'
    console.log(`--- Searching for ${targetId} in all columns of v_videos_with_niches ---`)

    const { data: videos, error } = await supabase.from('v_videos_with_niches').select('*').limit(100)

    if (error) {
        console.log('Error:', error.message)
        return
    }

    const matches = videos.filter(v => Object.values(v).some(val => val === targetId))

    if (matches.length > 0) {
        console.log('Found match in video(s):')
        matches.forEach(m => {
            const col = Object.keys(m).find(k => m[k] === targetId)
            console.log(`- Column: ${col}, Video Title: ${m.title}`)
        })
    } else {
        console.log('No matches found in the first 100 rows.')
    }
}

test()
