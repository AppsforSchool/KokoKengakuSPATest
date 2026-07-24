import { db } from "./firebase-init.js";

// ImgBBへの画像アップロード共通処理（チャット画像・プロフィールアイコン共通で使用）
let imgbbApiKeyCache = null;

export async function uploadImageToImgbb(file) {
  if (!imgbbApiKeyCache) {
    const keyDoc = await db.collection("system_keys").doc("imgbb").get();
    if (!keyDoc.exists) {
      throw new Error("APIキーの設定が見つかりません。セキュリティルールかドキュメントを確認してください。");
    }
    imgbbApiKeyCache = keyDoc.data().apiKey;
  }

  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKeyCache}`, {
    method: "POST",
    body: formData
  });

  const result = await response.json();
  if (!result.success) {
    throw new Error("ImgBBのアップロード処理に失敗しました。");
  }
  return result.data.url;
}
