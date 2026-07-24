// プロフィールモーダル（アイコン変更対応版）
// トーク画面で使われていた高機能版を、ドロワー・一覧・トークの全ページ共通で使用する

import { db } from "./firebase-init.js";
import { state } from "./state.js";
import { createAvatar } from "./avatar.js";
import { uploadImageToImgbb } from "./imgbb.js";

let profileModal,
  profileModalClose,
  profileAvatarWrap,
  profileAvatarHolder,
  profileAvatarInput,
  profileAvatarRemoveButton,
  profileName,
  profileNameInput,
  profileText,
  profileTextEdit,
  profileEditButton;

let isProfileEditing = false;
let currentProfileUserId = "";
let canEditCurrentProfile = false;
let profileAvatarCurrentUrl = "";
let profileAvatarFile = null;
let profileAvatarRemoved = false;
let initialized = false;

function initProfileModalOnce() {
  if (initialized) return;
  initialized = true;

  profileModal = document.getElementById("profile-modal");
  profileModalClose = document.getElementById("profile-modal-close");
  profileAvatarWrap = document.querySelector(".profile-avatar-wrap");
  profileAvatarHolder = document.getElementById("profile-avatar-holder");
  profileAvatarInput = document.getElementById("profile-avatar-input");
  profileAvatarRemoveButton = document.getElementById("profile-avatar-remove-button");
  profileName = document.getElementById("profile-name");
  profileNameInput = document.getElementById("profile-name-input");
  profileText = document.getElementById("profile-text");
  profileTextEdit = document.getElementById("profile-text-edit");
  profileEditButton = document.getElementById("profile-edit-button");

  profileModalClose.addEventListener("click", () => {
    profileModal.classList.add("hidden");
    resetProfileEditMode();
  });

  profileEditButton.addEventListener("click", handleProfileEditOrSave);

  // アイコンをタップ（編集モード中のみ有効）→ ファイル選択を開く
  profileAvatarHolder.addEventListener("click", () => {
    if (!isProfileEditing || !canEditCurrentProfile) return;
    profileAvatarInput.click();
  });

  // ファイルが選択されたらプレビューに反映（アップロードは保存時にまとめて行う）
  profileAvatarInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    profileAvatarFile = file;
    profileAvatarRemoved = false;

    const reader = new FileReader();
    reader.onload = (event) => {
      profileAvatarHolder.innerHTML = "";
      const img = document.createElement("img");
      img.classList.add("avatar-circle", "large");
      img.src = event.target.result;
      profileAvatarHolder.appendChild(img);
      profileAvatarRemoveButton.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });

  // 「画像を削除」→ プレビューを頭文字アバターに戻し、保存時に画像を消去
  profileAvatarRemoveButton.addEventListener("click", () => {
    profileAvatarFile = null;
    profileAvatarRemoved = true;
    profileAvatarInput.value = "";

    profileAvatarHolder.innerHTML = "";
    const nameForInitial = isProfileEditing ? profileNameInput.value : profileName.textContent;
    profileAvatarHolder.appendChild(createAvatar(nameForInitial, "large"));
    profileAvatarRemoveButton.classList.add("hidden");
  });
}

function resetProfileEditMode() {
  isProfileEditing = false;
  if (profileEditButton) {
    profileEditButton.textContent = "プロフィールを編集";
    profileEditButton.disabled = false;
  }
  if (profileName) profileName.classList.remove("hidden");
  if (profileNameInput) profileNameInput.classList.add("hidden");
  if (profileText) profileText.classList.remove("hidden");
  if (profileTextEdit) profileTextEdit.classList.add("hidden");
  if (profileModalClose) profileModalClose.classList.remove("hidden");

  if (profileAvatarWrap) profileAvatarWrap.classList.remove("editable");
  if (profileAvatarRemoveButton) profileAvatarRemoveButton.classList.add("hidden");
  profileAvatarFile = null;
  profileAvatarRemoved = false;
  if (profileAvatarHolder && profileName) {
    profileAvatarHolder.innerHTML = "";
    profileAvatarHolder.appendChild(createAvatar(profileName.textContent, "large", profileAvatarCurrentUrl));
  }
}

// 編集ボタン・保存ボタンが押された時の処理
async function handleProfileEditOrSave() {
  if (!isProfileEditing) {
    isProfileEditing = true;
    profileEditButton.textContent = "プロフィールを保存";

    let currentName = profileName.textContent;
    let currentText = profileText.textContent;

    if (currentText === "ステータスメッセージはありません。" || currentText === "取得中...") currentText = "";
    if (currentName === "取得中..." || currentName === "不明なユーザー") currentName = "";

    profileName.classList.add("hidden");
    profileNameInput.classList.remove("hidden");
    profileNameInput.value = currentName;

    profileText.classList.add("hidden");
    profileTextEdit.classList.remove("hidden");
    profileTextEdit.value = currentText;

    if (canEditCurrentProfile) {
      profileAvatarWrap.classList.add("editable");
      if (profileAvatarCurrentUrl) {
        profileAvatarRemoveButton.classList.remove("hidden");
      }
    }
  } else {
    const newName = profileNameInput.value.trim();
    const newProfileText = profileTextEdit.value.trim();

    if (!newName) {
      alert("ユーザーネームを入力してください。");
      return;
    }

    profileEditButton.disabled = true;
    profileEditButton.textContent = "保存中...";
    profileModalClose.classList.add("hidden");

    try {
      let finalImageUrl = profileAvatarCurrentUrl;
      if (profileAvatarFile) {
        profileEditButton.textContent = "画像をアップロード中...";
        finalImageUrl = await uploadImageToImgbb(profileAvatarFile);
      } else if (profileAvatarRemoved) {
        finalImageUrl = "";
      }

      profileEditButton.textContent = "保存中...";

      await db.collection("users_random").doc(currentProfileUserId).set(
        {
          name: newName,
          profileText: newProfileText,
          imageUrl: finalImageUrl
        },
        { merge: true }
      );

      profileName.textContent = newName;
      profileText.textContent = newProfileText || "ステータスメッセージはありません。";
      profileAvatarCurrentUrl = finalImageUrl;
      profileAvatarFile = null;
      profileAvatarRemoved = false;
      profileAvatarHolder.innerHTML = "";
      profileAvatarHolder.appendChild(createAvatar(newName, "large", profileAvatarCurrentUrl));

      // 自分自身のプロフィールを更新した場合は、ドロワーの表示名も更新する
      if (currentProfileUserId === state.myUserId) {
        const drawerUsername = document.getElementById("drawerUsername");
        if (drawerUsername) drawerUsername.textContent = newName;
      }

      const userSnapshot = await db.collection("users_random").doc(currentProfileUserId).get();
      const isAdmin = userSnapshot.exists && !!userSnapshot.data().isAdmin;
      profileName.classList.toggle("admin", isAdmin);

      resetProfileEditMode();
      alert("プロフィールを保存しました。");
    } catch (error) {
      console.error("プロフィール保存エラー:", error);
      alert("プロフィールの保存に失敗しました: " + error.message);
      profileEditButton.disabled = false;
      profileEditButton.textContent = "プロフィールを保存";
    }
  }
}

// プロフィールモーダルを開いてFirebaseから最新のステメ等を取得する関数
// startEditModeがtrueの場合、ダイレクトに編集可能なテキストエリア等を開く
export async function openProfileModal(userId, startEditMode = false) {
  initProfileModalOnce();

  currentProfileUserId = userId;
  canEditCurrentProfile = state.meIsAdmin || userId === state.myUserId;
  resetProfileEditMode();

  profileName.textContent = "取得中...";
  profileName.classList.remove("admin");
  profileText.textContent = "取得中...";
  profileAvatarCurrentUrl = "";

  profileAvatarHolder.innerHTML = "";
  profileAvatarHolder.appendChild(createAvatar("", "large"));

  profileEditButton.classList.toggle("hidden", !canEditCurrentProfile);
  profileModal.classList.remove("hidden");

  try {
    const userSnapshot = await db.collection("users_random").doc(userId).get();
    if (userSnapshot.exists) {
      const userData = userSnapshot.data();
      profileName.textContent = userData.name || "名前未設定";
      profileName.classList.toggle("admin", !!userData.isAdmin);
      profileText.textContent = userData.profileText || "ステータスメッセージはありません。";
      profileAvatarCurrentUrl = userData.imageUrl || "";

      profileAvatarHolder.innerHTML = "";
      profileAvatarHolder.appendChild(createAvatar(profileName.textContent, "large", profileAvatarCurrentUrl));

      if (canEditCurrentProfile && startEditMode) {
        handleProfileEditOrSave();
      }
    } else {
      profileName.textContent = "不明なユーザー";
      profileText.textContent = "";
    }
  } catch (error) {
    console.error("プロフィール取得エラー:", error);
    profileName.textContent = "エラー";
    profileText.textContent = "プロフィールの取得に失敗しました。";
  }
}
