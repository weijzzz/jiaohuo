# jiaohuo · Consulta de artículos

Consulta de precios por EAN o código de artículo para el catálogo de Unide.
PWA offline: los datos viven en IndexedDB y la app funciona sin cobertura.

---

## ⚠️ 三个待确认项：我无法替你验证

本次会话的网络策略挡掉了 `unideges30.unide.es`（CONNECT tunnel 403），
而且那是需要登录的商家后台。所以下面三点**仍然是未验证的假设**：

1. Unide 数据里是否有 EAN 字段
2. dashboard 是 XHR 返回 JSON，还是服务端渲染 HTML
3. 是否有 Exportar a Excel

**关键结论：这三点只影响「怎么把数据弄出来」，不影响其他任何部分。**
所以已经实现的是数据源无关的那一整套（schema / 条码逻辑 / IndexedDB / 扫码 /
查询 / PWA），导入层做成了可插拔的，等答案确定再接最后一段。

### 你自己 3 分钟验完的办法

**Q1 · 有没有 EAN 字段**

拿一个实物商品，读出包装上的 13 位条码数字。在 dashboard 查出这个商品后，
`Ctrl+F` 在页面里搜那串数字。搜得到 → 有 EAN。
字段名常见叫法：`EAN` / `CodigoBarras` / `CodBarras` / `GTIN` / `Referencia`。

**Q2 · XHR JSON 还是服务端渲染**

DevTools → Network → 勾选 `Fetch/XHR` → 清空 → 在页面上执行一次查询。

| 现象 | 结论 |
| --- | --- |
| 出现 XHR，响应是 JSON | 有内部 API，最好办 |
| 没有 XHR，只有 `Type=document` 的整页请求 | 服务端渲染 |
| 页面源码里能搜到 `__VIEWSTATE` | ASP.NET WebForms，自动化最麻烦（postback 要带 VIEWSTATE + EVENTVALIDATION） |

**Q3 · Exportar a Excel**

如果有按钮就点一次，然后**确认下载的文件到底是什么格式**——老系统的 `.xls`
经常是 HTML table 改了后缀：

```sh
file export.xls
head -c 8 export.xls | xxd
```

- `PK` 开头 → 真 xlsx
- `D0 CF 11 E0` 开头 → 真 xls (BIFF)
- `<html` / `<table` 开头 → HTML 伪装

### 验完把这个发我

CSV/导出的**表头那一行 + 2~3 行样例**（价格可以改掉），或者 XHR 的响应片段。
接上去大概 5 分钟的工作量。

---

## 关于 xlsx 支持

目前只支持 **CSV 和 JSON**。npm 上的 `xlsx` 包已被官方弃管，带两个无法修复的
高危告警（prototype pollution + ReDoS），所以没有装。

如果 Q3 的答案是「导出确实是 xlsx」，三条路：

1. Excel 里「另存为 CSV UTF-8」——零代码，但每天多一步
2. 用 SheetJS 官方 CDN 版本（绕开 npm 的弃管包）
3. 换 `exceljs`（在维护，但读不了真 `.xls` 和 HTML 伪装的）

---

## 架构

快照模式，不做实时代理：

```
Unide 后台 → 导出/抓取 → CSV·JSON → [导入] → IndexedDB → 内存索引 → 扫码/搜索
```

```
src/
  types.ts              Articulo / SnapshotMeta / ImportReport
  lib/
    ean.ts              条码归一化：校验位、UPC-A→EAN-13、ITF-14 箱码、Excel 损坏修复
    text.ts             去重音折叠（"jamon" 能搜到 "Jamón"）
    search.ts           文本搜索 + 排序
    catalog.ts          内存索引，扫码查询（含 unidad ⇄ caja 互查）
    db.ts               IndexedDB，只负责持久化
    format.ts           es-ES 价格/日期，快照时效分级
    import/
      mapping.ts        西班牙语表头自动识别
      values.ts         "1.234,56 €" 解析、windows-1252 编码检测
      index.ts          CSV/JSON 读取 → Articulo
    scan/
      detector.ts       BarcodeDetector 原生 + ZXing 兜底（按需加载）
      useScanner.ts     摄像头生命周期、手电筒、防重复
  components/           UI
```

### 几个刻意的设计决定

**`codigo` 做主键，`eans` 是数组** —— 按你的方案。扫码查询会自动互查
unidad ⇄ caja：扫箱码但库里只有单品码（或反过来）也能命中，命中后 UI 会
明确提示这是推导出来的，不会闷声显示另一个价格。

**查询在内存做，不走 IndexedDB 索引** —— 扫码循环每秒跑好几次，不能每帧
`await` 事务；一家店的商品数放内存完全没压力。`db.ts` 因此只管存取。

**快照时效常驻顶栏** —— 快照模式最大的风险就是拿过期价格报给客户。
`<24h` 绿 / `<72h` 黄 / 更久红，一直在屏幕上。

**Excel 吃前导零的修复是有边界的** —— `0841...` 被 Excel 吃成 `841...` 会
补回来，但补零距离限制在 3 位以内。否则短字符串补到 13 位有 1/10 概率
**碰巧**通过校验位（测试里有这个回归用例）。校验不过的条码会在导入报告里
列出来，不会静默丢弃。

**ZXing 只在没有原生 API 时按需加载** —— 单独 chunk（412 KB），Android Chrome
上永远不会执行到。注意它仍在 PWA 预缓存里，因为 iOS 离线扫码需要它。

**原生 API 要检查 `getSupportedFormats()`** —— 桌面版 Chrome on Linux 会暴露
`BarcodeDetector` 构造函数但支持 0 种格式，光判断 API 存在会踩坑。

---

## 开发

```sh
npm install
npm run dev        # 开发
npm test           # 70 个单元测试
npm run lint
npm run build
```

扫码需要 HTTPS（或 localhost）才能拿到摄像头权限。

## 已验证

浏览器端跑通了完整链路：`;` 分隔 + 西语价格的 CSV 导入 → 表头自动识别 →
去重音搜索 → Excel 损坏条码修复后可查 → 箱码命中单品 → 查不到时明确报错而
不是显示错价 → 刷新后数据仍在。

## 还没做

- 从 Unide 自动取数（等上面三个问题的答案）
- 多店/多价格表（后台价格通常是账号专属的，当前快照 = 你这个账号看到的价格）
