// Firebase 設定・初期化（全ページ共通）
const firebaseConfig = {
  apiKey: "AIzaSyAqIiNj0N4WruPSOkWbeo5gxzsNyeMkuLo",
  authDomain: "appsforschool-study.firebaseapp.com",
  projectId: "appsforschool-study",
  storageBucket: "appsforschool-study.firebasestorage.app",
  messagingSenderId: "740735293440",
  appId: "1:740735293440:web:982702b6d53aaa18ec60e5"
};

export const app = firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
export const db = firebase.firestore();
