import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA9yVyZj8X93Fc_ay29g69e4IYNfi1SARg",
  authDomain: "robinhub-4b531.firebaseapp.com",
  projectId: "robinhub-4b531",
  storageBucket: "robinhub-4b531.firebasestorage.app",
  messagingSenderId: "587668271610",
  appId: "1:587668271610:web:be3a028e0dcc8ebd10b443"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };