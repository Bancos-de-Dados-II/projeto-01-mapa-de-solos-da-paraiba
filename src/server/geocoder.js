const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

export function createNominatimGeocoder({
  endpoint = NOMINATIM_URL,
  fetchImpl = globalThis.fetch
} = {}) {
  return {
    async search(query) {
      const url = new URL(endpoint);
      url.searchParams.set("q", `${query}, Paraiba, Brasil`);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "5");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("bounded", "1");
      url.searchParams.set("viewbox", "-38.9,-6.0,-34.4,-8.6");

      const response = await fetchImpl(url, {
        headers: {
          "User-Agent": "mapa-solos-paraiba/1.0"
        }
      });

      if (!response.ok) {
        const error = new Error("Servico de geocodificacao indisponivel.");
        error.statusCode = 502;
        throw error;
      }

      const payload = await response.json();
      return payload.map((item) => ({
        label: item.display_name,
        lat: Number(item.lat),
        lon: Number(item.lon)
      }));
    }
  };
}
