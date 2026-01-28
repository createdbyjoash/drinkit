/**
 * Drinkit! - Coffee Ordering App Logic
 * 
 * SUPABASE SETUP GUIDE:
 * 1. Create a table 'products' (id, name, description, price, image_url)
 * 2. Create a table 'orders' (id, user_id, total_price, status, created_at)
 * 3. Create a table 'order_items' (id, order_id, product_name, size, quantity, price)
 */

// --- Configuration ---
const SUPABASE_URL = 'https://jndmpghrnwwzmonjqeuw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpuZG1wZ2hybnd3em1vbmpxZXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MzM4NTUsImV4cCI6MjA4NTAwOTg1NX0.-FJw_N1QFLgCwEa7rozCllZ3qz-hi0GlAYLwnLdXGjk';

// Initialize Supabase (Checking if keys are provided)
let sb = null;
if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// --- App State ---
let state = {
    user: null,
    products: [],
    cart: [],
    currentProduct: null,
    selectedSize: { name: 'Small', price: 10 },
    currentScreen: 'splash',
    loyaltyPoints: 0,
    walletBalance: 100.00
};

// --- Initial Demo Data (Fallback) ---
const demoProducts = [
    { id: 1, name: 'Midnight Espresso', description: 'Intense, dark, and mysteriously smooth.', price: 5, image_url: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=800' },
    { id: 2, name: 'Velvet Cappuccino', description: 'Creamy foam atop a rich espresso base.', price: 8, image_url: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=800' },
    { id: 3, name: 'Caramel Macchiato', description: 'Sweet caramel swirls with steamed milk.', price: 12, image_url: 'https://images.unsplash.com/photo-1572286258217-40142c1c6a70?w=800' },
    { id: 4, name: 'Oat Milk Latte', description: 'Plant-based goodness with a nutty finish.', price: 10, image_url: 'https://images.unsplash.com/photo-1512568400610-62da28bc8a13?w=800' },
    { id: 5, name: 'Pumpkin Spice', description: 'A cozy fall classic with warm spices.', price: 15, image_url: 'https://images.unsplash.com/photo-1507133750040-4a8f5700e35f?w=800' },
    { id: 6, name: 'Hazelnut Brew', description: 'Freshly roasted beans with a hint of nut.', price: 9, image_url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800' },
    { id: 7, name: 'Mocha Dream', description: 'Rich chocolate blended with premium espresso.', price: 14, image_url: 'https://images.unsplash.com/photo-1551106652-a5bcf4b29ab6?w=800' },
    { id: 8, name: 'Vanilla Bean Frappe', description: 'Chilled cream with real vanilla bean.', price: 11, image_url: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=800' }
];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    checkAuthState();
    loadProducts();
    updateCartCount();

    // Form Submissions
    document.getElementById('form-login').addEventListener('submit', handleLogin);
    document.getElementById('form-signup').addEventListener('submit', handleSignup);
});

// --- Auth Functions ---
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!sb) {
        // Demo mode bypass
        handleUserChange({ id: 'demo-user', email });
        return;
    }

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
}

async function handleSignup(e) {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const name = document.getElementById('signup-name').value;

    if (!sb) {
        alert("Supabase not configured. Using demo mode.");
        handleUserChange({ id: 'demo-user', email });
        return;
    }

    const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
    });

    if (error) {
        alert(error.message);
    } else {
        if (data.session) {
            showToast("Account created successfully!");
            handleUserChange(data.user);
        } else {
            showToast("Signup successful! Please check your email if confirmation is required.");
        }
    }
}

async function checkAuthState() {
    if (!sb) return;

    const { data: { user } } = await sb.auth.getUser();
    handleUserChange(user);

    sb.auth.onAuthStateChange((event, session) => {
        handleUserChange(session?.user || null);
    });
}

function handleUserChange(user) {
    state.user = user;

    // Update Profile UI
    const profileEmail = document.getElementById('profile-email');
    if (profileEmail) {
        profileEmail.innerText = user ? (user.email || 'Member') : 'Member';
    }

    if (user && (state.currentScreen === 'splash' || state.currentScreen === 'auth')) {
        window.navigateTo('home');
    }
}

async function handleLogout() {
    if (sb) await sb.auth.signOut();
    state.user = null;
    state.cart = [];
    updateCartCount();
    window.navigateTo('splash');
}

// --- Navigation ---
window.navigateTo = function (screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));

    // Show target screen
    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
        target.classList.remove('hidden');
        state.currentScreen = screenId;
    }

    // Update Bottom Nav visibility
    const bottomNav = document.getElementById('bottom-nav');
    if (['home', 'history', 'cart', 'profile', 'wallet'].includes(screenId)) {
        bottomNav.classList.remove('hidden');
        bottomNav.classList.add('flex'); // Ensure flex is added for layout
        // Update active state in nav
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-screen') === screenId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    } else {
        bottomNav.classList.remove('flex'); // Ensure flex is removed
        bottomNav.classList.add('hidden');
    }

    // Special renders / Refresh data if needed
    if (screenId === 'cart') renderCart();
    if (screenId === 'history') loadOrderHistory();
    if (screenId === 'profile') updateLoyaltySystem();
    if (screenId === 'wallet') renderWallet();

    // Refresh icons
    lucide.createIcons();

    // Scroll to top
    if (target) target.scrollTop = 0;
};

function toggleAuthMode() {
    const loginForm = document.getElementById('form-login');
    const signupForm = document.getElementById('form-signup');
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');

    if (loginForm.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        title.innerText = 'Welcome Back';
        subtitle.innerText = 'Sign in to continue your coffee journey';
    } else {
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        title.innerText = 'Join Drinkit!';
        subtitle.innerText = 'Create an account for the best experience';
    }
}

// --- Product Logic ---
async function loadProducts() {
    const productList = document.getElementById('product-list');

    if (sb) {
        const { data, error } = await sb.from('products').select('*');
        if (!error && data.length > 0) state.products = data;
        else state.products = demoProducts;
    } else {
        state.products = demoProducts;
    }

    if (state.currentScreen === 'home') showToast("Menu updated!");

    renderProducts();
}

function renderProducts() {
    const productList = document.getElementById('product-list');
    productList.innerHTML = state.products.map(product => `
        <div onclick="openProductModal(${product.id})" class="product-card group relative bg-white p-5 rounded-4xl cursor-pointer">
            <div class="relative h-56 mb-5 overflow-hidden rounded-3xl bg-primary-100">
                <img src="${product.image_url}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000">
                <div class="absolute top-4 left-4 glass px-3 py-1.5 rounded-full flex items-center gap-1.5">
                    <i data-lucide="star" class="w-3.5 h-3.5 fill-accent stroke-accent"></i>
                    <span class="text-[11px] font-black tracking-wider text-primary-900">4.8</span>
                </div>
                <div class="absolute bottom-4 right-4 bg-primary-900 text-white w-10 h-10 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <i data-lucide="plus" class="w-5 h-5"></i>
                </div>
            </div>
            <div class="px-2">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-xl font-black text-primary-900 leading-tight">${product.name}</h3>
                    <span class="text-lg font-black text-accent">$${product.price}</span>
                </div>
                <p class="text-primary-500 text-xs font-semibold uppercase tracking-widest leading-relaxed line-clamp-2">${product.description}</p>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
}

// --- Modal Logic ---
function openProductModal(productId) {
    const product = state.products.find(p => p.id === productId);
    state.currentProduct = product;

    document.getElementById('modal-name').innerText = product.name;
    document.getElementById('modal-description').innerText = product.description;
    document.getElementById('modal-image').src = product.image_url;

    // Reset selection
    selectSize('Small', 10);

    const modal = document.getElementById('product-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('add-to-cart-btn').onclick = () => {
        addToCart(product, state.selectedSize);
        closeProductModal();
    };
}

function closeProductModal() {
    const modal = document.getElementById('product-modal');
    modal.classList.add('hidden');
}

function selectSize(sizeName, price) {
    state.selectedSize = { name: sizeName, price: price };

    // Update UI
    document.querySelectorAll('.size-option').forEach(btn => {
        const nameNode = btn.querySelector('span:first-child');
        if (nameNode.innerText === sizeName.toUpperCase() || (sizeName === 'Medium' && nameNode.innerText === 'MED')) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

// --- Cart Logic ---
function addToCart(product, size) {
    state.cart.push({
        cartId: Date.now(),
        id: product.id,
        name: product.name,
        size: size.name,
        price: size.price,
        quantity: 1
    });

    updateCartCount();
    showToast(`Added ${product.name} to basket!`);
}

function updateCartCount() {
    const count = state.cart.length;
    const countDisplay = document.getElementById('cart-count');
    const navCountDisplay = document.getElementById('cart-count-nav');

    if (countDisplay) countDisplay.innerText = count;
    if (navCountDisplay) navCountDisplay.innerText = count;
}

function renderCart() {
    const container = document.getElementById('cart-items-container');
    if (state.cart.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-64 text-center">
                <i data-lucide="shopping-bag" class="w-16 h-16 text-primary-100 mb-4"></i>
                <p class="text-primary-400 font-bold">Your basket is empty</p>
                <button onclick="navigateTo('home')" class="mt-4 text-primary-700 font-black hover:underline">Browse Menu</button>
            </div>
        `;
        document.getElementById('checkout-btn').disabled = true;
    } else {
        container.innerHTML = state.cart.map((item, index) => `
            <div class="flex items-center gap-4 mb-6 bg-white p-4 rounded-3xl border border-primary-50 shadow-sm">
                <div class="w-20 h-20 rounded-2xl overflow-hidden bg-primary-50">
                    <img src="${state.products.find(p => p.id === item.id)?.image_url}" class="w-full h-full object-cover">
                </div>
                <div class="flex-1">
                    <h4 class="font-black text-primary-900">${item.name}</h4>
                    <p class="text-primary-900 text-xs font-bold uppercase">${item.size}</p>
                    <p class="text-primary-900 font-black mt-1">$${item.price}</p>
                </div>
                <div class="flex flex-col items-center gap-2">
                    <button onclick="removeFromCart(${index})" class="p-2 text-primary-200 hover:text-red-500 transition-colors">
                        <i data-lucide="trash-2" class="w-5 h-5"></i>
                    </button>
                </div>
            </div>
        `).join('');
        document.getElementById('checkout-btn').disabled = false;
    }

    const total = state.cart.reduce((sum, item) => sum + item.price, 0);
    document.getElementById('cart-total').innerText = `$${total.toFixed(2)}`;
    lucide.createIcons();
}

function removeFromCart(index) {
    state.cart.splice(index, 1);
    updateCartCount();
    renderCart();
}

// --- Order Flow ---
async function processCheckout() {
    if (state.cart.length === 0) return;

    const total = state.cart.reduce((sum, item) => sum + item.price, 0);
    const checkoutCart = [...state.cart]; // Copy cart to render receipt

    if (state.walletBalance < total) {
        showToast("Low balance! Add funds to your wallet.");
        navigateTo('wallet');
        return;
    }

    // Deduct from wallet
    state.walletBalance -= total;

    if (sb && state.user) {
        const { data: order, error: orderError } = await sb
            .from('orders')
            .insert([{
                user_id: state.user.id,
                total_price: total,
                status: 'Preparing'
            }])
            .select();

        if (!orderError) {
            const orderItems = checkoutCart.map(item => ({
                order_id: order[0].id,
                product_name: item.name,
                size: item.size,
                quantity: item.quantity,
                price: item.price
            }));

            await sb.from('order_items').insert(orderItems);
        }
    }

    // Prepare Receipt before navigating
    renderSuccessReceipt(checkoutCart, total);

    // Increase Loyalty Points
    state.loyaltyPoints += 5;

    // Success flow anyway for demo
    state.cart = [];
    updateCartCount();
    navigateTo('success');
}

function renderSuccessReceipt(cart, total) {
    const container = document.getElementById('order-receipt');
    if (!container) return;

    const dateStr = new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    container.innerHTML = `
        <div class="receipt-header">
            <h4 class="font-black text-primary-900 text-lg uppercase tracking-tight">Drinkit! Coffee</h4>
            <p class="text-[10px] text-primary-400 font-bold mt-1">${dateStr}</p>
        </div>
        <div class="receipt-body">
            ${cart.map(item => `
                <div class="receipt-item">
                    <span class="font-bold text-primary-900">${item.name} (${item.size})</span>
                    <span class="font-black text-primary-900">$${item.price.toFixed(2)}</span>
                </div>
            `).join('')}
            <div class="receipt-divider"></div>
            <div class="receipt-total">
                <span class="text-primary-600">TOTAL</span>
                <span class="text-primary-900">$${total.toFixed(2)}</span>
            </div>
        </div>
        <div class="mt-6 pt-4 border-t border-primary-50 text-center">
            <div class="mb-4 inline-flex items-center gap-2 bg-accent/10 px-3 py-1 rounded-full">
                <i data-lucide="zap" class="w-3 h-3 text-accent fill-accent"></i>
                <span class="text-[9px] font-black text-accent uppercase tracking-wider">+5 Points Earned</span>
            </div>
            <p class="text-[9px] font-black text-primary-300 uppercase tracking-[0.2em]">Thank you for your visit!</p>
        </div>
    `;
}

async function loadOrderHistory() {
    const container = document.getElementById('history-container');
    container.innerHTML = `<div class="animate-pulse space-y-4">
        ${[1, 2, 3].map(() => `<div class="h-24 bg-primary-50 rounded-2xl"></div>`).join('')}
    </div>`;

    let orders = [];
    let fetchError = false;

    if (sb && state.user) {
        try {
            const { data, error } = await sb
                .from('orders')
                .select('*, order_items(*)')
                .eq('user_id', state.user.id)
                .order('created_at', { ascending: false });

            if (!error && data) {
                orders = data;
            } else {
                fetchError = true;
            }
        } catch (e) {
            fetchError = true;
        }
    }

    if (!sb) {
        // Mock history if fetch fails or no user or no orders
        orders = [
            { id: 101, created_at: new Date().toISOString(), total_price: 25, status: 'Delivered', order_items: [{ product_name: 'Midnight Espresso', size: 'Large' }] },
            { id: 102, created_at: new Date().toISOString(), total_price: 10, status: 'Preparing', order_items: [{ product_name: 'Oat Milk Latte', size: 'Small' }] }
        ];
    }

    if (orders.length === 0) {
        container.innerHTML = `<p class="text-center py-20 text-primary-900 font-bold">No orders yet.</p>`;
    } else {
        container.innerHTML = orders.map(order => {
            const items = order.order_items || [];
            const firstItemName = items[0]?.product_name || 'Coffee Order';
            const dateStr = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

            return `
                <div class="bg-white p-6 rounded-[32px] shadow-sm border border-primary-50">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <p class="text-[10px] font-black uppercase text-primary-900 tracking-widest">Order #${order.id}</p>
                            <h4 class="font-black text-primary-900">${firstItemName}</h4>
                            <p class="text-xs text-primary-900">${dateStr}</p>
                        </div>
                        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-primary-50 text-primary-600'}">
                            ${order.status}
                        </span>
                    </div>
                    <div class="flex justify-between items-center pt-4 border-t border-primary-50">
                        <p class="text-primary-900 text-xs font-bold">${items.length} items</p>
                        <p class="text-primary-900 font-black">$${order.total_price}</p>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// --- Wallet & Loyalty Logic ---
function updateLoyaltySystem() {
    const pointsTotal = document.getElementById('loyalty-points-total');
    const progress = document.getElementById('loyalty-progress');
    const nextTierText = document.getElementById('loyalty-next-tier');
    const tierName = document.getElementById('profile-tier');

    if (!pointsTotal || !progress) return;

    const points = state.loyaltyPoints;
    pointsTotal.innerText = points;

    let currentTier = "Coffee Enthusiast";
    let nextTier = "Up-and-coming";
    let threshold = 250;

    if (points >= 1000) {
        currentTier = "Legendary Member";
        nextTier = "Max Tier Reached";
        threshold = points; // 100%
    } else if (points >= 500) {
        currentTier = "Regular Member";
        nextTier = "Legendary";
        threshold = 1000;
    } else if (points >= 250) {
        currentTier = "Up-and-coming Member";
        nextTier = "Regular";
        threshold = 500;
    }

    tierName.innerText = currentTier;
    const percentage = Math.min((points / threshold) * 100, 100);
    progress.style.width = `${percentage}%`;

    if (points < 1000) {
        const remaining = threshold - points;
        nextTierText.innerText = `${remaining} points until ${nextTier} tier`;
    } else {
        nextTierText.innerText = "You are a Coffee Legend!";
    }
}

function renderWallet() {
    const balanceText = document.getElementById('wallet-balance-total');
    if (balanceText) {
        balanceText.innerText = state.walletBalance.toFixed(2);
    }
}

function fundWallet() {
    state.walletBalance += 100;
    renderWallet();
    showToast("Wallet funded with $100.00!");

    // Add transaction to history
    const container = document.getElementById('wallet-transactions');
    if (container) {
        const transaction = document.createElement('div');
        transaction.className = "flex items-center justify-between p-4 bg-white rounded-3xl animate-in";
        transaction.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
                    <i data-lucide="arrow-down-left" class="w-5 h-5"></i>
                </div>
                <div>
                    <p class="font-black text-primary-900 text-sm">Wallet Funded</p>
                    <p class="text-[10px] text-primary-400 font-bold uppercase">Just Now</p>
                </div>
            </div>
            <p class="font-black text-green-600">+$100.00</p>
        `;
        container.insertBefore(transaction, container.firstChild);
        lucide.createIcons();
    }
}

// --- UI Helpers ---
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'bg-primary-600 text-white px-6 py-4 rounded-2xl shadow-2xl mb-4 mx-4 flex items-center gap-3 toast-enter pointer-events-auto';
    toast.innerHTML = `
        <i data-lucide="check-circle" class="w-5 h-5 text-green-400"></i>
        <span class="text-sm font-bold">${message}</span>
    `;
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease-in';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Initial Screen override for dev
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('screen')) window.navigateTo(urlParams.get('screen'));

