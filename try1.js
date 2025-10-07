import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
// FIX: เพิ่ม updateDoc สำหรับการอัปเดตเป้าหมาย
import { getFirestore, doc, setDoc, getDoc, collection, query, orderBy, getDocs, deleteDoc, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables and constants
let currentPage = 'dashboard';
let currentUser = null;
let transactions = [];
let goals = [];

const incomeCategories = ['เงินเดือน', 'รายได้เสริม', 'โบนัส', 'การลงทุน', 'อื่นๆ'];
const expenseCategories = ['อาหาร', 'เดินทาง', 'บันเทิง', 'ช้อปปิ้ง', 'ค่าใช้จ่ายบ้าน', 'สุขภาพ', 'การศึกษา', 'อื่นๆ'];

// Firebase configuration (กรุณาตรวจสอบและเปลี่ยน API Key, AuthDomain ฯลฯ ของคุณ)
const firebaseConfig = {
    apiKey: "AIzaSyAX2SXOZ3O-ExaD9KYiGs8aQ6e4RSEWfyA",
    authDomain: "ohmwebsite2025sigma.firebaseapp.com",
    projectId: "ohmwebsite2025sigma",
    storageBucket: "ohmwebsite2025sigma.firebasestorage.app",
    messagingSenderId: "637089291787",
    appId: "1:637089291787:web:36f189d4eeb5be942cb10e",
    measurementId: "G-DGJ5T376KP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authPage = document.getElementById('auth-page-wrapper');
const mainApp = document.getElementById('main-app');

// Utility Functions
function formatCurrency(amount) {
    if (isNaN(amount) || amount === null) {
        return '0.00';
    }
    return parseFloat(amount).toFixed(2);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * NEW/FIX: คำนวณวันทั้งหมดที่เหลืออย่างแม่นยำ และแปลงเป็นหน่วยใหญ่โดยประมาณ
 * @param {string} deadline - วันที่สิ้นสุดเป้าหมาย (YYYY-MM-DD)
 * @returns {{days: number, weeks: number, months: number, totalDays: number}}
 */
function calculateMonthsLeft(deadline) {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    // ตั้งเวลา now ให้เป็น 00:00:00 เพื่อให้การคำนวณวันถูกต้อง
    now.setHours(0, 0, 0, 0); 

    const diffTime = deadlineDate.getTime() - now.getTime();
    const totalDiffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (totalDiffDays <= 0) return { days: 0, weeks: 0, months: 0, totalDays: 0 };

    // แปลงเป็นหน่วยใหญ่โดยประมาณ (ใช้ 30 วัน/เดือน, 7 วัน/สัปดาห์) สำหรับการแสดงผลเท่านั้น
    const months = Math.floor(totalDiffDays / 30);
    const remainingAfterMonths = totalDiffDays % 30;
    const weeks = Math.floor(remainingAfterMonths / 7);
    const days = remainingAfterMonths % 7;

    return {
        days: days,
        weeks: weeks,
        months: months,
        totalDays: totalDiffDays // ค่านี้จะถูกใช้ในการคำนวณการออมต่อช่วงเวลา
    };
}

function getProgressBadge(progress, timeLeft) {
    const isCompleted = progress >= 100;
    // ตรวจสอบว่าหมดเวลาหรือไม่ (ใช้ totalDays)
    const isExpired = timeLeft.totalDays === 0 && progress < 100;

    let className = 'badge-secondary';
    let text = 'กำลังดำเนินงาน';

    if (isCompleted) {
        className = 'badge-primary';
        text = 'สำเร็จแล้ว';
    } else if (isExpired) {
        className = 'badge-danger';
        text = 'หมดเวลา';
    }

    return `<span class="badge ${className}">${text}</span>`;
}
// *** END ADDED ***

// Authentication
function initAuthPage() {
    const authTabs = document.querySelectorAll('.tab-btn');
    const formSections = document.querySelectorAll('.form-section');

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            formSections.forEach(form => form.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.getAttribute('data-tab');
            document.getElementById(`${tabName}-form-wrapper`).classList.add('active');
        });
    });
}
initAuthPage();

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert('ลงชื่อเข้าใช้สำเร็จ!');
    } catch (error) {
        // FIX: ปรับปรุงข้อความ error สำหรับ Firebase Auth Login
        let errorMessage = error.message;
        if (error.code === 'auth/invalid-credential') {
            errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
        }
        alert(`ลงชื่อเข้าใช้ล้มเหลว: ${errorMessage}`);
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const confirmPassword = document.getElementById('register-confirm-password').value;
    if (password !== confirmPassword) {
        alert('รหัสผ่านไม่ตรงกัน');
        return;
    }
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, "users", user.uid), {
            name: name,
            email: email,
        });
        alert('ลงทะเบียนสำเร็จ! ข้อมูลผู้ใช้ถูกบันทึกใน Firestore.');
    } catch (error) {
        // FIX: ปรับปรุงข้อความ error สำหรับ Firebase Auth Register
        let errorMessage = error.message;
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'อีเมลนี้ถูกใช้ลงทะเบียนแล้ว โปรดใช้อีเมลอื่น';
                break;
            case 'auth/weak-password':
                errorMessage = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
                break;
            // เพิ่ม case อื่นๆ ที่พบได้บ่อยตามต้องการ
        }
        alert(`การลงทะเบียนล้มเหลว: ${errorMessage}`);
    }
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        showMainApp(user);
    } else {
        showAuthPage();
    }
});

function showAuthPage() {
    currentUser = null;
    authPage.style.display = 'block';
    mainApp.style.display = 'none';
}

async function showMainApp(user) {
    authPage.style.display = 'none';
    mainApp.style.display = 'flex';

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        currentUser = userDoc.exists()
            ? { uid: user.uid, ...userDoc.data() }
            : { uid: user.uid, name: 'ผู้ใช้งาน', email: user.email };
    } catch (err) {
        console.error('get user doc error:', err);
        currentUser = { uid: user.uid, name: 'ผู้ใช้งาน', email: user.email };
    }

    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');
    if (nameEl) nameEl.textContent = `สวัสดี, ${currentUser.name}`;
    if (emailEl) emailEl.textContent = currentUser.email;

    initNavigation();
    renderCurrentPage();
}

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const logoutBtn = document.getElementById('logout-btn');

  navItems.forEach((item) => {
    const page = item.getAttribute('data-page');
    if (page) {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        setCurrentPage(page);
      });
    }
  });

  // Ensure logout listener is only added once
  if (logoutBtn) {
      logoutBtn.onclick = (e) => {
          e.preventDefault();
          logout();
      };
  }
}

function setCurrentPage(page) {
  currentPage = page;
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-page') === page);
  });
  renderCurrentPage();
}

// Data Handling
async function loadData() {
    if (!currentUser) return;
    try {
        // Query for transactions
        const transQuery = query(collection(db, "users", currentUser.uid, "transactions"), orderBy("date", "desc"));
        const transSnapshot = await getDocs(transQuery);
        transactions = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Query for goals
        const goalsQuery = query(collection(db, "users", currentUser.uid, "goals"), orderBy("deadline", "asc"));
        const goalsSnapshot = await getDocs(goalsQuery);
        goals = goalsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error loading data:", error);
        alert("ไม่สามารถโหลดข้อมูลรายการและเป้าหมายได้");
    }
}

// *** ฟังก์ชัน renderGoalslist() ที่ได้รับการแก้ไขและปรับปรุงการคำนวณ ***
function renderGoalsList() {
  if (goals.length === 0) {
    return `
      <div class="card" style="grid-column: 1 / -1;">
        <div class="card-content text-center py-8">
          <p style="color: #6b7280;">ยังไม่มีเป้าหมาย</p>
        </div>
      </div>`;
  }

  return goals.map(goal => {
    const target = Number(goal.targetAmount) || 0;
    const current = Number(goal.currentAmount) || 0;
    
    // ป้องกันการหารด้วยศูนย์
    const progress = target > 0 ? (current / target) * 100 : 0;
    const timeLeft = calculateMonthsLeft(goal.deadline);
    const remainingAmount = Math.max(0, target - current);
    
    let timeLeftText = '';
    let savePerText = '';
    
    // NEW FIX: ตรวจสอบว่ามีวันทั้งหมดเหลือหรือไม่
    const hasTimeLeft = timeLeft.totalDays > 0;
    const isCompleted = progress >= 100;
    
    if (isCompleted) {
        timeLeftText = `<span class="text-green-600">สำเร็จแล้ว</span>`;
        savePerText = `<span class="text-gray-500">-</span>`;
    } else if (hasTimeLeft) {
      // มีเวลาเหลือ
        const totalDays = timeLeft.totalDays; // ใช้ totalDays ที่แม่นยำ
        // NEW FIX: ใช้ค่าเฉลี่ย 30.4375 วันต่อเดือน เพื่อความแม่นยำทางสถิติ
        const totalMonths = totalDays / 30.4375; 
        const totalWeeks = totalDays / 7;

        // คำนวณเป้าหมายรายช่วงเวลา
        const monthlyTarget = totalMonths > 0 ? remainingAmount / totalMonths : 0;
        const weeklyTarget = totalWeeks > 0 ? remainingAmount / totalWeeks : 0;
        const dailyTarget = totalDays > 0 ? remainingAmount / totalDays : 0;
        
        // แสดงผลลัพธ์เวลาเหลือ
        timeLeftText = `${timeLeft.months > 0 ? timeLeft.months + ' เดือน' : ''}
                        ${timeLeft.weeks > 0 ? timeLeft.weeks + ' สัปดาห์' : ''}
                        ${timeLeft.days > 0 ? timeLeft.days + ' วัน' : ''}`;
        
        // แสดงผลลัพธ์การออม
        savePerText = `${formatCurrency(monthlyTarget)} /เดือน<br>
                        ${formatCurrency(weeklyTarget)} /สัปดาห์<br>
                        ${formatCurrency(dailyTarget)} /วัน`;

    } else {
        // หมดเวลาและยังไม่สำเร็จ
        timeLeftText = `<span class="text-red-600">หมดเวลาตามกำหนด</span>`;
        savePerText = `<span class="text-gray-500">-</span>`;
    }


    return `
      <div class="goal-card" data-id="${goal.id}">

        <div class="goal-header">
          <div>
            <div class="goal-title">${goal.title}</div>
            <div class="goal-category">${goal.category}</div>
          </div>
          <div class="goal-actions">
            ${getProgressBadge(progress, timeLeft)}
            <button class="btn btn-danger btn-small delete-goal-btn">ลบ</button>
          </div>
        </div>
        <div class="goal-progress">
          <div class="goal-progress-text">
            <span>ความคืบหน้า</span>
            <span>${formatCurrency(current)} / ${formatCurrency(target)}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
          </div>
          <div class="goal-progress-details">
            <span>${progress.toFixed(1)}%</span>
            <span>เหลือ ${formatCurrency(remainingAmount)}</span>
          </div>
        </div>
        <div class="goal-stats">
          <div>
            <div class="goal-stat-label">เวลาเหลือ</div>
            <div>${timeLeftText}</div>
          </div>
          <div>
            <div class="goal-stat-label">ออมต่อช่วงเวลา</div>
            <div>${savePerText}</div>
          </div>
        </div>

        ${goal.description
          ? `<p style="font-size: 0.875rem; color: #6b7280; margin-bottom: 1rem;">${goal.description}</p>`
          : ''}

        <div class="flex items-center gap-2 mb-4">
          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #6b7280;">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <span style="font-size: 0.875rem; color: #6b7280;">${formatDate(goal.deadline)}</span>
        </div>

        <div class="flex gap-2">
          <input type="number" class="form-input update-amount-input" placeholder="อัพเดทยอดเงินออม" style="flex: 1;">
          <button class="btn btn-primary btn-small update-goal-btn">อัพเดต</button>
        </div>
      </div>
    `;
  }).join('');
}


// Page Rendering
async function renderCurrentPage() {
    const contentArea = document.getElementById('content-area');
    if (!contentArea) {
        console.error("Content area not found.");
        return;
    }
    contentArea.innerHTML = `<div class="py-8 text-center">กำลังโหลด...</div>`;
    await loadData();
    switch (currentPage) {
        case 'dashboard':
            contentArea.innerHTML = renderDashboard();
            break;
        case 'transactions':
            contentArea.innerHTML = renderTransactionsPage();
            setTimeout(() => {
                initTransactionsPage();
            }, 0);
            break;
        case 'goals':
            contentArea.innerHTML = renderGoalsPage();
            setTimeout(() => {
                initGoalsPage();
            }, 0);
            break;
        case 'progress':
            contentArea.innerHTML = renderProgressPage();
            setTimeout(() => {
                // FIX: เรียก initProgressPage เพื่อโหลดข้อมูลก่อนสร้าง Chart
                initProgressPage();
            }, 0);
            break;
        default:
            contentArea.innerHTML = renderDashboard();
    }
}

// FIX: ลบพารามิเตอร์ที่ไม่จำเป็นออกไป
function renderDashboard() {
  // 1. Calculations: Use global data
  const totalIncome = Array.isArray(transactions) ? transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0) : 0;
    
  const totalExpense = Array.isArray(transactions) ? transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0) : 0;
    
  const balance = totalIncome - totalExpense; 

  // 2. HTML Template Generation
  return `
    <div class="space-y-4">
      <div>
        <h1>ยินดีต้อนรับสู่แอปบริหารการเงิน</h1>
        <p style="color: #6b7280; margin-top: 0.5rem;">ภาพรวมสถานะทางการเงินของคุณ</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(balance)}</div>
          <div class="stat-label">คงเหลือ</div>
        </div>
        <div class="stat-card">
          <div class="stat-value stat-positive">${formatCurrency(totalIncome)}</div>
          <div class="stat-label">รายรับทั้งหมด</div>
        </div>
        <div class="stat-card">
          <div class="stat-value stat-negative">${formatCurrency(totalExpense)}</div>
          <div class="stat-label">รายจ่ายทั้งหมด</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header"><div class="card-title">เป้าหมายการออม</div></div>
      <div class="card-content">
        ${(Array.isArray(goals) && goals.length) ?
          `<div class="mt-2 space-y-3">
            ${goals.map((goal) => {
              // Ensure targetAmount is a number and non-zero to avoid division by zero
              const target = Number(goal.targetAmount) || 0;
              const current = Number(goal.currentAmount) || 0;
              const progress = target > 0 ? (current / target) * 100 : 0;
              const timeLeft = calculateMonthsLeft(goal.deadline);

              return `
                <div class="goal-item">
                  <div class="flex justify-between items-center">
                    <span style="font-weight: 500;">${goal.title}</span>
                    <span style="font-size: 0.85rem;">
                      ${formatCurrency(current)} / ${formatCurrency(target)}
                    </span>
                  </div>
                  <div class="progress-bar small-bar">
                    <div class="progress-fill" style="width: ${Math.min(progress, 100)}%;"></div>
                  </div>
                  <div class="flex justify-between" style="font-size: 0.75rem; color: #6b7280;">
                    <span>${progress.toFixed(1)}%</span>
                    <span>${getProgressBadge(progress, timeLeft)}</span> 
                  </div>
                </div>
              `;
            }).join('')}
          </div>`
          :
          `<div class="text-center text-gray-500">ยังไม่มีเป้าหมาย</div>`
        }
      </div>
    </div>
  `;
}
function renderTransactionsList() {
    if (transactions.length === 0) {
        return `<p class="text-center py-8" style="color: #6b7280;">ยังไม่มีรายการ</p>`;
    }
    return transactions.map(t => `
        <div class="transaction-item" data-id="${t.id}">
            <div class="transaction-info">
                <div class="transaction-category">
                    <span class="badge ${t.type === 'income' ? 'badge-primary' : 'badge-secondary'}">
                        ${t.type === 'income' ? 'รายรับ' : 'รายจ่าย'}
                    </span>
                    <span style="margin-left: 0.5rem; font-weight: 500;">${t.category}</span>
                </div>
                <div class="transaction-description">${t.description}</div>
                <div class="transaction-date">${formatDate(t.date)}</div>
            </div>
            <div class="flex items-center gap-2">
                <div class="transaction-amount ${t.type === 'income' ? 'stat-positive' : 'stat-negative'}">
                    ${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}
                </div>
                <button class="btn btn-danger btn-small delete-transaction-btn">ลบ</button>
            </div>
        </div>
    `).join('');
}

function renderTransactionsPage() {
    return `
    <div class="p-6 bg-white rounded-lg shadow-md">
        <h1 class="text-2xl font-bold mb-4">บันทึกรายการ</h1>
        <div class="tabs-list mb-4">
            <div class="tabs-trigger active" data-tab="add">เพิ่มรายการ</div>
            <div class="tabs-trigger" data-tab="history">ประวัติการทำรายการ</div>
        </div>
        <div class="tabs-content active" id="add-tab">
            <h3 class="text-xl font-semibold border-b pb-2 mb-4">เพิ่มรายการใหม่</h3>
            <form id="transaction-form" class="space-y-4">
                <div class="flex gap-4">
                    <div class="form-group w-1/2">
                        <label class="form-label" for="transaction-type">ประเภท</label>
                        <select class="form-select" name="type" id="transaction-type" required>
                            <option value="expense">รายจ่าย</option>
                            <option value="income">รายรับ</option>
                        </select>
                    </div>
                    <div class="form-group w-1/2">
                        <label class="form-label" for="transaction-amount">จำนวนเงิน (บาท)</label>
                        <input type="number" class="form-input" name="amount" id="transaction-amount" step="0.01" placeholder="0.00" required />
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="transaction-category">หมวดหมู่</label>
                    <select class="form-select" name="category" id="transaction-category" required>
                        <option value="">เลือกหมวดหมู่</option>
                        ${expenseCategories.map(cat => `<option value="${cat}">${cat}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="transaction-date">วันที่</label>
                    <input type="date" class="form-input" name="date" id="transaction-date"
                        value="${new Date().toISOString().split('T')[0]}" required />
                </div>
                <div class="form-group">
                    <label class="form-label" for="transaction-description">รายละเอียด (ไม่บังคับ)</label>
                    <textarea class="form-textarea" name="description" id="transaction-description" placeholder="รายละเอียดเพิ่มเติม..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-full">บันทึกรายการ</button>
            </form>
        </div>
        <div class="tabs-content" id="history-tab">
            <div class="transaction-summary flex justify-between items-center bg-gray-100 p-4 rounded-lg mb-4 text-center">
                <div class="flex-1">
                    <p class="text-sm text-gray-600">รายรับทั้งหมด:</p>
                    <p class="text-lg font-bold text-green-600" id="total-income">0.00</p>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-gray-600">รายจ่ายทั้งหมด:</p>
                    <p class="text-lg font-bold text-red-600" id="total-expense">0.00</p>
                </div>
                <div class="flex-1">
                    <p class="text-sm text-gray-600">ยอดคงเหลือ:</p>
                    <p class="text-lg font-bold" id="total-balance">0.00</p>
                </div>
            </div>
            <h3 class="text-xl font-semibold border-b pb-2 mb-4">ประวัติการทำรายการ</h3>
            <div id="transactions-list">
                ${renderTransactionsList()}
            </div>
        </div>
    </div>
    `;
}

function initTransactionsPage() {
    const contentArea = document.getElementById('content-area');
    const form = document.getElementById('transaction-form');
    const typeSelect = document.getElementById('transaction-type');
    const categorySelect = document.getElementById('transaction-category');
    if (!form || !typeSelect || !categorySelect) {
        return;
    }

    // Tab switching logic
    contentArea.querySelectorAll('.tabs-trigger').forEach(trigger => {
        trigger.addEventListener('click', async () => {
            const tabName = trigger.getAttribute('data-tab');
            contentArea.querySelectorAll('.tabs-trigger').forEach(t => t.classList.remove('active'));
            trigger.classList.add('active');
            contentArea.querySelectorAll('.tabs-content').forEach(c => c.classList.remove('active'));
            contentArea.querySelector(`#${tabName}-tab`).classList.add('active');
            if (tabName === 'history') {
                await loadData();
                updateTransactionsList();
            }
        });
    });

    // Category select logic
    const updateCategoryOptions = () => {
        const type = typeSelect.value;
        const categories = type === 'income' ? incomeCategories : expenseCategories;
        categorySelect.innerHTML = `<option value="">เลือกหมวดหมู่</option>` + categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
    };
    typeSelect.addEventListener('change', updateCategoryOptions);
    updateCategoryOptions();

    // Form submission logic
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amountValue = parseFloat(form.amount.value);
        if (isNaN(amountValue) || amountValue <= 0) {
            alert('โปรดระบุจำนวนเงินที่ถูกต้อง');
            return;
        }
        const newTransaction = {
            type: form.type.value,
            amount: amountValue,
            category: form.category.value,
            description: form.description.value || '',
            date: form.date.value
        };

        try {
            await addDoc(collection(db, "users", currentUser.uid, "transactions"), newTransaction);
            form.reset();
            form.date.value = new Date().toISOString().split('T')[0];
            alert('บันทึกสำเร็จ!');
            // After adding a transaction, switch to history tab and reload
            const historyTrigger = contentArea.querySelector('.tabs-trigger[data-tab="history"]');
            if (historyTrigger) historyTrigger.click();
        } catch (error) {
            alert(`เกิดข้อผิดพลาด: ${error.message}`);
        }
    });

    // Delete button listener (Event Delegation)
    const transactionsListEl = document.getElementById('transactions-list');
    if (transactionsListEl) {
        transactionsListEl.addEventListener('click', async (e) => {
            if (e.target.classList.contains('delete-transaction-btn')) {
                const item = e.target.closest('.transaction-item');
                const id = item.dataset.id;
                if (confirm('คุณต้องการลบรายการนี้หรือไม่?')) {
                    try {
                        await deleteDoc(doc(db, "users", currentUser.uid, "transactions", id));
                        alert('รายการถูกลบเรียบร้อยแล้ว');
                        await loadData(); // โหลดข้อมูลใหม่
                        updateTransactionsList(); // อัปเดตรายการบนหน้าจอ
                    } catch (error) {
                        alert(`เกิดข้อผิดพลาด: ${error.message}`);
                    }
                }
            }
        });
    }

    // Initial render for history tab (ถ้าเริ่มต้นที่ add tab ไม่จำเป็นต้องเรียก แต่ถ้ามีการ switch tab จะถูกเรียก)
    // updateTransactionsList(); // ลบการเรียกนี้ออก เพราะจะถูกเรียกเมื่อ switch ไป history tab
}

function updateTransactionsList() {
    const transactionsListEl = document.getElementById('transactions-list');
    if (transactionsListEl) {
        transactionsListEl.innerHTML = renderTransactionsList();

        const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        const totalBalance = totalIncome - totalExpense;

        const totalIncomeEl = document.getElementById('total-income');
        const totalExpenseEl = document.getElementById('total-expense');
        const totalBalanceEl = document.getElementById('total-balance');

        if (totalIncomeEl) totalIncomeEl.textContent = formatCurrency(totalIncome);
        if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalExpense);
        if (totalBalanceEl) {
            totalBalanceEl.textContent = formatCurrency(totalBalance);
            // Optional: change color of balance based on value
            totalBalanceEl.classList.toggle('stat-positive', totalBalance > 0);
            totalBalanceEl.classList.toggle('stat-negative', totalBalance < 0);
        }
    }
}

// Goals
function renderGoalsPage() {
    const totalGoals = goals.length;
    // ตรวจสอบว่า targetAmount ไม่ใช่ 0 ก่อนคำนวณ
    const completedGoals = goals.filter(g => {
        const target = Number(g.targetAmount) || 0;
        return target > 0 && (g.currentAmount / target) * 100 >= 100;
    }).length;
    const totalSavings = goals.reduce((sum, g) => sum + (g.currentAmount || 0), 0);


    return `
        <div class="p-6 bg-white rounded-lg shadow-md">
            <h1 class="text-2xl font-bold mb-4">เป้าหมายการออม</h1>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div class="stat-card">
                    <div class="stat-value">${totalGoals}</div>
                    <div class="stat-label">เป้าหมายทั้งหมด</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value stat-positive">${completedGoals}</div>
                    <div class="stat-label">เป้าหมายที่สำเร็จ</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value stat-positive">${formatCurrency(totalSavings)}</div>
                    <div class="stat-label">เงินออมสะสม</div>
                </div>
            </div>

            <h3 class="text-xl font-semibold border-b pb-2 mb-4">กำหนดเป้าหมายใหม่</h3>
            <form id="goal-form" class="space-y-4 mb-8 p-4 border rounded-lg bg-gray-50">
                <div class="form-group">
                    <label class="form-label" for="goal-title">ชื่อเป้าหมาย</label>
                    <input type="text" class="form-input" name="title" id="goal-title" placeholder="เช่น ซื้อรถ, ท่องเที่ยวญี่ปุ่น" required />
                </div>
                <div class="flex gap-4">
                    <div class="form-group w-1/2">
                        <label class="form-label" for="goal-target-amount">ยอดเป้าหมาย (บาท)</label>
                        <input type="number" class="form-input" name="targetAmount" id="goal-target-amount" step="0.01" placeholder="0.00" required />
                    </div>
                    <div class="form-group w-1/2">
                        <label class="form-label" for="goal-deadline">กำหนดเวลาสิ้นสุด</label>
                        <input type="date" class="form-input" name="deadline" id="goal-deadline" required />
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="goal-category">หมวดหมู่</label>
                    <select class="form-select" name="category" id="goal-category" required>
                        <option value="">เลือกหมวดหมู่</option>
                        <option value="ทรัพย์สิน">ทรัพย์สิน</option>
                        <option value="การศึกษา">การศึกษา</option>
                        <option value="ท่องเที่ยว">ท่องเที่ยว</option>
                        <option value="ฉุกเฉิน">ฉุกเฉิน</option>
                        <option value="เกษียณ">เกษียณ</option>
                        <option value="อื่นๆ">อื่นๆ</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="goal-current-amount">ยอดเงินออมปัจจุบัน (เริ่มต้น)</label>
                    <input type="number" class="form-input" name="currentAmount" id="goal-current-amount" step="0.01" value="0.00" />
                </div>
                <div class="form-group">
                    <label class="form-label" for="goal-description">รายละเอียด (ไม่บังคับ)</label>
                    <textarea class="form-textarea" name="description" id="goal-description" placeholder="รายละเอียดเพิ่มเติม..."></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-full">บันทึกเป้าหมาย</button>
            </form>

            <h3 class="text-xl font-semibold border-b pb-2 mb-4">รายการเป้าหมายทั้งหมด</h3>
            <div id="goals-list" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${renderGoalsList()}
            </div>
        </div>
    `;
}

function initGoalsPage() {
    const goalsListEl = document.getElementById('goals-list');
    const form = document.getElementById('goal-form');

    if (!form || !goalsListEl) return;

    // Form submission logic
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const targetAmountValue = parseFloat(form.targetAmount.value);
        const currentAmountValue = parseFloat(form.currentAmount.value) || 0;
        
        if (isNaN(targetAmountValue) || targetAmountValue <= 0) {
            alert('โปรดระบุยอดเป้าหมายที่ถูกต้อง');
            return;
        }
        
        const newGoal = {
            title: form.title.value,
            targetAmount: targetAmountValue,
            currentAmount: currentAmountValue,
            deadline: form.deadline.value,
            category: form.category.value,
            description: form.description.value || '',
            createdAt: new Date().toISOString()
        };

        try {
            await addDoc(collection(db, "users", currentUser.uid, "goals"), newGoal);
            form.reset();
            alert('บันทึกเป้าหมายสำเร็จ!');
            await loadData();
            goalsListEl.innerHTML = renderGoalsList();
            renderGoalsPage(); // Re-render the full page to update stats
        } catch (error) {
            alert(`เกิดข้อผิดพลาดในการบันทึกเป้าหมาย: ${error.message}`);
        }
    });

    // Update and Delete Goals listeners (Event Delegation)
    goalsListEl.addEventListener('click', async (e) => {
        const item = e.target.closest('.goal-card');
        if (!item) return;

        const id = item.dataset.id;
        if (!id) return;
        
        // Update Goal
        if (e.target.classList.contains('update-goal-btn')) {
            const inputEl = item.querySelector('.update-amount-input');
            const updateAmount = parseFloat(inputEl.value);

            if (isNaN(updateAmount) || updateAmount <= 0) {
                alert('โปรดระบุจำนวนเงินออมที่ถูกต้อง');
                return;
            }

            const goalToUpdate = goals.find(g => g.id === id);
            if (!goalToUpdate) return;
            
            // ใช้ Firestore `updateDoc` เพื่ออัปเดตค่าปัจจุบัน
            const newCurrentAmount = Number(goalToUpdate.currentAmount) + updateAmount;
            
            try {
                const goalDocRef = doc(db, "users", currentUser.uid, "goals", id);
                await updateDoc(goalDocRef, {
                    currentAmount: newCurrentAmount
                });

                inputEl.value = ''; // Clear input
                alert('อัพเดตยอดเงินออมสำเร็จ!');
                await loadData(); // โหลดข้อมูลใหม่
                goalsListEl.innerHTML = renderGoalsList(); // อัปเดตรายการบนหน้าจอ
                renderGoalsPage(); // Re-render the full page to update stats
            } catch (error) {
                alert(`เกิดข้อผิดพลาดในการอัพเดต: ${error.message}`);
            }
        }
        
        // Delete Goal
        if (e.target.classList.contains('delete-goal-btn')) {
            if (confirm('คุณต้องการลบเป้าหมายนี้หรือไม่? การกระทำนี้ไม่สามารถยกเลิกได้')) {
                try {
                    await deleteDoc(doc(db, "users", currentUser.uid, "goals", id));
                    alert('เป้าหมายถูกลบเรียบร้อยแล้ว');
                    await loadData(); // โหลดข้อมูลใหม่
                    goalsListEl.innerHTML = renderGoalsList(); // อัปเดตรายการบนหน้าจอ
                    renderGoalsPage(); // Re-render the full page to update stats
                } catch (error) {
                    alert(`เกิดข้อผิดพลาดในการลบ: ${error.message}`);
                }
            }
        }
    });
}

// Progress Page
function renderProgressPage() {
    return `
        <div class="p-6 bg-white rounded-lg shadow-md">
            <h1 class="text-2xl font-bold mb-4">ติดตามผลและวิเคราะห์</h1>
            <p class="text-gray-600 mb-6">วิเคราะห์ภาพรวมรายรับและรายจ่ายตามหมวดหมู่</p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div class="card">
                    <div class="card-header"><div class="card-title">สัดส่วนรายจ่ายตามหมวดหมู่</div></div>
                    <div class="card-content">
                        <div class="chart-container" style="height: 400px; width: 100%;">
                            <canvas id="expense-category-chart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header"><div class="card-title">สัดส่วนรายรับตามหมวดหมู่</div></div>
                    <div class="card-content">
                        <div class="chart-container" style="height: 400px; width: 100%;">
                            <canvas id="income-category-chart"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <div class="card mt-8">
                <div class="card-header"><div class="card-title">แนวโน้มรายรับ-รายจ่าย (30 วันล่าสุด)</div></div>
                <div class="card-content">
                    <div class="chart-container" style="height: 400px; width: 100%;">
                        <canvas id="balance-chart"></canvas>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Chart Initializations
function initProgressPage() {
    // 1. Group transactions by category (Expense)
    const expenseByCategory = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
        // Uses the OR (|| 0) operator to initialize the category total if it doesn't exist.
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount;
    });
    
    // 2. Group transactions by category (Income)
    const incomeByCategory = {};
    transactions.filter(t => t.type === 'income').forEach(t => {
        // Uses the OR (|| 0) operator to initialize the category total if it doesn't exist.
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + t.amount;
    });

    // 3. Group transactions by date (for Balance Chart)
    const balanceByDate = {};
    transactions.forEach(t => {
        const date = t.date; // YYYY-MM-DD
        const amount = t.amount * (t.type === 'income' ? 1 : -1);
        balanceByDate[date] = (balanceByDate[date] || 0) + amount;
    });

    // Initialize Charts
    initExpenseCategoryChart(expenseByCategory);
    initIncomeCategoryChart(incomeByCategory);
    initBalanceChart(balanceByDate);
}

function initExpenseCategoryChart(expenseByCategory) {
  const ctx = document.getElementById('expense-category-chart').getContext('2d');
  
  if (Object.keys(expenseByCategory).length === 0) {
    ctx.canvas.parentNode.innerHTML = '<p class="text-center py-4 text-gray-600">ยังไม่มีข้อมูลรายจ่าย</p>';
    return;
  }

  // 3. Prepare data and colors for Chart.js
  const categories = Object.keys(expenseByCategory);
  const amounts = Object.values(expenseByCategory);
  
  // NEW: Calculate the total sum of all expense amounts for percentage calculation
  const totalExpenseAmount = amounts.reduce((sum, amount) => sum + amount, 0); 
  
  // Define a set of colors for the chart slices
  const colors = [
    '#ef4444', // Red (เน้นรายจ่าย)
    '#f59e0b', // amber/yellow
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#059669', // Emerald
    '#06b6d4',  // cyan
    '#f43f5e', // rose
    '#6b7280' // gray
  ];

  // 4. Create and render the Pie Chart
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: categories,
      datasets: [{
        data: amounts,
        // Slices the color array to match the exact number of categories
        backgroundColor: colors.slice(0, categories.length) 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // Allows chart to resize freely
      plugins: {
        legend: { 
          position: 'bottom' // Places the legend below the chart
        },
        // ADDED: Tooltip configuration for percentage
        tooltip: {
            callbacks: {
                label: function(context) {
                    let label = context.label || '';
                    if (label) {
                        label += ': ';
                    }           
                    const currentValue = context.raw;            
                    // Calculate percentage safely
                    const percentage = totalExpenseAmount > 0 
                        ? ((currentValue / totalExpenseAmount) * 100).toFixed(1)
                        : 0; 

                    // Return the formatted string: "Label: Currency Value (Percentage%)"
                    return `${label}${formatCurrency(currentValue)} (${percentage}%)`;
                }
            }
        }
      }
    }
  });
}


function initIncomeCategoryChart(incomeByCategory) {
  const ctx = document.getElementById('income-category-chart').getContext('2d');

  if (Object.keys(incomeByCategory).length === 0) {
    ctx.canvas.parentNode.innerHTML = '<p class="text-center py-4 text-gray-600">ยังไม่มีข้อมูลรายรับ</p>';
    return;
  }
  
  // 3. Prepare data and colors for Chart.js
  const categories = Object.keys(incomeByCategory);
  const amounts = Object.values(incomeByCategory);
  
  // NEW: Calculate the total sum of all income amounts for percentage calculation
  const totalIncomeAmount = amounts.reduce((sum, amount) => sum + amount, 0);
  
  // Define a set of colors for the chart slices
  // 💡 FIX/NEW: ใช้ชุดสีที่แตกต่างจากกราฟรายจ่ายเล็กน้อยเพื่อความชัดเจน
  const colors = [
    '#059669', // Emerald (เน้นรายรับ)
    '#3b82f6', // blue
    '#f59e0b', // amber/yellow
    '#8b5cf6', // purple
    '#ef4444', // red
    '#06b6d4',  // cyan
    '#f43f5e', // rose
    '#6b7280' // gray
  ];

  // 4. Create and render the Pie Chart
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels: categories,
      datasets: [{
        data: amounts,
        // Slices the color array to match the exact number of categories
        backgroundColor: colors.slice(0, categories.length) 
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, // Allows chart to resize freely
      plugins: {
        legend: { 
          position: 'bottom' // Places the legend below the chart
           },
        tooltip: {
            callbacks: {
                label: function(context) {
                                
                    let label = context.label || '';
                    if (label) {
                        label += ': ';
                         }           
                    const currentValue = context.raw;            
                    // FIX: Use totalIncomeAmount and formatCurrency
                    const percentage = totalIncomeAmount > 0 
                        ? ((currentValue / totalIncomeAmount) * 100).toFixed(1)
                        : 0;

                                // Return the formatted string: "Label: Currency Value (Percentage%)"
                                return `${label}${formatCurrency(currentValue)} (${percentage}%)`;
                            }
      }
    }
}
    }
  });
}


function initBalanceChart(balanceByDate) {
    const ctx = document.getElementById('balance-chart').getContext('2d');
    
    // Convert balanceByDate object into sorted arrays for Chart.js
    const sortedDates = Object.keys(balanceByDate).sort();
    
    // Only take the last 30 days of data
    const last30Days = sortedDates.slice(-30);

    const dataPoints = last30Days.map(date => ({
        date: date,
        amount: balanceByDate[date]
    }));

    // Calculate Cumulative Balance
    let cumulativeBalance = 0;
    const cumulativeData = dataPoints.map(point => {
        cumulativeBalance += point.amount;
        return cumulativeBalance;
    });


    // Create and render the Line Chart
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: last30Days.map(formatDate),
            datasets: [{
                label: 'ยอดคงเหลือสะสม',
                data: cumulativeData,
                borderColor: '#4f46e5',
                backgroundColor: 'rgba(79, 70, 229, 0.2)', // Light indigo fill
                tension: 0.3, // Curve the line slightly
                fill: true,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'ยอดเงิน (บาท)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'วันที่'
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            // Format the value as currency
                            return `${label}${formatCurrency(context.raw)}`;
                        }
                    }
                }
            }
        }
    });
}


// Navigation and Logout
async function logout() {
    try {
        await signOut(auth);
        // showAuthPage is called automatically by onAuthStateChanged listener
    } catch (error) {
        alert("ออกจากระบบไม่สำเร็จ: " + error.message);
    }
}