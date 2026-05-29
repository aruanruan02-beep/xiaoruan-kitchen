# 小阮厨房

一个适合微信里打开的静态 H5 点菜菜单。朋友勾选想吃的菜后，可以生成一张点菜单图片发回来。

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:5173/`。

## 维护菜品

菜品表在 `public/data/dishes.csv`，字段固定为：

```csv
id,name,category,image,note
```

- `id`：唯一编号，建议用英文或拼音。
- `name`：菜名。
- `category`：支持 `主食`、`素菜`、`荤菜`、`炖汤`、`水果`、`饮料`、`其他`。
- `image`：图片文件名，图片放在 `public/photos/`。
- `note`：可选备注，不想显示就留空。

示例：

```csv
tomato-egg,番茄鸡蛋盖饭,主食,tomato-egg.jpg,酸甜开胃
```

## 替换照片

把真实照片放进 `public/photos/`，然后在 CSV 的 `image` 列写对应文件名。推荐使用 `.jpg`、`.png`、`.webp`，图片尽量裁成横图或正方形，菜单里会自动居中裁切。

## 构建发布

```bash
npm run build
```

构建产物在 `dist/`，可以部署到 Vercel、Netlify、GitHub Pages 或任意静态网站托管服务。
