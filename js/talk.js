// トーク画面（チャットルーム）専用の機能

import { db } from "./firebase-init.js";
import { state } from "./state.js";
import { createAvatar } from "./avatar.js";
import { formatDateTime, sanitizeHtmlToOnlyLinks, navigateToList } from "./utils.js";
import { uploadImageToImgbb } from "./imgbb.js";
import { openProfileModal } from "./profile.js";

const POLL_MIN_CHOICES = 2;
const POLL_MAX_CHOICES = 10;

let talkId = null;

// ユーザーデータの統一キャッシュ（name / isAdmin / imageUrl / profileText をまとめて保持）
let userDataCache = {};
function getUserCache(userId) {
  return userDataCache[userId] || null;
}
function setUserCache(userId, data) {
  userDataCache[userId] = Object.assign({}, userDataCache[userId] || {}, data);
  return userDataCache[userId];
}
let userLastCheckedCache = {};
let currentRoomMembers = [];
let memberSubscribers = [];
let messageListenerUnsubscribe = null;
let editingMessageId = null;
let selectedImageFile = null;

// DOM要素
let talkTitleEl, talkAreaEl;
let toHomeButton, memberButton, memberModal, memberModalClose, memberArea;
let readModal, readModalClose, readArea;
let editModal, editModalClose, newUserIdInput, newMessageInput, newMessageChangeButton, messageDeleteButton;
let messageInput, messageAddButton;
let imageUploadModal,
  openImageModalBtn,
  imageModalClose,
  modalImageInput,
  selectImageBtn,
  imagePreviewContainer,
  imagePreview,
  imageMessageInput,
  submitImageBtn;
let pollCreateModal,
  pollCreateModalClose,
  openPollModalBtn,
  pollQuestionInput,
  pollChoicesList,
  pollAddChoiceButton,
  pollSubmitButton;
let pollVotersModal, pollVotersModalClose, pollVotersTitle, pollVotersArea;

let domInitialized = false;

export async function initTalkPage(newTalkId) {
  teardownTalkPage();
  talkId = newTalkId;

  initDomOnce();

  talkTitleEl.textContent = "loading...";
  talkAreaEl.innerHTML = "<p>loading...</p>";
  messageInput.value = "";
  updateMessageAddButtonState();

  await setupMemberSnapshots(talkId);
  await getAllTalkData(talkId);
}

export function teardownTalkPage() {
  if (messageListenerUnsubscribe) {
    messageListenerUnsubscribe();
    messageListenerUnsubscribe = null;
  }
  memberSubscribers.forEach((unsub) => unsub());
  memberSubscribers = [];
  currentRoomMembers = [];
  talkId = null;
}

function initDomOnce() {
  if (domInitialized) return;
  domInitialized = true;

  talkTitleEl = document.getElementById("talk-title");
  talkAreaEl = document.getElementById("talk-area");

  toHomeButton = document.getElementById("to-home-button");
  toHomeButton.addEventListener("click", () => navigateToList());

  memberButton = document.getElementById("member-button");
  memberModal = document.getElementById("member-modal");
  memberModalClose = document.getElementById("member-modal-close");
  memberArea = document.getElementById("member-area");

  memberButton.addEventListener("click", () => {
    memberModal.classList.remove("hidden");
    if (talkId) getMember(talkId);
  });
  memberModalClose.addEventListener("click", () => {
    memberModal.classList.add("hidden");
  });

  readModal = document.getElementById("read-modal");
  readModalClose = document.getElementById("read-modal-close");
  readArea = document.getElementById("read-area");
  readModalClose.addEventListener("click", () => {
    readModal.classList.add("hidden");
  });

  editModal = document.getElementById("edit-modal");
  editModalClose = document.getElementById("edit-modal-close");
  newUserIdInput = document.getElementById("new-userId-input");
  newMessageInput = document.getElementById("new-message-input");
  newMessageChangeButton = document.getElementById("new-message-change-button");
  messageDeleteButton = document.getElementById("message-delete-button");

  editModalClose.addEventListener("click", () => {
    editModal.classList.add("hidden");
  });
  newMessageChangeButton.addEventListener("click", async () => {
    await newMessageChange(editingMessageId, newUserIdInput.value, newMessageInput.value);
  });
  messageDeleteButton.addEventListener("click", async () => {
    if (window.confirm("本当に削除しますか？")) {
      await messageDelete(editingMessageId);
    }
  });

  messageInput = document.getElementById("message-input");
  messageAddButton = document.getElementById("message-add-button");
  messageInput.addEventListener("input", updateMessageAddButtonState);
  messageAddButton.addEventListener("click", async () => {
    await addMessage(talkId);
  });

  imageUploadModal = document.getElementById("image-upload-modal");
  openImageModalBtn = document.getElementById("open-image-modal-button");
  imageModalClose = document.getElementById("image-modal-close");
  modalImageInput = document.getElementById("modal-image-input");
  selectImageBtn = document.getElementById("select-image-button");
  imagePreviewContainer = document.getElementById("image-preview-container");
  imagePreview = document.getElementById("image-preview");
  imageMessageInput = document.getElementById("image-message-input");
  submitImageBtn = document.getElementById("submit-image-button");

  openImageModalBtn.addEventListener("click", () => {
    selectedImageFile = null;
    modalImageInput.value = "";
    imagePreview.src = "";
    imagePreviewContainer.classList.add("hidden");
    submitImageBtn.disabled = true;
    submitImageBtn.textContent = "画像を送信";
    imageModalClose.classList.remove("hidden");
    selectImageBtn.disabled = false;
    imageMessageInput.disabled = false;
    imageUploadModal.classList.remove("hidden");
  });
  imageModalClose.addEventListener("click", () => {
    imageUploadModal.classList.add("hidden");
  });
  selectImageBtn.addEventListener("click", () => {
    modalImageInput.click();
  });
  modalImageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    selectedImageFile = file;

    const reader = new FileReader();
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreviewContainer.classList.remove("hidden");
      submitImageBtn.disabled = false;
    };
    reader.readAsDataURL(file);
  });
  submitImageBtn.addEventListener("click", async () => {
    if (!selectedImageFile) return;

    submitImageBtn.disabled = true;
    imageModalClose.classList.add("hidden");
    selectImageBtn.disabled = true;
    submitImageBtn.textContent = "画像をアップロード中...";
    imageMessageInput.disabled = true;

    try {
      const imageUrl = await uploadImageToImgbb(selectedImageFile);

      await db.collection("KokoKengaku").doc(talkId).collection("talk").add({
        userId: state.myUserId,
        message: imageMessageInput.value,
        imageUrl: imageUrl,
        readBy: [],
        time: firebase.firestore.FieldValue.serverTimestamp()
      });

      await db.collection("KokoKengaku").doc(talkId).update({
        lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      imageUploadModal.classList.add("hidden");
      imageMessageInput.value = "";
    } catch (error) {
      console.error("画像送信中にエラーが発生しました:", error);
      alert("画像の送信に失敗しました。\n" + error.message);

      submitImageBtn.disabled = false;
      submitImageBtn.textContent = "画像を送信";
      imageModalClose.classList.remove("hidden");
      selectImageBtn.disabled = false;
      imageMessageInput.disabled = false;
    }
  });

  pollCreateModal = document.getElementById("poll-create-modal");
  pollCreateModalClose = document.getElementById("poll-create-modal-close");
  openPollModalBtn = document.getElementById("open-poll-modal-button");
  pollQuestionInput = document.getElementById("poll-question-input");
  pollChoicesList = document.getElementById("poll-choices-list");
  pollAddChoiceButton = document.getElementById("poll-add-choice-button");
  pollSubmitButton = document.getElementById("poll-submit-button");

  openPollModalBtn.addEventListener("click", () => {
    resetPollCreateForm();
    pollCreateModal.classList.remove("hidden");
  });
  pollCreateModalClose.addEventListener("click", () => {
    pollCreateModal.classList.add("hidden");
  });
  pollQuestionInput.addEventListener("input", updatePollSubmitState);
  pollAddChoiceButton.addEventListener("click", () => addPollChoiceRow());
  pollSubmitButton.addEventListener("click", submitPoll);

  pollVotersModal = document.getElementById("poll-voters-modal");
  pollVotersModalClose = document.getElementById("poll-voters-modal-close");
  pollVotersTitle = document.getElementById("poll-voters-title");
  pollVotersArea = document.getElementById("poll-voters-area");
  pollVotersModalClose.addEventListener("click", () => {
    pollVotersModal.classList.add("hidden");
  });
}

// ★ ルームメンバーの情報を裏側でリアルタイムに監視してキャッシュを更新する関数
async function setupMemberSnapshots(id) {
  try {
    const roomSnapshot = await db.collection("KokoKengaku").doc(id).get();
    if (!roomSnapshot.exists) return;

    const roomData = roomSnapshot.data();
    const memberUserIds = roomData.members || [];
    currentRoomMembers = memberUserIds;

    memberSubscribers.forEach((unsub) => unsub());
    memberSubscribers = [];

    memberUserIds.forEach((userId) => {
      const unsub = db.collection("users_random").doc(userId).onSnapshot((doc) => {
        if (doc.exists) {
          const userData = doc.data();

          setUserCache(userId, {
            name: userData.name || "名前未設定",
            isAdmin: userData.isAdmin || false,
            imageUrl: userData.imageUrl || "",
            profileText: userData.profileText || ""
          });

          if (!userLastCheckedCache[userId]) {
            userLastCheckedCache[userId] = {};
          }

          if (userData.lastChecked && userData.lastChecked[id]) {
            userLastCheckedCache[userId][id] = formatDateTime(userData.lastChecked[id].toDate());
          } else {
            userLastCheckedCache[userId][id] = "";
          }

          if (memberModal && !memberModal.classList.contains("hidden")) {
            getMember(id);
          }
        }
      });
      memberSubscribers.push(unsub);
    });
  } catch (error) {
    console.error("メンバーの監視設定に失敗しました:", error);
  }
}

async function getAllTalkData(id) {
  try {
    const roomSnapshot = await db.collection("KokoKengaku").doc(id).get();
    const roomData = roomSnapshot.data();
    talkTitleEl.textContent = roomData.title;

    db.collection("users_random")
      .doc(state.myUserId)
      .update({ [`unreadCounts.${id}`]: 0 })
      .catch((err) => console.error("未読リセットエラー:", err));

    messageListenerUnsubscribe = db
      .collection("KokoKengaku")
      .doc(id)
      .collection("talk")
      .orderBy("time", "asc")
      .onSnapshot(async (messageSnapshot) => {
        const newTalk = document.createElement("div");

        for (const talkDoc of messageSnapshot.docs) {
          const messageData = talkDoc.data();
          const message = document.createElement("div");
          message.classList.add("message");

          const messageUserId = messageData.userId;
          const isOwnMessage = messageUserId === state.myUserId;
          message.classList.add(isOwnMessage ? "message-own" : "message-other");

          const messageUser = document.createElement("p");
          let senderName = "不明なユーザー";
          let isAdmin = false;
          let senderImageUrl = "";

          if (messageUserId) {
            if (!getUserCache(messageUserId)) {
              const userSnapshot = await db.collection("users_random").doc(messageUserId).get();

              if (userSnapshot.exists) {
                const userData = userSnapshot.data();
                setUserCache(messageUserId, {
                  name: userData.name || "名前未設定",
                  isAdmin: userData.isAdmin || false,
                  imageUrl: userData.imageUrl || "",
                  profileText: userData.profileText || ""
                });
              } else {
                setUserCache(messageUserId, { name: "不明なユーザー", isAdmin: false, imageUrl: "", profileText: "" });
              }
            }
            const cached = getUserCache(messageUserId);
            senderName = cached.name;
            isAdmin = cached.isAdmin;
            senderImageUrl = cached.imageUrl;
          }

          let displayTime = "時間不明";
          if (messageData.time) {
            displayTime = formatDateTime(messageData.time.toDate());
          }

          const readByList = messageData.readBy || [];
          if (messageData.userId !== state.myUserId && !readByList.includes(state.myUserId)) {
            db.collection("KokoKengaku")
              .doc(id)
              .collection("talk")
              .doc(talkDoc.id)
              .update({
                readBy: firebase.firestore.FieldValue.arrayUnion(state.myUserId)
              })
              .catch((err) => console.error("既読更新エラー:", err));
          }

          const readSpan = document.createElement("span");
          readSpan.textContent = `既読:${readByList.length}人`;
          readSpan.style.textDecoration = "underline";
          readSpan.style.cursor = "pointer";
          readSpan.addEventListener("click", () => openReadByModal(readByList));

          const senderNameSpan = document.createElement("span");
          senderNameSpan.textContent = `${senderName} `;
          senderNameSpan.classList.add("clickable-user");
          senderNameSpan.addEventListener("click", () => openProfileModal(messageUserId));
          if (isAdmin) senderNameSpan.classList.add("admin");

          const displayTimeSpan = document.createElement("span");
          displayTimeSpan.textContent = `${displayTime} `;

          messageUser.classList.add("message-user");

          const editSpan = document.createElement("span");
          editSpan.textContent = "編集";
          editSpan.style.textDecoration = "underline";
          editSpan.style.cursor = "pointer";
          editSpan.addEventListener("click", () => {
            openEditModal(talkDoc.id, messageData.userId, messageData.message);
          });

          // 自分の発言では吹き出しの上に自分の名前を出さない（相手の発言のみ表示）
          if (!isOwnMessage) {
            messageUser.appendChild(senderNameSpan);
          }
          messageUser.appendChild(displayTimeSpan);
          messageUser.appendChild(readSpan);
          if (state.meIsAdmin || messageData.userId === state.myUserId) {
            messageUser.appendChild(document.createTextNode(" "));
            messageUser.appendChild(editSpan);
          }

          const bubbleCol = document.createElement("div");
          bubbleCol.classList.add("bubble-col");
          bubbleCol.appendChild(messageUser);

          if (messageData.imageUrl) {
            const img = document.createElement("img");
            img.src = messageData.imageUrl;
            img.alt = "送信された画像";
            img.classList.add("message-image");

            img.addEventListener("load", () => {
              img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
              img.classList.add("loaded");
            });

            bubbleCol.appendChild(img);
          }

          if (messageData.message && messageData.message.trim() !== "") {
            const messageText = document.createElement("p");
            messageText.classList.add("message-text");
            messageText.appendChild(sanitizeHtmlToOnlyLinks(messageData.message));
            bubbleCol.appendChild(messageText);
          }

          if (Array.isArray(messageData.choices) && messageData.choices.length > 0) {
            bubbleCol.appendChild(buildPollWidget(talkDoc.id, messageData.choices, messageData.answer || {}));
          }

          const messageRow = document.createElement("div");
          messageRow.classList.add("message-row");
          if (!isOwnMessage) {
            const rowAvatar = createAvatar(senderName, undefined, senderImageUrl);
            rowAvatar.classList.add("clickable-user");
            rowAvatar.addEventListener("click", () => openProfileModal(messageUserId));
            messageRow.appendChild(rowAvatar);
          }
          messageRow.appendChild(bubbleCol);

          message.appendChild(messageRow);
          newTalk.appendChild(message);
        }

        talkAreaEl.innerHTML = "";
        talkAreaEl.appendChild(newTalk);
        talkAreaEl.scrollTop = talkAreaEl.scrollHeight;

        updateLastCheckedTime(id);
      });
  } catch (error) {
    console.error("データ取得エラー:", error);
    alert(error);
  }
}

// ★ ルームの members リストに入っている人のみを表示する
function getMember(id) {
  memberArea.innerHTML = "";
  const isMeAdmin = state.meIsAdmin;

  for (const userId of currentRoomMembers) {
    const cached = getUserCache(userId) || {};
    const memberName = cached.name || "不明なユーザー";
    const isAdmin = cached.isAdmin || false;
    const memberImageUrl = cached.imageUrl || "";
    let lastCheckedTimeStr = "";

    if (userLastCheckedCache[userId] && userLastCheckedCache[userId][id]) {
      lastCheckedTimeStr = userLastCheckedCache[userId][id];
    }

    const memberElement = document.createElement("div");
    memberElement.classList.add("member-item");
    if (isAdmin) memberElement.classList.add("admin");

    const memberLeft = document.createElement("div");
    memberLeft.classList.add("member-left", "clickable-user");
    memberLeft.style.cursor = "pointer";

    memberLeft.appendChild(createAvatar(memberName, "small", memberImageUrl));

    const nameSpan = document.createElement("span");
    nameSpan.classList.add("member-name");
    nameSpan.textContent = memberName;
    memberLeft.appendChild(nameSpan);

    memberLeft.addEventListener("click", () => openProfileModal(userId));

    memberElement.appendChild(memberLeft);

    if (isMeAdmin) {
      const timeSpan = document.createElement("span");
      timeSpan.classList.add("member-last-checked");
      timeSpan.textContent = lastCheckedTimeStr || "未確認";
      memberElement.appendChild(timeSpan);
    }

    memberArea.appendChild(memberElement);
  }
}

async function updateLastCheckedTime(id) {
  try {
    await db
      .collection("users_random")
      .doc(state.myUserId)
      .set(
        {
          lastChecked: { [id]: firebase.firestore.FieldValue.serverTimestamp() }
        },
        { merge: true }
      );
  } catch (error) {
    console.error("最終確認時刻の更新に失敗:", error);
  }
}

function openEditModal(thisMessageId, messageUserId, messageText) {
  editingMessageId = thisMessageId;
  newUserIdInput.value = messageUserId;
  newMessageInput.value = messageText;

  newUserIdInput.disabled = !state.meIsAdmin;
  messageDeleteButton.disabled = !state.meIsAdmin;

  editModal.classList.remove("hidden");
}

async function newMessageChange(id, newUserId, newMessage) {
  try {
    await db.collection("KokoKengaku").doc(talkId).collection("talk").doc(id).update({
      userId: newUserId,
      message: newMessage
    });
    alert("変更しました。");
  } catch (error) {
    alert(error);
    console.error(error);
  }
}

async function messageDelete(id) {
  try {
    await db.collection("KokoKengaku").doc(talkId).collection("talk").doc(id).delete();
    editModal.classList.add("hidden");
    alert("削除しました。");
  } catch (error) {
    alert(error);
    console.error(error);
  }
}

function updateMessageAddButtonState() {
  messageAddButton.disabled = !(messageInput && messageInput.value.trim() !== "");
}

async function addMessage(id) {
  const message = messageInput.value.trim();
  messageAddButton.disabled = true;
  messageAddButton.textContent = "送信中...";

  try {
    await db.collection("KokoKengaku").doc(id).collection("talk").add({
      userId: state.myUserId,
      message: message,
      readBy: [],
      time: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection("KokoKengaku").doc(id).update({
      lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.log(error);
  } finally {
    messageAddButton.textContent = "送信";
    messageInput.value = "";
    updateMessageAddButtonState();
  }
}

// ★ 既読モーダル
async function openReadByModal(readByList) {
  readArea.innerHTML = "読み込み中...";
  readModal.classList.remove("hidden");

  const fragment = document.createDocumentFragment();

  for (const userId of readByList) {
    let cached = getUserCache(userId);

    if (!cached) {
      try {
        const userSnapshot = await db.collection("users_random").doc(userId).get();
        if (userSnapshot.exists) {
          const userData = userSnapshot.data();
          cached = setUserCache(userId, {
            name: userData.name || "名前未設定",
            isAdmin: userData.isAdmin || false,
            imageUrl: userData.imageUrl || "",
            profileText: userData.profileText || ""
          });
        } else {
          cached = setUserCache(userId, { name: "不明なユーザー", isAdmin: false, imageUrl: "", profileText: "" });
        }
      } catch (e) {
        console.error(e);
        cached = { name: "不明なユーザー", isAdmin: false, imageUrl: "" };
      }
    }

    const p = document.createElement("p");
    p.classList.add("clickable-user");
    p.style.cursor = "pointer";
    p.appendChild(createAvatar(cached.name, "small", cached.imageUrl));
    const nameSpan = document.createElement("span");
    nameSpan.textContent = cached.name;
    if (cached.isAdmin) nameSpan.classList.add("admin");
    p.appendChild(nameSpan);

    p.addEventListener("click", () => openProfileModal(userId));

    fragment.appendChild(p);
  }

  readArea.innerHTML = "";
  readArea.appendChild(fragment);
}

// ================================
// ★ アンケート機能
// ================================

function addPollChoiceRow(prefillValue) {
  if (pollChoicesList.children.length >= POLL_MAX_CHOICES) return;

  const row = document.createElement("div");
  row.classList.add("poll-choice-row");

  const input = document.createElement("input");
  input.type = "text";
  input.classList.add("poll-choice-input");
  input.maxLength = 100;
  input.value = prefillValue || "";
  input.addEventListener("input", updatePollSubmitState);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.classList.add("poll-choice-remove");
  removeBtn.textContent = "×";
  removeBtn.setAttribute("aria-label", "選択肢を削除");
  removeBtn.addEventListener("click", () => {
    if (pollChoicesList.children.length <= POLL_MIN_CHOICES) return;
    row.remove();
    renumberPollChoicePlaceholders();
    updatePollAddButtonState();
    updatePollRemoveButtonsVisibility();
    updatePollSubmitState();
  });

  row.appendChild(input);
  row.appendChild(removeBtn);
  pollChoicesList.appendChild(row);

  renumberPollChoicePlaceholders();
  updatePollAddButtonState();
  updatePollRemoveButtonsVisibility();
}

function renumberPollChoicePlaceholders() {
  const inputs = pollChoicesList.querySelectorAll(".poll-choice-input");
  inputs.forEach((input, index) => {
    input.placeholder = `選択肢 ${index + 1}`;
  });
}

function updatePollRemoveButtonsVisibility() {
  const canRemove = pollChoicesList.children.length > POLL_MIN_CHOICES;
  pollChoicesList.querySelectorAll(".poll-choice-remove").forEach((btn) => {
    btn.classList.toggle("hidden", !canRemove);
  });
}

function updatePollAddButtonState() {
  pollAddChoiceButton.disabled = pollChoicesList.children.length >= POLL_MAX_CHOICES;
}

function updatePollSubmitState() {
  const hasQuestion = pollQuestionInput.value.trim() !== "";
  const filledChoices = Array.from(pollChoicesList.querySelectorAll(".poll-choice-input")).filter(
    (input) => input.value.trim() !== ""
  ).length;
  pollSubmitButton.disabled = !(hasQuestion && filledChoices >= POLL_MIN_CHOICES);
}

function resetPollCreateForm() {
  pollQuestionInput.value = "";
  pollChoicesList.innerHTML = "";
  for (let i = 0; i < POLL_MIN_CHOICES; i++) {
    addPollChoiceRow();
  }
  updatePollSubmitState();
}

async function submitPoll() {
  const question = pollQuestionInput.value.trim();
  const choices = Array.from(pollChoicesList.querySelectorAll(".poll-choice-input"))
    .map((input) => input.value.trim())
    .filter((value) => value !== "")
    .slice(0, POLL_MAX_CHOICES);

  if (!question || choices.length < POLL_MIN_CHOICES) return;

  pollSubmitButton.disabled = true;
  pollSubmitButton.textContent = "送信中...";

  try {
    await db.collection("KokoKengaku").doc(talkId).collection("talk").add({
      userId: state.myUserId,
      message: question,
      choices: choices,
      answer: {},
      readBy: [],
      time: firebase.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("KokoKengaku").doc(talkId).update({
      lastUpdatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    pollCreateModal.classList.add("hidden");
    resetPollCreateForm();
  } catch (error) {
    console.error("アンケート送信中にエラーが発生しました:", error);
    alert("アンケートの送信に失敗しました。\n" + error.message);
  } finally {
    pollSubmitButton.textContent = "アンケートを送信";
    updatePollSubmitState();
  }
}

function buildPollWidget(messageDocId, choices, answerMap) {
  const widget = document.createElement("div");
  widget.classList.add("poll-widget");

  const scroll = document.createElement("div");
  scroll.classList.add("poll-choices-scroll");

  const hasMyAnswer = Object.prototype.hasOwnProperty.call(answerMap, state.myUserId);
  const myAnswerIndex = hasMyAnswer ? answerMap[state.myUserId] : null;
  const radioGroupName = `poll-${messageDocId}`;

  const answerButton = document.createElement("button");
  answerButton.type = "button";
  answerButton.classList.add("poll-answer-button");
  answerButton.textContent = hasMyAnswer ? "再回答する" : "答える";
  answerButton.disabled = true;

  choices.forEach((choiceLabel, index) => {
    const count = Object.values(answerMap).filter((v) => v === index).length;

    const optionLabel = document.createElement("label");
    optionLabel.classList.add("poll-choice-option");

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = radioGroupName;
    radio.value = String(index);
    if (myAnswerIndex === index) radio.checked = true;
    radio.addEventListener("change", () => {
      answerButton.disabled = index === myAnswerIndex;
    });

    const labelSpan = document.createElement("span");
    labelSpan.classList.add("poll-choice-label");
    labelSpan.textContent = choiceLabel;

    const countSpan = document.createElement("span");
    countSpan.classList.add("poll-choice-count");
    countSpan.textContent = `${count}人`;
    countSpan.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openPollVotersModal(answerMap, index, choiceLabel);
    });

    optionLabel.appendChild(radio);
    optionLabel.appendChild(labelSpan);
    optionLabel.appendChild(countSpan);
    scroll.appendChild(optionLabel);
  });

  widget.appendChild(scroll);

  answerButton.addEventListener("click", async () => {
    const checked = scroll.querySelector(`input[name="${radioGroupName}"]:checked`);
    if (!checked) return;

    const selectedIndex = Number(checked.value);
    const originalText = answerButton.textContent;
    answerButton.disabled = true;
    answerButton.textContent = "送信中...";

    try {
      await db
        .collection("KokoKengaku")
        .doc(talkId)
        .collection("talk")
        .doc(messageDocId)
        .update({
          [`answer.${state.myUserId}`]: selectedIndex
        });
    } catch (error) {
      console.error("回答の送信に失敗しました:", error);
      alert("回答の送信に失敗しました。\n" + error.message);
      answerButton.disabled = false;
      answerButton.textContent = originalText;
    }
    // 成功時はメッセージ一覧のリアルタイム再描画で新しい状態に置き換わる
  });

  widget.appendChild(answerButton);

  return widget;
}

async function openPollVotersModal(answerMap, choiceIndex, choiceLabel) {
  pollVotersTitle.textContent = choiceLabel ? `「${choiceLabel}」を選んだ人` : "回答した人";
  pollVotersArea.innerHTML = "読み込み中...";
  pollVotersModal.classList.remove("hidden");

  const voterIds = Object.keys(answerMap || {}).filter((uid) => answerMap[uid] === choiceIndex);
  const fragment = document.createDocumentFragment();

  if (voterIds.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "まだ誰も選んでいません";
    emptyMessage.style.color = "var(--text-muted)";
    fragment.appendChild(emptyMessage);
  }

  for (const userId of voterIds) {
    let cached = getUserCache(userId);

    if (!cached) {
      try {
        const userSnapshot = await db.collection("users_random").doc(userId).get();
        if (userSnapshot.exists) {
          const userData = userSnapshot.data();
          cached = setUserCache(userId, {
            name: userData.name || "名前未設定",
            isAdmin: userData.isAdmin || false,
            imageUrl: userData.imageUrl || "",
            profileText: userData.profileText || ""
          });
        } else {
          cached = setUserCache(userId, { name: "不明なユーザー", isAdmin: false, imageUrl: "", profileText: "" });
        }
      } catch (e) {
        console.error(e);
        cached = { name: "不明なユーザー", isAdmin: false, imageUrl: "" };
      }
    }

    const p = document.createElement("p");
    p.classList.add("clickable-user");
    p.style.cursor = "pointer";
    p.appendChild(createAvatar(cached.name, "small", cached.imageUrl));
    const nameSpan = document.createElement("span");
    nameSpan.textContent = cached.name;
    if (cached.isAdmin) nameSpan.classList.add("admin");
    p.appendChild(nameSpan);

    p.addEventListener("click", () => openProfileModal(userId));

    fragment.appendChild(p);
  }

  pollVotersArea.innerHTML = "";
  pollVotersArea.appendChild(fragment);
}
