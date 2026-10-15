
const dialog = document.getElementById("subscriptionDialog");
const form = document.getElementById("subscriptionForm");

const subscriptionList = document.getElementById("subscriptionList");
const emptyMessage = document.getElementById("emptyMessage");
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");

const serviceName = document.getElementById("serviceName");
const customName = document.getElementById("customName");
const servicePrice = document.getElementById("servicePrice");
const billingCycle = document.getElementById("billingCycle");
const isUnused = document.getElementById("isUnused");
const formError = document.getElementById("formError");

let subscriptions = [];

try {
  const saved = JSON.parse(localStorage.getItem("subleak-data") || "[]");
  if (Array.isArray(saved)) {
    subscriptions = saved.filter(item =>
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      Number.isFinite(item.price) &&
      item.price > 0 &&
      ["monthly", "yearly", "weekly"].includes(item.cycle) &&
      typeof item.unused === "boolean"
    );
  }
} catch (error) {
  subscriptions = [];
}

// Convert every subscription into a monthly cost.
function monthlyCost(subscription) {
  if (subscription.cycle === "yearly") {
    return subscription.price / 12;
  }

  if (subscription.cycle === "weekly") {
    return subscription.price * 52 / 12;
  }

  return subscription.price;
}

// Convert monthly spending into yearly spending.
function yearlyCost(subscription) {
  return monthlyCost(subscription) * 12;
}

// Choose an icon and style for each service.
function serviceStyle(name) {
  const lowerName = name.toLowerCase();

  if (lowerName.includes("netflix")) {
    return { icon: "N", className: "netflix" };
  }

  if (lowerName.includes("youtube")) {
    return { icon: "▶", className: "youtube" };
  }

  if (lowerName.includes("google play")) {
    return { icon: "G", className: "google" };
  }

  return { icon: "✦", className: "other" };
}

// Format prices in Indian Rupees.
function money(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(amount);
}

// Escape text before placing user-entered values in HTML.
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// Save subscriptions locally in this browser.
function saveData() {
  localStorage.setItem(
    "subleak-data",
    JSON.stringify(subscriptions)
  );
}

// Update the dashboard totals.
function updateStats() {
  const monthly = subscriptions.reduce(
    (total, item) => total + monthlyCost(item), 0
  );

  const yearly = subscriptions.reduce(
    (total, item) => total + yearlyCost(item), 0
  );

  const waste = subscriptions
    .filter(item => item.unused)
    .reduce((total, item) => total + monthlyCost(item), 0);

  document.getElementById("monthlyTotal").textContent = money(monthly);
  document.getElementById("yearlyTotal").textContent = money(yearly);
  document.getElementById("wasteTotal").textContent = money(waste);
  document.getElementById("activeCount").textContent = subscriptions.length;
  document.getElementById("listCount").textContent =
    `${subscriptions.length} service${subscriptions.length === 1 ? "" : "s"}`;
}

// Render the subscription list.
function renderSubscriptions() {
  const query = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;

  const filtered = subscriptions.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(query);

    const matchesFilter =
      filter === "all" ||
      (filter === "used" && !item.unused) ||
      (filter === "unused" && item.unused);

    return matchesSearch && matchesFilter;
  });

  subscriptionList.innerHTML = filtered.map(item => {
    const style = serviceStyle(item.name);

    const cycleLabel = {
      monthly: "Monthly",
      yearly: "Yearly",
      weekly: "Weekly"
    }[item.cycle];

    return `
      <article class="subscription-item">
        <div class="service-icon ${style.className}">
          ${style.icon}
        </div>

        <div class="service-info">
          <h3>${escapeHTML(item.name)}</h3>
          <p>${cycleLabel} billing · ${money(monthlyCost(item))}/mo</p>
          <span class="status ${item.unused ? "unused" : "used"}">
            ${item.unused ? "Not using" : "Currently used"}
          </span>
        </div>

        <div class="price">${money(item.price)}</div>

        <div class="item-actions">
          <button class="small-btn" data-action="toggle"
            data-id="${item.id}">
            ${item.unused ? "Mark used" : "Mark unused"}
          </button>

          <button class="small-btn delete-btn" data-action="delete"
            data-id="${item.id}">
            Delete
          </button>
        </div>
      </article>
    `;
  }).join("");

  emptyMessage.style.display = filtered.length ? "none" : "block";

  renderLeakDetector();
  updateStats();
}

// Detect subscriptions marked as unused.
function renderLeakDetector() {
  const leakResults = document.getElementById("leakResults");

  const unusedItems = subscriptions.filter(item => item.unused);

  if (unusedItems.length === 0) {
    leakResults.innerHTML = `
      <div class="no-leaks">
        ✓ No subscriptions are currently marked as unused.
        Mark a service as unused to see its potential savings.
      </div>
    `;
    return;
  }

  const monthlyWaste = unusedItems.reduce(
    (total, item) => total + monthlyCost(item), 0
  );

  leakResults.innerHTML = `
    <div class="leak-result">
      <p>Potential monthly savings</p>
      <span>${money(monthlyWaste)}/mo</span>
    </div>

    <div class="leak-result">
      <p>Potential yearly savings</p>
      <span>${money(monthlyWaste * 12)}/yr</span>
    </div>

    ${unusedItems.map(item => `
      <div class="leak-result">
        <p>${escapeHTML(item.name)}</p>
        <span>${money(monthlyCost(item))}/mo</span>
      </div>
    `).join("")}
  `;
}

// Open the add-subscription form.
document.getElementById("openForm").addEventListener("click", () => {
  form.reset();
  formError.textContent = "";
  dialog.showModal();
});

// Close the form.
document.getElementById("closeForm").addEventListener("click", () => {
  dialog.close();
});

// Close when the user clicks outside the dialog.
dialog.addEventListener("click", event => {
  if (event.target === dialog) {
    dialog.close();
  }
});

// Add a new subscription.
form.addEventListener("submit", event => {
  event.preventDefault();

  const price = Number(servicePrice.value);
  const name = customName.value.trim() || serviceName.value;

  if (!name || !Number.isFinite(price) || price <= 0) {
    formError.textContent = "Enter a valid name and price greater than zero.";
    return;
  }

  const newSubscription = {
    id: crypto.randomUUID(),
    name: name,
    price: price,
    cycle: billingCycle.value,
    unused: isUnused.checked
  };

  subscriptions.push(newSubscription);

  try {
    saveData();
  } catch (error) {
    subscriptions.pop();
    formError.textContent = "Unable to save data in this browser.";
    return;
  }

  dialog.close();
  form.reset();
  renderSubscriptions();
});

// Handle Mark Used, Mark Unused and Delete buttons.
subscriptionList.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button) return;

  const id = button.dataset.id;
  const action = button.dataset.action;

  if (action === "toggle") {
    const item = subscriptions.find(sub => sub.id === id);

    if (item) {
      item.unused = !item.unused;
    }
  }

  if (action === "delete") {
    subscriptions = subscriptions.filter(item => item.id !== id);
  }

  try {
    saveData();
    renderSubscriptions();
  } catch (error) {
    alert("Could not save the change. Please check browser storage.");
  }
});

// Search and filter subscriptions.
searchInput.addEventListener("input", renderSubscriptions);
filterSelect.addEventListener("change", renderSubscriptions);

// Display saved subscriptions on page load.
renderSubscriptions();
