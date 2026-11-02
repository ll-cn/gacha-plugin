# 抽卡插件（gacha-plugin）

原神**模拟抽卡**，Yunzai / TRSS-Yunzai 插件。卡池自动跟随官方祈愿公告，
保底、大小保底、武器定轨全部还原，抽卡结果与记录都是图片。

| 抽卡结果 | 卡池一览 |
| --- | --- |
| ![抽卡结果](https://raw.githubusercontent.com/ll-cn/plugin-preview/main/gacha/preview-wish.jpg) | ![卡池](https://raw.githubusercontent.com/ll-cn/plugin-preview/main/gacha/preview-banner.jpg) |

![记录 / 统计 / 欧皇榜](https://raw.githubusercontent.com/ll-cn/plugin-preview/main/gacha/preview-record.jpg)

![百连（一次 100 抽）](https://raw.githubusercontent.com/ll-cn/plugin-preview/main/gacha/preview-hundred.jpg)

![帮助图](https://raw.githubusercontent.com/ll-cn/plugin-preview/main/gacha/preview-help.jpg)

## 特性

- 🎴 **三个池子**：角色池（含池 2）、武器池、常驻池，概率与保底按游戏内机制还原
- 💯 **百连**：一次 100 抽（主人开启后可用），10×10 卡片网格
- 🔄 **卡池自动更新**：跟随米游社官方祈愿公告，出新版本新角色**不用手动维护名单**
- 🎯 **武器定轨**：定轨值满 2 必出指定武器
- 📜 **记录与统计**：出金率、平均抽数、歪率、各池垫抽、群内欧皇榜
- 🖼 **图片渲染**：卡片、卡池一览、记录、统计、帮助都是图
- 🖥 **支持锅巴面板**：装了 Guoba-Plugin 可在网页改配置，保存即生效
- 🤖 **云崽 / ALemonJS 双端**：同一份代码两套入口，alemonjs 装进 `packages/` 也能跑
- ⏱ **没出金自动撤回**：抽卡结果没有五星时过几秒自动撤，出金保留

## 指令

| 指令 | 说明 |
| --- | --- |
| `#抽卡` / `#十连` | 角色池十连（默认每天 10 次） |
| `#单抽` | 角色池单抽 |
| `#抽卡武器` | 武器池十连，可配合 `#定轨` 指定武器 |
| `#抽卡常驻` | 常驻池十连 |
| `#抽卡池2` | 当期第二个角色池 |
| `#抽卡百连` | 一次 100 抽（**需要主人先开启**，见配置 `hundredDraw`） |
| `#卡池` | 当期四个卡池一览（图片） |
| `#定轨苍耀` | 武器池定轨（直接接武器名），定轨值满 2 必出 |
| `#模拟抽卡记录 [页码]` | 最近的抽卡记录（四星及以上） |
| `#模拟抽卡记录五星` | 只看五星历史 |
| `#模拟抽卡统计` | 出金率、平均抽数、歪率、各池垫抽 |
| `#欧皇榜` | 群内平均出金排行（满 20 抽上榜） |
| `#卡池更新` | 手动同步卡池与角色库（主人 / 群管） |
| `#模拟抽卡帮助` | 全部指令（图片） |
| `#抽卡插件更新` / `#抽卡插件强制更新` | 从 GitHub 更新插件（仅主人） |
| `#抽卡插件更新日志` | 查看版本提交记录 |

**命令里的空格都可以省**：`#抽卡武器`、`#抽卡常驻`、`#抽卡池2`、`#模拟抽卡记录五星`、`#定轨苍耀` 都能用。

> 记录与统计只认 **`模拟抽卡…`** 开头的写法。裸的 `#抽卡记录`、`#抽卡统计` 留给 genshin 的原生记录（需要 authkey / UIGF 导入），两边互不干扰。

## 优先级

`#抽卡` / `#单抽` / `#十连` / `#定轨` / `#卡池` 的 **priority 是 10**，排在这些插件前面：

| 插件 | priority |
| --- | --- |
| **本插件** | **10** |
| Nwflower/flower-plugin（抽卡MOD） | 98（单抽）/ 99（十连·定轨） |
| genshin 自带抽卡 | 100 |

云崽按 priority **升序**执行，所以装了本插件后这些指令会走这里，不需要停用原插件。
（「次数用完 / 没权限 / 没数据」这类分支也会 `return true` 收口，不会再落到别的抽卡插件去。）

记录与统计（`#模拟抽卡记录` / `#模拟抽卡统计` / `#欧皇榜`）用的是 **priority 8**，
规则写死 `模拟抽卡…` 前缀，所以裸的 `#抽卡记录`、`#抽卡统计` 不会被抢，仍归 genshin 的 `gcLog`（300）。

## 配置

配置文件：**`config/config.yaml`**，改完保存**即时生效**（不用重启）。
删掉它（或变成空文件）后**下次抽卡会自动重新生成**默认配置。

```yaml
imageScale: 2       # 出图清晰度倍数(1=原尺寸，2=两倍像素)
jpegQuality: 90     # 出图质量(30-100，越低图越小)
textOnly: false     # 只发文字不发图
timeout: 25000      # 拉取卡池/角色资料的超时(毫秒)
dailyLimit: 10      # 每人每天可抽次数，十连算 1 次（0 = 不限；主人不受限）
refreshMinutes: 360 # 卡池自动刷新间隔(分钟)，0 = 只靠启动和过期触发
pityTip: true       # 抽卡卡片是否显示保底进度
recallNoGold: 8     # 没出五星时结果自动撤回(秒)，0 = 不撤回
hundredDraw: false  # 是否开放 #抽卡百连（一次 100 抽），默认关闭
```

**每日次数**：`dailyLimit` 只限制普通群友，**机器人主人不受限**（单抽 / 十连 / 百连都一样）。
一次十连或百连都只算 **1 次**。

**百连**：开关 `hundredDraw` 默认关闭，**只拦普通群友** —— 机器人主人随时可以发 `#抽卡百连`，
不受开关也不受每日次数限制。开启后群里谁都能用，和十连一样**只算 1 次**每日次数。
出图是 10 行 × 10 列的卡片网格，比十连图大不少。

**没出金自动撤回**：抽卡结果里没有五星时，图会在 `recallNoGold` 秒（默认 8 秒）后自动撤回，
出了五星就保留；改成 `0` 关掉。撤回需要机器人是群管理，失败只记日志、不影响抽卡结果落库。

## 锅巴面板配置

装了 [Guoba-Plugin](https://gitee.com/guoba-yunzai/guoba-plugin)（锅巴）的话，插件列表里会出现
「抽卡插件」，可以直接在网页上改「出图」和「模拟抽卡」两组配置并保存
（含 **允许百连** 开关）：写回的就是同一个 `config/config.yaml`，注释和没改的项都保留，保存后立即生效
（只有「卡池刷新间隔」要重启机器人才按新间隔走）。

## 抽卡概率

还原游戏内机制，各池独立计数，角色池 1 与池 2 共享保底：

| | 五星基础 | 软保底起点 | 硬保底 | UP 概率 |
| --- | --- | --- | --- | --- |
| 角色池 | 0.6% | 74 抽 | 90 抽 | 50%，歪了下次必中 |
| 武器池 | 0.7% | 63 抽 | 80 抽 | 75%，支持定轨 |
| 常驻池 | 0.6% | 74 抽 | 90 抽 | 无 UP |

四星 5.1%，每 10 抽必出。实测 100 万抽出金率 1.61%、平均 62.1 抽一个五星（官方约 1.6% / 62.5 抽）。

## 卡池怎么做到自动更新

卡池信息来自米游社官方祈愿公告（公开接口），角色与武器的星级/图标来自 yatta 角色库。
启动后、每 6 小时、以及抽卡时发现卡池过期，都会自动刷新一次，
每次刷到的卡池都累积写进 `data/wish/banners.json`，公告过期后历史卡池仍可查询。
官方公告比角色库更新早半天左右时，新角色先用文字卡占位，下次刷新自动补图。

## 数据

抽卡记录与卡池缓存在 `data/wish/`（不进 git）：`records.json`（记录）、`banners.json`（卡池）、`icons/`（图标）。

## 安装

### Yunzai / TRSS-Yunzai

```bash
cd plugins
git clone https://github.com/ll-cn/gacha-plugin.git
```

**必须整仓克隆**，只放 js 跑不起图（依赖 `resources/` 下的 html 模板）。
装完重启机器人。

### ALemonJS

同一个仓库，云崽和 alemonjs 两套入口并存，互不干扰 —— 区别只在入口：
云崽读 `index.js`，alemonjs 读 `package.json` 的 `main`（`lib/index.js`）。

| 分支 | 用途 |
| --- | --- |
| `main` | 开发主线（云崽 `git clone` 到 `plugins/` 用这个） |
| `release` | 只含 ALemonJS 运行所需（`package.json` + `lib/` + `app/` + `model/` + `resources/`），**生态市场与 `git clone` 用这个** |

> ⚠️ **只 clone 到 `packages/` 不会生效**。ALemonJS 按 `alemon.config.yaml` 的 `apps` 用
> `require.resolve` 加载插件，不会扫描 `packages/` 目录 —— 下载之后还要「链接 + 注册」。

```bash
# 1) 下载到宿主项目的 packages/
git clone -b release --depth=1 https://github.com/ll-cn/gacha-plugin.git ./packages/gacha-plugin

# 2) 链接进 node_modules，同时装上运行期依赖（art-template / sharp）
npm i ./packages/gacha-plugin
#   yarn: yarn add file:./packages/gacha-plugin
#   pnpm: pnpm add ./packages/gacha-plugin
#   宿主 package.json 里有 "workspaces": ["packages/*"] 的话，直接 install 也会自动建软链

# 3) 注册到 apps —— 手动编辑 alemon.config.yaml
#    apps:
#      gacha-plugin: true

# 4) 重启机器人
```

> ⚠️ **别用 `alemonc add apps gacha-plugin`**。那个命令会把 `apps` 从对象
> （`插件名: true`）**强转成数组**，把已有的 `alemonjs-cheese`、`alemonjs-load-yunzai` 一起清空。
> 手动加一行，或者用 `alemonc set apps.gacha-plugin true`。

**出图方式**（按顺序自动选，不用配）：

1. **shotium**（`@pixel.js/shotium`，和云崽同一个渲染内核）—— 进程内渲染，**不需要安装浏览器**，
   服务器/容器里最稳。`npm i` 时会作为可选依赖自动装对应平台的原生包（linux-x64 / linux-arm64 / win32 …）
2. 系统 Chrome / Chromium / Edge 无头截图（找不到 shotium 时兜底）
3. 两者都没有 → 自动降级成纯文字，不会报错

日志里会写实际用的方式：

```
[抽卡插件] 出图方式：shotium 进程内渲染（不需要浏览器）
[抽卡插件] 出图浏览器：/usr/bin/chromium
```

配置文件仍是 `packages/gacha-plugin/config/config.yaml`，首次启动自动生成，改完即时生效。
