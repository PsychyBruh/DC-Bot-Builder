import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "weather";
export const description = "Current weather for a city";
export const usage = "!weather <city>";
export const category = "utility";

export async function execute(message, args) {
  const city = args.join(" ");
  if (!city) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Provide a city: `!weather Tokyo`")] });
  }
  try {
    const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
    const geoData = await geo.json();
    if (!geoData.results?.length) {
      return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`❌ City not found: ${city}`)] });
    }
    const { latitude, longitude, name, country } = geoData.results[0];
    const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=celsius`);
    const wxData = await wx.json();
    const c = wxData.current;
    const codeMap = {
      0: "☀️ Clear", 1: "🌤️ Mainly clear", 2: "⛅ Partly cloudy", 3: "☁️ Overcast",
      45: "🌫️ Fog", 48: "🌫️ Frost fog",
      51: "🌦️ Light drizzle", 53: "🌦️ Drizzle", 55: "🌧️ Heavy drizzle",
      61: "🌧️ Light rain", 63: "🌧️ Rain", 65: "🌧️ Heavy rain",
      71: "🌨️ Light snow", 73: "🌨️ Snow", 75: "🌨️ Heavy snow",
      80: "🌦️ Showers", 81: "🌧️ Heavy showers", 82: "⛈️ Violent showers",
      95: "⛈️ Thunderstorm", 96: "⛈️ Thunder + hail", 99: "⛈️ Severe thunder",
    };
    const desc = codeMap[c.weather_code] || `Code ${c.weather_code}`;
    const embed = baseEmbed(COLORS.info)
      .setTitle(`🌤️ Weather in ${name}, ${country}`)
      .addFields(
        { name: "🌡️ Temperature", value: `${c.temperature_2m}°C`, inline: true },
        { name: "💧 Humidity", value: `${c.relative_humidity_2m}%`, inline: true },
        { name: "💨 Wind", value: `${c.wind_speed_10m} km/h`, inline: true },
        { name: "☁️ Conditions", value: desc, inline: false },
      )
      .setFooter({ text: "Open-Meteo API" });
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Failed to fetch weather: ${err.message}`)] });
  }
}
