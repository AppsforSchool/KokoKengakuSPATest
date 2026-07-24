// シェアモーダル（全ページ共通）

export function initShareModal() {
  const shareModalBtn = document.getElementById("share-modal-btn");
  const shareModal = document.getElementById("share-modal");
  const shareModalClose = document.getElementById("share-modal-close");

  shareModalBtn.addEventListener("click", () => {
    shareModal.classList.remove("hidden");
  });
  shareModalClose.addEventListener("click", () => {
    shareModal.classList.add("hidden");
  });
}
