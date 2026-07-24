// アバター（頭文字アイコン / 画像アイコン）生成ヘルパー

export function getInitial(name) {
  if (!name) return "?";
  return Array.from(name.trim())[0] || "?";
}

// size: "small" | "large" | 省略で通常サイズ
export function createAvatar(name, size, imageUrl) {
  if (imageUrl) {
    const img = document.createElement("img");
    img.classList.add("avatar-circle");
    if (size === "small") img.classList.add("small");
    if (size === "large") img.classList.add("large");
    img.src = imageUrl;
    img.alt = name || "";
    return img;
  }
  const avatar = document.createElement("div");
  avatar.classList.add("avatar-circle");
  if (size === "small") avatar.classList.add("small");
  if (size === "large") avatar.classList.add("large");
  avatar.textContent = getInitial(name);
  return avatar;
}
