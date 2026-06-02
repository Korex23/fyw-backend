const https = require("https");
const fs = require("fs");

async function getFlutterWaveTransactions(secretKey) {
  const options = {
    hostname: "api.flutterwave.com",
    port: 443,
    path: "/v3/transactions",
    method: "GET",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

// Main execution
const secretKey = "FLWSECK-2b6ee003d5aeecf255d5eeb29ec145fc-19cd72cf86cvt-X";

if (!secretKey) {
  console.error(
    "Error: FLUTTERWAVE_SECRET_KEY environment variable is not set",
  );
  process.exit(1);
}

getFlutterWaveTransactions(secretKey)
  .then((response) => {
    const output = `Status: ${response.status}\n\nTransactions:\n${JSON.stringify(response.data, null, 2)}`;
    const filename = `transactions-${new Date().toISOString().split("T")[0]}.txt`;

    fs.writeFileSync(filename, output, "utf8");
    console.log(`✓ Transactions written to ${filename}`);
  })
  .catch((error) => {
    console.error("Error fetching transactions:", error.message);
    process.exit(1);
  });
