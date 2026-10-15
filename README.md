# 八奈见杏菜制品图鉴

《败犬女主太多了！》八奈见杏菜相关官方实体制品的在线图鉴。项目为纯静态网站，页面从本地 JSON 读取制品、活动和分类资料。

## 本地启动

在工作区中进入本仓库并启动静态文件服务器：

```bash
cd makeine-goods-yanami-anna
python3 -m http.server 4173
```

浏览器访问 `http://localhost:4173/`。端口被占用时可以把 `4173` 换成其他端口。由于页面使用 `fetch()` 加载 JSON，不能直接双击 `index.html` 运行。

## 数据文件

- `data/catalog.json`：本角色的制品主数据。包含制品名称、活动、分类、厂商、发售方式、图片、来源和备注等信息。
- `data/catalog.schema.json`：`catalog.json` 的结构约束，用于检查字段格式，不存放制品。
- `data/registry/campaigns.json`：活动、联动、展会及系列名称；由制品的 `campaign_id` 引用。
- `data/registry/categories.json`：制品分类；由 `category_id` 引用。
- `data/registry/manufacturers.json`：厂商与店铺名称；由 `manufacturer_id` 引用。
- `data/registry/characters.json`：角色名称、日文名和别名。
- `data/registry/translations.json`：维护数据时使用的固定译名表。

相同活动在不同角色仓库中应使用相同的 `campaign_id`；同一件多人或随机制品应使用相同的 `global_product_id`，以便跨角色对齐。

## 图片目录

- `images/items/`：制品原图或可获得的最高质量详情图，对应商品图片记录中的 `path`。
- `images/thumbs/`：列表页使用的压缩缩略图，对应 `thumbnail_path`，用于减少首屏加载流量。

列表优先加载缩略图，打开制品详情时再读取原图。远程图片地址保存在图片记录的 `source_url` 中，用于追溯图片来源，网页展示仍使用仓库内的本地文件。

## 部署

Netlify 无需构建命令，发布目录填写 `.`。仓库根目录的 `netlify.toml` 已包含静态文件与缓存配置。
