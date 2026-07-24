// アプリのエントリーポイント
// ログイン状態の監視と、URLの#(talkId)有無によるページの出し分け（ルーティング）を行う

import { auth, db } from "./firebase-init.js";
import { state } from "./state.js";
import { initDrawer, updateDrawerUserInfo } from "./drawer.js";
import { initShareModal } from "./share.js";
import { initLoginPage } from "./login.js";
import { initListPage, teardownListPage } from "./list.js";
import { initTalkPage, teardownTalkPage } from "./talk.js";
import { getHashTalkId } from "./utils.js";

let loadingOverlay, noActiveOverlay, settingButton;
let isLoggedIn = false;

document.addEventListener("DOMContentLoaded", () => {
  loadingOverlay = document.getElementById("loading-overlay");
  noActiveOverlay = document.getElementById("no-active-overlay");
  settingButton = document.getElementById("setting-button");

  initDrawer();
  initShareModal();
  initLoginPage();
  updateHeaderHeightVar();

  window.addEventListener("resize", updateHeaderHeightVar);
  const header = document.getElementById("app-header");
  if (header && window.ResizeObserver) {
    new ResizeObserver(() => updateHeaderHeightVar()).observe(header);
  }
});

// スマホでヘッダー分の高さを避けて #head-area を固定表示するため、
// ヘッダーの実測高さを CSS 変数 --header-height に反映する
function updateHeaderHeightVar() {
  const header = document.getElementById("app-header");
  if (header) {
    document.documentElement.style.setProperty("--header-height", header.offsetHeight + "px");
  }
}

window.addEventListener("hashchange", () => {
  if (isLoggedIn) route();
});

auth.onAuthStateChanged(async (user) => {
  try {
    if (user) {
      state.myUserId = user.email.split("@")[0];

      const userSnapshot = await db.collection("users_random").doc(state.myUserId).get();
      const userData = userSnapshot.data();

      if (userData && userData.isActive) {
        state.myUid = userData.uid;
        state.meIsAdmin = !!userData.isAdmin;

        updateDrawerUserInfo(userData.name, state.meIsAdmin);
        settingButton.classList.remove("hidden");

        isLoggedIn = true;
        loadingOverlay.classList.add("hidden");
        noActiveOverlay.classList.add("hidden");

        route();
      } else {
        isLoggedIn = false;
        loadingOverlay.classList.add("hidden");
        noActiveOverlay.classList.remove("hidden");
        hideAllPages();
      }
    } else {
      isLoggedIn = false;
      state.myUserId = "";
      state.myUid = "";
      state.meIsAdmin = false;

      teardownListPage();
      teardownTalkPage();
      settingButton.classList.add("hidden");

      loadingOverlay.classList.add("hidden");
      noActiveOverlay.classList.add("hidden");
      showPage("login");
    }
  } catch (error) {
    console.error(error);
    alert(error);
  }
});

// URLのハッシュを見て「トーク一覧」か「トーク画面」かを切り替える
function route() {
  const talkId = getHashTalkId();

  if (talkId) {
    teardownListPage();
    showPage("talk");
    initTalkPage(talkId);
  } else {
    teardownTalkPage();
    showPage("list");
    initListPage();
  }
}

function showPage(pageName) {
  ["login", "list", "talk"].forEach((p) => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle("hidden", p !== pageName);
  });
}

function hideAllPages() {
  ["login", "list", "talk"].forEach((p) => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.add("hidden");
  });
}
