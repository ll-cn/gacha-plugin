import path from 'node:path'
import fs from 'node:fs'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const TMP = path.join(ROOT, 'data', 'tmp')

/** 展开「目录下的子目录 + 尾路径」形式的候选（puppeteer / playwright 的缓存结构） */
function expandCandidates(base, tail) {
  const out = []
  try {
    for (const name of fs.readdirSync(base)) {
      const p = path.join(base, name, tail)
      try {
        if (fs.existsSync(p)) out.push(p)
      } catch {
        /* 忽略单个条目 */
      }
    }
  } catch {
    /* 目录不存在 */
  }
  return out
}

/** 系统浏览器候选路径（Chrome / Chromium / Edge 均可无头截图） */
function findBrowser() {
  // 显式指定优先
  for (const key of ['GACHA_CHROME', 'PUPPETEER_EXECUTABLE_PATH', 'CHROME_PATH']) {
    const v = process.env[key]
    try {
      if (v && fs.existsSync(v)) return v
    } catch {
      /* 忽略 */
    }
  }

  const home = process.env.USERPROFILE || process.env.HOME || ''
  const cacheDir = process.env.PUPPETEER_CACHE_DIR || path.join(home, '.cache', 'puppeteer')
  const playwrightDir = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(home, '.cache', 'ms-playwright')

  const fixed =
    process.platform === 'win32'
      ? [
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
          path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'Application', 'chrome.exe'),
          'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
          'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
          path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'Application', 'msedge.exe')
        ]
      : process.platform === 'darwin'
        ? [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
            '/Applications/Chromium.app/Contents/MacOS/Chromium'
          ]
        : [
            '/usr/bin/google-chrome',
            '/usr/bin/google-chrome-stable',
            '/usr/bin/chromium',
            '/usr/bin/chromium-browser',
            '/opt/google/chrome/chrome',
            '/snap/bin/chromium',
            '/usr/bin/microsoft-edge'
          ]

  // puppeteer / playwright 自己下载的浏览器（服务器上最常见的来源）
  const cached = [
    ...expandCandidates(path.join(cacheDir, 'chrome'), path.join('chrome-linux64', 'chrome')),
    ...expandCandidates(path.join(cacheDir, 'chrome-headless-shell'), path.join('chrome-headless-shell-linux64', 'chrome-headless-shell')),
    ...expandCandidates(playwrightDir, path.join('chrome-linux', 'chrome'))
  ]

  for (const p of [...fixed, ...cached]) {
    try {
      if (p && fs.existsSync(p)) return p
    } catch {
      /* 忽略 */
    }
  }
  return ''
}

let browserPath = null
function browser() {
  if (browserPath === null) browserPath = findBrowser()
  return browserPath
}

/** 用无头浏览器把 html 截成图片（窗口按 2 倍宽度开，避免 zoom 后被裁） */
async function shot(htmlFile, outFile) {
  const exe = browser()
  if (!exe) {
    throw new Error(
      '没找到 Chrome / Chromium。装一个（apt install chromium），或用环境变量指定：GACHA_CHROME=/usr/bin/chromium，' +
        '也可以执行 npx puppeteer browsers install chrome'
    )
  }

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--force-device-scale-factor=1',
    // 视口要明显大于内容宽度（模板 html{zoom:2}，十连约 2550、百连更宽），否则右侧会被裁
    '--window-size=3600,6000',
    `--screenshot=${outFile}`,
    pathToFileURL(htmlFile).href
  ]
  await execFileAsync(exe, args, { timeout: 60000, windowsHide: true })
  if (!fs.existsSync(outFile)) throw new Error('浏览器没有产出截图')
  return outFile
}

/**
 * 渲染一个模板出图。
 * payload 里的 tplFile / cssZoom / versionHtml 等字段与云崽渲染器一致。
 */
export async function renderTemplate(name, payload) {
  const template = require('art-template')
  const sharp = require('sharp')

  const html = fs.readFileSync(payload.tplFile, 'utf8')
  const rendered = template.render(html, {
    cssZoom: payload.cssZoom ?? 2,
    versionHtml: payload.versionHtml ?? '',
    ...payload
  })

  fs.mkdirSync(TMP, { recursive: true })
  const tag = `${name}-${Date.now()}`
  const htmlFile = path.join(TMP, `${tag}.html`)
  const pngFile = path.join(TMP, `${tag}.png`)

  // 白底便于裁剪，避免模板浅色背景留边
  const withBg = rendered.replace('</head>', '<style>html,body{background:#ffffff !important}</style></head>')
  fs.writeFileSync(htmlFile, withBg)

  try {
    await shot(htmlFile, pngFile)
    const buf = await sharp(pngFile)
      .trim({ background: '#ffffff', threshold: 6 })
      .jpeg({ quality: payload.quality ?? 90, chromaSubsampling: '4:4:4' })
      .toBuffer()
    return buf
  } finally {
    for (const f of [htmlFile, pngFile]) {
      try {
        fs.rmSync(f, { force: true })
      } catch {
        /* 忽略 */
      }
    }
  }
}
