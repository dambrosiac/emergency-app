const socket = io();
let currentUser = null;
let map = null;
let markers = {};
let userList = [];

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

    try {
        const res = await fetch('/api/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();

        if (res.ok) {
            currentUser = data;
            loginScreen.classList.add('hidden');
            appScreen.classList.remove('hidden');
            initMap();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('Network error');
    }
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

    // Poll for other users
    fetchUsers();
    setInterval(fetchUsers, 5000);
}

function updatePosition(position) {
    const { latitude, longitude } = position.coords;
    const message = emergencyMessageInput.value;

    console.log("=== UPDATE POSITION ===");
    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);
    console.log("Message:", message);
    console.log("User ID:", currentUser.id);

    // Update server
    fetch('/api/update-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUser.id,
            lat: latitude,
            lng: longitude,
            message: message
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log("Server response:", data);
            if (data.user) {
                // Update local user state with server data including last_active
                currentUser.lat = data.user.lat;
                currentUser.lng = data.user.lng;
                currentUser.message = data.user.message;
                currentUser.last_active = data.user.last_active;
            }
        })
        .catch(err => {
            console.error("Error updating location:", err);
        });

    // Ensure self marker exists/updates
    updateMarker(currentUser);
}

// Update Message Button
updateMsgBtn.addEventListener('click', () => {
    console.log("Update button clicked");
    const originalText = updateMsgBtn.textContent;
    updateMsgBtn.textContent = "Updating...";
    updateMsgBtn.disabled = true;

    if (navigator.geolocation) {
        console.log("Requesting position (high accuracy)...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log("Position received");
                updatePosition(position);
                updateMsgBtn.textContent = originalText;
                updateMsgBtn.disabled = false;
            },
            (err) => {
                console.warn("High accuracy failed, trying low accuracy...", err);
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        console.log("Position received (low accuracy)");
                        updatePosition(position);
                        updateMsgBtn.textContent = originalText;
                        updateMsgBtn.disabled = false;
                    },
                    (err2) => {
                        console.warn("Geolocation failed, using last known position...", err2);
                        // Use last known position if available
                        if (currentUser.lat && currentUser.lng) {
                            const message = emergencyMessageInput.value;
                            console.log("Updating message with last known position");
                            console.log("Message:", message);

                            fetch('/api/update-location', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    userId: currentUser.id,
                                    lat: currentUser.lat,
                                    lng: currentUser.lng,
                                    message: message
                                })
                            })
                                .then(response => response.json())
                                .then(data => {
                                    console.log("Server response:", data);
                                    if (data.user) {
                                        currentUser.message = data.user.message;
                                        currentUser.last_active = data.user.last_active;
                                    }
                                    updateMarker(currentUser);
                                    alert("Message updated successfully!");
                                    updateMsgBtn.textContent = originalText;
                                    updateMsgBtn.disabled = false;
                                })
                                .catch(err => {
                                    console.error("Error updating:", err);
                                    alert("Error updating message: " + err.message);
                                    updateMsgBtn.textContent = originalText;
                                    updateMsgBtn.disabled = false;
                                });
                        } else {
                            alert("Cannot get location. Please wait for initial location to be detected.");
                            updateMsgBtn.textContent = originalText;
                            updateMsgBtn.disabled = false;
                        }
                    },
                    { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
                );
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
        updateMsgBtn.textContent = originalText;
        updateMsgBtn.disabled = false;
    }
});

async function fetchUsers() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        userList = users;

        console.log("Fetched users:", users); // Debug log

        updateDistressList(users);

        users.forEach(user => {
            updateMarker(user);
        });
    } catch (err) {
        console.error("Error fetching users:", err);
    }
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

    console.log("Sorted users:", sortedUsers); // Debug log

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

// Socket Listeners (Optional for real-time, but polling covers it too)
socket.on('location_update', (data) => {
    // We can update the specific marker immediately
    // But fetchUsers handles the list and everything comprehensively
    // We'll let the polling/fetchUsers handle the main state to keep it simple and consistent
    // Or we could optimize here. For now, rely on polling + fetchUsers.
});
