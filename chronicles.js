const CHRONICLES_PASSWORD = "35";
const CHRONICLES_API = "https://script.google.com/macros/s/AKfycbzg_A5BXWuQbjYW--Z9xekMJew_HWjujGQeTzQpk6ka_itHXAAm8q6kS5h7Dk8R7Jaz/exec";
const chronicle = document.getElementById("chronicle");

if (chronicle) {
    const gate = document.getElementById("chronicle-gate");
    const gatePassword = document.getElementById("chronicle-password");
    const gateUnlock = document.getElementById("chronicle-unlock");
    const gateStatus = document.getElementById("chronicle-gate-status");
    const content = document.getElementById("chronicle-content");
    const dateInput = document.getElementById("chronicle-date");
    const titleInput = document.getElementById("chronicle-title");
    const entryInput = document.getElementById("chronicle-entry");
    const storeButton = document.getElementById("chronicle-store");
    const writeStatus = document.getElementById("chronicle-write-status");

    content.style.display = "none";

    function setStatus(element, text, success = false) {
        if (!element) return;
        element.textContent = text;
        element.style.color = success ? "#555" : "#777";
    }

    gateUnlock.addEventListener("click", () => {
        if (gatePassword.value === CHRONICLES_PASSWORD) {
            gate.style.display = "none";
            content.style.display = "block";
            setStatus(gateStatus, "");
        } else {
            setStatus(gateStatus, "Incorrect password.");
            gatePassword.select();
        }
    });

    gatePassword.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            gateUnlock.click();
        }
    });

    storeButton.addEventListener("click", async () => {
        try {
            const date = dateInput.value;
            const title = titleInput.value.trim();
            const entry = entryInput.value.trim();

            if (!date) {
                throw new Error("Please select a date.");
            }

            if (!title) {
                throw new Error("Please enter a title.");
            }

            if (!entry) {
                throw new Error("Please write an entry.");
            }

            storeButton.disabled = true;
            setStatus(writeStatus, "Saving...");

            const form = new FormData();
            form.append("action", "storeChronicle");
            form.append("date", date);
            form.append("title", title);
            form.append("entry", entry);
            form.append("created", new Date().toISOString());

            const response = await fetch(CHRONICLES_API, {
                method: "POST",
                body: form
            });

            if (!response.ok) {
                throw new Error("Unable to contact the chronicle server.");
            }

            const text = await response.text();
            let result;

            try {
                result = JSON.parse(text);
            } catch {
                throw new Error("The chronicle server returned an invalid response.");
            }

            if (result.ok === false) {
                throw new Error(
                    result.error || "The server rejected the chronicle."
                );
            }

            setStatus(
                writeStatus,
                "Chronicle saved successfully.",
                true
            );

            titleInput.value = "";
            entryInput.value = "";
        } catch (error) {
            setStatus(writeStatus, error.message);
        } finally {
            storeButton.disabled = false;
        }
    });
}