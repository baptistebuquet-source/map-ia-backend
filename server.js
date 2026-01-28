import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

/* =====================
   SEARCH
===================== */
app.post("/search", async (req, res) => {
  const { query } = req.body;
  if (!query) return res.json([]);

  try {
    // Recherche principale
    const searchRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=fr&key=${process.env.GOOGLE_MAPS_KEY}`
    );
    const searchData = await searchRes.json();

    const results = [];

    for (const place of searchData.results.slice(0, 5)) {
      // Détails précis
      const detailsRes = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,geometry,formatted_phone_number,website&language=fr&key=${process.env.GOOGLE_MAPS_KEY}`
      );

      const details = await detailsRes.json();
      if (!details.result?.geometry) continue;

      results.push({
        name: details.result.name,
        address: details.result.formatted_address,
        latitude: details.result.geometry.location.lat,
        longitude: details.result.geometry.location.lng,
        phone: details.result.formatted_phone_number,
        website: details.result.website
      });
    }

    res.json(results);

  } catch (err) {
    console.error(err);
    res.json([]);
  }
});

/* =====================
   START
===================== */
app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000");
});

