// 汎用ユーティリティ関数

export function formatDateTime(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

// メッセージ本文に含まれる一部の許可タグ（リンク・装飾）のみを安全なDOMに変換する
export function sanitizeHtmlToOnlyLinks(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const box = document.createDocumentFragment();

  function processNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent);
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toUpperCase();
      let resultElement = null;

      if (tagName === "A") {
        resultElement = document.createElement("a");
        const rawHref = node.getAttribute("href") || "#";
        resultElement.setAttribute("href", rawHref);
        resultElement.setAttribute("target", "_blank");
        resultElement.setAttribute("rel", "noopener noreferrer");
        resultElement.classList.add("chat-link");
      } else if (tagName === "UNDERLINE") {
        resultElement = document.createElement("span");
        resultElement.classList.add("underline");
      } else if (tagName === "LARGE") {
        resultElement = document.createElement("span");
        resultElement.classList.add("large");
      } else if (tagName === "MAINCOLOR") {
        resultElement = document.createElement("span");
        resultElement.classList.add("main-color");
      } else if (tagName === "SMALL") {
        resultElement = document.createElement("span");
        resultElement.classList.add("small");
      } else if (tagName === "EMOJI") {
        resultElement = document.createElement("span");
        resultElement.classList.add("emoji");
      }

      if (resultElement) {
        node.childNodes.forEach((child) => {
          const processedChild = processNode(child);
          if (processedChild) resultElement.appendChild(processedChild);
        });
        return resultElement;
      } else {
        const fragment = document.createDocumentFragment();
        node.childNodes.forEach((child) => {
          const processedChild = processNode(child);
          if (processedChild) fragment.appendChild(processedChild);
        });
        return fragment;
      }
    }

    return null;
  }

  Array.from(doc.body.childNodes).forEach((node) => {
    const processed = processNode(node);
    if (processed) box.appendChild(processed);
  });

  return box;
}

// ===== ルーティング用ヘルパー =====
// URLが index.html#roomId のとき roomId を返す。無ければ null（トーク一覧）
export function getHashTalkId() {
  const hash = window.location.hash.replace(/^#/, "");
  return hash ? decodeURIComponent(hash) : null;
}

export function navigateToTalk(talkId) {
  window.location.hash = encodeURIComponent(talkId);
}

export function navigateToList() {
  if (window.location.hash) {
    // hashchangeイベントが発火し、ルーターがトーク一覧に切り替える
    window.location.hash = "";
  } else {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}
