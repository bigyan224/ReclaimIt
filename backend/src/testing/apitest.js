// Node 18+ (built-in fetch)
const url = "http://192.168.16.103:8000/score";

const payload = {
  sourceItem: {
    itemId: "lost-123",
    itemName: "Black HP laptop",
    description: "Lost near the library",
    category: "electronics",
    color: "black",
    brandName: "HP",
    dateTime: "2024-05-01T10:30:00Z",
    location: { coordinates: [85.3240, 27.7172] }
  },
  candidates: [
    {
      candidateId: "found-1",
      itemName: "HP laptop",
      description: "Found outside library",
      category: "electronics",
      color: "black",
      brandName: "HP",
      dateTime: "2024-05-01T12:00:00Z",
      location: { coordinates: [85.3235, 27.7170] }
    },
    {
      candidateId: "found-2",
      itemName: "Blue backpack",
      description: "Found at cafeteria",
      category: "accessories",
      color: "blue",
      brandName: "Nike",
      dateTime: "2024-05-03T09:00:00Z",
      location: { coordinates: [85.3200, 27.7160] }
    },
    {
      candidateId: "found-3",
      itemName: "red car",
      description: " cafe",
      category: "acce",
      color: "white",
      brandName: "polo",
      dateTime: "2024-05-03T09:00:00Z",
      location: { coordinates: [85.3200, 27.7160] }
    },
     {
      candidateId: "found-4",
      itemName: "computer",
      description: "computer found library",
      category: "electronics",
      color: "black",
      brandName: "",
      dateTime: "2024-05-01T12:00:00Z",
      location: { coordinates: [25.3235, 87.7170] }
    },
  ]
};

async function scoreMatches() {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  console.log(data); // [{ candidateId, matchScore, confidence }, ...]
}

scoreMatches().catch(console.error);