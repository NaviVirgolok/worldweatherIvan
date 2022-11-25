'use strict';

const OPENWEATHERMAP_API_KEY = '82005d27a116c2880c8f0fcb866998a0';

class OpenWeatherMapCache {
    /**
     * Constructor.
     * @param lifetimeSeconds
     */
    constructor(lifetimeSeconds = 60 * 60) {
        this.lifetimeSeconds = lifetimeSeconds;
        this.key = 'a861eeb4-acf3-4ca1-9ab6-a74e705802e3'; // UUIDv4 To avoid keys intersection with other components

        // Test localStorage availability
        try {
            const testKey = this.key + '-test';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            this.isAvailable = true
        } catch (error) {
            this.isAvailable = false;
        }
    }

    getKeyForLocation(latitude, longitude) {
        return [this.key, latitude, longitude].join('-');
    }

    load(latitude, longitude) {
        if (!this.isAvailable) {
            return undefined;
        }

        const encodedItem = localStorage.getItem(this.getKeyForLocation(latitude, longitude));
        if (!encodedItem) {
            return undefined;
        }

        const {data, timestamp} = JSON.parse(encodedItem);
        const diffTimestampInSeconds = (new Date() - new Date(timestamp)) / 1000;
        if (diffTimestampInSeconds < 0 || diffTimestampInSeconds > this.lifetimeSeconds) {
            return undefined;
        }

        return data;
    }

    save(latitude, longitude, data) {
        if (!this.isAvailable) {
            return;
        }

        localStorage.setItem(
            this.getKeyForLocation(latitude, longitude),
            JSON.stringify({
                data,
                timestamp: new Date().getTime(),
            })
        );
    }
}

class WeatherWidget extends React.Component {
    constructor(properties) {
        super(properties);
        this.state = {
            icon: 'unknown',
            temperature: {
                value: undefined,
                unit: 'C',
            },
            description: '-',
            location: '-',
            humidity: {
                value: undefined,
                unit: '%',
            },
            wind: {
                value: undefined,
                unit: 'm/s',
            },
            sunrise: undefined,
            sunset: undefined,
            notification: undefined,
        };
        this.openWeatherMapCache = new OpenWeatherMapCache();
    }

    setStateFromOpenWeatherMapResponseData(data) {
        this.setState({
            temperature: {
                value: this.kelvinToCelsius(data?.main?.temp),
                unit: 'C',
            },
            description: data?.weather?.[0]?.description ?? '',
            icon: data?.weather?.[0]?.icon ?? 'unknown',
            location: `${data?.name}, ${data?.sys?.country}`,
            humidity: {
                value: data?.main?.humidity,
                unit: '%',
            },
            wind: {
                value: Math.round(data?.wind?.speed),
                unit: 'm/s',
            },
            sunrise: data?.sys?.sunrise,
            sunset: data?.sys?.sunset,
            notification: undefined,
        });
    }

    getWeather(latitude, longitude) {
        const responseData = this.openWeatherMapCache.load(latitude, longitude);
        if (responseData) {
            console.debug('Using cached response data');
            this.setStateFromOpenWeatherMapResponseData(responseData);
        } else {
            console.debug('Update data from API');
            let api = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${OPENWEATHERMAP_API_KEY}`;
            fetch(api)
                .then(response => response.json())
                .then(data => {
                    this.setStateFromOpenWeatherMapResponseData(data);
                    console.debug('Save response data to cache');
                    this.openWeatherMapCache.save(latitude, longitude, data);
                });
        }
    }

    toggleTemperatureUnit() {
        this.setState({
            temperature: {
                ...this.state.temperature,
                unit: this.state.temperature.unit === 'C' ? 'F' : 'C',
            },
        });
    }

    kelvinToCelsius(temperature) {
        if (temperature === undefined) {
            return undefined;
        }

        return Math.round(temperature - 273);
    }

    celsiusToFahrenheit(temperature) {
        if (temperature === undefined) {
            return undefined;
        }

        return Math.round((temperature * 9/5) + 32);
    }

    formatTemperature(temperature) {
        if (temperature?.value === undefined) {
            return '- °';
        }

        const value = temperature.unit === 'F'
            ? this.celsiusToFahrenheit(temperature.value)
            : temperature.value;

        return value + ' °';
    }

    formatTime(timeInSeconds) {
        if (timeInSeconds === undefined) {
            return '--:--';
        }

        const datetime = new Date(timeInSeconds * 1000);
        return datetime.getHours().toString().padStart(2, '0') + ':' + datetime.getMinutes();
    }

    componentDidMount() {
        if ('geolocation' in navigator){
            navigator.geolocation.getCurrentPosition(
                position => this.getWeather(position.coords.latitude, position.coords.longitude),
                error => {
                    this.setState({
                        notification: error.message,
                    })
                }
            );
        } else {
            this.setState({
                notification: "Browser doesn't Support Geolocation",
            });
        }
    }

    render() {
        const e = React.createElement;
        return e('div', { className: 'container' },
            e('div', { className: 'app-title' }, 'Current weather'),
            this.state.notification ? e('div', { className: 'notification' }, this.state.notification) : undefined,
            e('div', { className: 'weather-container' },
                e('div', { className: 'weather-icon' },
                    e('img', {src: `icons/${this.state.icon}.png` }),
                ),
                e('div', { className: 'temperature-value', onClick: () => this.toggleTemperatureUnit()},
                    this.formatTemperature(this.state.temperature),
                    e('span', undefined, this.state.temperature.unit),
                ),
                e('div', { className: 'temperature-description' }, this.state.description ?? '-'),
                e('div', { className: 'location' }, this.state.location ?? '-'),
                e('div', { className: 'humidity' },
                    'Humidity: ' + (this.state.humidity.value ?? '-- '),
                    e('span', undefined, this.state.humidity.unit)
                ),
                e('div', {className: 'wind'},
                    'Wind: ' + (this.state.wind.value ?? '-- '),
                    e('span', undefined, ' ' + this.state.wind.unit)
                ),
                e('div', {className: 'sunrise'},
                    'Sunrise: ' + this.formatTime(this.state.sunrise)
                ),
                e('div', {className: 'sunset'},
                    'Sunset: ' + this.formatTime(this.state.sunset)
                ),
            )
        );
    }
}

ReactDOM.createRoot(document.getElementById('weather-widget')).render(React.createElement(WeatherWidget));
