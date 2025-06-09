let temperatureChart = null;
let humidityChart = null;

// Weather icon mapping
const weatherIcons = {
    'clear sky': '☀️',
    'few clouds': '🌤️',
    'scattered clouds': '⛅',
    'broken clouds': '☁️',
    'overcast clouds': '☁️',
    'shower rain': '🌦️',
    'rain': '🌧️',
    'thunderstorm': '⛈️',
    'snow': '❄️',
    'mist': '🌫️',
    'fog': '🌫️',
    'haze': '🌫️'
};

function getWeatherIcon(description) {
    const desc = description.toLowerCase();
    for (const [key, icon] of Object.entries(weatherIcons)) {
        if (desc.includes(key)) {
            return icon;
        }
    }
    return '🌤️'; // default icon
}

async function getCurrentLocation() {
    if (navigator.geolocation) {
        showLoading(true);
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                await fetchWeatherByCoords(lat, lon);
            },
            (error) => {
                console.log('Geolocation error:', error);
                fetchWeatherByCity('Delhi');
            }
        );
    } else {
        fetchWeatherByCity('Delhi');
    }
}

async function searchWeather() {
    const city = document.getElementById('cityInput').value.trim();
    if (city) {
        await fetchWeatherByCity(city);
    }
}

document.getElementById('cityInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchWeather();
    }
});

async function fetchWeatherByCity(city) {
    showLoading(true);
    const API_KEY = '9057aa52dfdf53cbb0937962dc20bd2b';
    try {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();

        if (!geoData.length) {
            showError('City not found.');
            showLoading(false);
            return;
        }

        const { lat, lon } = geoData[0];
        await fetchWeatherByCoords(lat, lon, city);
    } catch (error) {
        showError('Failed to fetch weather data.');
        console.error(error);
    }
    showLoading(false);
}

async function fetchWeatherByCoords(lat, lon, cityName = 'Current Location') {
    showLoading(true);
    const API_KEY = '9057aa52dfdf53cbb0937962dc20bd2b';

    try {
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;

        const [currentRes, forecastRes] = await Promise.all([
            fetch(currentUrl),
            fetch(forecastUrl)
        ]);

        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        const dailyForecast = [];
        const grouped = {};

        forecastData.list.forEach(entry => {
            const date = entry.dt_txt.split(' ')[0];
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(entry);
        });

        Object.keys(grouped).slice(1, 8).forEach(date => {
            const dayGroup = grouped[date];
            const temps = dayGroup.map(e => e.main.temp);
            const humidities = dayGroup.map(e => e.main.humidity);
            const descriptions = dayGroup.map(e => e.weather[0].description);

            dailyForecast.push({
                date: new Date(date),
                temp_max: Math.max(...temps),
                temp_min: Math.min(...temps),
                humidity: Math.round(humidities.reduce((a, b) => a + b) / humidities.length),
                description: descriptions[Math.floor(descriptions.length / 2)]
            });
        });

        const weatherData = {
            city: currentData.name || cityName,
            country: currentData.sys.country,
            current: {
                temp: currentData.main.temp,
                feels_like: currentData.main.feels_like,
                humidity: currentData.main.humidity,
                wind_speed: currentData.wind.speed,
                description: currentData.weather[0].description,
                datetime: new Date(currentData.dt * 1000)
            },
            forecast: dailyForecast
        };

        displayWeatherData(weatherData);

    } catch (error) {
        showError('Failed to fetch weather data.');
        console.error(error);
    }
    showLoading(false);
}

function displayWeatherData(data) {
    document.getElementById('locationInfo').textContent = `📍 ${data.city}, ${data.country}`;
    document.getElementById('locationInfo').style.display = 'block';

    document.getElementById('currentTemp').textContent = `${Math.round(data.current.temp)}°C`;
    document.getElementById('currentDesc').textContent = data.current.description;
    document.getElementById('currentIcon').textContent = getWeatherIcon(data.current.description);
    document.getElementById('currentHumidity').textContent = `${data.current.humidity}%`;
    document.getElementById('currentWind').textContent = `${data.current.wind_speed} km/h`;
    document.getElementById('feelsLike').textContent = `${Math.round(data.current.feels_like)}°C`;
    document.getElementById('lastUpdated').textContent = data.current.datetime.toLocaleTimeString();

    const forecastGrid = document.getElementById('forecastGrid');
    forecastGrid.innerHTML = '';

    data.forecast.forEach(day => {
        const forecastItem = document.createElement('div');
        forecastItem.className = 'forecast-item';

        const dayName = day.date.toLocaleDateString('en-US', { weekday: 'short' });
        const monthDay = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        forecastItem.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div style="font-size: 0.9rem; color: #636e72;">${monthDay}</div>
            <div class="forecast-icon">${getWeatherIcon(day.description)}</div>
            <div style="font-size: 0.8rem; color: #636e72; text-transform: capitalize;">${day.description}</div>
            <div class="forecast-temps">
                <span class="temp-high">${Math.round(day.temp_max)}°</span>
                <span class="temp-low">${Math.round(day.temp_min)}°</span>
            </div>
        `;

        forecastGrid.appendChild(forecastItem);
    });

    updateCharts(data);
    document.getElementById('weatherContent').style.display = 'block';
    hideError();
}

function updateCharts(data) {
    const ctx1 = document.getElementById('temperatureChart').getContext('2d');
    const ctx2 = document.getElementById('humidityChart').getContext('2d');

    if (temperatureChart) temperatureChart.destroy();
    if (humidityChart) humidityChart.destroy();

    const labels = data.forecast.map(day =>
        day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    );
    const maxTemps = data.forecast.map(day => day.temp_max);
    const minTemps = data.forecast.map(day => day.temp_min);
    const humidity = data.forecast.map(day => day.humidity);

    temperatureChart = new Chart(ctx1, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Max Temperature (°C)',
                data: maxTemps,
                borderColor: '#e17055',
                backgroundColor: 'rgba(225, 112, 85, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Min Temperature (°C)',
                data: minTemps,
                borderColor: '#74b9ff',
                backgroundColor: 'rgba(116, 185, 255, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Temperature Trends (7 Days)'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                }
            }
        }
    });

    humidityChart = new Chart(ctx2, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Humidity (%)',
                data: humidity,
                backgroundColor: 'rgba(0, 206, 201, 0.6)',
                borderColor: '#00cec9',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Humidity Levels (7 Days)'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Humidity (%)'
                    }
                }
            }
        }
    });
}

function showLoading(show) {
    document.getElementById('loadingDiv').style.display = show ? 'block' : 'none';
}

function showError(message) {
    document.getElementById('errorDiv').textContent = message;
    document.getElementById('errorDiv').style.display = 'block';
}

function hideError() {
    document.getElementById('errorDiv').style.display = 'none';
}

window.addEventListener('load', () => {
    getCurrentLocation();
});
