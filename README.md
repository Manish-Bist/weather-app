# Skyline — Weather App

A lightweight, modern single-page weather web application featuring live canvas weather animations, global location search, and multi-unit support.

## Preview

| Dynamic Weather View | Detailed Forecast & Metrics |
| :---: | :---: |
| ![Weather Preview 1](Screenshots/Screenshot%201.png) | ![Weather Preview 2](Screenshots/Screenshot%202.png) |

## Key Features

- **Dynamic Sky Backgrounds:** Animated canvas particles (rain, snow, stars, ambient clouds) and adaptive sky gradients based on local conditions and time of day.
- **Global Search & Autocomplete:** Search for cities worldwide with dynamic suggestions powered by Open-Meteo Geocoding.
- **Automatic Geolocation:** Instant weather updates based on your current browser location.
- **Saved Locations (Chips):** Quick-access location chips saved locally in `localStorage`.
- **Unit Toggle:** Instant switching between Celsius (°C) and Fahrenheit (°F).
- **Comprehensive Metrics:** Real-time temperature, feels-like temperature, 24-hour hourly projections, 7-day forecast, humidity, wind speed & direction (with compass indicator), UV index, sunrise/sunset times, surface pressure, and visibility.

## Tech Stack & APIs

- **Frontend:** HTML5, CSS3 (CSS Variables & Glassmorphism design), Vanilla JavaScript
- **Canvas API:** Custom particle rendering engine for dynamic visual effects
- **Weather Data API:** [Open-Meteo Forecast API](https://open-meteo.com/) (No API key required)
- **Geocoding APIs:** [Open-Meteo Geocoding](https://geocoding-api.open-meteo.com/) (Search) & [BigDataCloud](https://www.bigdatacloud.com/) (Reverse Geocoding)

## Setup & Running Locally

1. Clone the repository:
   ```bash
   git clone [https://github.com/Manish-Bist/weather-app.git](https://github.com/Manish-Bist/weather-app.git)
