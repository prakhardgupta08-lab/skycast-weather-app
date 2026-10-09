
/* =========================================
   SKYCAST — WEATHER APP
   Search, live weather and forecasts
========================================= */

// Find the elements we need from index.html.

const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const searchButton = document.getElementById("search-button");
const locationButton = document.getElementById("location-button");
const statusMessage = document.getElementById("status-message");

const cityName = document.getElementById("city-name");
const weatherDescription = document.getElementById("weather-description");
const weatherIcon = document.getElementById("weather-icon");
const temperature = document.getElementById("temperature");
const temperatureUnit = document.getElementById("temperature-unit");
const feelsLike = document.getElementById("feels-like");
const humidity = document.getElementById("humidity");
const windSpeed = document.getElementById("wind-speed");
const precipitation = document.getElementById("precipitation");
const windUnit = document.getElementById("wind-unit");
const lastUpdated = document.getElementById("last-updated");

const hourlyForecast = document.getElementById("hourly-forecast");
const dailyForecast = document.getElementById("daily-forecast");

const celsiusButton = document.getElementById("celsius-button");
const fahrenheitButton = document.getElementById("fahrenheit-button");

// Remember the latest weather information so that
// changing temperature units doesn't require another API call.

let latestWeather = null;
let selectedUnit = "C";
let requestNumber = 0;


// Translate official Open-Meteo weather codes into descriptions
// and matching weather symbols.

function getWeatherInfo(code, isDay = 1) {
    if (code === 0) {
        return {
            description: "Clear sky",
            icon: isDay ? "☀️" : "🌙"
        };
    }

    if (code === 1) {
        return {
            description: "Mainly clear",
            icon: isDay ? "🌤️" : "🌙"
        };
    }

    if (code === 2) {
        return {
            description: "Partly cloudy",
            icon: "⛅"
        };
    }

    if (code === 3) {
        return {
            description: "Overcast",
            icon: "☁️"
        };
    }

    if ([45, 48].includes(code)) {
        return {
            description: "Foggy",
            icon: "🌫️"
        };
    }

    if ([51, 53, 55, 56, 57].includes(code)) {
        return {
            description: "Drizzle",
            icon: "🌦️"
        };
    }

    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return {
            description: "Rain",
            icon: "🌧️"
        };
    }

    if ([71, 73, 75, 77, 85, 86].includes(code)) {
        return {
            description: "Snow",
            icon: "❄️"
        };
    }

    if ([95, 96, 99].includes(code)) {
        return {
            description: "Thunderstorm",
            icon: "⛈️"
        };
    }

    return {
        description: "Weather conditions unavailable",
        icon: "🌡️"
    };
}


// Convert Celsius into Fahrenheit when required.

function convertTemperature(value) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
        return "--";
    }

    const result = selectedUnit === "F"
        ? (value * 9 / 5) + 32
        : value;

    return Math.round(result);
}


// Show a message to the user.

function showStatus(message) {
    statusMessage.textContent = message;
}


// Format an API time such as "2026-10-09T15:00"
// as a readable hour, without assuming the user's
// computer is in the same time zone as the searched city.

function formatHour(timeString) {
    const match = timeString.match(/T(\d{2}):(\d{2})/);

    if (!match) {
        return timeString;
    }

    const hour = Number(match[1]);
    const minute = match[2];
    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${period}`;
}


// Format a date from the weather API.

function formatDay(dateString, index) {
    if (index === 0) {
        return "Today";
    }

    if (index === 1) {
        return "Tomorrow";
    }

    const [year, month, day] = dateString.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12);

    return new Intl.DateTimeFormat("en", {
        weekday: "short"
    }).format(date);
}


// Create a forecast element safely using textContent.

function createElement(tag, className, text = "") {
    const element = document.createElement(tag);

    if (className) {
        element.className = className;
    }

    element.textContent = text;

    return element;
}


// Get weather data for a city name.

async function searchCity(city) {
    const cleanCity = city.trim();

    if (!cleanCity) {
        showStatus("Please enter a city name first.");
        cityInput.focus();
        return;
    }

    const thisRequest = ++requestNumber;

    searchButton.disabled = true;
    locationButton.disabled = true;
    searchButton.textContent = "Searching...";
    showStatus(`Finding weather for ${cleanCity}...`);

    try {
        // First, convert the city name into coordinates.

        const geocodingURL = new URL(
            "https://geocoding-api.open-meteo.com/v1/search"
        );

        geocodingURL.search = new URLSearchParams({
            name: cleanCity,
            count: "5",
            language: "en",
            format: "json"
        });

        const geocodingResponse = await fetch(geocodingURL);

        if (!geocodingResponse.ok) {
            throw new Error("Could not search for that city.");
        }

        const geocodingData = await geocodingResponse.json();

        if (thisRequest !== requestNumber) return;

        if (!geocodingData.results || geocodingData.results.length === 0) {
            throw new Error(
                "City not found. Check the spelling and try again."
            );
        }

        // Use the first matching result.

        const place = geocodingData.results[0];

        await loadWeather(
            place.latitude,
            place.longitude,
            place.name,
            place.country,
            thisRequest
        );

    } catch (error) {
        if (thisRequest === requestNumber) {
            showStatus(
                error.message || "Something went wrong. Please try again."
            );
        }
    } finally {
        if (thisRequest === requestNumber) {
            searchButton.disabled = false;
            locationButton.disabled = false;
            searchButton.textContent = "Search";
        }
    }
}


// Retrieve real weather and forecast data for coordinates.

async function loadWeather(
    latitude,
    longitude,
    name,
    country = "",
    thisRequest = ++requestNumber
) {
    showStatus(`Loading weather for ${name}...`);

    const forecastURL = new URL(
        "https://api.open-meteo.com/v1/forecast"
    );

    forecastURL.search = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),

        current: [
            "temperature_2m",
            "relative_humidity_2m",
            "apparent_temperature",
            "is_day",
            "precipitation",
            "weather_code",
            "wind_speed_10m"
        ].join(","),

        hourly: [
            "temperature_2m",
            "weather_code"
        ].join(","),

        daily: [
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_probability_max"
        ].join(","),

        temperature_unit: "celsius",
        wind_speed_unit: "kmh",
        precipitation_unit: "mm",
        timezone: "auto",
        forecast_days: "7"
    });

    const response = await fetch(forecastURL);

    if (!response.ok) {
        throw new Error(
            "Weather data could not be loaded. Please try again."
        );
    }

    const data = await response.json();

    if (thisRequest !== requestNumber) return;

    if (
        !data.current ||
        !data.hourly ||
        !data.daily ||
        !Array.isArray(data.hourly.time) ||
        !Array.isArray(data.daily.time)
    ) {
        throw new Error("The weather service returned incomplete data.");
    }

    // Store the successful result and refresh the dashboard.

    latestWeather = {
        data,
        name,
        country
    };

    renderWeather();
    showStatus(`Weather updated successfully for ${name}.`);
}


// Display the current weather and both forecasts.

function renderWeather() {
    if (!latestWeather) return;

    const { data, name, country } = latestWeather;
    const current = data.current;

    // City and current conditions.

    cityName.textContent = country
        ? `${name}, ${country}`
        : name;

    const currentInfo = getWeatherInfo(
        current.weather_code,
        current.is_day
    );

    weatherDescription.textContent = currentInfo.description;
    weatherIcon.textContent = currentInfo.icon;

    temperature.textContent = convertTemperature(
        current.temperature_2m
    );

    temperatureUnit.textContent = `°${selectedUnit}`;

    feelsLike.textContent = convertTemperature(
        current.apparent_temperature
    );

    humidity.textContent =
        current.relative_humidity_2m ?? "--";

    windSpeed.textContent =
        current.wind_speed_10m ?? "--";

    windUnit.textContent = "km/h";

    precipitation.textContent =
        current.precipitation ?? "--";

    lastUpdated.textContent =
        `Updated ${new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        })}`;

    // Update the accessible state of the unit buttons.

    celsiusButton.classList.toggle("active", selectedUnit === "C");
    fahrenheitButton.classList.toggle("active", selectedUnit === "F");

    celsiusButton.setAttribute(
        "aria-pressed",
        String(selectedUnit === "C")
    );

    fahrenheitButton.setAttribute(
        "aria-pressed",
        String(selectedUnit === "F")
    );

    // Refresh the forecast sections.

    renderHourlyForecast(data);
    renderDailyForecast(data);
}


// Display the next six hourly forecast entries.

function renderHourlyForecast(data) {
    hourlyForecast.replaceChildren();

    const times = data.hourly.time;
    const values = data.hourly.temperature_2m;
    const codes = data.hourly.weather_code;

    if (!times || !values || !codes) {
        hourlyForecast.append(
            createElement("p", "empty-forecast", "Hourly data unavailable.")
        );
        return;
    }

    const currentTime = data.current.time;

    let startIndex = times.findIndex(
        time => time >= currentTime
    );

    if (startIndex < 0) {
        startIndex = 0;
    }

    const endIndex = Math.min(startIndex + 6, times.length);

    for (let i = startIndex; i < endIndex; i++) {
        const card = createElement("article", "hourly-card");

        const info = getWeatherInfo(codes[i]);

        card.append(
            createElement("p", "hourly-time", formatHour(times[i])),
            createElement("span", "hourly-icon", info.icon),
            createElement(
                "p",
                "hourly-temperature",
                `${convertTemperature(values[i])}°`
            )
        );

        hourlyForecast.append(card);
    }
}


// Display the seven-day forecast.

function renderDailyForecast(data) {
    dailyForecast.replaceChildren();

    const daily = data.daily;

    for (let i = 0; i < daily.time.length; i++) {
        const row = createElement("article", "daily-row");

        const day = createElement(
            "span",
            "daily-day",
            formatDay(daily.time[i], i)
        );

        const info = getWeatherInfo(daily.weather_code[i]);

        const condition = createElement("span", "daily-condition");

        condition.append(
            createElement("span", "daily-icon", info.icon),
            document.createTextNode(info.description)
        );

        const temperatures = createElement(
            "div",
            "daily-temperatures"
        );

        temperatures.append(
            createElement(
                "span",
                "daily-high",
                `${convertTemperature(daily.temperature_2m_max[i])}°`
            ),
            createElement(
                "span",
                "daily-low",
                `${convertTemperature(daily.temperature_2m_min[i])}°`
            )
        );

        row.append(day, condition, temperatures);
        dailyForecast.append(row);
    }
}


// Submit a city search when the form is used.

searchForm.addEventListener("submit", event => {
    event.preventDefault();
    searchCity(cityInput.value);
});


// Switch between Celsius and Fahrenheit without fetching again.

celsiusButton.addEventListener("click", () => {
    selectedUnit = "C";
    renderWeather();
});

fahrenheitButton.addEventListener("click", () => {
    selectedUnit = "F";
    renderWeather();
});


// Ask the browser for permission to use the current location.

locationButton.addEventListener("click", () => {
    if (!navigator.geolocation) {
        showStatus(
            "Location is not supported by this browser. Search for a city instead."
        );
        return;
    }

    const thisRequest = ++requestNumber;

    locationButton.disabled = true;
    searchButton.disabled = true;
    showStatus("Requesting your location permission...");

    navigator.geolocation.getCurrentPosition(
        async position => {
            if (thisRequest !== requestNumber) return;

            try {
                await loadWeather(
                    position.coords.latitude,
                    position.coords.longitude,
                    "Your location",
                    "",
                    thisRequest
                );
            } catch (error) {
                if (thisRequest === requestNumber) {
                    showStatus(
                        error.message || "Could not load local weather."
                    );
                }
            } finally {
                if (thisRequest === requestNumber) {
                    locationButton.disabled = false;
                    searchButton.disabled = false;
                }
            }
        },

        error => {
            if (thisRequest !== requestNumber) return;

            const messages = {
                1: "Location permission was denied. You can search for a city instead.",
                2: "Your location could not be determined. Try city search.",
                3: "Location request timed out. Please try again."
            };

            showStatus(
                messages[error.code] || "Location is unavailable."
            );

            locationButton.disabled = false;
            searchButton.disabled = false;
        },

        {
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 300000
        }
    );
});


// Start with a friendly message instead of inventing weather data.

showStatus(
    "Welcome to SkyCast! Search for a city to see its real weather."
);