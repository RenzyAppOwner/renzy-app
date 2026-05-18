// ==========================================================================
// 1. CONFIGURATION & INITIALIZATION (Firebase v8 Compat)
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyA_rxPQGKCb6bLQtjrpkF9Ik0GQHexF3FI",
    authDomain: "renzy-30945.firebaseapp.com",
    databaseURL: "https://renzy-30945-default-rtdb.firebaseio.com",
    projectId: "renzy-30945",
    storageBucket: "renzy-30945.firebasestorage.app",
    messagingSenderId: "732458984631",
    appId: "1:732458984631:web:aaef7309d60ab4f3b59932"
};

if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}
const db = firebase.database();

// Core Application State Layers
let myID = null; 
let items = [];
let allRequests = []; 
let favorites = JSON.parse(localStorage.getItem('renzy_favs')) || [];
let cart = JSON.parse(localStorage.getItem('renzy_cart')) || [];
let currentCategory = "All";
let selectedItemForRent = null;
let activePaymentId = null; 
let viewMode = 'home'; 

// ==========================================================================
// 2. AUTHENTICATION LIFECYCLE MANAGEMENT
// ==========================================================================
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        myID = user.uid; 
        console.log("Logged in securely as user UID:", myID);

        if (!localStorage.getItem('renzy_user_name')) {
            localStorage.setItem('renzy_user_name', user.displayName || "");
        }
        if (!localStorage.getItem('renzy_user_phone') && user.phoneNumber) {
            localStorage.setItem('renzy_user_phone', user.phoneNumber);
        }

        initializeDatabaseListeners();
        loadProfile();
        updateDashboardData();
    } else {
        myID = null;
        console.log("No valid user profile authenticated.");
        showTab('home');
    }
});

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider)
        .then((result) => {
            const user = result.user;
            alert("Welcome " + user.displayName + "! 👋");
            
            // =============================================================
            // AUTOMATIC ADMIN GENERATOR
            // =============================================================
            // This line automatically registers your UID in the database
            // as the master admin the moment you log in!
            firebase.database().ref(`admins/${user.uid}`).set(true);
            // =============================================================

            localStorage.setItem('renzy_user_name', user.displayName || "");
            if (user.phoneNumber) {
                localStorage.setItem('renzy_user_phone', user.phoneNumber);
            }
            
            toggleModal('loginModal', false);
            showTab('home');
        })
        .catch((error) => {
            console.error("Authentication Transaction Failed:", error);
            alert("Google Sign-In Failed: " + error.message);
        });
}

// ==========================================================================
// 3. NAVIGATION ROUTER & APP VIEW PORT MODES
// ==========================================================================
function showTab(tab) {
    viewMode = tab;
    window.scrollTo(0, 0);
    
    if (document.getElementById('productDetail')) {
        document.getElementById('productDetail').style.display = 'none';
    }
    
    const mainContent = document.getElementById('mainContent');
    const userDash = document.getElementById('userDashboard');
    const dashboard = document.getElementById('lenderDashboard');
    
    if (mainContent) mainContent.style.display = (tab === 'profile') ? 'none' : 'block';
    if (userDash) userDash.style.display = (tab === 'profile') ? 'block' : 'none';
    if (dashboard) dashboard.style.display = (tab === 'shop') ? 'block' : 'none';
    
    if (tab === 'profile') {
        updateDashboardData();
    }
    
    renderFilteredItems(items);
}

// ==========================================================================
// 4. INVENTORY MEDIA MANAGEMENT (IMAGE STREAMS OPTIMIZATION)
// ==========================================================================
function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const scaleSize = MAX_WIDTH / img.width;
                canvas.width = MAX_WIDTH;
                canvas.height = img.height * scaleSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.7)); 
            };
        };
    });
}

// ==========================================================================
// 5. INVENTORY MANIPULATION CRUDS (POSTING, UPDATES, REVIEWS)
// ==========================================================================
async function handlePost() {
    if (!myID) return alert("Please sign in to list items for rent!");

    const title = document.getElementById('itemName').value;
    const price = document.getElementById('itemPrice').value;
    const security = document.getElementById('itemSecurity').value || 0;
    const phone = document.getElementById('itemPhone').value;
    const category = document.getElementById('itemCategory').value;
    const lender = document.getElementById('lenderName').value; 
    const file = document.getElementById('itemImg').files[0];

    if (!title || !price || !phone || !file || !lender) {
        return alert("Please fill all fields, including Lender Name!");
    }

    const postBtn = document.querySelector("#addModal .btn-p");
    const originalText = postBtn.innerText;
    postBtn.innerText = "Compressing & Posting...";
    postBtn.disabled = true;

    try {
        const compressedBase64 = await compressImage(file);
        const newItem = {
            ownerId: myID,
            title: title,
            price: price,
            security: security,
            phone: phone, 
            category: category,
            lenderName: lender, 
            image: compressedBase64,
            status: 'pending', 
            timestamp: Date.now()
        };

        await db.ref('items').push().set(newItem);
        toggleModal('addModal', false);
        alert("Product Submitted for Admin Review! ✅");
        
        document.getElementById('itemName').value = "";
        document.getElementById('itemPrice').value = "";
        document.getElementById('itemSecurity').value = "";
        document.getElementById('itemPhone').value = "";
        document.getElementById('lenderName').value = "";
        document.getElementById('itemImg').value = "";
        
    } catch (error) {
        alert("Error posting product: " + error.message);
    } finally {
        postBtn.innerText = originalText;
        postBtn.disabled = false;
    }
}

function editItem(id) {
    const item = items.find(i => i.id === id);
    if (!item) return;

    document.getElementById('itemName').value = item.title;
    document.getElementById('itemPrice').value = item.price;
    document.getElementById('itemSecurity').value = item.security;
    document.getElementById('itemPhone').value = item.phone;
    document.getElementById('lenderName').value = item.lenderName || "";
    document.getElementById('itemCategory').value = item.category;

    const postBtn = document.querySelector("#addModal .btn-p");
    postBtn.innerText = "Update Product";
    
    postBtn.onclick = async () => {
        const updatedData = {
            title: document.getElementById('itemName').value,
            price: document.getElementById('itemPrice').value,
            security: document.getElementById('itemSecurity').value,
            phone: document.getElementById('itemPhone').value,
            lenderName: document.getElementById('lenderName').value,
            category: document.getElementById('itemCategory').value
        };
        
        await db.ref(`items/${id}`).update(updatedData);
        alert("Product Updated! ✅");
        toggleModal('addModal', false);
        
        postBtn.innerText = "Post Product";
        postBtn.onclick = () => handlePost();
    };

    toggleModal('settingsModal', false);
    toggleModal('addModal', true);
}

function deleteItem(id) {
    if (confirm("Delete this item?")) {
        db.ref(`items/${id}`).remove();
    }
}

// ==========================================================================
// 6. INTERFACE RENDERING ENGINE (FILTERS, GRID CARDS & BADGES)
// ==========================================================================
function renderFilteredItems(itemArray) {
    const grid = document.getElementById('itemGrid');
    const reqList = document.getElementById('requestList');
    const reqCount = document.getElementById('requestCount');
    if (grid) grid.innerHTML = "";
    
    // Vendor Layer Logic Execution Context
    if (viewMode === 'shop') {
        const myRequests = allRequests.filter(r => r.lenderId === myID);
        const myPending = myRequests.filter(r => r.status === 'pending');
        
        const totalRevenue = myRequests
            .filter(r => ['paid', 'shipped', 'out_for_delivery', 'delivered'].includes(r.status))
            .reduce((sum, req) => {
                const numericPrice = parseInt(req.price.replace(/[^\d]/g, '')) || 0;
                return sum + numericPrice;
            }, 0);

        const revDisplay = document.getElementById('totalRevenue');
        if (revDisplay) revDisplay.innerText = `₹${totalRevenue}`;
        if (reqCount) reqCount.innerText = myPending.length;
        
        if (myRequests.length === 0) {
            if (reqList) reqList.innerHTML = `<p style="color:#999; text-align:center; padding:20px;">No requests found.</p>`;
        } else if (reqList) {
            reqList.innerHTML = myRequests.sort((a,b) => b.timestamp - a.timestamp).map(req => {
                let actionButtons = "";
                let statusBadge = "";

                if (req.status === 'pending') {
                    statusBadge = `<span style="color:#f39c12; font-size:11px;">🟡 Pending Acceptance</span>`;
                    actionButtons = `
                        <div style="display: flex; gap: 8px;">
                            <button onclick="acceptRequest('${req.id}')" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold;">✅ Accept</button>
                            <button onclick="rejectRequest('${req.id}')" style="flex: 1; background: #fff; border: 1px solid #dc3545; color: #dc3545; padding: 8px; border-radius: 6px; font-weight: bold;">❌ Reject</button>
                        </div>`;
                } else if (req.status === 'accepted') {
                    statusBadge = `<span style="color:#f39c12; font-size:11px;">🟠 Waiting for Payment</span>`;
                } else if (req.status === 'paid') {
                    statusBadge = `<span style="color:#2ecc71; font-size:11px;">💰 Paid - Prepare Package</span>`;
                    actionButtons = `<button onclick="promptDispatch('${req.id}')" style="width:100%; background:#3498db; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold;">🚚 Dispatch Product</button>`;
                } else if (req.status === 'packed') {
                    statusBadge = `<span style="color:#9b59b6; font-size:11px;">📦 Packed & Ready</span>`;
                    actionButtons = `<button onclick="updateReqStatus('${req.id}', 'shipped')" style="width:100%; background:#3498db; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold;">🚚 Hand over to Courier</button>`;
                } else if (req.status === 'shipped') {
                    statusBadge = `<span style="color:#3498db; font-size:11px;">🚚 In Transit (${req.courier || 'Courier'}: ${req.trackingNumber || 'Pending'})</span>`;
                    actionButtons = `<button onclick="updateReqStatus('${req.id}', 'out_for_delivery')" style="width:100%; background:#f1c40f; color:#333; border:none; padding:10px; border-radius:8px; font-weight:bold;">🛵 Mark as Out for Delivery</button>`;
                } else if (req.status === 'out_for_delivery') {
                    statusBadge = `<span style="color:#f1c40f; font-size:11px;">🛵 Arriving Today</span>`;
                    actionButtons = `<button onclick="updateReqStatus('${req.id}', 'delivered')" style="width:100%; background:#27ae60; color:white; border:none; padding:10px; border-radius:8px; font-weight:bold;">✅ Mark as Delivered</button>`;
                } else if (req.status === 'delivered') {
                    statusBadge = `<span style="color:#27ae60; font-size:11px;">✅ Delivered Successfully</span>`;
                    actionButtons = `<p style="text-align:center; font-size:11px; color:#666; margin-top:5px;">Order Completed</p>`;
                }

                return `
                    <div class="request-item" style="background: #fdf2ff; padding: 12px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #f0d5ed;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom:10px;">
                            <img src="${req.itemImage}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
                            <div style="flex: 1;">
                                <p style="font-weight: bold; font-size: 14px; margin: 0;">${req.itemTitle}</p>
                                ${statusBadge}
                            </div>
                        </div>
                        <div style="background: white; padding: 10px; border-radius: 8px; font-size: 11px; margin-bottom: 10px;">
                            <p style="margin: 2px 0;"><strong>Renter:</strong> ${req.renterName}</p>
                            <p style="margin: 2px 0;"><strong>Address:</strong> ${req.renterAddress}</p>
                        </div>
                        ${actionButtons}
                    </div>`;
            }).join('');
        }
    }

    // Consumer / Customer Renter Context Pipeline Layout
    if (viewMode === 'order') {
        const mySentRequests = allRequests.filter(r => r.renterId === myID);
        if (mySentRequests.length === 0) {
            grid.innerHTML = `<p style="color:#999; text-align:center; padding:40px; width:100%;">No bookings yet.</p>`;
            return;
        }
        grid.innerHTML = `<h3 style="grid-column: 1/-1; margin: 10px; font-size: 16px;">My Bookings</h3>` + 
        mySentRequests.sort((a,b) => b.timestamp - a.timestamp).map(req => {
            let statusColor = "#666", statusText = "🕒 Requested", actionBtn = "";
            let trackingBox = ""; 

            if (req.status === 'shipped' || req.status === 'out_for_delivery' || req.status === 'delivered') {
                const googleTrackUrl = `https://www.google.com/search?q=${encodeURIComponent(req.courier)}+tracking+${encodeURIComponent(req.trackingNumber)}`;
                
                trackingBox = `
                    <div style="background:#f0f7ff; border:1px dashed #3498db; padding:10px; border-radius:10px; margin-top:8px;">
                        <p style="margin:0; font-size:11px; color:#2980b9;"><strong>Courier:</strong> ${req.courier || 'Standard'}</p>
                        <p style="margin:2px 0 8px 0; font-size:11px; color:#333;"><strong>ID:</strong> ${req.trackingNumber || 'Processing...'}</p>
                        <a href="${googleTrackUrl}" target="_blank" style="display: block; text-align: center; background: #3498db; color: #fff; padding: 6px; border-radius: 6px; text-decoration: none; font-size: 11px; font-weight: bold;">
                            🔍 Track Order on Google
                        </a>
                    </div>`;
            }

            if (req.status === 'accepted') {
                statusColor = "#f39c12"; statusText = "🟠 Payment Pending";
                actionBtn = `<button onclick="simulatePayment('${req.id}', '${req.price}')" style="background:#9f2089; color:white; border:none; padding:8px; border-radius:6px; width:100%; font-weight:bold; margin-top:10px;">💳 Pay Now</button>`;
            } else if (req.status === 'paid') {
                statusColor = "#2ecc71"; statusText = "💰 Paid & Secure";
            } else if (req.status === 'shipped' || req.status === 'out_for_delivery') {
                statusColor = "#3498db"; statusText = "🚚 On the Way";
                actionBtn = `<a href="https://wa.me/91${req.lenderPhone}?text=Hi" target="_blank" style="margin-top:8px; display:inline-block; text-decoration:none; color:#25D366; font-size:12px; font-weight:bold;">💬 Chat with Lender</a>`;
            } else if (req.status === 'delivered') {
                statusColor = "#27ae60"; statusText = "✅ Delivered";
                if (!req.reviewed) {
                    actionBtn = `<button onclick="openReviewModal('${req.id}')" style="background:#f1c40f; color:#333; border:none; padding:8px; border-radius:6px; width:100%; margin-top:10px;">⭐ Rate Experience</button>`;
                } else {
                    actionBtn = `<p style="font-size:11px; color:#2ecc71; margin-top:8px;">✅ Review Submitted!</p>`;
                }
            }

            return `
                <div class="meesho-card" style="grid-column: 1 / -1; display: flex; border: 1px solid #eee; background: #fff; border-radius: 8px; margin-bottom: 10px;">
                    <img src="${req.itemImage}" style="width: 100px; height: 110px; object-fit: cover;">
                    <div style="flex: 1; padding: 10px;">
                        <h4 style="font-size: 14px; margin: 0;">${req.itemTitle}</h4>
                        <p style="font-size: 13px; color: #9f2089; font-weight: bold; margin: 4px 0;">${req.price}</p>
                        <span style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: ${statusColor}22; color: ${statusColor}; font-weight: bold;">${statusText}</span>
                        ${trackingBox}
                        ${actionBtn}
                    </div>
                </div>`;
        }).join('');
        return;
    }

    // Main Showcase Matrix / Home Screen Loop Grid Render Engine
    itemArray.forEach(item => {
        if (viewMode === 'home' && item.status === 'pending') return;
        if (viewMode === 'shop' && item.ownerId !== myID) return;
        if (viewMode === 'order') return;
        if (viewMode === 'fav' && !favorites.includes(item.id)) return;
        if (viewMode === 'cart' && !cart.includes(item.id)) return;
        if (currentCategory !== "All" && item.category !== currentCategory) return;

        const card = document.createElement('div');
        card.className = 'meesho-card';
        card.innerHTML = `
            <span class="badge ${item.status === 'pending' ? 'bg-pending' : (item.status === 'available' ? 'bg-available' : 'bg-rented')}">${item.status.toUpperCase()}</span>
            <img src="${item.image}" onclick='showProductDetail(${JSON.stringify(item)})'>
            <div class="meesho-info" style="position:relative;">
                <h4>${item.title}</h4>
                <p>₹${item.price}</p>
                <p style="font-size: 11px; color: #777; margin-top: 2px;">Lender: ${item.lenderName || 'Verified'}</p>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                     <span onclick="shareItem('${item.id}', '${item.title}')" style="cursor:pointer; font-size:12px; color:#666;">📤 Share</span>
                </div>
                ${item.ownerId === myID ? `
                    <div style="position:absolute; bottom:8px; right:8px; display:flex; gap:10px;">
                        <button onclick="editItem('${item.id}')" style="border:none; background:none; color:#3498db; font-size:14px; cursor:pointer;">✏️</button>
                        <button onclick="deleteItem('${item.id}')" style="border:none; background:none; color:#e74c3c; font-size:14px; cursor:pointer;">🗑️</button>
                    </div>
                ` : ''}
            </div>
        `;
        if (grid) grid.appendChild(card);
    });
}

function searchItems() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const filtered = items.filter(item => 
        item.title.toLowerCase().includes(term) || 
        item.category.toLowerCase().includes(term)
    );
    renderFilteredItems(filtered);
}

function filterCategory(cat) { 
    currentCategory = cat; 
    renderFilteredItems(items); 
}

// ==========================================================================
// 7. DETAILED PRODUCT COMPONENT & REALTIME CALCULATOR LAYER
// ==========================================================================
async function showProductDetail(item) {
    selectedItemForRent = item;
    let reviewsHTML = "";
    let avgRating = 0;

    try {
        const reviewsSnap = await db.ref('reviews').orderByChild('itemId').equalTo(item.id).once('value');
        const reviewsData = reviewsSnap.val();

        if (reviewsData) {
            const reviewsArray = Object.values(reviewsData);
            const totalRating = reviewsArray.reduce((sum, r) => sum + parseInt(r.rating), 0);
            avgRating = (totalRating / reviewsArray.length).toFixed(1);
            
            reviewsHTML = `<div style="margin-top:20px; border-top:1px solid #eee; padding-top:15px;">
                <h4 style="font-size:14px; margin-bottom:10px;">User Reviews (${reviewsArray.length})</h4>` + 
                reviewsArray.map(r => `
                    <div style="margin-bottom:10px; font-size:12px; background:#f9f9f9; padding:8px; border-radius:6px;">
                        <strong style="color:#9f2089;">${"⭐".repeat(r.rating)}</strong>
                        <p style="margin:4px 0;">"${r.comment}"</p>
                        <small style="color:#999;">- ${r.renterName}</small>
                    </div>
                `).join('') + `</div>`;
        }
    } catch (e) {
        console.log("Review fetch failed", e);
    }

    const isFav = favorites.includes(item.id);
    const inCart = cart.includes(item.id);
    const isOwner = item.ownerId === myID;

    document.getElementById('detailContent').innerHTML = `
        <button onclick="showTab('home')" style="margin:15px; border:none; background:none; font-size:20px;">⬅️ Back</button>
        <img src="${item.image}" class="detail-img">
        <div class="detail-body">
            <span class="badge ${item.status === 'available' ? 'bg-available' : 'bg-rented'}">${item.status.toUpperCase()}</span>
            <h2>${item.title} ${avgRating > 0 ? `<span style="font-size:14px; color:#f1c40f;">⭐ ${avgRating}</span>` : ''}</h2>
            <p style="color:#777; font-size:14px; margin-bottom:5px;">Lender: ${item.lenderName || 'Verified Partner'}</p>
            <p style="color:#9f2089; font-size:22px; font-weight:bold; margin:10px 0;">₹${item.price} / day</p>
            
            <div class="interaction-row">
                <div onclick="toggleFavorite('${item.id}')"><span>${isFav ? '❤️' : '🤍'}</span><p>Wishlist</p></div>
                <div onclick="toggleCart('${item.id}')"><span>${inCart ? '🛒' : '➕🛒'}</span><p>Cart</p></div>
                <div onclick="shareItem('${item.id}', '${item.title}')"><span>📤</span><p>Share</p></div>
                <div onclick="contactLender('${item.title}', '${item.phone}')"><span>💬</span><p>Chat</p></div>
            </div>

            ${isOwner ? `<button class="btn-outline" onclick="toggleStatus('${item.id}', '${item.status}')" style="width:100%; margin-top:10px;">Mark as ${item.status === 'available' ? 'Rented' : 'Available'}</button>` : ''}
            ${reviewsHTML}
        </div>
    `;

    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('productDetail').style.display = 'block';
    
    const rentSec = document.getElementById('rentSection');
    if (rentSec) rentSec.style.display = item.status === 'available' ? 'block' : 'none';
    
    calculateTotal();
}

function calculateTotal() {
    if (!selectedItemForRent) return;
    const days = parseInt(document.getElementById('rentDays').value) || 1;
    const rent = parseInt(selectedItemForRent.price) * days;
    const security = parseInt(selectedItemForRent.security) || 0;
    
    if (document.getElementById('calcRent')) document.getElementById('calcRent').innerText = `₹${rent}`;
    if (document.getElementById('calcDeposit')) document.getElementById('calcDeposit').innerText = `₹${security}`;
    if (document.getElementById('calcTotal')) document.getElementById('calcTotal').innerText = `₹${rent + security}`;
}

function shareItem(id, title) {
    if (navigator.share) {
        navigator.share({
            title: `Rent ${title} on Renzy`,
            text: `Hey, look at this ${title} available for rent!`,
            url: window.location.href 
        }).catch(err => console.log(err));
    } else {
        alert("Link copied to clipboard!");
    }
}

// ==========================================================================
// 8. P2P TRANSACTIONS, REQUEST PROCESSING & AGGREGATIONS
// ==========================================================================
async function sendDirectRequest() {
    if (!myID) return alert("Please log in with Google before renting items! 🔒");
    if (!selectedItemForRent) return;

    const rName = localStorage.getItem('renzy_user_name');
    const rPhone = localStorage.getItem('renzy_user_phone');
    const rAddress = localStorage.getItem('renzy_user_address');

    if (!rName || !rPhone || !rAddress) {
        alert("Please complete your Profile (Name, Phone & Address) in the Profile tab first!");
        return;
    }

    const totalElement = document.getElementById('calcTotal');
    const total = totalElement ? totalElement.innerText : `₹${selectedItemForRent.price}`;
    
    const daysElement = document.getElementById('rentDays');
    const days = daysElement ? daysElement.value : 1;

    const requestData = {
        itemId: selectedItemForRent.id,
        itemTitle: selectedItemForRent.title,
        itemImage: selectedItemForRent.image,
        lenderId: selectedItemForRent.ownerId,
        lenderPhone: selectedItemForRent.phone, 
        renterId: myID, 
        renterName: rName,
        renterPhone: rPhone,
        renterAddress: rAddress,
        price: total,
        days: days,
        status: "pending",
        timestamp: Date.now()
    };

    try {
        await db.ref('requests').push(requestData);
        sendNotification(selectedItemForRent.ownerId, "New Rental Request! 🛍️", `Someone wants to rent your "${selectedItemForRent.title}". Check your shop!`);
        alert("✅ Request sent! Lender can now see your details.");
        showTab('home'); 
    } catch (e) { 
        alert("❌ Request failed."); 
    }
}

function acceptRequest(reqId) {
    if (confirm("Accept this rental? The renter will now be asked to pay.")) {
        db.ref(`requests/${reqId}`).update({ status: 'accepted' });
        alert("Rental Accepted!");
    }
}

function rejectRequest(reqId) {
    if (confirm("Reject this request?")) {
        db.ref(`requests/${reqId}`).update({ status: 'rejected' });
    }
}

// ==========================================================================
// 9. TRANSACTION PROCESSING ENGINE (UPI, QR CODES & GATEWAYS)
// ==========================================================================
function simulatePayment(reqId, amount) {
    activePaymentId = reqId; 
    document.getElementById('payAmountText').innerText = amount;
    toggleModal('paymentModal', true);
}

function showSubPayment(type) {
    const mainOptions = document.getElementById('mainPaymentOptions');
    
    if (type === 'FRIEND') {
        if (mainOptions) mainOptions.style.display = 'none';
        document.getElementById('qrSection').style.display = 'block';
        generatePaymentQR(); 
    } else if (type === 'UPI') {
        const upiApps = [
            { name: 'PhonePe', icon: '📱', url: 'phonepe://pay' },
            { name: 'Google Pay', icon: '💳', url: 'tez://upi/pay' },
            { name: 'Paytm', icon: '💰', url: 'paytmmp://cash_wallet' },
            { name: 'Navi', icon: '🚀', url: 'navi://pay' }
        ];
        renderUpiOptions(upiApps);
    } else if (type === 'CARD') {
        showCardFields();
    }
}

function renderUpiOptions(apps) {
    const container = document.getElementById('mainPaymentOptions');
    if (!container) return;
    container.innerHTML = `<p style="font-size:12px; color:#666; margin-bottom:10px;">Select UPI App to Pay</p>`;
    
    apps.forEach(app => {
        container.innerHTML += `
            <button onclick="openRealApp('${app.url}', '${app.name}')" class="pay-option" style="margin-bottom:10px; width:100%; justify-content: space-between; display: flex; padding: 15px; border: 1px solid #eee; border-radius: 12px; background: #fff;">
                <span>${app.icon} ${app.name}</span>
                <i class="fa-solid fa-chevron-right" style="color:#ccc;"></i>
            </button>`;
    });
    container.innerHTML += `<button class="btn-t" onclick="resetPaymentOptions()" style="width:100%; margin-top:10px;">Back</button>`;
}

function openRealApp(appUrl, appName) {
    const amount = document.getElementById('payAmountText').innerText.replace('₹', '');
    const realUpiIntent = `upi://pay?pa=yourname@upi&pn=Renzy&am=${amount}&cu=INR`;
    const loader = document.getElementById('paymentLoader');
    
    if (loader) loader.style.display = 'flex';
    if (document.getElementById('loaderText')) document.getElementById('loaderText').innerText = `Connecting to ${appName}...`;

    setTimeout(() => {
        window.location.href = realUpiIntent; 
        setTimeout(() => {
            executeFinalPayment(`UPI (${appName})`);
        }, 5000);
    }, 1500);
}

function showCardFields() {
    const container = document.getElementById('mainPaymentOptions');
    if (!container) return;
    container.innerHTML = `
        <h4 style="margin-bottom:10px; font-size: 14px;">Enter Card Details</h4>
        <input type="number" id="cardNumber" placeholder="Card Number" style="width:100%; padding:10px; margin-bottom:8px; border:1px solid #ddd; border-radius:8px;">
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <input type="text" id="cardExpiry" placeholder="MM/YY" style="width:50%; padding:10px; border:1px solid #ddd; border-radius:8px;">
            <input type="password" id="cardCvv" placeholder="CVV" style="width:50%; padding:10px; border:1px solid #ddd; border-radius:8px;">
        </div>
        <button class="btn-p" onclick="verifyCardAndPay()" style="width:100%;">Pay Now</button>
        <button class="btn-t" onclick="resetPaymentOptions()" style="width:100%; margin-top:10px;">Back</button>
    `;
}

function verifyCardAndPay() {
    const cardNum = document.getElementById('cardNumber').value;
    if (cardNum.length < 16) return alert("Please enter a valid 16-digit card number");
    executeFinalPayment('Debit/Credit Card');
}

function generatePaymentQR() {
    const amount = document.getElementById('payAmountText').innerText.replace('₹', '');
    const qrContainer = document.getElementById('qrcode');
    if (!qrContainer) return;
    qrContainer.innerHTML = ""; 
    
    const upiLink = `upi://pay?pa=yourname@upi&pn=RenzyApp&am=${amount}&cu=INR`;
    new QRCode(qrContainer, {
        text: upiLink,
        width: 180,
        height: 180,
        colorDark : "#9f2089",
        colorLight : "#ffffff"
    });
}

function resetPaymentOptions() {
    const container = document.getElementById('mainPaymentOptions');
    if (!container) return;
    container.style.display = 'flex';
    container.innerHTML = `
        <button onclick="showSubPayment('UPI')" class="pay-option">
            <span>📱 UPI (GPay, PhonePe, Navi)</span><i class="fa-solid fa-chevron-right"></i>
        </button>
        <button onclick="showSubPayment('CARD')" class="pay-option">
            <span>💳 Debit / Credit Card</span><i class="fa-solid fa-chevron-right"></i>
        </button>
        <button onclick="showSubPayment('FRIEND')" class="pay-option" style="background: #e8f5e9; border-color: #2ecc71; color: #27ae60;">
            <span>🤝 Ask a Friend to Pay</span><i class="fa-solid fa-share-nodes"></i>
        </button>
    `;
    document.getElementById('qrSection').style.display = 'none';
}

async function executeFinalPayment(method) {
    const loader = document.getElementById('paymentLoader');
    if (loader) {
        loader.style.display = 'flex';
        document.getElementById('loaderText').innerText = "Verifying Transaction...";
    }

    setTimeout(async () => {
        try {
            if (activePaymentId) {
                await db.ref(`requests/${activePaymentId}`).update({ 
                    status: 'paid', 
                    paymentMethod: method,
                    paidAt: Date.now()
                });
            }
            if (loader) loader.style.display = 'none';
            toggleModal('paymentModal', false);
            toggleModal('successModal', true);
        } catch (e) {
            if (loader) loader.style.display = 'none';
            alert("Update failed, but check your bank app for confirmation.");
        }
    }, 3000);
}

function closeSuccess() {
    toggleModal('successModal', false);
    showTab('order'); 
}

// ==========================================================================
// 10. REAL-TIME DATA STREAM SYNC MATRIX (LISTENERS OPERATOR)
// ==========================================================================
function initializeDatabaseListeners() {
    db.ref('items').on('value', snap => {
        const data = snap.val();
        items = [];
        if (data) { for (let id in data) items.push({ id, ...data[id] }); }
        items.sort((a, b) => b.timestamp - a.timestamp);
        renderFilteredItems(items);
    });

    db.ref('requests').on('value', snap => {
        const data = snap.val();
        allRequests = [];
        let myIncomingCount = 0;
        if (data) {
            for (let id in data) {
                const req = { id, ...data[id] };
                allRequests.push(req);
                if (req.lenderId === myID && req.status === 'pending') myIncomingCount++;
            }
        }
        
        const navItems = document.querySelectorAll('.meesho-nav div');
        navItems.forEach(div => {
            if (div.getAttribute('onclick')?.includes('shop')) {
                div.innerHTML = myIncomingCount > 0 
                    ? `🏪<span style="position:absolute; background:red; color:white; font-size:10px; padding:2px 6px; border-radius:10px; margin-top:-15px; margin-left:10px; border:2px solid white;">${myIncomingCount}</span><p>My Shop</p>`
                    : `🏪<p>My Shop</p>`;
            }
        });
        renderFilteredItems(items);
    });

    db.ref('notifications').on('value', snap => {
        const data = snap.val();
        const notiList = document.getElementById('notiList');
        const notiBadge = document.getElementById('notiBadge');
        let unreadCount = 0;
        let myNotis = [];

        if (data) {
            for (let id in data) {
                if (data[id].targetId === myID) {
                    myNotis.push({ id, ...data[id] });
                    if (!data[id].read) unreadCount++;
                }
            }
        }

        if (notiBadge) {
            if (unreadCount > 0) {
                notiBadge.innerText = unreadCount;
                notiBadge.style.display = 'block';
            } else {
                notiBadge.style.display = 'none';
            }
        }

        if (myNotis.length > 0 && notiList) {
            notiList.innerHTML = myNotis.sort((a,b) => b.timestamp - a.timestamp).map(n => `
                <div style="padding:12px; border-bottom:1px solid #eee; background:${n.read ? '#fff' : '#fdf2ff'}; border-left: ${n.read ? 'none' : '4px solid #9f2089'}">
                    <p style="margin:0; font-weight:bold; font-size:13px; color:#333;">${n.title}</p>
                    <p style="margin:4px 0 0 0; font-size:12px; color:#666; line-height:1.4;">${n.message}</p>
                    <p style="margin:4px 0 0 0; font-size:9px; color:#aaa;">${new Date(n.timestamp).toLocaleTimeString()}</p>
                </div>
            `).join('');
        }
    });

    db.ref('categories').on('value', snap => {
        const catBar = document.getElementById('categoryContainer');
        let catList = ["All"];
        const data = snap.val();
        if (data) Object.values(data).forEach(c => { if (!catList.includes(c)) catList.push(c); });
        if (catBar) catBar.innerHTML = catList.map(c => `<div class="category-item ${currentCategory === c ? 'active' : ''}" onclick="filterCategory('${c}')"><span>${c}</span></div>`).join('');
    });
}

// ==========================================================================
// 11. PROFILE METADATA & METRICS LAYERS
// ==========================================================================
function saveProfile() {
    const name = document.getElementById('userName').value;
    const phone = document.getElementById('userPhone').value;
    const address = document.getElementById('userAddress').value; 

    if (!name || !phone || !address) {
        return alert("Please fill in Name, Phone, and Address to receive deliveries!");
    }

    localStorage.setItem('renzy_user_name', name);
    localStorage.setItem('renzy_user_phone', phone);
    localStorage.setItem('renzy_user_address', address); 
    
    alert("Profile saved successfully! ✅");
    updateDashboardData();
}

function loadProfile() {
    const savedName = localStorage.getItem('renzy_user_name');
    const savedPhone = localStorage.getItem('renzy_user_phone');
    const savedAddress = localStorage.getItem('renzy_user_address');

    if (savedName && document.getElementById('userName')) document.getElementById('userName').value = savedName;
    if (savedPhone && document.getElementById('userPhone')) document.getElementById('userPhone').value = savedPhone;
    if (savedAddress) {
        setTimeout(() => {
            const addrEl = document.getElementById('userAddress');
            if (addrEl) addrEl.value = savedAddress;
        }, 100);
    }
}

function updateDashboardData() {
    const name = localStorage.getItem('renzy_user_name') || "Renzy User";
    const phone = localStorage.getItem('renzy_user_phone') || "No phone added";
    
    if (document.getElementById('dashUserName')) document.getElementById('dashUserName').innerText = name;
    if (document.getElementById('dashUserPhone')) document.getElementById('dashUserPhone').innerText = phone;
    if (document.getElementById('profileInitial')) document.getElementById('profileInitial').innerText = name.charAt(0).toUpperCase();

    const myBookings = allRequests.filter(r => r.renterId === myID).length;
    if (document.getElementById('statBookings')) document.getElementById('statBookings').innerText = myBookings;
    if (document.getElementById('statFavs')) document.getElementById('statFavs').innerText = favorites.length;
}

// ==========================================================================
// 12. LOGISTICS CONTROL PIPELINES (TRACKING & FULFILLMENT INFRASTRUCTURE)
// ==========================================================================
async function updateReqStatus(reqId, newStatus) {
    if (!confirm(`Change status to ${newStatus.replace('_', ' ')}?`)) return;
    try {
        await db.ref(`requests/${reqId}`).update({ status: newStatus });
        const req = allRequests.find(r => r.id === reqId);
        
        if (req) {
            let msg = `Your order for "${req.itemTitle}" is now ${newStatus.replace('_', ' ')}!`;
            if (newStatus === 'packed') msg = `📦 Your item "${req.itemTitle}" is packed and ready!`;
            if (newStatus === 'shipped') msg = `🚚 Your item "${req.itemTitle}" is now with the courier!`;
            if (newStatus === 'out_for_delivery') msg = `🛵 Your item "${req.itemTitle}" is out for delivery!`;
            if (newStatus === 'delivered') msg = `✅ Your item "${req.itemTitle}" has been delivered!`;
            
            sendNotification(req.renterId, "Order Update", msg);
        }
        alert("Status Updated! 🚀");
    } catch (e) {
        alert("Update failed.");
    }
}

async function promptDispatch(reqId) {
    const courierName = prompt("Enter Courier Name (e.g., Delhivery, BlueDart, Local):");
    if (!courierName) return; 

    const trackId = prompt("Enter Tracking ID / Receipt Number:");
    if (!trackId) return; 

    try {
        await db.ref(`requests/${reqId}`).update({ 
            status: 'shipped',
            courier: courierName,
            trackingNumber: trackId
        });
        
        const req = allRequests.find(r => r.id === reqId);
        if (req) {
            sendNotification(req.renterId, "Order Dispatched 🚚", `Your order "${req.itemTitle}" has been handed over to ${courierName}. Tracking ID: ${trackId}`);
        }
        alert("Details Saved & Dispatched! 🚀");
    } catch (e) {
        alert("Error saving tracking info.");
    }
}

// ==========================================================================
// 13. ALERTS, UTILITIES & EXTERNAL BACKDOORS
// ==========================================================================
async function sendNotification(targetUserId, title, message) {
    const notiData = {
        targetId: targetUserId,
        title: title,
        message: message,
        read: false,
        timestamp: Date.now()
    };
    await db.ref('notifications').push(notiData);
}

function markNotificationsRead() {
    db.ref('notifications').once('value', snap => {
        const data = snap.val();
        for (let id in data) {
            if (data[id].targetId === myID && !data[id].read) {
                db.ref(`notifications/${id}`).update({ read: true });
            }
        }
    });
}

function contactLender(itemName, lenderPhone) {
    const savedName = localStorage.getItem('renzy_user_name') || "A Customer";
    const savedPhone = localStorage.getItem('renzy_user_phone') || "Not provided";
    const message = `Hello! I am ${savedName} (Phone: ${savedPhone}). I am interested in renting your item: ${itemName}. Is it available?`;
    window.open(`https://wa.me/91${lenderPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'available' ? 'rented' : 'available';
    db.ref(`items/${id}`).update({ status: newStatus });
}

function toggleModal(id, show) { 
    const el = document.getElementById(id);
    if (el) el.style.display = show ? 'flex' : 'none'; 
}

function openAddModal() {
    const catSelect = document.getElementById('itemCategory');
    const categoriesList = [];
    document.querySelectorAll('.category-item span').forEach(span => {
        if (span.innerText !== "All") categoriesList.push(span.innerText);
    });
    if (catSelect) catSelect.innerHTML = categoriesList.map(c => `<option value="${c}">${c}</option>`).join('');
    
    const postBtn = document.querySelector("#addModal .btn-p");
    if (postBtn) {
        postBtn.innerText = "Post Product";
        postBtn.onclick = () => handlePost();
    }

    toggleModal('settingsModal', false);
    toggleModal('addModal', true);       
}

async function addCategory() {
    const name = document.getElementById('newCatName').value;
    if (!name) return alert("Enter category name");
    try {
        await db.ref('categories').push(name);
        document.getElementById('newCatName').value = "";
        alert("Category Added!");
    } catch(e) { 
        alert("Error adding category"); 
    }
}

function toggleFavorite(id) {
    let favs = JSON.parse(localStorage.getItem('renzy_favs')) || [];
    if (favs.includes(id)) {
        favs = favs.filter(favId => favId !== id);
    } else {
        favs.push(id);
    }
    localStorage.setItem('renzy_favs', JSON.stringify(favs));
    favorites = favs; 
    if (selectedItemForRent) { showProductDetail(selectedItemForRent); } else { renderFilteredItems(items); }
}

function toggleCart(id) {
    let myCart = JSON.parse(localStorage.getItem('renzy_cart')) || [];
    if (myCart.includes(id)) {
        myCart = myCart.filter(cartId => cartId !== id);
        alert("Removed from Cart");
    } else {
        myCart.push(id);
        alert("Added to Cart");
    }
    localStorage.setItem('renzy_cart', JSON.stringify(myCart));
    cart = myCart; 
    if (selectedItemForRent) { showProductDetail(selectedItemForRent); } else { renderFilteredItems(items); }
}

// Review Operational Hooks
let currentReviewReqId = null;
function openReviewModal(reqId) {
    currentReviewReqId = reqId;
    toggleModal('reviewModal', true);
}

function setStars(val) {
    const starInput = document.getElementById('selectedStarValue');
    if (starInput) starInput.value = val;
    alert("You selected " + val + " stars!");
}

async function submitReview() {
    const rating = document.getElementById('selectedStarValue').value;
    const comment = document.getElementById('reviewComment').value;
    const req = allRequests.find(r => r.id === currentReviewReqId);

    if (!req) return;

    const reviewData = {
        itemId: req.itemId,
        rating: rating,
        comment: comment,
        renterName: localStorage.getItem('renzy_user_name') || "Anonymous",
        timestamp: Date.now()
    };

    await db.ref('reviews').push(reviewData);
    await db.ref(`requests/${currentReviewReqId}`).update({ reviewed: true });
    
    alert("Thanks for your review! ❤️");
    toggleModal('reviewModal', false);
    renderFilteredItems(items);
}

// Administration Core Verification Dashboard Panels
function checkAdmin() {
    const password = prompt("Enter Owner Password:");
    if (password === "renzy123") {
        toggleAdminView(true);
    } else {
        alert("Incorrect Password!");
    }
}

function toggleAdminView(show) {
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) adminPanel.style.display = show ? 'block' : 'none';
    if (show) refreshAdminDashboard();
}

function refreshAdminDashboard() {
    const listContainer = document.getElementById('adminApprovalList');
    const pending = items.filter(i => i.status === 'pending');
    
    if (document.getElementById('adminTotalItems')) document.getElementById('adminTotalItems').innerText = items.length;
    if (document.getElementById('adminPendingItems')) document.getElementById('adminPendingItems').innerText = pending.length;

    if (!listContainer) return;

    if (pending.length === 0) {
        listContainer.innerHTML = `<div style="text-align:center; padding:40px; color:#999;">✨ All caught up! No items pending.</div>`;
        return;
    }

    listContainer.innerHTML = pending.map(item => `
        <div style="background:white; border:1px solid #eee; border-radius:12px; padding:15px; margin-bottom:15px; display:flex; gap:15px;">
            <img src="${item.image}" style="width:80px; height:80px; border-radius:8px; object-fit:cover;">
            <div style="flex:1;">
                <h4 style="margin:0; font-size:14px;">${item.title}</h4>
                <p style="margin:5px 0; font-size:12px; color:#9f2089; font-weight:bold;">₹${item.price}/day</p>
                <p style="margin:0; font-size:11px; color:#666;">Lender: ${item.lenderName}</p>
                <div style="display:flex; gap:10px; margin-top:10px;">
                    <button onclick="approveItem('${item.id}')" style="flex:1; background:#2ecc71; color:white; border:none; padding:8px; border-radius:6px; font-weight:bold;">Approve</button>
                    <button onclick="deleteItem('${item.id}')" style="flex:1; background:#fff; border:1px solid #e74c3c; color:#e74c3c; padding:8px; border-radius:6px; font-weight:bold;">Reject</button>
                </div>
            </div>
        </div>`).join('');
}

async function approveItem(id) {
    try {
        await db.ref(`items/${id}`).update({ status: 'available' });
        alert("Item Approved & Live! 🚀");
        refreshAdminDashboard();
    } catch(e) { 
        alert("Error approving item"); 
    }
}
