# 八奈见杏菜制品图鉴

《败犬女主太多了！》八奈见杏菜官方实体制品的独立 JSON 图鉴项目。

## 本地运行

```bash
python3 -m http.server 4173
```

访问 `http://localhost:4173/`。页面通过 `fetch()` 读取 JSON，不能直接双击 `index.html`。

## 数据位置

- `data/catalog.json`：本角色商品数据，唯一需要日常编辑的商品文件。
- `data/catalog.schema.json`：六个角色项目共用的结构约束。
- `data/registry/`：从 `makeine-goods-catalog/registry/` 同步的公共词表快照。
- `images/items/`：详情图。
- `images/thumbs/`：列表缩略图。

商品使用 `campaign_id`、`manufacturer_id` 和 `category_id` 引用公共词表。相同群像商品在不同角色项目中必须使用相同的 `global_product_id`。

## 公共词表

在工作区的 `makeine-goods-catalog` 中维护活动名称、厂商名称、固定译名和角色名称，然后运行：

```bash
python3 makeine-goods-catalog/tools/sync_registries.py
python3 makeine-goods-catalog/tools/validate_character_projects.py
```

## Netlify

项目无需构建命令，发布目录填写 `.`。`netlify.toml` 已包含缓存规则。
