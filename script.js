// --- 1. CONFIGURATION & INITIALIZATION ---
const firebaseConfig = {
    apiKey: "AIzaSyA_rxPQGKCb6bLQtjrpkF9Ik0GQHexF3FI",
    authDomain: "renzy-30945.firebaseapp.com",
    databaseURL: "https://renzy-30945-default-rtdb.firebaseio.com",
    projectId: "renzy-30945",
    storageBucket: "renzy-30945.firebasestorage.app",
    messagingSenderId: "732458984631",
    appId: "1:732458984631:web:aaef7309d60ab4f3b59932"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.database();

// --- SAFE DEVICE IDENTITY ---
let myID = localStorage.getItem('renzy_user_id') || 'user_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('renzy_user_id', myID);

let items = [];
let allRequests = []; 
let favorites = JSON.parse(localStorage.getItem('renzy_favs')) || [];
let cart = JSON.parse(localStorage.getItem('renzy_cart')) || [];
let myOrders = JSON.parse(localStorage.getItem('renzy_orders')) || []; 
let currentCategory = "All";
let selectedItemForRent = null;
let viewMode = 'home'; 

// --- 2. NAVIGATION ---
function showTab(tab) {
    viewMode = tab;
    window.scrollTo(0,0);
    document.getElementById('productDetail').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    const dashboard = document.getElementById('lenderDashboard');
    if (dashboard) {
        dashboard.style.display = (tab === 'shop') ? 'block' : 'none';
    }
    
    renderFilteredItems(items);
}

// --- 3. IMAGE COMPRESSION ---
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

// --- 4. POSTING, EDITING & DELETING ---
async function handlePost() {
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
            status: 'available',
            timestamp: Date.now()
        };

        await db.ref('items').push().set(newItem);
        toggleModal('addModal', false);
        alert("Product Posted Successfully!");
        
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

// --- 5. UI RENDERING ---
function renderFilteredItems(itemArray) {
    const grid = document.getElementById('itemGrid');
    const reqList = document.getElementById('requestList');
    const reqCount = document.getElementById('requestCount');
    grid.innerHTML = "";
    
    if (viewMode === 'shop') {
        const myIncoming = allRequests.filter(r => r.lenderId === myID && r.status === 'pending');
        
        // --- REVENUE CALCULATION ---
        const totalRevenue = allRequests
            .filter(r => r.lenderId === myID && r.status === 'accepted')
            .reduce((sum, req) => {
                const numericPrice = parseInt(req.price.replace(/[^\d]/g, '')) || 0;
                return sum + numericPrice;
            }, 0);

        const revDisplay = document.getElementById('totalRevenue');
        if (revDisplay) revDisplay.innerText = `₹${totalRevenue}`;
        // ---------------------------

        if(reqCount) reqCount.innerText = myIncoming.length;
        
        if (myIncoming.length === 0) {
            reqList.innerHTML = `<p style="color:#999; font-size:13px; text-align:center; padding:20px;">No pending requests.</p>`;
        } else {
            reqList.innerHTML = myIncoming.map(req => `
                <div class="request-item" style="background: #fdf2ff; padding: 12px; border-radius: 10px; margin-bottom: 10px; border: 1px solid #f0d5ed;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom:10px;">
                        <img src="${req.itemImage}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
                        <div style="flex: 1;">
                            <p style="font-weight: bold; font-size: 14px; margin: 0;">${req.itemTitle}</p>
                            <p style="font-size: 12px; color: #666;">Total: ${req.price} | ${req.days} Days</p>
                        </div>
                    </div>
                    <div style="background: white; padding: 10px; border-radius: 8px; font-size: 12px; margin-bottom: 10px; border: 1px solid #eee;">
                        <p style="margin: 2px 0;"><strong>Renter:</strong> ${req.renterName || 'Unknown'}</p>
                        <p style="margin: 2px 0;"><strong>Phone:</strong> ${req.renterPhone || 'N/A'}</p>
                        <p style="margin: 2px 0;"><strong>Address:</strong> ${req.renterAddress || 'Not provided'}</p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button onclick="acceptRequest('${req.id}', '${req.itemId}')" style="flex: 1; background: #28a745; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer;">✅ Accept</button>
                        <button onclick="rejectRequest('${req.id}')" style="flex: 1; background: #fff; border: 1px solid #dc3545; color: #dc3545; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer;">❌ Reject</button>
                    </div>
                </div>
            `).join('');
        }
    }

    if (viewMode === 'order') {
        const mySentRequests = allRequests.filter(r => r.renterId === myID);
        if (mySentRequests.length === 0) {
            grid.innerHTML = `<p style="color:#999; text-align:center; padding:40px; width:100%; grid-column: 1 / -1;">You haven't booked anything yet.</p>`;
            return;
        }

        grid.innerHTML = `<h3 style="grid-column: 1/-1; margin: 10px; font-size: 16px; color: #333;">My Booking History</h3>` + 
        mySentRequests.sort((a,b) => b.timestamp - a.timestamp).map(req => {
            let statusColor = "#666"; 
            let statusText = "🕒 Requested";
            let contactBtn = "";

            if (req.status === 'accepted') {
                statusColor = "#28a745"; 
                statusText = "✅ Accepted";
                contactBtn = `<a href="https://wa.me/91${req.lenderPhone}?text=Hi, you accepted my request for ${req.itemTitle}!" target="_blank" style="margin-top:8px; display:inline-block; text-decoration:none; color:#25D366; font-size:12px; font-weight:bold;">💬 Chat</a>`;
            } else if (req.status === 'rejected') {
                statusColor = "#dc3545"; 
                statusText = "❌ Rejected";
            }

            return `
                <div class="meesho-card" style="grid-column: 1 / -1; display: flex; flex-direction: row; height: auto; min-height: 110px; align-items: center; border: 1px solid #eee; background: #fff; border-radius: 8px; margin-bottom: 10px; width: 100%; overflow: hidden;">
                    <img src="${req.itemImage}" style="width: 100px; height: 110px; object-fit: cover;">
                    <div class="meesho-info" style="flex: 1; padding: 10px;">
                        <h4 style="font-size: 14px; margin: 0;">${req.itemTitle}</h4>
                        <p style="font-size: 13px; color: #9f2089; font-weight: bold; margin: 4px 0;">Total: ${req.price} (${req.days} Days)</p>
                        <span style="font-size: 10px; padding: 3px 8px; border-radius: 12px; background: ${statusColor}22; color: ${statusColor}; font-weight: bold; display: inline-block;">
                            ${statusText}
                        </span>
                        <p style="font-size: 9px; color: #bbb; margin-top: 5px;">Requested: ${new Date(req.timestamp).toLocaleDateString()}</p>
                        ${contactBtn}
                    </div>
                </div>
            `;
        }).join('');
        return; 
    }

    itemArray.forEach(item => {
        if (viewMode === 'shop' && item.ownerId !== myID) return;
        if (viewMode === 'order') return;
        if (viewMode === 'fav' && !favorites.includes(item.id)) return;
        if (viewMode === 'cart' && !cart.includes(item.id)) return;
        if (currentCategory !== "All" && item.category !== currentCategory) return;

        const card = document.createElement('div');
        card.className = 'meesho-card';
        card.innerHTML = `
            <span class="badge ${item.status === 'available' ? 'bg-available' : 'bg-rented'}">${item.status.toUpperCase()}</span>
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
        grid.appendChild(card);
    });
}

// --- 6. DETAIL VIEW & ACTIONS ---
function showProductDetail(item) {
    selectedItemForRent = item;
    const isFav = favorites.includes(item.id);
    const inCart = cart.includes(item.id);
    const isOwner = item.ownerId === myID;

    document.getElementById('detailContent').innerHTML = `
        <button onclick="showTab('home')" style="margin:15px; border:none; background:none; font-size:20px;">⬅️ Back</button>
        <img src="${item.image}" class="detail-img">
        <div class="detail-body">
            <span class="badge ${item.status === 'available' ? 'bg-available' : 'bg-rented'}">${item.status.toUpperCase()}</span>
            <h2>${item.title}</h2>
            <p style="color:#777; font-size:14px; margin-bottom:5px;">Lender: ${item.lenderName || 'Verified Partner'}</p>
            <p style="color:#9f2089; font-size:22px; font-weight:bold; margin:10px 0;">₹${item.price} / day</p>
            <div class="interaction-row">
                <div onclick="toggleFavorite('${item.id}')"><span>${isFav ? '❤️' : '🤍'}</span><p>Wishlist</p></div>
                <div onclick="toggleCart('${item.id}')"><span>${inCart ? '🛒' : '➕🛒'}</span><p>Cart</p></div>
                <div onclick="shareItem('${item.id}', '${item.title}')"><span>📤</span><p>Share</p></div>
                <div onclick="contactLender('${item.title}', '${item.phone}')" style="cursor:pointer; text-align:center;">
                    <span>💬</span><p>Chat</p>
                </div>
            </div>
            ${isOwner ? `<button class="btn-outline" onclick="toggleStatus('${item.id}', '${item.status}')">Mark as ${item.status === 'available' ? 'Rented' : 'Available'}</button>` : ''}
        </div>
    `;
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('productDetail').style.display = 'block';
    document.getElementById('rentSection').style.display = item.status === 'available' ? 'block' : 'none';
    calculateTotal();
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

// --- 7. FIREBASE REQUEST LOGIC ---
async function sendDirectRequest() {
    if (!selectedItemForRent) return;

    const rName = localStorage.getItem('renzy_user_name');
    const rPhone = localStorage.getItem('renzy_user_phone');
    const rAddress = localStorage.getItem('renzy_user_address');

    if (!rName || !rPhone) {
        alert("Please complete your Profile (Name & Phone) in the Menu first!");
        return;
    }

    const total = document.getElementById('calcTotal').innerText;
    const days = document.getElementById('rentDays').value;

    const requestData = {
        itemId: selectedItemForRent.id,
        itemTitle: selectedItemForRent.title,
        itemImage: selectedItemForRent.image,
        lenderId: selectedItemForRent.ownerId,
        lenderPhone: selectedItemForRent.phone, 
        renterId: myID, 
        renterName: rName,
        renterPhone: rPhone,
        renterAddress: rAddress || "Address not set",
        price: total,
        days: days,
        status: "pending",
        timestamp: Date.now()
    };

    try {
        await db.ref('requests').push(requestData);
        alert("✅ Request sent! Lender can now see your details.");
        showTab('home'); 
    } catch (e) { alert("❌ Request failed."); }
}

function acceptRequest(reqId, itemId) {
    if(confirm("Accept this rental?")) {
        db.ref(`items/${itemId}`).update({ status: 'rented' });
        db.ref(`requests/${reqId}`).update({ status: 'accepted' });
        alert("Rental Accepted!");
    }
}

function rejectRequest(reqId) {
    if(confirm("Reject this request?")) {
        db.ref(`requests/${reqId}`).update({ status: 'rejected' });
    }
}

// --- 8. REAL-TIME DATA LISTENERS ---
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

// --- HELPER UI FUNCTIONS ---
function calculateTotal() {
    if (!selectedItemForRent) return;
    const days = parseInt(document.getElementById('rentDays').value) || 1;
    const rent = parseInt(selectedItemForRent.price) * days;
    const security = parseInt(selectedItemForRent.security) || 0;
    document.getElementById('calcRent').innerText = `₹${rent}`;
    document.getElementById('calcDeposit').innerText = `₹${security}`;
    document.getElementById('calcTotal').innerText = `₹${rent + security}`;
}

function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'available' ? 'rented' : 'available';
    db.ref(`items/${id}`).update({ status: newStatus });
}

function deleteItem(id) {
    if (confirm("Delete this item?")) db.ref(`items/${id}`).remove();
}

function toggleModal(id, show) { document.getElementById(id).style.display = show ? 'flex' : 'none'; }
function filterCategory(cat) { currentCategory = cat; renderFilteredItems(items); }

db.ref('categories').on('value', snap => {
    const catBar = document.getElementById('categoryContainer');
    let catList = ["All"];
    const data = snap.val();
    if (data) Object.values(data).forEach(c => { if(!catList.includes(c)) catList.push(c); });
    catBar.innerHTML = catList.map(c => `<div class="category-item ${currentCategory === c ? 'active' : ''}" onclick="filterCategory('${c}')"><span>${c}</span></div>`).join('');
});

function openAddModal() {
    const catSelect = document.getElementById('itemCategory');
    const categories = [];
    document.querySelectorAll('.category-item span').forEach(span => {
        if(span.innerText !== "All") categories.push(span.innerText);
    });
    catSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    
    const postBtn = document.querySelector("#addModal .btn-p");
    postBtn.innerText = "Post Product";
    postBtn.onclick = () => handlePost();

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
    } catch(e) { alert("Error adding category"); }
}

function searchItems() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const filtered = items.filter(item => 
        item.title.toLowerCase().includes(term) || 
        item.category.toLowerCase().includes(term)
    );
    renderFilteredItems(filtered);
}

function changeLanguage(lang) { console.log("Language changed to:", lang); }

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

function checkAdmin() {
    const password = prompt("Enter Owner Password:");
    if (password === "renzy123") {
        document.getElementById('adminArea').style.display = 'block';
        alert("Welcome, Owner!");
    } else {
        alert("Incorrect Password!");
    }
}

function saveProfile() {
    const name = document.getElementById('userName').value;
    const phone = document.getElementById('userPhone').value;
    const address = document.getElementById('userAddress') ? document.getElementById('userAddress').value : "";

    if (!name || !phone) return alert("Please fill in both Name and Phone!");

    localStorage.setItem('renzy_user_name', name);
    localStorage.setItem('renzy_user_phone', phone);
    localStorage.setItem('renzy_user_address', address);
    alert("Profile saved successfully! ✅");
}

function loadProfile() {
    const savedName = localStorage.getItem('renzy_user_name');
    const savedPhone = localStorage.getItem('renzy_user_phone');
    const savedAddress = localStorage.getItem('renzy_user_address');

    if (savedName) document.getElementById('userName').value = savedName;
    if (savedPhone) document.getElementById('userPhone').value = savedPhone;
    if (savedAddress && document.getElementById('userAddress')) {
        document.getElementById('userAddress').value = savedAddress;
    }
}

loadProfile();

function contactLender(itemName, lenderPhone) {
    const savedName = localStorage.getItem('renzy_user_name') || "A Customer";
    const savedPhone = localStorage.getItem('renzy_user_phone') || "Not provided";
    const message = `Hello! I am ${savedName} (Phone: ${savedPhone}). I am interested in renting your item: ${itemName}. Is it available?`;
    window.open(`https://wa.me/91${lenderPhone}?text=${encodeURIComponent(message)}`, '_blank');
}
