// ===================== CONFIGURATION =====================

const GEOCODING_API = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_API = "https://api.open-meteo.com/v1/forecast";

// Replace this with your deployed backend URL when you deploy.
// For local development, this points to your local backend.
const BACKEND_URL = "http://localhost:5000";

const LAST_CITY_KEY = "aiWeatherAssistant_lastCity";
const LAST_CITY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours


// ===================== APPLICATION STATE =====================

const state = {
    location: {
        city: "",
        country: "",
        latitude: null,
        longitude: null
    },

    weather: {
        current: null,
        hourly: [],
        daily: []
    },

    ai: {
        status: "idle",
        answer: ""
    },

    ui: {
        loading: false,
        error: null
    }
};


// ===================== CHART INSTANCES =====================

const charts = {
    temperature: null,
    precipitation: null,
    wind: null
};


// ===================== DOM REFERENCES =====================

const el = {
    searchForm: document.getElementById("search-form"),
    cityInput: document.getElementById("city-input"),
    locationBtn: document.getElementById("location-btn"),
    locationSelectContainer: document.getElementById("location-select-container"),

    loadingIndicator: document.getElementById("loading-indicator"),
    errorMessage: document.getElementById("error-message"),
    dashboard: document.getElementById("dashboard"),

    locationName: document.getElementById("location-name"),
    currentIcon: document.getElementById("current-icon"),
    currentTemp: document.getElementById("current-temp"),
    currentCondition: document.getElementById("current-condition"),
    feelsLike: document.getElementById("feels-like"),
    humidity: document.getElementById("humidity"),
    windSpeed: document.getElementById("wind-speed"),
    precipitation: document.getElementById("precipitation"),
    lastUpdated: document.getElementById("last-updated"),

    hourlyScroll: document.getElementById("hourly-scroll"),
    dailyList: document.getElementById("daily-list"),

    tempChartCanvas: document.getElementById("temperature-chart"),
    precipChartCanvas: document.getElementById("precipitation-chart"),
    windChartCanvas: document.getElementById("wind-chart"),

    predefinedQuestions: document.getElementById("predefined-questions"),
    aiForm: document.getElementById("ai-form"),
    aiQuestionInput: document.getElementById("ai-question"),
    aiLoading: document.getElementById("ai-loading"),
    aiError: document.getElementById("ai-error"),
    aiAnswer: document.getElementById("ai-answer")
};


// ===================== WEATHER CODE MAPPING =====================

function mapWeatherCode(code) {
    const table = [
        {
            codes: [0],
            condition: "Clear Sky",
            icon: "☀️"
        },
        {
            codes: [1, 2, 3],
            condition: "Cloudy",
            icon: "⛅"
        },
        {
            codes: [45, 48],
            condition: "Fog",
            icon: "🌫️"
        },
        {
            codes: [51, 53, 55, 56, 57],
            condition: "Drizzle",
            icon: "🌦️"
        },
        {
            codes: [61, 63, 65, 66, 67],
            condition: "Rain",
            icon: "🌧️"
        },
        {
            codes: [71, 73, 75, 77],
            condition: "Snow",
            icon: "❄️"
        },
        {
            codes: [80, 81, 82],
            condition: "Rain Showers",
            icon: "🌦️"
        },
        {
            codes: [95, 96, 99],
            condition: "Thunderstorm",
            icon: "⛈️"
        }
    ];

    const match = table.find((entry) => entry.codes.includes(Number(code)));

    return match || {
        condition: "Unknown",
        icon: "❓"
    };
}


// ===================== FORMATTING HELPERS =====================

const fmtTemp = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "--";
    }

    return `${Math.round(Number(value))}°C`;
};


const fmtPercent = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "--";
    }

    return `${Math.round(Number(value))}%`;
};


const fmtWind = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "--";
    }

    return `${Math.round(Number(value))} km/h`;
};


const fmtPrecip = (value) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "--";
    }

    return `${Number(value).toFixed(1)} mm`;
};


function fmtHour(isoString) {
    if (!isoString) {
        return "--";
    }

    const date = new Date(isoString);

    if (Number.isNaN(date.getTime())) {
        return "--";
    }

    return date.toLocaleTimeString([], {
        hour: "numeric",
        hour12: true
    });
}


function fmtDay(isoDateString, index) {
    if (index === 0) {
        return "Today";
    }

    if (!isoDateString) {
        return "--";
    }

    const date = new Date(`${isoDateString}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "--";
    }

    return date.toLocaleDateString([], {
        weekday: "short"
    });
}


// ===================== UI STATE HELPERS =====================

function showLoading(isLoading) {
    state.ui.loading = isLoading;

    if (el.loadingIndicator) {
        el.loadingIndicator.classList.toggle("hidden", !isLoading);
    }

    if (isLoading) {
        hideError();
    }
}


function showError(message) {
    state.ui.error = message;

    if (el.errorMessage) {
        el.errorMessage.textContent = message;
        el.errorMessage.classList.remove("hidden");
    }

    if (el.dashboard) {
        el.dashboard.classList.add("hidden");
    }
}


function hideError() {
    state.ui.error = null;

    if (el.errorMessage) {
        el.errorMessage.classList.add("hidden");
    }
}


function showDashboard() {
    if (el.dashboard) {
        el.dashboard.classList.remove("hidden");
    }
}


// ===================== WEATHER SERVICE =====================

// Search for a city using Open-Meteo geocoding API.
async function searchLocation(city) {
    const url =
        `${GEOCODING_API}?name=${encodeURIComponent(city)}` +
        `&count=5&language=en&format=json`;

    let response;

    try {
        response = await fetch(url);
    } catch (error) {
        throw new Error("NETWORK_ERROR");
    }

    if (!response.ok) {
        throw new Error("NETWORK_ERROR");
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("NETWORK_ERROR");
    }

    if (!data.results || data.results.length === 0) {
        throw new Error("CITY_NOT_FOUND");
    }

    return data.results.map((result) => ({
        name: result.name,
        latitude: result.latitude,
        longitude: result.longitude,
        country: result.country || "",
        admin1: result.admin1 || ""
    }));
}


// Get current, hourly and daily weather from Open-Meteo.
async function getWeather(latitude, longitude) {
    const params = new URLSearchParams({
        latitude: latitude,
        longitude: longitude,

        current:
            "temperature_2m," +
            "relative_humidity_2m," +
            "apparent_temperature," +
            "precipitation," +
            "weather_code," +
            "wind_speed_10m",

        hourly:
            "temperature_2m," +
            "precipitation_probability," +
            "weather_code," +
            "wind_speed_10m",

        daily:
            "weather_code," +
            "temperature_2m_max," +
            "temperature_2m_min," +
            "precipitation_probability_max",

        timezone: "auto",
        forecast_days: "7"
    });

    let response;

    try {
        response = await fetch(`${WEATHER_API}?${params.toString()}`);
    } catch (error) {
        throw new Error("NETWORK_ERROR");
    }

    if (!response.ok) {
        throw new Error("WEATHER_UNAVAILABLE");
    }

    let data;

    try {
        data = await response.json();
    } catch (error) {
        throw new Error("WEATHER_UNAVAILABLE");
    }

    if (!data.current || !data.hourly || !data.daily) {
        throw new Error("WEATHER_UNAVAILABLE");
    }

    return data;
}


// ===================== WEATHER PROCESSING =====================

function processWeatherData(raw) {
    if (
        !raw ||
        !raw.current ||
        !raw.hourly ||
        !raw.daily
    ) {
        throw new Error("WEATHER_UNAVAILABLE");
    }

    const current = {
        temperature: raw.current.temperature_2m,
        feelsLike: raw.current.apparent_temperature,
        humidity: raw.current.relative_humidity_2m,
        precipitation: raw.current.precipitation,
        windSpeed: raw.current.wind_speed_10m,
        weatherCode: raw.current.weather_code,
        time: raw.current.time
    };


    // Find the current hour in the hourly forecast.
    let startIndex = 0;

    if (raw.current.time && Array.isArray(raw.hourly.time)) {
        const currentHour = raw.current.time.slice(0, 13) + ":00";

        const foundIndex = raw.hourly.time.findIndex(
            (time) => time === currentHour
        );

        if (foundIndex !== -1) {
            startIndex = foundIndex;
        }
    }


    // Show the next 12 hourly entries.
    const endIndex = Math.min(
        startIndex + 12,
        raw.hourly.time.length
    );

    const hourly = [];

    for (let i = startIndex; i < endIndex; i++) {
        hourly.push({
            time: raw.hourly.time[i],
            temperature: raw.hourly.temperature_2m?.[i] ?? null,
            precipitationProbability:
                raw.hourly.precipitation_probability?.[i] ?? null,
            windSpeed:
                raw.hourly.wind_speed_10m?.[i] ?? null,
            weatherCode:
                raw.hourly.weather_code?.[i] ?? null
        });
    }


    // Seven-day forecast.
    const daily = [];

    for (let i = 0; i < raw.daily.time.length; i++) {
        daily.push({
            date: raw.daily.time[i],
            tempMax: raw.daily.temperature_2m_max?.[i] ?? null,
            tempMin: raw.daily.temperature_2m_min?.[i] ?? null,
            precipitationProbability:
                raw.daily.precipitation_probability_max?.[i] ?? null,
            weatherCode:
                raw.daily.weather_code?.[i] ?? null
        });
    }


    return {
        current,
        hourly,
        daily
    };
}


// ===================== RENDERING =====================

function renderCurrentWeather() {
    const current = state.weather.current;

    if (!current) {
        return;
    }

    const meta = mapWeatherCode(current.weatherCode);

    if (el.locationName) {
        el.locationName.textContent = state.location.country
            ? `${state.location.city}, ${state.location.country}`
            : state.location.city;
    }

    if (el.currentIcon) {
        el.currentIcon.textContent = meta.icon;
    }

    if (el.currentTemp) {
        el.currentTemp.textContent = fmtTemp(current.temperature);
    }

    if (el.currentCondition) {
        el.currentCondition.textContent = meta.condition;
    }

    if (el.feelsLike) {
        el.feelsLike.textContent = fmtTemp(current.feelsLike);
    }

    if (el.humidity) {
        el.humidity.textContent = fmtPercent(current.humidity);
    }

    if (el.windSpeed) {
        el.windSpeed.textContent = fmtWind(current.windSpeed);
    }

    if (el.precipitation) {
        el.precipitation.textContent = fmtPrecip(
            current.precipitation
        );
    }

    if (el.lastUpdated) {
        el.lastUpdated.textContent =
            new Date().toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit"
            });
    }
}


function renderHourlyForecast() {
    if (!el.hourlyScroll) {
        return;
    }

    el.hourlyScroll.innerHTML = "";

    state.weather.hourly.forEach((hour) => {
        const meta = mapWeatherCode(hour.weatherCode);

        const item = document.createElement("div");
        item.className = "hourly-item";

        item.innerHTML = `
            <div class="h-time">${fmtHour(hour.time)}</div>
            <span class="h-icon" aria-hidden="true">${meta.icon}</span>
            <div class="h-temp">${fmtTemp(hour.temperature)}</div>
            <div class="h-precip">${fmtPercent(hour.precipitationProbability)}</div>
        `;

        el.hourlyScroll.appendChild(item);
    });
}


function renderDailyForecast() {
    if (!el.dailyList) {
        return;
    }

    el.dailyList.innerHTML = "";

    state.weather.daily.forEach((day, index) => {
        const meta = mapWeatherCode(day.weatherCode);

        const item = document.createElement("div");
        item.className = "daily-item";

        item.innerHTML = `
            <span class="d-day">${fmtDay(day.date, index)}</span>
            <span class="d-icon" aria-hidden="true">${meta.icon}</span>
            <span class="d-condition">${meta.condition}</span>
            <span class="d-temp">
                ${fmtTemp(day.tempMax)} / ${fmtTemp(day.tempMin)}
            </span>
            <span class="d-precip">
                ☔ ${fmtPercent(day.precipitationProbability)}
            </span>
        `;

        el.dailyList.appendChild(item);
    });
}


function renderLocationOptions(locations) {
    if (!el.locationSelectContainer) {
        return;
    }

    el.locationSelectContainer.innerHTML = "";
    el.locationSelectContainer.classList.remove("hidden");

    locations.forEach((location) => {
        const button = document.createElement("button");

        button.className = "location-option";
        button.type = "button";

        const locationDetails = [
            location.admin1,
            location.country
        ]
            .filter(Boolean)
            .join(", ");

        button.innerHTML = `
            <strong>${location.name}</strong>
            <span>${locationDetails}</span>
        `;

        button.addEventListener("click", () => {
            selectLocation(location);
        });

        el.locationSelectContainer.appendChild(button);
    });
}


// ===================== CHARTS =====================

function renderCharts() {
    if (typeof Chart === "undefined") {
        console.error(
            "Chart.js is not loaded. Please include Chart.js before script.js."
        );
        return;
    }

    const labels = state.weather.hourly.map(
        (hour) => fmtHour(hour.time)
    );

    renderOneChart(
        "temperature",
        el.tempChartCanvas,
        labels,
        state.weather.hourly.map(
            (hour) => hour.temperature
        ),
        "Temperature (°C)",
        "#2b6cb0"
    );

    renderOneChart(
        "precipitation",
        el.precipChartCanvas,
        labels,
        state.weather.hourly.map(
            (hour) => hour.precipitationProbability
        ),
        "Precipitation Probability (%)",
        "#3182ce"
    );

    renderOneChart(
        "wind",
        el.windChartCanvas,
        labels,
        state.weather.hourly.map(
            (hour) => hour.windSpeed
        ),
        "Wind Speed (km/h)",
        "#f6ad55"
    );
}


function renderOneChart(
    key,
    canvas,
    labels,
    data,
    label,
    color
) {
    if (!canvas) {
        return;
    }

    // Destroy the previous chart before creating a new one.
    if (charts[key]) {
        charts[key].destroy();
        charts[key] = null;
    }

    charts[key] = new Chart(canvas, {
        type: "line",

        data: {
            labels: labels,

            datasets: [
                {
                    label: label,
                    data: data,
                    borderColor: color,
                    backgroundColor: `${color}33`,
                    tension: 0.35,
                    fill: true,
                    pointRadius: 3
                }
            ]
        },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    display: false
                }
            },

            scales: {
                y: {
                    beginAtZero: false
                },

                x: {
                    ticks: {
                        maxRotation: 0,
                        autoSkip: true
                    }
                }
            }
        }
    });
}


// ===================== GEOLOCATION =====================

function useMyLocation() {
    if (!navigator.geolocation) {
        showError(
            "Your browser does not support location services. Please search by city instead."
        );
        return;
    }

    showLoading(true);

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const {
                latitude,
                longitude
            } = position.coords;

            state.location = {
                city: "Your Location",
                country: "",
                latitude: latitude,
                longitude: longitude
            };

            await loadWeatherForCurrentLocation();
        },

        () => {
            showLoading(false);

            showError(
                "Location permission was denied. You can still search for a city above."
            );
        },

        {
            timeout: 10000,
            enableHighAccuracy: false,
            maximumAge: 300000
        }
    );
}


async function loadWeatherForCurrentLocation() {
    try {
        const raw = await getWeather(
            state.location.latitude,
            state.location.longitude
        );

        state.weather = processWeatherData(raw);

        renderCurrentWeather();
        renderHourlyForecast();
        renderDailyForecast();
        renderCharts();

        showDashboard();
        hideError();
    } catch (error) {
        handleWeatherError(error);
    } finally {
        showLoading(false);
    }
}


// ===================== LOCAL STORAGE =====================

function saveLastCity() {
    const payload = {
        city: state.location.city,
        country: state.location.country,
        latitude: state.location.latitude,
        longitude: state.location.longitude,
        timestamp: Date.now()
    };

    try {
        localStorage.setItem(
            LAST_CITY_KEY,
            JSON.stringify(payload)
        );
    } catch (error) {
        console.warn(
            "Unable to save the last searched city.",
            error
        );
    }
}


function loadLastCity() {
    let raw;

    try {
        raw = localStorage.getItem(LAST_CITY_KEY);
    } catch (error) {
        return null;
    }

    if (!raw) {
        return null;
    }

    let data;

    try {
        data = JSON.parse(raw);
    } catch (error) {
        try {
            localStorage.removeItem(LAST_CITY_KEY);
        } catch (removeError) {
            console.warn(removeError);
        }

        return null;
    }

    if (
        !data ||
        !data.city ||
        typeof data.latitude !== "number" ||
        typeof data.longitude !== "number" ||
        typeof data.timestamp !== "number"
    ) {
        try {
            localStorage.removeItem(LAST_CITY_KEY);
        } catch (error) {
            console.warn(error);
        }

        return null;
    }

    const age = Date.now() - data.timestamp;

    if (age > LAST_CITY_TTL_MS || age < 0) {
        try {
            localStorage.removeItem(LAST_CITY_KEY);
        } catch (error) {
            console.warn(error);
        }

        return null;
    }

    return data;
}


// ===================== AI ASSISTANT =====================

async function askAI(question) {
    const trimmed = question.trim();

    if (!trimmed) {
        return;
    }

    // Weather must be loaded before asking the AI.
    if (!state.weather.current) {
        if (el.aiError) {
            el.aiError.textContent =
                "Please search for a city and load its weather first.";

            el.aiError.classList.remove("hidden");
        }

        return;
    }

    state.ai.status = "loading";

    if (el.aiLoading) {
        el.aiLoading.classList.remove("hidden");
    }

    if (el.aiError) {
        el.aiError.classList.add("hidden");
    }

    if (el.aiAnswer) {
        el.aiAnswer.classList.add("hidden");
    }


    const current = state.weather.current;

    const payload = {
        question: trimmed,

        weather: {
            location: state.location.country
                ? `${state.location.city}, ${state.location.country}`
                : state.location.city,

            temperature: current.temperature,
            feelsLike: current.feelsLike,
            humidity: current.humidity,
            precipitation: current.precipitation,

            precipitationProbability:
                state.weather.hourly[0]?.precipitationProbability ?? null,

            windSpeed: current.windSpeed,

            condition:
                mapWeatherCode(
                    current.weatherCode
                ).condition
        }
    };


    try {
        const response = await fetch(
            `${BACKEND_URL}/api/ai/ask`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(payload)
            }
        );


        let data;

        try {
            data = await response.json();
        } catch (error) {
            throw new Error(
                "AI assistant is temporarily unavailable."
            );
        }


        if (!response.ok || !data.success) {
            throw new Error(
                data?.error ||
                "AI assistant is temporarily unavailable."
            );
        }


        if (!data.answer) {
            throw new Error(
                "AI assistant is temporarily unavailable."
            );
        }


        state.ai.status = "success";
        state.ai.answer = data.answer;


        if (el.aiAnswer) {
            el.aiAnswer.textContent = data.answer;
            el.aiAnswer.classList.remove("hidden");
        }

    } catch (error) {
        console.error("AI request error:", error);

        state.ai.status = "error";

        if (el.aiError) {
            el.aiError.textContent =
                "AI assistant is temporarily unavailable.";

            el.aiError.classList.remove("hidden");
        }

    } finally {
        if (el.aiLoading) {
            el.aiLoading.classList.add("hidden");
        }
    }
}


// ===================== ERROR HANDLING =====================

function handleWeatherError(error) {
    showLoading(false);

    const errorMessage =
        error && error.message
            ? error.message
            : "UNKNOWN_ERROR";

    switch (errorMessage) {
        case "CITY_NOT_FOUND":
            showError(
                "City not found. Please check the spelling."
            );
            break;

        case "WEATHER_UNAVAILABLE":
            showError(
                "Weather data is temporarily unavailable. Please try again later."
            );
            break;

        case "NETWORK_ERROR":
            showError(
                "No internet connection. Please check your network and try again."
            );
            break;

        default:
            console.error("Weather error:", error);

            showError(
                "Something went wrong. Please try again."
            );
    }
}


// ===================== MAIN FLOW =====================

async function handleSearch(city) {
    const trimmedCity = city.trim();

    if (!trimmedCity) {
        return;
    }


    if (el.locationSelectContainer) {
        el.locationSelectContainer.classList.add("hidden");
        el.locationSelectContainer.innerHTML = "";
    }

    showLoading(true);


    try {
        const results = await searchLocation(trimmedCity);


        if (results.length === 1) {
            await selectLocation(results[0]);
        } else {
            showLoading(false);
            renderLocationOptions(results);
        }

    } catch (error) {
        handleWeatherError(error);
    }
}


async function selectLocation(location) {
    if (el.locationSelectContainer) {
        el.locationSelectContainer.classList.add("hidden");
        el.locationSelectContainer.innerHTML = "";
    }


    state.location = {
        city: location.name,
        country: location.country || "",
        latitude: location.latitude,
        longitude: location.longitude
    };


    showLoading(true);


    try {
        const raw = await getWeather(
            location.latitude,
            location.longitude
        );

        state.weather = processWeatherData(raw);


        renderCurrentWeather();
        renderHourlyForecast();
        renderDailyForecast();
        renderCharts();

        showDashboard();
        hideError();

        saveLastCity();

    } catch (error) {
        handleWeatherError(error);

    } finally {
        showLoading(false);
    }
}


// ===================== RESTORE LAST CITY =====================

async function restoreLastCity() {
    const saved = loadLastCity();

    if (!saved) {
        return;
    }


    await selectLocation({
        name: saved.city,
        country: saved.country,
        latitude: saved.latitude,
        longitude: saved.longitude
    });
}


// ===================== EVENT LISTENERS =====================

function initializeEventListeners() {

    // Search form
    if (el.searchForm) {
        el.searchForm.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                const city = el.cityInput
                    ? el.cityInput.value.trim()
                    : "";

                if (!city) {
                    return;
                }

                handleSearch(city);
            }
        );
    }


    // Use current location button
    if (el.locationBtn) {
        el.locationBtn.addEventListener(
            "click",
            useMyLocation
        );
    }


    // Predefined AI questions
    if (el.predefinedQuestions) {
        el.predefinedQuestions.addEventListener(
            "click",
            (event) => {

                const chip =
                    event.target.closest(".question-chip");

                if (!chip) {
                    return;
                }

                const question =
                    chip.dataset.question;

                if (question) {
                    askAI(question);
                }
            }
        );
    }


    // AI question form
    if (el.aiForm) {
        el.aiForm.addEventListener(
            "submit",
            (event) => {
                event.preventDefault();

                const question =
                    el.aiQuestionInput
                        ? el.aiQuestionInput.value.trim()
                        : "";

                if (!question) {
                    return;
                }

                askAI(question);

                if (el.aiQuestionInput) {
                    el.aiQuestionInput.value = "";
                }
            }
        );
    }
}


// ===================== STARTUP =====================

document.addEventListener(
    "DOMContentLoaded",
    () => {
        initializeEventListeners();
        restoreLastCity();
    }
);