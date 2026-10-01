/* =========================
   SETTINGS
   ========================= */

const MAX_MESSAGE_LENGTH = 300; // Maximum message length in characters
const CAPSULE_API = "https://script.google.com/macros/s/AKfycbzg_A5BXWuQbjYW--Z9xekMJew_HWjujGQeTzQpk6ka_itHXAAm8q6kS5h7Dk8R7Jaz/exec";

/* =========================
   ELEMENTS
   ========================= */

const capsule = document.getElementById("capsule");

if (capsule) {
    const gate = document.getElementById("capsule-gate");
    const gatePassword = document.getElementById("capsule-password");
    const gateUnlock = document.getElementById("capsule-unlock");
    const gateStatus = document.getElementById("capsule-gate-status");

    const content = document.getElementById("capsule-content");
    const actions = document.getElementById("capsule-actions");

    const writeButton = document.getElementById("capsule-write-button");
    const openButton = document.getElementById("capsule-open-button");
    const writePanel = document.getElementById("capsule-write");
    const openPanel = document.getElementById("capsule-open");

    const messageInput = document.getElementById("capsule-message");
    const messageLength = document.getElementById("capsule-message-length");
    const key1Input = document.getElementById("capsule-key-1");
    const key2Input = document.getElementById("capsule-key-2");
    const generateKeys = document.getElementById("capsule-generate-keys");
    const nameInput = document.getElementById("capsule-name");
    const openingDateInput = document.getElementById("capsule-opening-date");
    const encryptButton = document.getElementById("capsule-encrypt");
    const writeStatus = document.getElementById("capsule-write-status");

    const searchName = document.getElementById("capsule-search-name");
    const searchButton = document.getElementById("capsule-search");
    const searchResult = document.getElementById("capsule-search-result");
    const ciphertextOutput = document.getElementById("capsule-ciphertext");
    const decryptKey1 = document.getElementById("capsule-decrypt-key-1");
    const decryptKey2 = document.getElementById("capsule-decrypt-key-2");
    const decryptButton = document.getElementById("capsule-decrypt");
    const openStatus = document.getElementById("capsule-open-status");
    const messageResult = document.getElementById("capsule-message-result");

    let currentCiphertext = null;
    let currentHash = null;
    let capsuleToken = null;

    /* =========================
       GENERAL HELPERS
       ========================= */

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    function setStatus(element, text, success = false) {
        if (!element) return;
        element.textContent = text;
        element.style.color = success ? "#555" : "#777";
    }

    function updateMessageLength() {
        const length = Array.from(messageInput.value).length;
        messageLength.textContent = `Message length (Max ${MAX_MESSAGE_LENGTH} characters): ${length} / ${MAX_MESSAGE_LENGTH}`;

        if (length > MAX_MESSAGE_LENGTH) {
            messageLength.style.color = "#b33";
            messageLength.textContent += " — Message is too long.";
        } else {
            messageLength.style.color = "";
        }
    }

    function xorBytes(data, key1, key2) {
        const result = new Uint8Array(data.length);

        for (let i = 0; i < data.length; i++) {
            result[i] = data[i] ^ key1[i] ^ key2[i];
        }

        return result;
    }

    function parseKey(value, expectedLength) {
        const parts = value.trim().split(/[\s,]+/).filter(Boolean);

        if (parts.length !== expectedLength) {
            throw new Error(`Key must contain exactly ${expectedLength} numbers.`);
        }

        const key = new Uint8Array(expectedLength);

        for (let i = 0; i < parts.length; i++) {
            if (!/^\d+$/.test(parts[i])) {
                throw new Error("Keys must contain numbers only.");
            }

            const number = Number(parts[i]);

            if (!Number.isInteger(number) || number < 0 || number > 255) {
                throw new Error("Each key number must be between 0 and 255.");
            }

            key[i] = number;
        }

        return key;
    }

    function generateKey(length) {
        const key = new Uint8Array(length);
        crypto.getRandomValues(key);
        return key;
    }

    function keyToString(key) {
        return Array.from(key).join(" ");
    }

    function bytesToBase64(bytes) {
        let binary = "";
        const chunkSize = 0x8000;

        for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode(
                ...bytes.subarray(i, i + chunkSize)
            );
        }

        return btoa(binary);
    }

    function base64ToBytes(value) {
        const binary = atob(value);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }

        return bytes;
    }

    async function hashBytes(bytes) {
        const hash = await crypto.subtle.digest("SHA-256", bytes);
        return bytesToBase64(new Uint8Array(hash));
    }

    /* =========================
       API
       ========================= */

    async function storeCapsule(name, ciphertext, hash, key1, key2, openingDate) {
        const form = new FormData();
        form.append("action", "store");
        form.append("name", name);
        form.append("ciphertext", ciphertext);
        form.append("hash", hash);
        form.append("key1", key1);
        form.append("key2", key2);
        form.append("openingDate", openingDate);
        form.append("created", new Date().toISOString());
        form.append("token", capsuleToken);

        const response = await fetch(CAPSULE_API, {
            method: "POST",
            body: form
        });

        if (!response.ok) {
            throw new Error("Unable to contact the capsule server.");
        }

        const text = await response.text();
        let result;

        try {
            result = JSON.parse(text);
        } catch {
            throw new Error("The capsule server returned an invalid response.");
        }

        if (result.ok === false) {
            throw new Error(result.error || "The server rejected the capsule.");
        }

        return result;
    }

    async function searchCapsule(name) {
        const url =
            `${CAPSULE_API}?action=search&name=${encodeURIComponent(name)}`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Unable to contact the capsule server.");
        }

        return await response.json();
    }

    /* =========================
       PASSWORD GATE
       ========================= */

    content.style.display = "none";
    searchResult.style.display = "none";
    writePanel.style.display = "none";
    openPanel.style.display = "none";

    gateUnlock.addEventListener("click", async () => {
        try {
            gateUnlock.disabled = true;
            setStatus(gateStatus, "Checking password...");

            const form = new FormData();
            form.append("action", "unlock");
            form.append("type", "capsule");
            form.append("password", gatePassword.value);

            const response = await fetch(CAPSULE_API, {
                method: "POST",
                body: form
            });

            const result = await response.json();

            if (!result.ok) {
                throw new Error(result.error || "Incorrect password.");
            }

            capsuleToken = result.token;

            gate.style.display = "none";
            content.style.display = "block";
            setStatus(gateStatus, "");
        } catch (error) {
            setStatus(gateStatus, error.message);
            gatePassword.select();
        } finally {
            gateUnlock.disabled = false;
        }
    });

    gatePassword.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            gateUnlock.click();
        }
    });

    /* =========================
       WRITE / OPEN SELECTION
       ========================= */

    writeButton.addEventListener("click", () => {
        writePanel.style.display = "block";
        openPanel.style.display = "none";
        setStatus(writeStatus, "");
    });

    openButton.addEventListener("click", () => {
        openPanel.style.display = "block";
        writePanel.style.display = "none";
        searchResult.style.display = "block";
        setStatus(openStatus, "");
    });

    /* =========================
       MESSAGE / KEY GENERATION
       ========================= */

    messageInput.addEventListener("input", updateMessageLength);

    generateKeys.addEventListener("click", () => {
        const length = Array.from(messageInput.value).length;

        if (length === 0) {
            setStatus(writeStatus, "Write a message first.");
            return;
        }

        if (length > MAX_MESSAGE_LENGTH) {
            setStatus(
                writeStatus,
                `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`
            );
            return;
        }

        const byteLength = encoder.encode(messageInput.value).length;

        key1Input.value = keyToString(generateKey(byteLength));
        key2Input.value = keyToString(generateKey(byteLength));

        setStatus(
            writeStatus,
            `Generated keys for ${length} characters.`,
            true
        );
    });

    /* =========================
       ENCRYPT & STORE
       ========================= */

    encryptButton.addEventListener("click", async () => {
        try {
            const messageLengthInCharacters =
                Array.from(messageInput.value).length;

            if (messageLengthInCharacters === 0) {
                throw new Error("Please enter a message.");
            }

            if (messageLengthInCharacters > MAX_MESSAGE_LENGTH) {
                throw new Error(
                    `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`
                );
            }

            const message = messageInput.value;
            const name = nameInput.value.trim();
            const openingDate = openingDateInput.value;
            const messageBytes = encoder.encode(message);

            if (messageBytes.length === 0) {
                throw new Error("Please enter a message.");
            }

            if (!name) {
                throw new Error("Please enter the person's name.");
            }

            if (!openingDate) {
                throw new Error("Please select a promised opening date.");
            }

            const key1 = parseKey(
                key1Input.value,
                messageBytes.length
            );

            const key2 = parseKey(
                key2Input.value,
                messageBytes.length
            );

            const ciphertext = xorBytes(
                messageBytes,
                key1,
                key2
            );

            const encodedCiphertext = bytesToBase64(ciphertext);
            const hash = await hashBytes(messageBytes);

            encryptButton.disabled = true;
            setStatus(writeStatus, "Encrypting and storing...");

            await storeCapsule(
                name,
                encodedCiphertext,
                hash,
                key1Input.value,
                key2Input.value,
                openingDate
            );

            setStatus(
                writeStatus,
                "Capsule stored successfully. Save both keys somewhere safe.",
                true
            );

            openingDateInput.value = "";
        } catch (error) {
            setStatus(writeStatus, error.message);
        } finally {
            encryptButton.disabled = false;
        }
    });

    /* =========================
       SEARCH
       ========================= */

    searchButton.addEventListener("click", async () => {
        try {
            const name = searchName.value.trim();

            if (!name) {
                throw new Error("Enter a name first.");
            }

            searchButton.disabled = true;
            messageResult.style.display = "none";
            ciphertextOutput.value = "";
            currentCiphertext = null;
            currentHash = null;

            setStatus(openStatus, "Searching...");

            const result = await searchCapsule(name);

            if (!result || result.ok === false) {
                setStatus(
                    openStatus,
                    result?.error || "No capsule found for that name."
                );
                return;
            }

            if (result.early) {
                const openEarly = confirm(
                    `This capsule was intended to be opened on ${result.openingDate}.\n\nAre you sure you want to open it early?`
                );

                if (!openEarly) {
                    setStatus(openStatus, "Opening cancelled.");
                    return;
                }
            }

            if (!result.ciphertext) {
                setStatus(openStatus, "No capsule found for that name.");
                return;
            }

            currentCiphertext = result.ciphertext;
            currentHash = result.hash || null;

            ciphertextOutput.value = currentCiphertext;

            setStatus(
                openStatus,
                "Capsule found. Enter both keys.",
                true
            );
        } catch (error) {
            setStatus(openStatus, error.message);
        } finally {
            searchButton.disabled = false;
        }
    });

    /* =========================
       DECRYPT
       ========================= */

    decryptButton.addEventListener("click", async () => {
        try {
            if (!currentCiphertext) {
                throw new Error("Search for a capsule first.");
            }

            const ciphertext = base64ToBytes(currentCiphertext);

            const key1 = parseKey(
                decryptKey1.value,
                ciphertext.length
            );

            const key2 = parseKey(
                decryptKey2.value,
                ciphertext.length
            );

            const messageBytes = xorBytes(
                ciphertext,
                key1,
                key2
            );

            if (currentHash) {
                const calculatedHash = await hashBytes(messageBytes);

                if (calculatedHash !== currentHash) {
                    throw new Error(
                        "The two keys do not match this capsule."
                    );
                }
            }

            const message = decoder.decode(messageBytes);

            messageResult.style.display = "block";
            messageResult.textContent = "";
            messageResult.style.whiteSpace = "pre-wrap";
            messageResult.appendChild(
                document.createTextNode(message)
            );

            setStatus(
                openStatus,
                "Capsule successfully decrypted.",
                true
            );
        } catch (error) {
            messageResult.style.display = "none";
            setStatus(openStatus, error.message);
        }
    });
}