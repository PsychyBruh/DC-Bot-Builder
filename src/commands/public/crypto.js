import { baseEmbed, COLORS } from "../utils/embeds.js";

export const name = "crypto";
export const description = "Get crypto price";
export const usage = "!crypto <coin> [currency]";
export const category = "utility";

const COINGECKO = {
  btc: "bitcoin", eth: "ethereum", doge: "dogecoin", ltc: "litecoin",
  sol: "solana", ada: "cardano", xrp: "ripple", bnb: "binancecoin",
  matic: "matic-network", dot: "polkadot", avax: "avalanche-2",
};

export async function execute(message, args) {
  const rawCoin = args[0]?.toLowerCase();
  if (!rawCoin) {
    return message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription("❌ Try: `!crypto btc` or `!crypto eth`")] });
  }
  const coin = COINGECKO[rawCoin] || rawCoin;
  const currency = (args[1] || "usd").toLowerCase();
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true`);
    if (!r.ok) {
      return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription("❌ Coin not found or rate limited")] });
    }
    const d = await r.json();
    const data = d[coin];
    if (!data) {
      return message.reply({ embeds: [baseEmbed(COLORS.warning).setDescription(`❌ No data for ${rawCoin}`)] });
    }
    const price = data[currency];
    const change = data[`${currency}_24h_change`]?.toFixed(2) || "—";
    const changeColor = change.startsWith("-") ? COLORS.danger : COLORS.success;
    const embed = baseEmbed(changeColor)
      .setTitle(`💰 ${rawCoin.toUpperCase()}`)
      .addFields(
        { name: "Price", value: `${currency.toUpperCase()} ${price.toLocaleString()}`, inline: true },
        { name: "24h Change", value: `${change}%`, inline: true },
        { name: "Market Cap", value: `${currency.toUpperCase()} ${(data[`${currency}_market_cap`] / 1e9).toFixed(2)}B`, inline: true },
      )
      .setFooter({ text: "CoinGecko" });
    await message.reply({ embeds: [embed] });
  } catch (err) {
    await message.reply({ embeds: [baseEmbed(COLORS.danger).setDescription(`❌ Failed: ${err.message}`)] });
  }
}
