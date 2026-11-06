#!/usr/bin/env node
/**
 * Makes the style card photos for rooms other than the living room
 * (tester feedback 6 Nov 2026: a bedroom showed living-room pictures).
 *
 *   cd ~/Documents/"Kelly Homes" && node scripts/make-style-cards.mjs
 *   node scripts/make-style-cards.mjs bedroom          # one room only
 *
 * Writes public/images/styles/cards/<room>/<style>.jpg (480 x 360) for the rooms in
 * ROOM_CARD_FOLDERS (lib/design/studioStyles.ts). Skips cards that already exist, so it
 * can be run again after a failure. Reads OPENAI_API_KEY from .env.local (never prints it).
 * Style words come from lib/stylePrompts.ts, the same cards the designs use.
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

const ROOT = process.cwd()
const ROOMS = {
  bedroom: {
    label: "bedroom",
    line: "A made double bed with a headboard is the main piece, with bedside tables and lamps, a rug and curtains. No sofa, no dining table, no desk.",
  },
  "dining-room": {
    label: "dining room",
    line: "A dining table with six chairs is the main piece, with a pendant light above it and a sideboard. No sofa, no bed, no desk.",
  },
  office: {
    label: "home office",
    line: "A desk with a comfortable office chair is the main piece, with shelving, a desk lamp and a plant. No bed, no dining table.",
  },
}
const CONCURRENCY = 3

function readEnvKey(name) {
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=\\s*(.*)\\s*$`))
      if (!m) continue
      const value = m[1].trim()
      const quoted = value.match(/^(["'])(.*)\1/)
      return quoted ? quoted[2] : value.replace(/\s+#.*$/, "")
    }
  }
  return process.env[name] || ""
}

function readStyleCards() {
  const src = readFileSync(join(ROOT, "lib/stylePrompts.ts"), "utf8")
  const body = src.slice(src.indexOf("const CARDS"), src.indexOf("export const STYLE_CARDS"))
  const re =
    /\{\s*id: "([^"]+)",\s*name: "([^"]+)",\s*colours: "([^"]+)",\s*materials: "([^"]+)",\s*furniture: "([^"]+)",\s*decor: "([^"]+)",\s*avoid: "([^"]+)",\s*\}/g
  const cards = []
  for (const m of body.matchAll(re)) {
    cards.push({ id: m[1], name: m[2], colours: m[3], materials: m[4], decor: m[6], avoid: m[7] })
  }
  return cards
}

function promptFor(card, room) {
  return [
    `Photorealistic interior photograph of a ${room.label} in ${card.name} style, in a modern apartment.`,
    `Colours: ${card.colours}. Materials: ${card.materials}. Decor: ${card.decor}.`,
    room.line,
    `Avoid: ${card.avoid}.`,
    "Eye-level shot from a corner with a slightly wide lens, soft natural daylight, tidy and styled like a magazine photo.",
    "No people, no text, no logos, no watermarks.",
  ].join(" ")
}

async function requestImage(key, body) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  })
  const data = await res.json().catch(() => null)
  return { res, data }
}

async function makeCard(key, card, room, outFile) {
  const base = { model: readEnvKey("OPENAI_IMAGE_MODEL") || "gpt-image-2.5-sunburst", prompt: promptFor(card, room), n: 1 }
  let { res, data } = await requestImage(key, { ...base, size: "1536x1024", quality: "medium" })
  // If the model doesn't take these settings, try once with its defaults.
  if (res.status === 400) ({ res, data } = await requestImage(key, base))
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${data?.error?.message || "no message"}`)
  const b64 = data?.data?.[0]?.b64_json
  let input
  if (b64) input = Buffer.from(b64, "base64")
  else if (data?.data?.[0]?.url) {
    const img = await fetch(data.data[0].url)
    if (!img.ok) throw new Error(`image download ${img.status}`)
    input = Buffer.from(await img.arrayBuffer())
  }
  else throw new Error("OpenAI sent no image")
  const jpg = await sharp(input).resize(480, 360, { fit: "cover", position: "centre" }).jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  writeFileSync(outFile, jpg)
}

async function main() {
  const key = readEnvKey("OPENAI_API_KEY")
  if (!key.startsWith("sk-")) {
    console.log("No OpenAI key found in .env.local. Nothing done.")
    process.exit(1)
  }
  const wanted = process.argv.slice(2)
  const rooms = Object.keys(ROOMS).filter((r) => wanted.length === 0 || wanted.includes(r))
  if (rooms.length === 0) {
    console.log(`Unknown room. Use one of: ${Object.keys(ROOMS).join(", ")}`)
    process.exit(1)
  }
  const cards = readStyleCards()
  if (cards.length !== 19) console.log(`Note: found ${cards.length} styles (expected 19).`)

  const jobs = []
  for (const r of rooms) {
    const dir = join(ROOT, "public/images/styles/cards", r)
    mkdirSync(dir, { recursive: true })
    for (const card of cards) {
      const outFile = join(dir, `${card.id}.jpg`)
      if (!existsSync(outFile)) jobs.push({ r, card, outFile })
    }
  }
  console.log(`${jobs.length} cards to make (${rooms.join(", ")}). About 20-40 seconds each, ${CONCURRENCY} at a time.`)
  let done = 0
  let failed = 0
  const queue = [...jobs]
  async function worker() {
    while (queue.length > 0) {
      const job = queue.shift()
      try {
        await makeCard(key, job.card, ROOMS[job.r], job.outFile)
        done++
        console.log(`  made ${job.r}/${job.card.id}.jpg  (${done + failed}/${jobs.length})`)
      } catch (error) {
        failed++
        console.log(`  FAILED ${job.r}/${job.card.id}: ${error.message}  (${done + failed}/${jobs.length})`)
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`Done: ${done} made, ${failed} failed.${failed ? " Run the same command again to retry the failed ones." : ""}`)
}

main().catch((error) => {
  console.log(`Stopped: ${error.message}`)
  process.exit(1)
})
