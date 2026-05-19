# SG Bus Timings

Expo mobile app for Singapore bus arrivals using LTA DataMall Bus Arrival v3 and OpenStreetMap tiles.

## Features

- Search Singapore bus stops by stop code, road, or landmark.
- View bus stops on an OpenStreetMap/Leaflet map.
- Render bus stop markers based on the current map viewport, with markers hidden when zoomed too far out.
- Jump to current location with a dedicated locate control.
- Pull-up drawer for selected bus stop details and live arrivals.
- Arrival rows sorted by bus service number.
- Operator-colored bus number badges.
- Crowd-density indicator for each arriving bus.
- Wheelchair-accessible arrival indicator.
- Flexoki light, dark, and system theme modes.
- Local storage for the LTA AccountKey and bus-stop cache.

## Requirements

- Node.js and npm.
- Expo Go or an iOS/Android simulator.
- LTA DataMall AccountKey from <https://datamall.lta.gov.sg/>.

This app uses LTA DataMall `v3/BusArrival` for live timings and `BusStops` for the searchable stop cache.

## Setup

```sh
npm install
```

Start the Expo dev server:

```sh
npm start
```

For local-only testing:

```sh
npm start -- --host localhost
```

Open the app, go to Settings, paste your LTA DataMall AccountKey, then sync bus stops.

## Scripts

```sh
npm start       # start Expo
npm run android # open Android target
npm run ios     # open iOS target
npm run web     # open web target
npm run typecheck
```

## Notes

- Arrival timings refresh every 20 seconds while a stop is selected.
- The AccountKey is stored locally on the device via AsyncStorage.
- Bus stop data is cached locally after sync; live arrivals still come from LTA.
- OpenStreetMap tiles are loaded inside a WebView-backed Leaflet map.
