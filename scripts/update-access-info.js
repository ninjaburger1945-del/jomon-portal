require('dotenv').config();
const fs = require('fs');
const path = require('path');

const FACILITIES_FILE = path.join(__dirname, '../app/data/facilities.json');
const API_KEY = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyBw1RQ9YWonSzccXmHPeVveikQDp_BUISg';

// Helpers
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithBackoff(url, options = {}, retries = 3, backoff = 1000) {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                let errorData = await response.text();
                try { errorData = JSON.parse(errorData); } catch (e) { }

                if (response.status === 429) {
                    console.log(`Rate limit exceeded, retrying in ${backoff}ms...`);
                    await sleep(backoff);
                    backoff *= 2; // Exponential backoff
                    continue;
                }

                console.error(`HTTP error! status: ${response.status}`, typeof errorData === 'object' ? JSON.stringify(errorData, null, 2) : errorData);
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Fetch failed, retrying in ${backoff}ms... (${error.message})`);
            await sleep(backoff);
            backoff *= 2;
        }
    }
}

// 1. Google Maps API calls
async function getNearestStation(lat, lng) {
    // Use Places API (New) - Text Search with location restriction
    console.log(`Finding nearest station for ${lat}, ${lng}...`);
    const url = 'https://places.googleapis.com/v1/places:searchText';

    const payload = {
        textQuery: "駅",
        languageCode: "ja",
        maxResultCount: 1,
        rankPreference: "DISTANCE",
        locationBias: {
            circle: {
                center: { latitude: lat, longitude: lng },
                radius: 10000.0 // 10km search
            }
        }
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'places.displayName,places.location'
        },
        body: JSON.stringify(payload)
    };

    const data = await fetchWithBackoff(url, options);

    if (data.places && data.places.length > 0) {
        return {
            name: data.places[0].displayName.text,
            location: {
                lat: data.places[0].location.latitude,
                lng: data.places[0].location.longitude
            }
        };
    }
    return null;
}

async function getDirections(originLat, originLng, destLat, destLng, travelMode = 'TRANSIT') {
    console.log(`Getting directions from ${originLat},${originLng} to ${destLat},${destLng} via ${travelMode}...`);
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';

    const payload = {
        origin: { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat, longitude: destLng } } },
        travelMode: travelMode,
        computeAlternativeRoutes: false,
        languageCode: "ja"
    };

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.legs'
        },
        body: JSON.stringify(payload)
    };

    return await fetchWithBackoff(url, options);
}

// 2. Main Logic
async function updateAccessInfo() {
    const rawData = fs.readFileSync(FACILITIES_FILE, 'utf8');
    const facilities = JSON.parse(rawData);
    let updatedCount = 0;

    for (let i = 0; i < facilities.length; i++) {
        const facility = facilities[i];
        console.log(`\nProcessing [${i + 1}/${facilities.length}]: ${facility.name}`);

        try {
            const station = await getNearestStation(facility.lat, facility.lng);
            if (!station) {
                console.warn(`No train station found near ${facility.name}`);
                facility.access = {
                    info: `[公共交通機関でのアクセス]\n最寄り駅が検索できませんでした。`,
                    rank: 'C',
                    advice: `[AIによる補足]\nこの施設はアクセス難易度【C】です。公共交通機関での到達が困難なため、「レンタカー」の利用が必須となります。`
                };
                continue;
            }

            const stationName = station.name;
            const stationLocation = station.location;

            // Walk from Station
            let walkingData = await getDirections(stationLocation.lat, stationLocation.lng, facility.lat, facility.lng, 'WALK');
            let walkDurationSecs = 999999;
            if (walkingData.routes && walkingData.routes.length > 0) {
                walkDurationSecs = parseInt(walkingData.routes[0].duration.replace('s', ''), 10);
            }

            // Transit from Station
            let transitData = await getDirections(stationLocation.lat, stationLocation.lng, facility.lat, facility.lng, 'TRANSIT');
            let hasBus = false;
            let busLineName = '路線バス';
            let busStopOut = '最寄りバス停';
            let busWalkTime = 0;

            if (transitData.routes && transitData.routes.length > 0 && transitData.routes[0].legs) {
                const leg = transitData.routes[0].legs[0];
                if (leg.steps) {
                    for (const step of leg.steps) {
                        if (step.transitDetails) {
                            const td = step.transitDetails;
                            if (td.transitLine && td.transitLine.vehicle) {
                                hasBus = true; // Any non-walking transit is considered a "Bus/Tram" ride for this logic
                                busLineName = td.transitLine.name || td.transitLine.vehicle.name || '路線バス';
                                busStopOut = td.stopDetails && td.stopDetails.arrivalStop && td.stopDetails.arrivalStop.name ? td.stopDetails.arrivalStop.name : busStopOut;
                            }
                        }

                        if (hasBus && step.navigationInstruction && step.navigationInstruction.instructions && step.navigationInstruction.instructions.includes('Walk')) {
                            if (step.distanceMeters) {
                                busWalkTime += Math.ceil((step.distanceMeters / 1) / 60);
                            }
                        } else if (hasBus && !step.transitDetails && step.distanceMeters) {
                            busWalkTime += Math.ceil((step.distanceMeters / 1) / 60);
                        }
                    }
                }
            }

            if (i === 0) {
                console.log("\n--- DEBUG (First Facility Walk) ---");
                console.log("Walk Mins:", Math.ceil(walkDurationSecs / 60));
                console.log("\n--- DEBUG (First Facility Transit) ---");
                console.log("Has Bus:", hasBus, "Bus Line:", busLineName, "Bus Walk:", busWalkTime);
                if (transitData && transitData.routes && transitData.routes.length > 0) {
                    console.log("Transit Legs Snippet:", JSON.stringify(transitData.routes[0].legs[0], null, 2).slice(0, 500) + '...');
                } else {
                    console.log("Transit API returned no active routes or data.");
                    console.log("Full Transit Response:", JSON.stringify(transitData, null, 2));
                }
            }

            // Determine Rank and Format Output
            let rank = 'C';
            let infoText = '';
            let adviceText = '';

            const walkMins = Math.ceil(walkDurationSecs / 60);

            if (walkMins <= 5) {
                rank = 'S';
                infoText = `[公共交通機関でのアクセス]\n「${stationName}」より徒歩約${walkMins}分。`;
                adviceText = `[AIによる補足]\nこの施設はアクセス難易度【S】です。駅から非常に近く、スムーズに到着できます。`;
            }
            else if (walkMins <= 10) {
                rank = 'A';
                infoText = `[公共交通機関でのアクセス]\n「${stationName}」より徒歩約${walkMins}分。`;
                if (hasBus) {
                    infoText += `\nまたは、「${stationName}」より${busLineName}に乗車、[${busStopOut}]下車徒歩約${busWalkTime}分。`;
                }
                adviceText = `[AIによる補足]\nこの施設はアクセス難易度【A】です。公共交通機関のみでのアクセスが容易です。`;
            }
            else if (hasBus && busWalkTime <= 10) {
                rank = 'A';
                infoText = `[公共交通機関でのアクセス]\n「${stationName}」より${busLineName}に乗車、[${busStopOut}]下車徒歩約${busWalkTime}分。`;
                adviceText = `[AIによる補足]\nこの施設はアクセス難易度【A】です。バスの運行本数には限りがある場合があるため、事前の時刻表確認を推奨します。`;
            }
            else if (walkMins <= 15 || (hasBus && busWalkTime <= 15)) {
                rank = 'B';
                if (hasBus) {
                    infoText = `[公共交通機関でのアクセス]\n「${stationName}」より${busLineName}に乗車、[${busStopOut}]下車徒歩約${busWalkTime}分。`;
                } else {
                    infoText = `[公共交通機関でのアクセス]\n「${stationName}」より徒歩約${walkMins}分。`;
                }
                adviceText = `[AIによる補足]\nこの施設はアクセス難易度【B】です。バス本数が少ないか、最寄りから距離があるため、「車・タクシー」での来訪も併せてご検討ください。`;
            }
            else {
                rank = 'C';
                infoText = `[公共交通機関でのアクセス]\n最寄り駅「${stationName}」から距離があります（徒歩約${walkMins}分）。`;
                adviceText = `[AIによる補足]\nこの施設はアクセス難易度【C】です。公共交通機関での到達が困難なため、「レンタカー必須」またはタクシーの利用を強く推奨します。`;
            }

            // Update the facility access object only
            facility.access = {
                info: infoText,
                rank: rank,
                advice: adviceText
            };

            updatedCount++;

            // Small delay to respect rate limits
            await sleep(200);

        } catch (err) {
            console.error(`Error processing ${facility.name}:`, err.message);
        }
    }

    // Save changes
    fs.writeFileSync(FACILITIES_FILE, JSON.stringify(facilities, null, 2), 'utf8');
    console.log(`\nSuccessfully updated ${updatedCount} facilities.`);
}

updateAccessInfo().catch(console.error);
