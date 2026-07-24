// アカウント設定ドロワー（プロフィール編集ボタン含む・全ページ共通）

import { auth } from "./firebase-init.js";
import { state } from "./state.js";
import { openProfileModal } from "./profile.js";

let drawerOverlay,
  accountSettingsDrawer,
  drawerCloseButton,
  accountSettingsButton,
  drawerUserId,
  drawerLogoutButton,
  drawerUsername,
  drawerEditProfileButton;

export function initDrawer() {
  drawerOverlay = document.getElementById("drawerOverlay");
  accountSettingsDrawer = document.getElementById("accountSettingsDrawer");
  drawerCloseButton = document.getElementById("drawerCloseButton");
  accountSettingsButton = document.getElementById("setting-button");

  drawerUserId = document.getElementById("drawerUserId");
  drawerLogoutButton = document.getElementById("logout-button");
  drawerUsername = document.getElementById("drawerUsername");
  drawerEditProfileButton = document.getElementById("drawer-edit-profile-button");

  accountSettingsButton.addEventListener("click", openDrawer);
  drawerCloseButton.addEventListener("click", closeDrawer);
  drawerOverlay.addEventListener("click", closeDrawer);
  drawerLogoutButton.addEventListener("click", handleLogout);

  // ドロワー内の「プロフィールを編集」ボタン（トーク画面版の編集モーダルを使用）
  drawerEditProfileButton.addEventListener("click", () => {
    closeDrawer();
    openProfileModal(state.myUserId, true);
  });
}

export function openDrawer() {
  accountSettingsDrawer.classList.add("is-open");
  drawerOverlay.classList.add("is-open");
}

export function closeDrawer() {
  accountSettingsDrawer.classList.remove("is-open");
  drawerOverlay.classList.remove("is-open");
}

export function updateDrawerUserInfo(name, isAdmin) {
  drawerUserId.textContent = state.myUserId;
  drawerUsername.textContent = name;
  drawerUsername.classList.toggle("admin", !!isAdmin);
}

async function handleLogout() {
  const isConfirmed = confirm("ログアウトしますか？");
  if (isConfirmed) {
    try {
      await auth.signOut();
      alert("ログアウトしました。");
    } catch (error) {
      console.error("ログアウトエラー:", error);
      alert("ログアウトに失敗しました。");
    }
  }
}
