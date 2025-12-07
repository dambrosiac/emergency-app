// --- DEMO MODE (GitHub Pages) ---
// Since we are hosted on GitHub Pages (static), we cannot connect to a real backend.
// This script mocks the backend behavior for demonstration purposes.

// Mock Socket.io
const socket = { on: () => { }, emit: () => { } };

let currentUser = null;
let map = null;
let markers = {};
let userList = [
    { id: 99, username: "DemoUser1", lat: 19.0760, lng: 72.8777, message: "Help needed!", last_active: Date.now() },
    { id: 98, username: "PoliceBot", lat: 19.0800, lng: 72.8800, message: "On patrol", last_active: Date.now() }
];

// --- DOM Elements ---
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const usernameInput = document.getElementById('username');
const loginBtn = document.getElementById('login-btn');
const emergencyMessageInput = document.getElementById('emergency-message');
const updateMsgBtn = document.getElementById('update-msg-btn');
const distressList = document.getElementById('distress-list');

// --- Auth Functions ---

async function joinApp() {
    const username = usernameInput.value.trim();

    if (!username) {
        alert('Please enter your name');
        return;
    }

    // Mock API Call
    console.log("Mocking /api/join for", username);

    setTimeout(() => {
        currentUser = {
            id: Math.floor(Math.random() * 1000),
            username: username,
            lat: null,
            lng: null,
            message: "",
            last_active: Date.now()
        };

        loginScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');

        // Show Demo Alert
        const demoBanner = document.createElement('div');
        demoBanner.style = "background: #f39c12; color: #fff; padding: 10px; text-align: center; font-weight: bold;";
        demoBanner.innerText = "⚠️ PROTOTYPE MODE: No live server connection (GitHub Pages is static). Data is local only.";
        document.body.insertBefore(demoBanner, document.querySelector('header'));

        initMap();
    }, 500);
}

loginBtn.addEventListener('click', joinApp);

// Allow Enter key to trigger Update button
emergencyMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        updateMsgBtn.click();
    }
});

// --- Map Functions ---

function initMap() {
    // Default to Mumbai if geolocation fails
    map = L.map('map').setView([19.0760, 72.8777], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '©OpenStreetMap, ©CartoDB'
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(updatePosition, (err) => console.error(err), {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        });
    }

    // Poll for other users (Mocked)
    fetchUsers();
    setInterval(fetchUsers, 5000);
}

function updatePosition(position) {
    const { latitude, longitude } = position.coords;
    const message = emergencyMessageInput.value;

    console.log("=== UPDATE POSITION (MOCK) ===");

    // Update local state directly
    if (currentUser) {
        currentUser.lat = latitude;
        currentUser.lng = longitude;
        currentUser.message = message;
        currentUser.last_active = Date.now();

        updateMarker(currentUser);
    }
}

// Update Message Button
updateMsgBtn.addEventListener('click', () => {
    const originalText = updateMsgBtn.textContent;
    updateMsgBtn.textContent = "Updating...";
    updateMsgBtn.disabled = true;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                updatePosition(position);
                alert("Message updated! (Simulated)");
                updateMsgBtn.textContent = originalText;
                updateMsgBtn.disabled = false;
            },
            (err) => {
                alert("Could not get location.");
                updateMsgBtn.textContent = originalText;
                updateMsgBtn.disabled = false;
            }
        );
    } else {
        alert("Geolocation not supported.");
    }
});

async function fetchUsers() {
    // Mock API: Return static list + current user
    let displayList = [...userList];
    if (currentUser && currentUser.lat) {
        displayList.push(currentUser);
    }

    console.log("Mock fetchUsers:", displayList);
    updateDistressList(displayList);

    displayList.forEach(user => {
        updateMarker(user);
    });
}

function updateMarker(user) {
    if (!user.lat || !user.lng) return;

    const popupContent = `
        <b>${user.username}</b><br>
        <span style="color:red">${user.message || 'No message'}</span><br>
        <small>Last active: ${new Date(user.last_active || Date.now()).toLocaleTimeString()}</small>
    `;

    if (markers[user.id]) {
        markers[user.id].setLatLng([user.lat, user.lng]);
        markers[user.id].setPopupContent(popupContent);
    } else {
        const marker = L.marker([user.lat, user.lng]).addTo(map);
        marker.bindPopup(popupContent);
        markers[user.id] = marker;
    }
}

// --- Distress List Functions ---

function updateDistressList(users) {
    distressList.innerHTML = '';

    // Sort users by last_active timestamp, most recent first
    const sortedUsers = users
        .filter(user => user.lat && user.lng) // Only include users with location
        .sort((a, b) => (b.last_active || 0) - (a.last_active || 0));

    sortedUsers.forEach(user => {
        const li = document.createElement('li');
        li.className = 'distress-item';
        li.innerHTML = `
            <strong>${user.username}</strong>
            <span>${user.message || 'No message'}</span>
        `;
        li.onclick = () => {
            map.setView([user.lat, user.lng], 18);
            if (markers[user.id]) {
                markers[user.id].openPopup();
            }
        };
        distressList.appendChild(li);
    });
}

