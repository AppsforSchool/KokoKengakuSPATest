// トーク一覧ページ専用の機能

import { db } from "./firebase-init.js";
import { state } from "./state.js";
import { navigateToTalk } from "./utils.js";

let talkListenerUnsubscribe = null;
let talkButtonArea, talkButtonLoading;

export function initListPage() {
  teardownListPage();

  talkButtonArea = document.getElementById("talk-button-area");
  talkButtonLoading = document.getElementById("talk-button-loading");

  talkButtonArea.innerHTML = "";
  talkButtonArea.classList.add("hidden");
  talkButtonLoading.classList.remove("hidden");

  getAllTalkData();
}

export function teardownListPage() {
  if (talkListenerUnsubscribe) {
    talkListenerUnsubscribe();
    talkListenerUnsubscribe = null;
  }
}

function getAllTalkData() {
  try {
    let query = db.collection("KokoKengaku");

    if (!state.meIsAdmin) {
      // 一般ユーザーの場合は、自分がメンバーに含まれるルームのみに絞り込む
      query = query.where("members", "array-contains", state.myUserId);
    }

    talkListenerUnsubscribe = query.onSnapshot(
      async (talkSnapshot) => {
        // ユーザーの最新の lastChecked を取得
        const userSnapshot = await db.collection("users_random").doc(state.myUserId).get();
        const userData = userSnapshot.data() || {};
        const lastCheckedMap = userData.lastChecked || {};

        // 変化（追加・修正・削除）があった差分だけをループ処理する
        talkSnapshot.docChanges().forEach((change) => {
          const talkDoc = change.doc;
          const roomId = talkDoc.id;
          const roomData = talkDoc.data();

          if (change.type === "added") {
            if (document.getElementById(`room-${roomId}`)) return;

            const talkButton = document.createElement("div");
            talkButton.classList.add("talk-button");
            talkButton.id = `room-${roomId}`;
            talkButton.addEventListener("click", () => {
              navigateToTalk(roomId);
            });

            const titleArea = document.createElement("p");
            titleArea.classList.add("title");
            titleArea.textContent = roomData.title;

            const newMessageArea = document.createElement("p");
            newMessageArea.classList.add("new-message");
            newMessageArea.id = `unread-${roomId}`;
            newMessageArea.textContent = "取得中...";

            talkButton.appendChild(titleArea);
            talkButton.appendChild(newMessageArea);
            talkButtonArea.appendChild(talkButton);

            updateSingleRoomUnread(roomId, lastCheckedMap[roomId]);
          }

          if (change.type === "modified") {
            const talkButton = document.getElementById(`room-${roomId}`);
            if (talkButton) {
              const titleArea = talkButton.querySelector(".title");
              if (titleArea) titleArea.textContent = roomData.title;
              updateSingleRoomUnread(roomId, lastCheckedMap[roomId]);
            }
          }

          if (change.type === "removed") {
            const talkButton = document.getElementById(`room-${roomId}`);
            if (talkButton) talkButton.remove();
          }
        });

        talkButtonLoading.classList.add("hidden");
        talkButtonArea.classList.remove("hidden");
      },
      (error) => {
        console.error("リアルタイムリスナーエラー:", error);
      }
    );
  } catch (error) {
    console.error("データ取得エラー:", error);
    alert(error);
  }
}

async function updateSingleRoomUnread(roomId, lastCheckedTimestamp) {
  const newMessageArea = document.getElementById(`unread-${roomId}`);
  if (!newMessageArea) return;

  const lastCheckedTime = lastCheckedTimestamp ? lastCheckedTimestamp.toDate() : new Date(0);

  try {
    const unreadSnapshot = await db
      .collection("KokoKengaku")
      .doc(roomId)
      .collection("talk")
      .where("time", ">", lastCheckedTime)
      .get();

    const unreadCount = unreadSnapshot.size;
    newMessageArea.textContent = `新着: ${unreadCount}件`;
    newMessageArea.classList.toggle("no-message", unreadCount === 0);
  } catch (error) {
    console.error(`未読数更新エラー [Room: ${roomId}]:`, error);
  }
}
