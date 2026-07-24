// ログインページ専用の機能（ID/パスワード入力・QRコード読み取り）

import { auth } from "./firebase-init.js";

let idInput, passwordInput, loginButton, errorMessage;
let qrLoginButton, qrLoginModal, qrLoginModalClose, qrLoginModalFailure, qrLoginRetryButton;
let html5QrCode;
let initialized = false;

export function initLoginPage() {
  if (initialized) return;
  initialized = true;

  idInput = document.getElementById("id");
  passwordInput = document.getElementById("password");
  loginButton = document.getElementById("login-button");
  errorMessage = document.getElementById("error-message");

  idInput.addEventListener("input", updateLoginButtonState);
  passwordInput.addEventListener("input", updateLoginButtonState);
  loginButton.addEventListener("click", handleLogin);
  updateLoginButtonState();

  qrLoginButton = document.getElementById("qr-login-button");
  qrLoginModal = document.getElementById("qr-login-modal");
  qrLoginModalClose = document.getElementById("qr-login-modal-close");
  qrLoginModalFailure = document.getElementById("qr-login-failure");
  qrLoginRetryButton = document.getElementById("qr-login-retry");

  qrLoginButton.addEventListener("click", () => {
    qrLoginModal.classList.remove("hidden");
    startScan("login-qr-reader");
  });
  qrLoginModalClose.addEventListener("click", () => {
    qrLoginModal.classList.add("hidden");
    stopScan();
  });
  qrLoginRetryButton.addEventListener("click", () => {
    qrLoginModalFailure.classList.add("hidden");
    startScan("login-qr-reader");
  });
}

function updateLoginButtonState() {
  const hasId = idInput && idInput.value.trim() !== "";
  const hasPassword = passwordInput && passwordInput.value.trim() !== "";
  loginButton.disabled = !(hasId && hasPassword);
}

async function handleLogin() {
  errorMessage.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "ログイン中...";

  try {
    const loginEmail = `${idInput.value}@appsforschool.com`;
    await auth.signInWithEmailAndPassword(loginEmail, passwordInput.value);
    // ログイン成功後の画面遷移は app.js の onAuthStateChanged が担当する
  } catch (error) {
    errorMessage.textContent = "ログインに失敗しました。IDとパスワードを確認してください。";
    console.error("ログインエラー:", error);
    loginButton.disabled = false;
    loginButton.textContent = "ログイン";
  }
}

async function startScan(qrReaderId) {
  html5QrCode = new Html5Qrcode(qrReaderId);

  const config = {
    fps: 10,
    qrbox: { width: 250, height: 250 }
  };

  try {
    await html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        stopScan();
        inputQrData(decodedText);
      },
      () => {
        // スキャン中、QRが見つからない間はここが呼ばれ続ける（無視してOK）
      }
    );
  } catch (err) {
    console.error("カメラ起動エラー:", err);
    alert("カメラの起動に失敗しました。ブラウザの権限を確認してください。");
    stopScan();
    qrLoginModal.classList.add("hidden");
  }
}

async function stopScan() {
  if (html5QrCode) {
    await html5QrCode.stop();
    html5QrCode = null;
  }
}

function inputQrData(decodedData) {
  const splitBySpace = decodedData.split(" ");
  if (splitBySpace.length === 2) {
    idInput.value = splitBySpace[0];
    passwordInput.value = splitBySpace[1];

    qrLoginModal.classList.add("hidden");
    updateLoginButtonState();
  } else {
    qrLoginModalFailure.classList.remove("hidden");
  }
}
