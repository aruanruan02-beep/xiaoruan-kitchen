import { useEffect, useMemo, useState } from "react";

const CATEGORIES = ["主食", "素菜", "荤菜", "炖汤", "水果", "饮料", "其他"] as const;
const BASE_URL = import.meta.env.BASE_URL;
type Category = (typeof CATEGORIES)[number];

type Dish = {
  id: string;
  name: string;
  category: Category;
  image: string;
  note: string;
};

type ViewMode = "menu" | "summary";

const categorySet = new Set<string>(CATEGORIES);

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field.trim());
      field = "";
    } else if (char === "\n") {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  const [headers = [], ...dataRows] = rows.filter((item) => item.some(Boolean));
  return dataRows.map((item) =>
    headers.reduce<Record<string, string>>((result, header, index) => {
      result[header] = item[index] ?? "";
      return result;
    }, {}),
  );
}

function normalizeDish(row: Record<string, string>): Dish | null {
  const category = categorySet.has(row.category) ? (row.category as Category) : "其他";
  const id = row.id || `${category}-${row.name}`;

  if (!row.name || !row.image) {
    return null;
  }

  return {
    id,
    name: row.name,
    category,
    image: row.image,
    note: row.note ?? "",
  };
}

function groupByCategory(dishes: Dish[]) {
  return CATEGORIES.map((category) => ({
    category,
    dishes: dishes.filter((dish) => dish.category === category),
  })).filter((group) => group.dishes.length > 0);
}

function imagePath(fileName: string) {
  return `${BASE_URL}photos/${encodeURIComponent(fileName)}`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const chars = [...text];
  let line = "";
  let currentY = y;

  chars.forEach((char) => {
    const testLine = line + char;
    if (context.measureText(testLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });

  if (line) {
    context.fillText(line, x, currentY);
  }

  return currentY + lineHeight;
}

function drawCoverImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
) {
  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const sourceX = x - (width - size) / 2;
  const sourceY = y - (height - size) / 2;

  context.save();
  roundRect(context, x, y, size, size, 18);
  context.clip();
  context.drawImage(image, sourceX, sourceY, width, height);
  context.restore();
}

async function createMenuImage(dishes: Dish[]) {
  const groups = groupByCategory(dishes);
  const width = 1080;
  const padding = 56;
  const cardHeight = 150;
  const dishHeight = 170;
  const sectionGap = 28;
  const estimatedHeight =
    220 +
    groups.reduce((total, group) => total + 68 + group.dishes.length * dishHeight + sectionGap, 0) +
    56;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.max(640, estimatedHeight);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is not available.");
  }

  context.fillStyle = "#fff8ef";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#d9482f";
  context.fillRect(0, 0, canvas.width, 16);

  context.fillStyle = "#24160f";
  context.textBaseline = "alphabetic";
  context.font = "700 62px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("小阮厨房点菜单", padding, 112);

  context.fillStyle = "#80695c";
  context.font = "400 30px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText(
    `${new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })} · 共 ${dishes.length} 道`,
    padding,
    158,
  );

  let y = 224;

  for (const group of groups) {
    context.fillStyle = "#24160f";
    context.font = "700 38px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(group.category, padding, y);
    y += 24;

    for (const dish of group.dishes) {
      const cardY = y;
      const cardWidth = width - padding * 2;
      const imageSize = 112;
      const imageX = padding + 20;
      const imageY = cardY + (cardHeight - imageSize) / 2;
      const textX = imageX + imageSize + 28;
      const textMaxWidth = cardWidth - imageSize - 72;

      context.fillStyle = "#fffdf9";
      roundRect(context, padding, cardY, cardWidth, cardHeight, 28);
      context.fill();

      const image = await loadImage(imagePath(dish.image));
      if (image) {
        drawCoverImage(context, image, imageX, imageY, imageSize);
      } else {
        context.fillStyle = "#f1dfcb";
        roundRect(context, imageX, imageY, imageSize, imageSize, 18);
        context.fill();
      }

      context.fillStyle = "#24160f";
      context.font = "700 39px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";

      if (dish.note) {
        context.textBaseline = "alphabetic";
        context.fillText(dish.name, textX, cardY + 60);
        context.fillStyle = "#80695c";
        context.font = "400 27px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
        drawWrappedText(context, dish.note, textX, cardY + 102, textMaxWidth, 34);
      } else {
        context.textBaseline = "middle";
        context.fillText(dish.name, textX, cardY + cardHeight / 2);
        context.textBaseline = "alphabetic";
      }

      y += dishHeight;
    }

    y += sectionGap;
  }

  return canvas.toDataURL("image/png");
}

export default function App() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<Category | "全部">("全部");
  const [viewMode, setViewMode] = useState<ViewMode>("menu");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetch(`${BASE_URL}data/dishes.csv`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error("菜品表格没有加载成功。");
        }
        return response.text();
      })
      .then((text) => {
        setDishes(parseCsv(text).map(normalizeDish).filter(Boolean) as Dish[]);
      })
      .catch(() => setError("没有读到菜品表格，请检查 public/data/dishes.csv。"))
      .finally(() => setLoading(false));
  }, []);

  const selectedDishes = useMemo(
    () => dishes.filter((dish) => selectedIds.has(dish.id)),
    [dishes, selectedIds],
  );

  const visibleDishes = useMemo(() => {
    if (activeCategory === "全部") {
      return dishes;
    }

    return dishes.filter((dish) => dish.category === activeCategory);
  }, [activeCategory, dishes]);

  const categoryCounts = useMemo(() => {
    return dishes.reduce<Record<string, number>>((counts, dish) => {
      counts[dish.category] = (counts[dish.category] ?? 0) + 1;
      return counts;
    }, {});
  }, [dishes]);

  function toggleDish(id: string) {
    setGeneratedImage("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleFinish() {
    if (selectedDishes.length === 0) {
      return;
    }

    setViewMode("summary");
    setIsGenerating(true);
    try {
      const dataUrl = await createMenuImage(selectedDishes);
      setGeneratedImage(dataUrl);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <h1>小阮厨房</h1>
        </div>
        <button className="counter" type="button" onClick={() => setViewMode("summary")}>
          已选 {selectedDishes.length}
        </button>
      </header>

      {viewMode === "menu" ? (
        <>
          <section className="category-strip" aria-label="菜品分类">
            <button
              className={activeCategory === "全部" ? "active" : ""}
              type="button"
              onClick={() => setActiveCategory("全部")}
            >
              全部
              <span>{dishes.length}</span>
            </button>
            {CATEGORIES.map((category) => (
              <button
                className={activeCategory === category ? "active" : ""}
                type="button"
                key={category}
                onClick={() => setActiveCategory(category)}
              >
                {category}
                <span>{categoryCounts[category] ?? 0}</span>
              </button>
            ))}
          </section>

          <section className="menu-content">
            {loading ? <div className="state">正在端菜...</div> : null}
            {error ? <div className="state">{error}</div> : null}
            {!loading && !error && dishes.length === 0 ? (
              <div className="state">菜品表还是空的，把照片和 CSV 放进来就能开点。</div>
            ) : null}
            {!loading && !error && dishes.length > 0 && visibleDishes.length === 0 ? (
              <div className="state">这个分类还没有菜。</div>
            ) : null}

            <div className="dish-grid">
              {visibleDishes.map((dish) => {
                const selected = selectedIds.has(dish.id);
                return (
                  <button
                    className={`dish-card${selected ? " selected" : ""}`}
                    type="button"
                    key={dish.id}
                    onClick={() => toggleDish(dish.id)}
                    aria-pressed={selected}
                  >
                    <span className="photo-wrap">
                      <img src={imagePath(dish.image)} alt={dish.name} loading="lazy" />
                      <span className="checkmark">{selected ? "✓" : "+"}</span>
                    </span>
                    <span className="dish-meta">
                      <span className="dish-name">{dish.name}</span>
                      {dish.note ? <span className="dish-note">{dish.note}</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <nav className="bottom-action">
            <button
              className="primary-action"
              type="button"
              disabled={selectedDishes.length === 0}
              onClick={handleFinish}
            >
              选好了
              <span>{selectedDishes.length > 0 ? `${selectedDishes.length} 道` : "先选几道"}</span>
            </button>
          </nav>
        </>
      ) : (
        <section className="summary-page">
          <button className="back-button" type="button" onClick={() => setViewMode("menu")}>
            返回继续点菜
          </button>

          {selectedDishes.length === 0 ? (
            <div className="state">还没有选菜，先回菜单里挑几道想吃的。</div>
          ) : (
            <>
              <div className="order-card">
                <div className="order-card-head">
                  <div>
                    <p className="eyebrow">今日想吃</p>
                    <h2>小阮厨房点菜单</h2>
                  </div>
                  <span>{selectedDishes.length} 道</span>
                </div>

                {groupByCategory(selectedDishes).map((group) => (
                  <div className="order-group" key={group.category}>
                    <h3>{group.category}</h3>
                    {group.dishes.map((dish) => (
                      <div className="order-row" key={dish.id}>
                        <img src={imagePath(dish.image)} alt={dish.name} />
                        <div>
                          <strong>{dish.name}</strong>
                          {dish.note ? <p>{dish.note}</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="image-sheet" role="dialog" aria-modal="true" aria-label="选好的菜单截图">
                <div className="image-sheet-panel">
                  <div className="image-sheet-head">
                    <strong>选好的菜单截图</strong>
                    <button type="button" onClick={() => setViewMode("menu")}>
                      继续点
                    </button>
                  </div>
                  {isGenerating ? <div className="state compact">正在生成图片...</div> : null}
                  {generatedImage ? (
                    <figure className="image-result">
                      <img src={generatedImage} alt="选好的菜单截图" />
                      <figcaption>长按保存图片，发给小阮就好。</figcaption>
                    </figure>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
