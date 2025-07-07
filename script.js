// Debounce function to limit API calls
function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const locationInput = document.getElementById('location-input');
  const suggestionsList = document.getElementById('suggestions');

  const GEO_API_KEY = 'fda32cd589msh23c9585c4b02e06p10aa03jsn8b7012945de4';
  const GEO_API_HOST = 'wft-geo-db.p.rapidapi.com';

  // Debounced input event
  locationInput.addEventListener('input', debounce(() => {
    const query = locationInput.value.trim();
    if (query.length < 2) {
      suggestionsList.innerHTML = '';
      return;
    }

    fetch(`https://${GEO_API_HOST}/v1/geo/cities?namePrefix=${query}&limit=5`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': GEO_API_KEY,
        'X-RapidAPI-Host': GEO_API_HOST
      }
    })
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        suggestionsList.innerHTML = '';
        if (!data.data || data.data.length === 0) {
          suggestionsList.innerHTML = '<li>No city found</li>';
          return;
        }

        data.data.forEach(city => {
          const li = document.createElement('li');
          li.textContent = `${city.name}, ${city.countryCode}`;
          li.classList.add('suggestion-item');
          li.addEventListener('click', () => {
            locationInput.value = city.name;
            suggestionsList.innerHTML = '';
            fetchWeatherMeteo(city.latitude, city.longitude, city.name);
          });
          suggestionsList.appendChild(li);
        });
      })
      .catch(err => {
        console.error('Suggestion fetch failed:', err);
        suggestionsList.innerHTML = '<li>Error fetching suggestions</li>';
      });
  }, 600));

  // Current location button click
  document.getElementById('current-location-icon').addEventListener('click', () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;

          fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
            .then(res => res.json())
            .then(data => {
              const cityName = data.city || data.locality || "Your Location";
              fetchWeatherMeteo(lat, lon, cityName);
            })
            .catch(err => {
              console.warn('Reverse geocoding failed:', err);
              fetchWeatherMeteo(lat, lon, "Your Location");
            });
        },
        (err) => {
          alert('Failed to get current location.');
          console.error('Geolocation error:', err);
        }
      );
    } else {
      alert('Geolocation is not supported by your browser.');
    }
  });

  document.addEventListener('click', (event) => {
    const searchBox = document.querySelector('.search-box');
    if (!searchBox.contains(event.target)) {
      suggestionsList.innerHTML = '';
    }
  });

  function fetchWeatherMeteo(lat, lon, cityName) {
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m,precipitation,visibility,pressure_msl`)
      .then(res => res.json())
      .then(data => {
        const cw = data.current_weather;
        const hourly = data.hourly;
        if (!cw || !hourly) return;

        const temp = Math.round(cw.temperature);
        document.querySelector('.weather-info h1').textContent = temp;
        document.querySelector('.weather-info span').textContent = '°C';

        const wind = cw.windspeed;
        const desc = getWeatherDescription(temp, wind);
        document.getElementById('description').textContent = desc;
        document.getElementById('location').textContent = cityName;

        updateBackground(desc);
        speakWeather(cityName, temp, desc);

        document.getElementById('wind-status').textContent = wind;
        document.getElementById('humidity').textContent = hourly.relative_humidity_2m[0];
        document.getElementById('visibility').textContent = (hourly.visibility[0] / 1000).toFixed(1);
        document.getElementById('air-pressure').textContent = hourly.pressure_msl[0];

        const forecastItems = document.querySelectorAll('.weather-forecast-item');
        const today = new Date();
        for (let i = 0; i < forecastItems.length && i < 7; i++) {
          const dayDate = new Date(today);
          dayDate.setDate(today.getDate() + i);

          const dayName = i === 0 ? "Today" : dayDate.toLocaleDateString('en-US', { weekday: 'short' });
          const formattedDate = `${padZero(dayDate.getDate())}/${padZero(dayDate.getMonth() + 1)}`;

          forecastItems[i].querySelector('.day').textContent = dayName;
          forecastItems[i].querySelector('.date').textContent = formattedDate;
          forecastItems[i].querySelector('.temperature').textContent = `${Math.round(hourly.temperature_2m[i])}°C`;
        }

        const now = new Date();
        document.getElementById('day').textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
        document.getElementById('date').textContent = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      })
      .catch(err => console.error('Open-Meteo error:', err));
  }

  function updateBackground(description) {
    const body = document.body;
    body.style.background = 'none';
    body.style.backgroundSize = 'cover';

    body.classList.remove('fading-bg');
    void body.offsetWidth;
    body.classList.add('fading-bg');

    const oldVideo = document.getElementById('bg-video');
    if (oldVideo) oldVideo.remove();

    function setVideo(fileName) {
      const video = document.createElement('video');
      video.src = `assets/${fileName}`;
      video.id = 'bg-video';
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'fixed';
      video.style.top = 0;
      video.style.left = 0;
      video.style.width = '100vw';
      video.style.height = '100vh';
      video.style.objectFit = 'cover';
      video.style.zIndex = '-1';
      video.style.opacity = '0';
      video.style.transition = 'opacity 1s ease-in-out';

      video.addEventListener('canplay', () => {
        video.style.opacity = '1';
      });

      document.body.appendChild(video);
    }

    const desc = description.toLowerCase();
    if (desc.includes("thunder") || desc.includes("storm") || desc.includes("🌩️")) {
      setVideo("ThunderstormVideo.mp4");
    } else if (desc.includes("partly") || desc.includes("🌤️")) {
      setVideo("PartlyCloudyVideo.mp4");
    } else if (desc.includes("cloud") || desc.includes("☁️")) {
      setVideo("CloudyVideo.mp4");
    } else if (desc.includes("rain") || desc.includes("🌧️")) {
      setVideo("RainyVideo.mp4");
    } else if (desc.includes("fog") || desc.includes("🌫️")) {
      setVideo("FoggyVideo.mp4");
    } else if (desc.includes("snow") || desc.includes("❄️")) {
      setVideo("SnowyVideo.mp4");
    } else if (desc.includes("wind") || desc.includes("🌪️")) {
      setVideo("WindyVideo.mp4");
    } else if (desc.includes("sun") || desc.includes("clear") || desc.includes("☀️")) {
      body.style.background = "url('assets/SunnyImage.jpg') no-repeat center center fixed";
    } else {
      body.style.background = "url('assets/DefaultWeather.jpg') no-repeat center center fixed";
    }

    body.style.backgroundSize = "cover";
  }

  function speakWeather(city, temp, desc) {
    const msg = new SpeechSynthesisUtterance(`The current weather in ${city} is ${temp} degrees Celsius. ${desc}`);
    window.speechSynthesis.speak(msg);
  }

  function getWeatherDescription(temp, wind) {
    if (wind > 50) return "🌩️ Heavy Stormy Day";
    if (wind > 30) return "💨 Windy Day";
    if (temp > 35) return "☀️ Very Hot Day";
    if (temp > 25) return "⛅ Warm and Sunny";
    if (temp > 15) return "🌤️ Pleasant Weather";
    if (temp > 5) return "🌧️ Rainy and Cool";
    return "❄️ Very Cold Day";
  }

  function padZero(num) {
    return num < 10 ? '0' + num : num;
  }

  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    hours = hours % 12 || 12;

    document.getElementById('flip-hour').textContent = padZero(hours);
    document.getElementById('flip-minute').textContent = padZero(minutes);
    document.getElementById('flip-second').textContent = padZero(seconds);
  }

  setInterval(updateClock, 1000);
  updateClock();
});