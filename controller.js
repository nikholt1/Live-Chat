
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
    import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
    import { getFirestore, doc, deleteDoc, setDoc, updateDoc, arrayRemove, getDoc, collection, query, getDocs, arrayUnion, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
    import { orderBy } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
    import { where } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
    import { serverTimestamp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";



    const blue = '\x1b[34m';
    const orange = '\x1b[38;5;214m'; // ANSI code for orange
    const red = '\x1b[31m';

    // Reset color
    const reset = '\x1b[0m';

    // Firebase configuration
    const firebaseConfig = {
        ... 
    };

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // Helper function to subscribe user to default rooms
    async function subscribeUserToDefaultRooms(userId) {
        const rooms = ["Meeting", "Help"];
        const userRef = doc(db, "users", userId);

        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (!userData.rooms || !userData.rooms.includes("Meeting") || !userData.rooms.includes("Help")) {
                await setDoc(userRef, {
                    rooms: arrayUnion(...rooms)
                }, { merge: true });
            }
        } else {
            await setDoc(userRef, {
                email: auth.currentUser.email,
                profileName: "",
                rooms: rooms
            });
        }
    }
    // Check if the user is signed in



    // Function to display rooms in the HTML list
    async function displayRooms() {
        const roomsList = document.getElementById('roomsList');
        const roomsRef = collection(db, "rooms");

        try {
            const querySnapshot = await getDocs(roomsRef);
            roomsList.innerHTML = ''; // Clear existing rooms

            querySnapshot.forEach((doc) => {
                const roomData = doc.data();
                const roomName = roomData.roomName;

                const roomItem = document.createElement('div');
                roomItem.classList.add('room-item');
                roomItem.innerHTML = `<img class="roomsimage" src="Logo%20transparent.png " alt="${roomName}">
                                  <p>${roomName}</p>`;

                roomItem.onclick = () => displayRoomDetails(doc.id);

                roomsList.appendChild(roomItem);
            });
        } catch (error) {
            console.error("Error fetching rooms: ", error);
            roomsList.innerHTML = '<p>Error loading rooms. Please try again later.</p>';
        }
    }

    // Function to display room details
    let currentRoomId = null; // Initialize the currentRoomId globally

    // Function to display room details
    async function displayRoomDetails(roomId) {
        const roomRef = doc(db, "rooms", roomId);
        const roomSnap = await getDoc(roomRef);

        if (roomSnap.exists()) {
            const roomData = roomSnap.data();
            document.getElementById("roomName").textContent = roomData.roomName;
            document.getElementById("roomDescription").textContent = roomData.description;
            document.getElementById("roomId").textContent = `Room ID: ${roomId}`;

            // Update the currentRoomId
            currentRoomId = roomId;  // Set the current room ID

            // Display messages in the room
            displayMessages(roomId);

            // Listen for active calls in the current room
            listenToCalls(roomId); // Start listening for active calls in this room
        } else {
            console.log("No such room!");
        }
    }

    async function checkForActiveCall(roomId) {
        const callsRef = collection(db, "rooms", roomId, "calls");
        const q = query(callsRef, where("active", "==", true));

        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            // If there are active calls, display call info
            snapshot.forEach((doc) => {
                const callData = doc.data();
                console.log("Active call found:", callData);

                // Show the call container and the join/disconnect buttons
                showCallContainer(roomId, doc.id);
            });
        } else {
            // If no active calls, hide the call container
            document.getElementById('callContainer').style.display = 'none';
        }
    }

    let currentRoomListener = null; // Variable to hold the room's listener

    async function displayMessages(roomId) {
        const chatContent = document.getElementById('chatContent');
        const messagesRef = collection(db, "rooms", roomId, "messages");

        // If there's an active listener, remove it (for when changing rooms)
        if (currentRoomListener) {
            currentRoomListener();  // Unsubscribes from the previous room's listener
            currentRoomListener = null;
        }

        // Clear the chat content immediately when switching rooms
        chatContent.innerHTML = ''; // Clears any previous messages

        // Set up the real-time listener for new messages (ordered by timestamp)
        currentRoomListener = onSnapshot(query(messagesRef, orderBy("timestamp", "asc")), (snapshot) => {
            if (snapshot.empty) {
                console.log("No messages.");
                chatContent.innerHTML = '<p>No messages yet.</p>'; // Display message when no messages exist
                return;
            }

            // Loop through each change in the snapshot (only new ones)
            snapshot.docChanges().forEach(change => {
                if (change.type === "added") {
                    // Only add new messages to the chat
                    const newMessage = change.doc.data();
                    console.log("New message data: ", newMessage);

                    // Only display non-empty messages
                    if (newMessage.text && newMessage.text.trim() !== "") {
                        const newMessageElement = document.createElement('div');
                        // Display the new message in the format: "timestamp: username: message"
                        const timestamp = new Date(newMessage.timestamp).toLocaleString();
                        newMessageElement.textContent = `${timestamp}: ${newMessage.username}: ${newMessage.text}`;

                        // Append to the bottom of the chat
                        chatContent.appendChild(newMessageElement);
                    } else {
                        console.log("Skipping empty new message");
                    }

                    // Scroll to the latest message (bottom)
                    chatContent.scrollTop = chatContent.scrollHeight;
                }
            });
        });
    }








    const sendButton = document.getElementById('sendButton');
    const messageInput = document.getElementById('messageInput');
    const roomIdElement = document.getElementById('roomId');

    // When clicking the send button
    // Add an event listener for the "Send" button
    // When clicking the send button
    sendButton.addEventListener('click', async () => {
        const message = messageInput.value.trim();

        // Don't send an empty message
        if (!message) {
            console.log("Message cannot be empty");
            return; // Don't proceed if message is empty
        }

        if (!currentRoomId) {
            console.log("Room ID is invalid");
            return; // Exit if no room ID is set
        }

        // Get current user's profile name (username)
        const user = auth.currentUser;
        const userId = user.uid;
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            console.log("User data not found");
            return;
        }

        const userData = userSnap.data();
        const username = userData.profileName || "Unknown User"; // Default to "Unknown User" if profile name is missing

        // Send message to Firestore
        console.log("Sending message: ", message);
        const messagesRef = collection(db, "rooms", currentRoomId, "messages");

        try {
            // Send the message to Firestore with timestamp and username
            await addDoc(messagesRef, {
                text: message,
                timestamp: Date.now(),
                username: username,  // Store the username
                userId: userId
            });

            console.log("Message sent successfully:", message);

            // Clear input and focus on input field
            messageInput.value = '';
            messageInput.focus();

        } catch (error) {
            console.error("Error sending message: ", error);
        }
    });

    // Listen for active calls in the current room
    listenToCalls(roomId);


    // Function to update roomId for the current room (when switching rooms)


    // Initialize display on page load



    // Function to display messages in the room


    // Listen for authentication state changes
    import { getDatabase, ref, onDisconnect, set } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is authenticated
            const userId = user.uid;
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);

            // 🔔 Realtime Database reference
            const dbRT = getDatabase();
            const userStatusRef = ref(dbRT, `status/${userId}`);

            // 🌐 Set status to online in Realtime Database
            set(userStatusRef, { state: "online", last_changed: Date.now() });

            // ⚡ Ensure status changes to offline when the browser/tab is closed
            onDisconnect(userStatusRef).set({ state: "offline", last_changed: Date.now() });

            if (userSnap.exists()) {
                const data = userSnap.data();
                document.getElementById("userEmail").textContent = data.email;
                document.getElementById("savedName").textContent = data.profileName;

                // Update user status in Firestore
                await setDoc(userRef, { status: "online" }, { merge: true });

                // Subscribe the user to rooms and display them
                await subscribeUserToDefaultRooms(userId);
                await displayUsers();  // Display users when logged in
                await displayRooms();  // Populate the rooms when the page is loaded
            } else {
                await setDoc(userRef, { email: user.email, profileName: "New User", status: "online" });
            }

            // Update user document if profileName is missing
            const data = userSnap.data();
            if (!data.profileName) {
                await setDoc(userRef, { profileName: "Default Name" }, { merge: true });
            }

        } else {
            // User is not authenticated
            console.log("User is not authenticated");

            // 📴 Set offline status in Realtime Database before redirect
            if (auth.currentUser) {
                const dbRT = getDatabase();
                const userStatusRef = ref(dbRT, `status/${auth.currentUser.uid}`);
                await set(userStatusRef, { state: "offline", last_changed: Date.now() });
            }

            window.location.href = "login.html";  // Redirect to login page
        }
    });




    // Function to log out the user


    // Call this function to populate rooms when the page loads
    window.onload = function () {
        displayRooms(); // Populate the rooms when the page is loaded
    };

    // Send Message


    // Send Message

    // Function to toggle the settings visibility and show the username input


    // Add event listener to the "Save" button to save the new username to Firestore
    document.getElementById('saveUsernameButton').addEventListener('click', async () => {
        const newUsername = document.getElementById('usernameInput').value.trim();

        if (!newUsername) {
            alert("Please enter a username.");
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            alert("You must be logged in to change your username.");
            return;
        }

        // Update the username in Firestore
        const userRef = doc(db, "users", user.uid);
        try {
            await setDoc(userRef, { profileName: newUsername }, { merge: true });
            alert("Username updated successfully!");

            // Update the UI to reflect the change
            document.getElementById("savedName").textContent = newUsername;

            // Hide the username input field after saving
            document.getElementById('usernameSettings').style.display = 'none';
        } catch (error) {
            console.error("Error updating username: ", error);
            alert("Error updating username. Please try again.");
        }
    });

    import {  onValue } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-database.js";

    async function displayUsers() {
        const usersList = document.getElementById('userList');
        const usersRef = collection(db, "users");
        const dbRT = getDatabase();

        try {
            const querySnapshot = await getDocs(usersRef);
            usersList.innerHTML = ''; // Clear existing users

            querySnapshot.forEach((doc) => {
                const userData = doc.data();
                const userName = userData.profileName;
                const userId = doc.id; // Get the user document ID

                const userItem = document.createElement('div');
                userItem.classList.add('user-item');
                userItem.innerHTML = `<p>${userName}</p>`;

                // Status Dot
                const statusDot = document.createElement('span');
                statusDot.style.width = '10px';
                statusDot.style.height = '10px';
                statusDot.style.borderRadius = '50%';
                statusDot.style.marginLeft = '5px';
                statusDot.style.backgroundColor = 'lightgrey'; // Default offline

                userItem.appendChild(statusDot);
                usersList.appendChild(userItem);

                // Real-time listener for status
                const statusRef = ref(dbRT, `status/${userId}`);
                onValue(statusRef, (snapshot) => {
                    const status = snapshot.val();
                    if (status && status.state === "online") {
                        statusDot.style.backgroundColor = 'green';
                    } else {
                        statusDot.style.backgroundColor = 'lightgrey';
                    }
                });

                // Click Event to Open Private Room
                userItem.addEventListener('click', async () => {
                    const currentUser = auth.currentUser;
                    const currentUserId = currentUser.uid;
                    const currentUsername = document.getElementById("savedName").textContent;
                    const otherUsername = userName;

                    await createPrivateRoom(currentUserId, currentUsername, userId, otherUsername);
                });
            });
        } catch (error) {
            console.error("Error fetching users: ", error);
            usersList.innerHTML = '<p>Error loading users. Please try again later.</p>';
        }
    }


    async function createPrivateRoom(currentUserId, currentUsername, otherUserId, otherUsername) {
        const roomName = `${currentUsername}:${otherUsername}`; // Unique room name
        const roomsRef = collection(db, "rooms");
        const roomQuery = query(roomsRef, where("roomName", "==", roomName));
        const roomSnapshot = await getDocs(roomQuery);

        let roomId;

        if (roomSnapshot.empty) {
            // Create a new room if it doesn't exist
            const newRoomRef = await addDoc(roomsRef, {
                roomName: roomName,
                users: [currentUserId, otherUserId]
            });
            console.log("Room created:", roomName);
            roomId = newRoomRef.id;
        } else {
            // Use the existing room
            console.log("Room already exists:", roomName);
            roomId = roomSnapshot.docs[0].id;
        }

        // Display the room like other rooms
        await displayRoomDetails(roomId);
    }

    // ...


    // Adding the event listener for starting the call
    // 📞 Start Call Button Event Listener
    document.getElementById('startCallButton').addEventListener('click', async () => {
        if (!currentRoomId) {
            console.log("No room selected.");
            return;
        }
        await startCall(currentRoomId);
    });

    // 🚀 Start Call Function
    async function startCall(roomId) {
        const callsRef = collection(db, "rooms", roomId, "calls");
        const callData = {
            timestamp: serverTimestamp(),
            active: true,
            users: [auth.currentUser.uid],
            creatorId: auth.currentUser.uid
        };

        try {
            const callDocRef = await addDoc(callsRef, callData);
            showCallContainer(roomId, callDocRef.id);
            console.log("Call started:", callDocRef.id);
        } catch (error) {
            console.error("Error starting call:", error);
        }
    }

    // 👂 Real-time Listener for Active Calls
    async function listenToCalls(roomId) {
        if (!roomId || typeof roomId !== 'string') {
            console.error('Invalid roomId');
            return;
        }

        try {
            const callsRef = collection(db, "rooms", roomId, "calls");
            const q = query(callsRef, where("active", "==", true));  // Query for active calls

            // Listen for changes in the active calls
            onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    console.log("No active calls in this room.");
                    document.getElementById('callContainer').style.display = 'none';  // Hide call container if no active call
                    return;
                }

                snapshot.forEach((doc) => {
                    const callData = doc.data();
                    if (callData.active) {
                        console.log("Active call found:", doc.id);
                        showCallContainer(roomId, doc.id);  // Show the active call container
                    }
                });
            });
        } catch (error) {
            console.error("Error fetching calls:", error);
        }
    }


    // 📡 Monitor Call Status
    function monitorCallStatus(callId) {
        const callRef = doc(db, "rooms", currentRoomId, "calls", callId);
        const endCallBtn = document.getElementById("endCallBtn");

        return onSnapshot(callRef, (callDocSnapshot) => {
            if (callDocSnapshot.exists()) {
                const callData = callDocSnapshot.data();
                const isActive = callData?.active ?? false;

                endCallBtn.style.display = isActive ? "block" : "none";
                console.log(`Call status: ${isActive ? "Active" : "Inactive"}`);
            } else {
                console.log("Call document does not exist.");
                endCallBtn.style.display = "none";
            }
        }, (error) => {
            console.error("Error monitoring call status:", error);
        });
    }

    // 🚪 Join Call
    async function joinCall(callId) {
        const callRef = doc(db, "rooms", currentRoomId, "calls", callId);

        try {
            if (!auth.currentUser) {
                console.error("User not authenticated.");
                return;
            }

            await updateDoc(callRef, {
                users: arrayUnion(auth.currentUser.uid),
                active: true
            });

            console.log("User joined the call:", callId);
            monitorCallStatus(callId);
            updateCallButtons(callId, true);

        } catch (error) {
            console.error("Error joining the call:", error);
        }
    }

    // 🔌 Disconnect User
    async function disconnectUserFromCall(callId) {
        const callRef = doc(db, "rooms", currentRoomId, "calls", callId);

        try {
            if (!auth.currentUser ) {
                console.error("User  not authenticated.");
                return;
            }

            // Remove the current user from the call
            await updateDoc(callRef, {
                users: arrayRemove(auth.currentUser .uid) // Only remove the current user's ID
            });

            console.log("User  disconnected from call:", callId);
            updateCallButtons(callId, false); // Update UI buttons accordingly

            // Check if there are any users left in the call
            const callDocSnapshot = await getDoc(callRef);
            const callData = callDocSnapshot.data();

            if (callData?.users?.length === 0) {
                // If no users are left, you can choose to end the call
                await endCall(callId); // Optionally end the call if no users are left
            } else {
                console.log("User  left the call, but others are still in it.");
            }

        } catch (error) {
            console.error("Error disconnecting from call:", error);
        }
    }

    // ❌ End Call
    async function endCall(callId) {
        const callRef = doc(db, "rooms", currentRoomId, "calls", callId);
        try {
            if (!auth.currentUser ) {
                console.error("User  not authenticated.");
                return;
            }

            // Remove the current user from the call
            await updateDoc(callRef, {
                users: arrayRemove(auth.currentUser .uid) // Remove the current user's ID from the users array
            });

            console.log("User  disconnected from call:", callId);

            // Check if there are any users left in the call
            const callDocSnapshot = await getDoc(callRef);
            const callData = callDocSnapshot.data();

            if (callData?.users?.length === 0) {
                // If no users are left, you can choose to end the call
                await setDoc(callRef, { active: false }, { merge: true }); // Mark the call as inactive
                await deleteDoc(callRef); // Optionally delete the call document
                console.log("Call ended and deleted:", callId);
                document.getElementById('callContainer').style.display = 'none'; // Hide the call container
            } else {
                // Optionally update the UI to reflect that the user has left the call
                console.log("User  left the call, but others are still in it.");
            }
        } catch (error) {
            console.error("Error ending call:", error);
        }
    }


    // 📞 Call UI Display
    async function showCallContainer(roomId, callId) {
        const callContainer = document.getElementById('callContainer');
        callContainer.innerHTML = `<h1>Call in Room: ${roomId}</h1>
                               <p>Call ID: ${callId}</p>
                               <button id="endCallButton">End Call</button>
                               <div id="callActionContainer"></div>`;

        // Check if the current user is already in the call
        const callRef = doc(db, "rooms", roomId, "calls", callId);
        const callSnap = await getDoc(callRef);
        const callData = callSnap.data();

        if (callData.users && callData.users.includes(auth.currentUser .uid)) {
            // User is already in the call
            console.log("User  is already in the call.");
        } else {
            // User is not in the call, show the join button
            const joinButton = document.createElement('button');
            joinButton.textContent = "Join Call";
            joinButton.onclick = () => joinCall(callId); // Call joinCall function
            document.getElementById('callActionContainer').appendChild(joinButton);
        }

        document.getElementById('endCallButton').addEventListener('click', () => {
            endCall(callId);
        });

        callContainer.style.display = 'block';
    }

    // 🔀 Update Call Action Buttons
    function updateCallButtons(callId, isInCall) {
        const actionContainer = document.getElementById('callActionContainer');
        actionContainer.innerHTML = isInCall
            ? `<button id="disconnectButton">Disconnect from Call</button>`
            : `<button id="joinCallButton">Join Call</button>`;

        if (isInCall) {
            document.getElementById('disconnectButton').addEventListener('click', () => {
                disconnectUserFromCall(callId);
            });
        } else {
            document.getElementById('joinCallButton').addEventListener('click', () => {
                joinCall(callId);
            });
        }
    }

    // 🌐 Initialize Call Listener on Page Load
    window.onload = function () {
        listenToCalls(currentRoomId);
    };





    // When a user joins the call (add them to the call document's 'users' array)



